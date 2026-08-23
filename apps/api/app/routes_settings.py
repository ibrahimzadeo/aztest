"""Settings: provider credentials, the model roster, the judge, run defaults.

Everything here is configured in the UI and stored in the database; env vars
are only a fallback so a fresh deploy can come up pre-wired.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from azbench.nexum import SAFE_CONCURRENCY, NexumClient, ProviderError
from azbench.secrets import encrypt, mask

from .deps import db, judge_config, provider_client, provider_config, require_key, run_defaults

router = APIRouter(prefix="/api/v1", dependencies=[Depends(require_key)])


class ProviderIn(BaseModel):
    base_url: str | None = None
    api_key: str | None = None  # omitted = keep, "" = clear


class JudgeIn(BaseModel):
    enabled: bool = True
    model: str = ""
    max_output_tokens: int = 2000
    input_price_per_m: float = 0
    output_price_per_m: float = 0


class DefaultsIn(BaseModel):
    concurrency: int = Field(default=SAFE_CONCURRENCY, ge=1, le=10)
    temperature: float | None = 0.7
    max_output_tokens: int = Field(default=1500, ge=64, le=32000)


class ModelIn(BaseModel):
    model_id: str
    label: str = ""
    enabled: bool = True
    input_price_per_m: float = 0
    output_price_per_m: float = 0
    max_output_tokens: int | None = None
    temperature: float | None = None
    notes: str = ""


@router.get("/settings")
async def get_settings() -> dict:
    provider = await provider_config()
    return {
        "provider": {
            "base_url": provider["base_url"],
            "has_key": provider["has_key"],
            "key_masked": mask(provider["api_key"]),
        },
        "judge": await judge_config(),
        "defaults": await run_defaults(),
        "safe_concurrency": SAFE_CONCURRENCY,
    }


@router.put("/settings/provider")
async def put_provider(body: ProviderIn) -> dict:
    cfg = await db.get_setting("provider", {}) or {}
    if body.base_url is not None:
        cfg["base_url"] = body.base_url.strip().rstrip("/")
    if body.api_key is not None:
        cfg["api_key_enc"] = encrypt(body.api_key.strip()) if body.api_key.strip() else None
    await db.set_setting("provider", cfg)
    return await get_settings()


@router.put("/settings/judge")
async def put_judge(body: JudgeIn) -> dict:
    await db.set_setting("judge", body.model_dump())
    return await get_settings()


@router.put("/settings/defaults")
async def put_defaults(body: DefaultsIn) -> dict:
    await db.set_setting("run_defaults", body.model_dump())
    return await get_settings()


@router.post("/settings/probe")
async def probe() -> dict:
    """One live call to the provider so the operator knows the key works
    before a run spends anything against it."""
    try:
        client = await provider_client()
        models = await client.list_models()
    except HTTPException:
        raise
    except ProviderError as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "model_count": len(models), "base_url": client.base_url}


@router.get("/provider/models")
async def catalog() -> dict:
    """Live provider catalog. Always read from /models — the provider's
    marketing page under-reports what the API actually serves."""
    client = await provider_client()
    try:
        models = await client.list_models()
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    roster = {m["model_id"] for m in await db.models()}
    return {
        "base_url": client.base_url,
        "models": [
            {
                "id": m["id"],
                "owned_by": m.get("owned_by") or "",
                "context_length": m.get("context_length"),
                "in_roster": m["id"] in roster,
            }
            for m in models
        ],
    }


@router.get("/models")
async def list_models(enabled_only: bool = False) -> dict:
    return {"models": await db.models(enabled_only=enabled_only)}


@router.post("/models")
async def upsert_model(body: ModelIn) -> dict:
    if not body.model_id.strip():
        raise HTTPException(status_code=400, detail="model_id is required")
    return await db.upsert_model(**body.model_dump())


@router.delete("/models/{model_id:path}")
async def delete_model(model_id: str) -> dict:
    await db.delete_model(model_id)
    return {"deleted": model_id}
