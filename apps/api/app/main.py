"""AzTest API — Azerbaijani LLM writing benchmark."""

from __future__ import annotations

import logging
import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from azbench.rubric import DIMENSIONS

from . import routes_library, routes_reports, routes_results, routes_runs, routes_settings
from .deps import db, redis, require_key

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("aztest.api")

app = FastAPI(title="AzTest API", version="1.0.0")

origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    await db.connect()
    log.info("database pool ready")


@app.on_event("shutdown")
async def shutdown() -> None:
    await db.close()


@app.get("/api/v1/health")
async def health() -> dict:
    """Effective-config echo: enough to verify a deploy in one call."""
    status = {"status": "ok", "db": False, "redis": False}
    try:
        await db.fetchrow("select 1 as ok")
        status["db"] = True
    except Exception as exc:  # noqa: BLE001
        status["db_error"] = str(exc)[:200]
    try:
        await redis().ping()
        status["redis"] = True
    except Exception as exc:  # noqa: BLE001
        status["redis_error"] = str(exc)[:200]
    status["auth_enabled"] = bool(os.environ.get("AZTEST_API_KEY"))
    status["cors_origins"] = origins
    return status


@app.get("/api/v1/rubric", dependencies=[Depends(require_key)])
async def rubric() -> dict:
    """The judge and the human review screen score the same dimensions; the UI
    reads them from here so the two can never drift apart."""
    return {"dimensions": DIMENSIONS}


app.include_router(routes_settings.router)
app.include_router(routes_library.router)
app.include_router(routes_runs.router)
app.include_router(routes_results.router)
app.include_router(routes_reports.router)
