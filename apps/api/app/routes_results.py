"""Results: the leaderboard, per-dimension breakdown, error taxonomy, and the
blind human-review queue that calibrates the judge."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from azbench.rubric import DIMENSION_KEYS, overall

from .deps import db, require_key

router = APIRouter(prefix="/api/v1", dependencies=[Depends(require_key)])


class RatingIn(BaseModel):
    rater: str = "reviewer"
    scores: dict[str, int]
    comment: str = ""


@router.get("/leaderboard")
async def leaderboard(suite_id: str | None = None, run_id: str | None = None) -> dict:
    rows = await db.leaderboard(suite_id=suite_id, run_id=run_id)
    return {"rows": rows}


@router.get("/results/dimensions")
async def dimensions(suite_id: str | None = None) -> dict:
    """Per-model average per rubric dimension — this is where a model that
    scores well overall but keeps failing orthography becomes visible."""
    rows = await db.dimension_averages(suite_id=suite_id)
    matrix: dict[str, dict] = {}
    for row in rows:
        matrix.setdefault(row["model_id"], {})[row["dimension"]] = float(row["score"])
    return {"keys": DIMENSION_KEYS, "matrix": matrix}


@router.get("/results/errors")
async def errors(model_id: str | None = None, limit: int = 12) -> dict:
    return {"rows": await db.error_taxonomy(model_id=model_id, limit=limit)}


@router.get("/review/queue")
async def review_queue(rater: str = "reviewer", limit: int = 25) -> dict:
    """Blind by construction: the query never selects model_id, so the model
    behind an output cannot leak into the review UI."""
    rows = await db.review_queue(rater, limit=limit)
    return {"queue": rows, "rater": rater}


@router.post("/review/{gen_id}")
async def submit_rating(gen_id: str, body: RatingIn) -> dict:
    gen = await db.generation(gen_id)
    if not gen:
        raise HTTPException(status_code=404, detail="generation not found")
    clean = {}
    for key, value in body.scores.items():
        if key not in DIMENSION_KEYS:
            continue
        clean[key] = max(1, min(5, int(value)))
    if not clean:
        raise HTTPException(status_code=400, detail="no valid rubric scores submitted")
    row = await db.save_rating(gen_id, body.rater, clean, overall(clean), body.comment)
    return {"rating": row, "overall": overall(clean)}


@router.get("/review/agreement")
async def agreement(rater: str | None = None) -> dict:
    """Judge-vs-human agreement. Without this the judge is an unvalidated
    number; with it, the gap is on screen and quantified."""
    clause = "and h.rater = $1" if rater else ""
    args = [rater] if rater else []
    rows = await db.fetch(
        f"""select g.model_id, g.id::text as generation_id, g.task_code,
               g.overall_score as judge, h.overall as human
           from human_ratings h join generations g on g.id = h.generation_id
           where g.overall_score is not null and h.overall is not null {clause}
           order by g.model_id""",
        *args,
    )
    pairs = [(float(r["judge"]), float(r["human"])) for r in rows]
    return {
        "pairs": len(pairs),
        "mean_abs_diff": round(sum(abs(j - h) for j, h in pairs) / len(pairs), 1) if pairs else None,
        "judge_mean": round(sum(j for j, _ in pairs) / len(pairs), 1) if pairs else None,
        "human_mean": round(sum(h for _, h in pairs) / len(pairs), 1) if pairs else None,
        "rows": rows,
    }
