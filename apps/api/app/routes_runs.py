"""Runs: a suite (or ad-hoc playground prompt) × the selected models.

The API only *plans* a run — it writes one PENDING generation per task×model
and hands the run id to the worker over Redis. Nothing here calls a model, so
a slow provider can never block the UI.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from azbench.nexum import SAFE_CONCURRENCY

from .deps import db, enqueue_run, judge_config, require_key, run_defaults

router = APIRouter(prefix="/api/v1", dependencies=[Depends(require_key)])


class RunIn(BaseModel):
    suite_id: str | None = None
    task_ids: list[str] = []
    models: list[str] = Field(min_length=1)
    label: str = ""
    judge_enabled: bool | None = None
    judge_model: str | None = None
    concurrency: int | None = Field(default=None, ge=1, le=10)
    temperature: float | None = None
    max_output_tokens: int | None = None


class PlaygroundIn(BaseModel):
    prompt: str
    system_prompt: str = ""
    models: list[str] = Field(min_length=1)
    label: str = ""
    judge_enabled: bool = False
    temperature: float | None = None
    max_output_tokens: int | None = None


@router.post("/runs", status_code=201)
async def create_run(body: RunIn) -> dict:
    tasks = []
    if body.suite_id:
        suite = await db.suite(body.suite_id)
        if not suite:
            raise HTTPException(status_code=404, detail="suite not found")
        tasks = [t for t in suite["tasks"] if t["enabled"]]
    elif body.task_ids:
        tasks = await db.tasks_by_ids(body.task_ids)
    if not tasks:
        raise HTTPException(status_code=400, detail="no enabled tasks selected")

    defaults, judge = await run_defaults(), await judge_config()
    judge_on = judge["enabled"] if body.judge_enabled is None else body.judge_enabled
    judge_model = body.judge_model or judge["model"]
    if judge_on and not judge_model:
        raise HTTPException(
            status_code=400,
            detail="Judge is on but no judge model is set — pick one under Settings → Judge.",
        )

    run = await db.create_run(
        kind="suite",
        label=body.label or (await _suite_label(body.suite_id) if body.suite_id else "Seçilmiş tapşırıqlar"),
        suite_id=body.suite_id,
        models=body.models,
        judge_model=judge_model if judge_on else "",
        judge_enabled=judge_on,
        concurrency=body.concurrency or defaults["concurrency"],
        temperature=body.temperature if body.temperature is not None else defaults["temperature"],
        max_output_tokens=body.max_output_tokens or defaults["max_output_tokens"],
    )
    for task in tasks:
        for model_id in body.models:
            await db.create_generation(
                run_id=str(run["id"]), task_id=str(task["id"]), task_code=task["code"],
                task_title=task["title"], model_id=model_id, prompt=task["prompt"],
                system_prompt=task["system_prompt"],
            )
    await enqueue_run(str(run["id"]))
    return {**run, "planned": len(tasks) * len(body.models)}


@router.post("/playground", status_code=201)
async def playground(body: PlaygroundIn) -> dict:
    """An ad-hoc prompt across N models. Stored as a run so the playground
    shares one results surface with the graded suites."""
    if not body.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt is required")
    judge = await judge_config()
    defaults = await run_defaults()
    if body.judge_enabled and not judge["model"]:
        raise HTTPException(status_code=400, detail="no judge model configured")
    run = await db.create_run(
        kind="playground",
        label=body.label or _snippet(body.prompt),
        models=body.models,
        judge_model=judge["model"] if body.judge_enabled else "",
        judge_enabled=body.judge_enabled,
        concurrency=defaults["concurrency"],
        temperature=body.temperature if body.temperature is not None else defaults["temperature"],
        max_output_tokens=body.max_output_tokens or defaults["max_output_tokens"],
    )
    for model_id in body.models:
        await db.create_generation(
            run_id=str(run["id"]), task_id=None, task_code="AD-HOC",
            task_title=_snippet(body.prompt), model_id=model_id,
            prompt=body.prompt, system_prompt=body.system_prompt,
        )
    await enqueue_run(str(run["id"]))
    return {**run, "planned": len(body.models)}


@router.get("/runs")
async def list_runs(limit: int = 50, kind: str | None = None) -> dict:
    return {"runs": await db.runs(limit=limit, kind=kind), "safe_concurrency": SAFE_CONCURRENCY}


@router.get("/runs/{run_id}")
async def get_run(run_id: str) -> dict:
    run = await db.run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    gens = await db.generations(run_id)
    return {
        "run": run,
        "generations": gens,
        "models": sorted({g["model_id"] for g in gens}),
        "tasks": _ordered_tasks(gens),
    }


@router.post("/runs/{run_id}/cancel")
async def cancel_run(run_id: str) -> dict:
    run = await db.run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    if run["status"] in ("COMPLETED", "FAILED", "CANCELLED"):
        return {"status": run["status"]}
    await db.set_run_status(run_id, "CANCELLED")
    return {"status": "CANCELLED"}


@router.delete("/runs/{run_id}")
async def delete_run(run_id: str) -> dict:
    """Discard a run and its answers. The leaderboard aggregates every run, so
    a run made under a broken configuration has to be removable — otherwise a
    model that was never given room to answer looks permanently bad."""
    run = await db.run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    if run["status"] in ("QUEUED", "RUNNING"):
        raise HTTPException(
            status_code=409,
            detail="cancel the run before deleting it",
        )
    await db.delete_run(run_id)
    return {"deleted": run_id}


@router.get("/generations/{gen_id}")
async def get_generation(gen_id: str) -> dict:
    gen = await db.generation(gen_id)
    if not gen:
        raise HTTPException(status_code=404, detail="generation not found")
    return {"generation": gen, "ratings": await db.ratings_for(gen_id)}


def _ordered_tasks(gens: list[dict]) -> list[dict]:
    seen: dict[str, dict] = {}
    for g in gens:
        seen.setdefault(g["task_code"], {"code": g["task_code"], "title": g["task_title"]})
    return list(seen.values())


async def _suite_label(suite_id: str) -> str:
    suite = await db.suite(suite_id)
    return suite["name"] if suite else "Dəst"


def _snippet(text: str, n: int = 60) -> str:
    flat = " ".join((text or "").split())
    return flat[:n] + ("…" if len(flat) > n else "")
