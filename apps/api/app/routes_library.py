"""The task library and the suites that group tasks into one run."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from azbench.seed import seed

from .deps import db, require_key

router = APIRouter(prefix="/api/v1", dependencies=[Depends(require_key)])


class TaskIn(BaseModel):
    # `register` is a BaseModel attribute name, so the field is declared under
    # a different name and aliased — the JSON contract and the column stay
    # `register`, and dumps use by_alias=True.
    model_config = ConfigDict(populate_by_name=True)

    code: str
    title: str
    category: str = "general"
    reg: str = Field(default="neutral", alias="register")
    prompt: str
    system_prompt: str = ""
    guidance: str = ""
    enabled: bool = True


class SuiteIn(BaseModel):
    code: str
    name: str
    description: str = ""
    task_ids: list[str] = []


@router.get("/tasks")
async def list_tasks(enabled_only: bool = False) -> dict:
    rows = await db.tasks(enabled_only=enabled_only)
    return {"tasks": rows, "categories": sorted({r["category"] for r in rows})}


@router.post("/tasks")
async def create_task(body: TaskIn) -> dict:
    if not body.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt is required")
    try:
        return await db.create_task(**body.model_dump(by_alias=True))
    except Exception as exc:  # noqa: BLE001 — unique violation is the common case
        raise HTTPException(status_code=400, detail=f"could not create task: {exc}") from exc


@router.get("/tasks/{task_id}")
async def get_task(task_id: str) -> dict:
    row = await db.task(task_id)
    if not row:
        raise HTTPException(status_code=404, detail="task not found")
    return row


@router.patch("/tasks/{task_id}")
async def update_task(task_id: str, body: TaskIn) -> dict:
    row = await db.update_task(task_id, **body.model_dump(by_alias=True))
    if not row:
        raise HTTPException(status_code=404, detail="task not found")
    return row


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str) -> dict:
    await db.delete_task(task_id)
    return {"deleted": task_id}


@router.post("/tasks/seed")
async def seed_tasks() -> dict:
    """Re-run the starter seed. Idempotent by code, and it never overwrites a
    task that already exists — safe to press after editing the library."""
    return await seed(db)


@router.get("/suites")
async def list_suites() -> dict:
    return {"suites": await db.suites()}


@router.post("/suites")
async def create_suite(body: SuiteIn) -> dict:
    try:
        return await db.create_suite(body.code, body.name, body.description, body.task_ids)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"could not create suite: {exc}") from exc


@router.get("/suites/{suite_id}")
async def get_suite(suite_id: str) -> dict:
    row = await db.suite(suite_id)
    if not row:
        raise HTTPException(status_code=404, detail="suite not found")
    return row


@router.patch("/suites/{suite_id}")
async def update_suite(suite_id: str, body: SuiteIn) -> dict:
    row = await db.update_suite(suite_id, body.code, body.name, body.description, body.task_ids)
    if not row:
        raise HTTPException(status_code=404, detail="suite not found")
    return row


@router.delete("/suites/{suite_id}")
async def delete_suite(suite_id: str) -> dict:
    await db.delete_suite(suite_id)
    return {"deleted": suite_id}
