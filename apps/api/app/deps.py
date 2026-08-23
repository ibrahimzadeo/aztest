"""Shared API state: the database pool, the Redis queue and the shared-key auth."""

from __future__ import annotations

import os

import redis.asyncio as aioredis
from fastapi import Header, HTTPException, Query

from azbench.db import Database
from azbench.nexum import DEFAULT_BASE_URL, NexumClient
from azbench.secrets import decrypt

QUEUE_KEY = "aztest:runs"

db = Database()
_redis: aioredis.Redis | None = None


def redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            os.environ.get("REDIS_URL", "redis://localhost:6379/0"), decode_responses=True
        )
    return _redis


async def enqueue_run(run_id: str) -> None:
    await redis().rpush(QUEUE_KEY, str(run_id))


def api_key() -> str:
    return os.environ.get("AZTEST_API_KEY", "")


async def require_key(
    x_az_key: str | None = Header(default=None),
    key: str | None = Query(default=None),
) -> None:
    """Shared-key auth. An empty AZTEST_API_KEY disables it (local dev only).
    The query fallback exists for browser contexts that cannot send headers."""
    expected = api_key()
    if not expected:
        return
    if (x_az_key or key) != expected:
        raise HTTPException(status_code=401, detail="unauthorized")


# ---- provider config, stored in the DB because it is set in the UI ----
async def provider_config() -> dict:
    cfg = await db.get_setting("provider", {}) or {}
    base_url = cfg.get("base_url") or os.environ.get("NEXUM_BASE_URL") or DEFAULT_BASE_URL
    stored = cfg.get("api_key_enc")
    plain = decrypt(stored) if stored else os.environ.get("NEXUM_API_KEY", "")
    return {"base_url": base_url, "api_key": plain, "has_key": bool(plain)}


async def provider_client() -> NexumClient:
    cfg = await provider_config()
    if not cfg["api_key"]:
        raise HTTPException(
            status_code=400,
            detail="No provider API key configured — add it under Settings → Provider.",
        )
    return NexumClient(cfg["api_key"], cfg["base_url"])


async def judge_config() -> dict:
    cfg = await db.get_setting("judge", {}) or {}
    return {
        "enabled": cfg.get("enabled", True),
        "model": cfg.get("model") or os.environ.get("JUDGE_MODEL", ""),
        "max_output_tokens": int(cfg.get("max_output_tokens") or 2000),
        "input_price_per_m": float(cfg.get("input_price_per_m") or 0),
        "output_price_per_m": float(cfg.get("output_price_per_m") or 0),
    }


async def run_defaults() -> dict:
    cfg = await db.get_setting("run_defaults", {}) or {}
    return {
        # Nexum returns 429 at concurrency 4 — 3 is the safe ceiling and the
        # default, not a starting point to raise casually.
        "concurrency": int(cfg.get("concurrency") or 3),
        "temperature": cfg.get("temperature", 0.7),
        # Reasoning models spend completion tokens thinking before they write
        # anything, so a tight cap returns an empty answer rather than a short
        # one. Per-model overrides live in the model roster.
        "max_output_tokens": int(cfg.get("max_output_tokens") or 4000),
    }
