"""AzTest worker: drains the run queue, calls the models, scores the output.

Per run: claim → generate every task×model with bounded concurrency → run the
deterministic checks → judge (also bounded) → totals. Concurrency is capped
globally because the provider returns 429 at 4 in flight, and a rate-limited
generation would otherwise land in the leaderboard as a quality signal.
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import time

import redis.asyncio as aioredis

from azbench.checks import run_checks
from azbench.db import Database
from azbench.judge import JudgeError, judge_output
from azbench.nexum import SAFE_CONCURRENCY, DEFAULT_BASE_URL, NexumClient, ProviderError, cost_usd
from azbench.secrets import decrypt

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("aztest.worker")

QUEUE_KEY = "aztest:runs"
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
# Hard ceiling regardless of what a run asks for: the provider 429s at 4.
MAX_CONCURRENCY = int(os.environ.get("MAX_CONCURRENCY", SAFE_CONCURRENCY))
CANCEL_POLL_SECONDS = 5.0

_stopping = asyncio.Event()


async def provider(db: Database) -> NexumClient:
    """Credentials live in the DB because they are entered in the UI; env is
    the fallback so a fresh deploy can come up already wired."""
    cfg = await db.get_setting("provider", {}) or {}
    base_url = cfg.get("base_url") or os.environ.get("NEXUM_BASE_URL") or DEFAULT_BASE_URL
    key = decrypt(cfg["api_key_enc"]) if cfg.get("api_key_enc") else os.environ.get("NEXUM_API_KEY", "")
    return NexumClient(key, base_url)


async def judge_settings(db: Database) -> dict:
    cfg = await db.get_setting("judge", {}) or {}
    return {
        "max_output_tokens": int(cfg.get("max_output_tokens") or 2000),
        "input_price_per_m": float(cfg.get("input_price_per_m") or 0),
        "output_price_per_m": float(cfg.get("output_price_per_m") or 0),
    }


async def execute_run(db: Database, run_id: str) -> None:
    run = await db.run(run_id)
    if not run:
        log.error("run %s not found", run_id)
        return
    if run["status"] == "CANCELLED":
        log.info("run %s was cancelled before it started", run_id)
        return

    await db.set_run_status(run_id, "RUNNING")
    started = time.monotonic()
    try:
        client = await provider(db)
    except ProviderError as exc:
        await db.set_run_status(run_id, "FAILED", error=str(exc))
        log.error("run %s: %s", run_id, exc)
        return

    # A previous worker may have died mid-run (a redeploy, usually), leaving
    # rows in RUNNING that nothing will ever finish.
    reclaimed = await db.reset_inflight(run_id)
    if reclaimed:
        log.info("run %s: reset %d abandoned generation(s) to PENDING", run_id, reclaimed)
    gens = [g for g in await db.generations(run_id) if g["status"] == "PENDING"]
    concurrency = max(1, min(int(run["concurrency"] or MAX_CONCURRENCY), MAX_CONCURRENCY))
    log.info("run %s: %d generation(s) at concurrency %d", run_id, len(gens), concurrency)

    # Per-model pricing is operator-set (the provider is flat-fee), so read
    # the roster once rather than per generation.
    roster = {m["model_id"]: m for m in await db.models()}
    jcfg = await judge_settings(db)
    sem = asyncio.Semaphore(concurrency)
    cancelled = asyncio.Event()

    async def watch_cancel() -> None:
        while not cancelled.is_set():
            await asyncio.sleep(CANCEL_POLL_SECONDS)
            if await db.run_status(run_id) == "CANCELLED":
                cancelled.set()
                return

    async def one(gen: dict) -> None:
        if cancelled.is_set():
            return
        async with sem:
            if cancelled.is_set():
                return
            await _generate_and_score(db, client, gen, run, roster, jcfg)

    watcher = asyncio.create_task(watch_cancel())
    try:
        await asyncio.gather(*(one(g) for g in gens))
    finally:
        cancelled.set()
        watcher.cancel()

    done = await db.generations(run_id)
    totals = {
        "generations": len(done),
        "errors": sum(1 for g in done if g["status"] == "ERROR"),
        "judged": sum(1 for g in done if g["judge_status"] == "DONE"),
        "judge_errors": sum(1 for g in done if g["judge_status"] == "ERROR"),
        "cost_usd": round(sum(float(g["cost"] or 0) + float(g["judge_cost"] or 0) for g in done), 6),
        "output_tokens": sum(int(g["completion_tokens"] or 0) for g in done),
        "wall_seconds": round(time.monotonic() - started, 1),
    }
    await db.set_run_totals(run_id, totals)
    final = await db.run_status(run_id)
    if final == "CANCELLED":
        log.info("run %s cancelled: %s", run_id, totals)
        return
    status = "FAILED" if totals["errors"] == totals["generations"] and totals["generations"] else "COMPLETED"
    await db.set_run_status(run_id, status)
    log.info("run %s %s: %s", run_id, status, totals)


async def _generate_and_score(db, client, gen, run, roster, jcfg) -> None:
    model_cfg = roster.get(gen["model_id"], {})
    await db.mark_generation_running(gen["id"])
    try:
        completion = await client.complete(
            gen["model_id"],
            gen["prompt"],
            system=gen["system_prompt"] or None,
            temperature=_num(model_cfg.get("temperature"), run["temperature"]),
            max_tokens=int(model_cfg.get("max_output_tokens") or run["max_output_tokens"] or 4000),
        )
    except ProviderError as exc:
        await db.finish_generation(gen["id"], status="ERROR", error=str(exc)[:2000])
        await db.save_judge(gen["id"], status="SKIPPED", error="generation failed")
        log.warning("gen %s (%s) failed: %s", gen["id"], gen["model_id"], exc)
        return

    cost = cost_usd(
        completion.prompt_tokens,
        completion.completion_tokens,
        model_cfg.get("input_price_per_m") or 0,
        model_cfg.get("output_price_per_m") or 0,
    )
    # An answer that never arrived is a configuration failure, not bad
    # writing. Scoring it would put a reasoning model that blew its token
    # budget on the leaderboard as if it wrote badly — so record why, keep the
    # tokens and cost it really spent, and never hand it to the judge.
    empty = completion.emptiness_reason()
    if empty:
        await db.finish_generation(
            gen["id"], status="ERROR", error=empty,
            prompt_tokens=completion.prompt_tokens,
            completion_tokens=completion.completion_tokens,
            cost=cost, latency_ms=completion.latency_ms,
            finish_reason=completion.finish_reason,
        )
        await db.save_judge(gen["id"], status="SKIPPED", error="no answer to score")
        log.warning("gen %s (%s): %s", gen["id"], gen["model_id"], empty)
        return

    checks = run_checks(completion.text)
    await db.finish_generation(
        gen["id"], status="DONE", output=completion.text,
        prompt_tokens=completion.prompt_tokens, completion_tokens=completion.completion_tokens,
        cost=cost, latency_ms=completion.latency_ms, checks=checks,
        mechanics_score=checks["mechanics_score"],
        finish_reason=completion.finish_reason,
    )
    if completion.truncated:
        log.info("gen %s (%s): answer was cut off at the token cap", gen["id"], gen["model_id"])

    if not (run["judge_enabled"] and run["judge_model"]):
        await db.save_judge(gen["id"], status="OFF")
        return
    try:
        verdict = await judge_output(
            client, run["judge_model"], gen["prompt"], completion.text,
            max_tokens=jcfg["max_output_tokens"],
        )
    except (JudgeError, ProviderError) as exc:
        await db.save_judge(gen["id"], status="ERROR", error=str(exc)[:2000])
        log.warning("judge failed for gen %s: %s", gen["id"], exc)
        return
    judge_cost = cost_usd(
        verdict.get("prompt_tokens", 0), verdict.get("completion_tokens", 0),
        jcfg["input_price_per_m"], jcfg["output_price_per_m"],
    )
    await db.save_judge(gen["id"], status="DONE", judge=verdict, cost=judge_cost)


def _num(primary, fallback):
    for value in (primary, fallback):
        if value is not None:
            return float(value)
    return None


async def main() -> None:
    db = Database()
    await db.connect(max_size=5)
    redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    log.info("worker up; queue=%s max_concurrency=%d", QUEUE_KEY, MAX_CONCURRENCY)

    # Anything left RUNNING belongs to a container that died mid-run (a
    # redeploy, usually). Reclaim it rather than leaving a run spinning
    # forever in the UI.
    stale = await db.fetch("select id::text as id from runs where status = 'RUNNING'")
    for row in stale:
        log.info("reclaiming interrupted run %s", row["id"])
        await redis.rpush(QUEUE_KEY, row["id"])

    while not _stopping.is_set():
        item = await redis.blpop(QUEUE_KEY, timeout=5)
        if not item:
            continue
        run_id = item[1]
        try:
            await execute_run(db, run_id)
        except Exception as exc:  # noqa: BLE001 — one bad run must not kill the worker
            log.exception("run %s crashed", run_id)
            await db.set_run_status(run_id, "FAILED", error=f"{type(exc).__name__}: {exc}")

    await redis.close()
    await db.close()


if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _stopping.set)
    loop.run_until_complete(main())
