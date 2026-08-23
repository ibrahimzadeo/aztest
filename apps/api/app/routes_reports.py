"""Shareable A4 reports.

Served as a complete HTML document rather than JSON: the artifact itself is
the deliverable, so it can be saved, emailed or printed to PDF without the
app. Auth accepts `?key=` because these URLs get opened in a browser tab.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse

from .deps import db, require_key
from .report import render_report

router = APIRouter(prefix="/api/v1/reports", dependencies=[Depends(require_key)])

# How many worked examples to include, and how much of each answer.
SAMPLE_COUNT = 4
EXCERPT_CHARS = 700


async def _samples(run_id: str | None, limit: int = SAMPLE_COUNT) -> list[dict]:
    """A spread of worked examples: the best answer, the weakest, and the rest
    in between — so the report shows what the scores mean, not just the scores.
    """
    clause, args = "", []
    if run_id:
        args.append(run_id)
        clause = "and g.run_id = $1::uuid"
    rows = await db.fetch(
        f"""select g.model_id, g.task_code, g.output, g.overall_score, g.judge
            from generations g
            where g.status = 'DONE' and coalesce(g.output,'') <> ''
                  and g.overall_score is not null {clause}
            order by g.overall_score desc""",
        *args,
    )
    if not rows:
        return []
    picked = [rows[0]] if rows else []
    if len(rows) > 1:
        picked.append(rows[-1])
    middle = rows[1:-1]
    step = max(1, len(middle) // max(1, limit - 2)) if middle else 1
    picked += middle[::step][: max(0, limit - 2)]

    out = []
    for row in picked[:limit]:
        text = row["output"] or ""
        out.append({
            "model_id": row["model_id"],
            "task_code": row["task_code"],
            "score": row["overall_score"],
            "excerpt": text[:EXCERPT_CHARS] + ("…" if len(text) > EXCERPT_CHARS else ""),
            "errors": ((row["judge"] or {}).get("errors") or []),
        })
    return out


async def _agreement() -> dict:
    rows = await db.fetch(
        """select g.overall_score as judge, h.overall as human
           from human_ratings h join generations g on g.id = h.generation_id
           where g.overall_score is not null and h.overall is not null"""
    )
    pairs = [(float(r["judge"]), float(r["human"])) for r in rows]
    if not pairs:
        return {"pairs": 0}
    return {
        "pairs": len(pairs),
        "mean_abs_diff": round(sum(abs(j - h) for j, h in pairs) / len(pairs), 1),
        "judge_mean": round(sum(j for j, _ in pairs) / len(pairs), 1),
        "human_mean": round(sum(h for _, h in pairs) / len(pairs), 1),
    }


def _dimension_matrix(rows: list[dict]) -> dict:
    matrix: dict[str, dict] = {}
    for row in rows:
        matrix.setdefault(row["model_id"], {})[row["dimension"]] = float(row["score"])
    return matrix


@router.get("/runs/{run_id}", response_class=HTMLResponse)
async def run_report(run_id: str) -> HTMLResponse:
    run = await db.run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    gens = await db.generations(run_id)
    tasks = sorted({g["task_code"] for g in gens})
    html = render_report(
        title=run["label"] or run["suite_name"] or "Qiymətləndirmə hesabatı",
        scope={
            "Dəst": run["suite_name"] or ("Ad-hoc prompt" if run["kind"] == "playground" else "—"),
            "Tapşırıq sayı": len(tasks),
            "Model sayı": len(run["models"] or []),
            "Hakim modeli": run["judge_model"] or "istifadə edilməyib",
            "İşə salma tarixi": (run["started_at"] or run["created_at"]).strftime("%d.%m.%Y %H:%M"),
            "Status": run["status"],
        },
        rows=await db.leaderboard(run_id=run_id),
        dimensions=_dimension_matrix(await db.dimension_averages(run_id=run_id)),
        errors=await db.error_taxonomy(run_id=run_id),
        excluded=await db.excluded_summary(run_id=run_id),
        samples=await _samples(run_id),
        agreement=await _agreement(),
    )
    return HTMLResponse(html)


@router.get("/overall", response_class=HTMLResponse)
async def overall_report(suite_id: str | None = None) -> HTMLResponse:
    """Every scored answer on record, optionally narrowed to one suite."""
    suite = await db.suite(suite_id) if suite_id else None
    runs = await db.runs(limit=1000)
    counted = [r for r in runs if not suite_id or str(r["suite_id"]) == str(suite_id)]
    html = render_report(
        title="Azərbaycan dili üzrə LLM qiymətləndirmə hesabatı",
        scope={
            "Əhatə": suite["name"] if suite else "Bütün qeydə alınmış nəticələr",
            "İşə salma sayı": len(counted),
            "Provayder": "Nexum Router",
        },
        rows=await db.leaderboard(suite_id=suite_id),
        dimensions=_dimension_matrix(await db.dimension_averages(suite_id=suite_id)),
        errors=await db.error_taxonomy(),
        excluded=await db.excluded_summary(),
        samples=await _samples(None),
        agreement=await _agreement(),
    )
    return HTMLResponse(html)
