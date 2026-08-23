"""Postgres access layer (asyncpg). Deliberately plain SQL: the schema is
small, every query is visible, and the worker and API share one surface."""

from __future__ import annotations

import json
import os
import uuid
from decimal import Decimal

import asyncpg


def dsn() -> str:
    url = os.environ.get("DATABASE_URL", "postgresql://localhost:5432/aztest")
    # Tolerate SQLAlchemy-style URLs so one env var works everywhere.
    return url.replace("postgresql+asyncpg://", "postgresql://").replace(
        "postgresql+psycopg://", "postgresql://"
    )


async def _init_conn(conn: asyncpg.Connection) -> None:
    await conn.set_type_codec(
        "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
    )
    await conn.set_type_codec(
        "json", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
    )


class Database:
    def __init__(self, url: str | None = None):
        self.url = url or dsn()
        self.pool: asyncpg.Pool | None = None

    async def connect(self, *, min_size: int = 1, max_size: int = 10) -> None:
        self.pool = await asyncpg.create_pool(
            self.url, min_size=min_size, max_size=max_size, init=_init_conn
        )

    async def close(self) -> None:
        if self.pool:
            await self.pool.close()
            self.pool = None

    # ---- generic helpers ----
    async def fetch(self, sql: str, *args) -> list[dict]:
        async with self.pool.acquire() as conn:
            return [dict(r) for r in await conn.fetch(sql, *args)]

    async def fetchrow(self, sql: str, *args) -> dict | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(sql, *args)
            return dict(row) if row else None

    async def execute(self, sql: str, *args) -> str:
        async with self.pool.acquire() as conn:
            return await conn.execute(sql, *args)

    # ---- settings (key/value) ----
    async def get_setting(self, key: str, default=None):
        row = await self.fetchrow("select value from settings where key = $1", key)
        return row["value"] if row else default

    async def set_setting(self, key: str, value) -> None:
        await self.execute(
            """insert into settings (key, value, updated_at) values ($1, $2, now())
               on conflict (key) do update set value = $2, updated_at = now()""",
            key,
            value,
        )

    # ---- models ----
    async def models(self, *, enabled_only: bool = False) -> list[dict]:
        where = "where enabled" if enabled_only else ""
        return await self.fetch(f"select * from models {where} order by model_id")

    async def model(self, model_id: str) -> dict | None:
        return await self.fetchrow("select * from models where model_id = $1", model_id)

    async def upsert_model(self, **f) -> dict:
        return await self.fetchrow(
            """insert into models (model_id, label, enabled, input_price_per_m,
                   output_price_per_m, max_output_tokens, temperature, notes)
               values ($1,$2,$3,$4,$5,$6,$7,$8)
               on conflict (model_id) do update set
                   label = excluded.label,
                   enabled = excluded.enabled,
                   input_price_per_m = excluded.input_price_per_m,
                   output_price_per_m = excluded.output_price_per_m,
                   max_output_tokens = excluded.max_output_tokens,
                   temperature = excluded.temperature,
                   notes = excluded.notes
               returning *""",
            f["model_id"],
            f.get("label") or "",
            bool(f.get("enabled", True)),
            _dec(f.get("input_price_per_m") or 0),
            _dec(f.get("output_price_per_m") or 0),
            f.get("max_output_tokens"),
            _dec(f.get("temperature")),
            f.get("notes") or "",
        )

    async def delete_model(self, model_id: str) -> None:
        await self.execute("delete from models where model_id = $1", model_id)

    # ---- tasks ----
    async def tasks(self, *, enabled_only: bool = False) -> list[dict]:
        where = "where enabled" if enabled_only else ""
        return await self.fetch(f"select * from tasks {where} order by category, code")

    async def task(self, task_id: str) -> dict | None:
        return await self.fetchrow("select * from tasks where id = $1", _uid(task_id))

    async def tasks_by_ids(self, ids: list[str]) -> list[dict]:
        return await self.fetch(
            "select * from tasks where id = any($1::uuid[]) order by category, code",
            [_uid(i) for i in ids],
        )

    async def create_task(self, **f) -> dict:
        return await self.fetchrow(
            """insert into tasks (code, title, category, register, prompt, system_prompt,
                   guidance, enabled)
               values ($1,$2,$3,$4,$5,$6,$7,$8) returning *""",
            f["code"], f["title"], f.get("category") or "general",
            f.get("register") or "neutral", f["prompt"], f.get("system_prompt") or "",
            f.get("guidance") or "", bool(f.get("enabled", True)),
        )

    async def update_task(self, task_id: str, **f) -> dict | None:
        return await self.fetchrow(
            """update tasks set code=$2, title=$3, category=$4, register=$5, prompt=$6,
                   system_prompt=$7, guidance=$8, enabled=$9, updated_at=now()
               where id=$1 returning *""",
            _uid(task_id), f["code"], f["title"], f.get("category") or "general",
            f.get("register") or "neutral", f["prompt"], f.get("system_prompt") or "",
            f.get("guidance") or "", bool(f.get("enabled", True)),
        )

    async def delete_task(self, task_id: str) -> None:
        await self.execute("delete from tasks where id = $1", _uid(task_id))

    # ---- suites ----
    async def suites(self) -> list[dict]:
        return await self.fetch(
            """select s.*, count(st.task_id)::int as task_count
               from suites s left join suite_tasks st on st.suite_id = s.id
               group by s.id order by s.code"""
        )

    async def suite(self, suite_id: str) -> dict | None:
        row = await self.fetchrow("select * from suites where id = $1", _uid(suite_id))
        if not row:
            return None
        row["tasks"] = await self.fetch(
            """select t.* from suite_tasks st join tasks t on t.id = st.task_id
               where st.suite_id = $1 order by st.position""",
            _uid(suite_id),
        )
        return row

    async def create_suite(self, code: str, name: str, description: str, task_ids: list[str]) -> dict:
        row = await self.fetchrow(
            "insert into suites (code, name, description) values ($1,$2,$3) returning *",
            code, name, description or "",
        )
        await self._set_suite_tasks(row["id"], task_ids)
        return await self.suite(str(row["id"]))

    async def update_suite(self, suite_id: str, code: str, name: str, description: str,
                           task_ids: list[str]) -> dict | None:
        row = await self.fetchrow(
            "update suites set code=$2, name=$3, description=$4 where id=$1 returning *",
            _uid(suite_id), code, name, description or "",
        )
        if not row:
            return None
        await self._set_suite_tasks(row["id"], task_ids)
        return await self.suite(suite_id)

    async def _set_suite_tasks(self, suite_id, task_ids: list[str]) -> None:
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute("delete from suite_tasks where suite_id = $1", suite_id)
                for pos, tid in enumerate(task_ids):
                    await conn.execute(
                        "insert into suite_tasks (suite_id, task_id, position) values ($1,$2,$3)",
                        suite_id, _uid(tid), pos,
                    )

    async def delete_suite(self, suite_id: str) -> None:
        await self.execute("delete from suites where id = $1", _uid(suite_id))

    # ---- runs ----
    async def create_run(self, **f) -> dict:
        return await self.fetchrow(
            """insert into runs (kind, label, suite_id, status, models, judge_model,
                   judge_enabled, concurrency, temperature, max_output_tokens)
               values ($1,$2,$3,'QUEUED',$4,$5,$6,$7,$8,$9) returning *""",
            f.get("kind") or "suite", f.get("label") or "",
            _uid(f["suite_id"]) if f.get("suite_id") else None,
            f.get("models") or [], f.get("judge_model") or "",
            bool(f.get("judge_enabled", True)), int(f.get("concurrency") or 3),
            _dec(f.get("temperature")), f.get("max_output_tokens"),
        )

    async def runs(self, limit: int = 50, kind: str | None = None) -> list[dict]:
        clause = "where kind = $2" if kind else ""
        args = [limit] + ([kind] if kind else [])
        return await self.fetch(
            f"""select r.*, s.name as suite_name,
                   (select count(*) from generations g where g.run_id = r.id)::int as total,
                   (select count(*) from generations g where g.run_id = r.id
                        and g.status in ('DONE','ERROR'))::int as done,
                   (select round(avg(g.overall_score)::numeric, 1) from generations g
                        where g.run_id = r.id and g.overall_score is not null) as avg_score,
                   (select coalesce(sum(g.cost + coalesce(g.judge_cost,0)),0) from generations g
                        where g.run_id = r.id) as cost
               from runs r left join suites s on s.id = r.suite_id
               {clause} order by r.created_at desc limit $1""",
            *args,
        )

    async def run(self, run_id: str) -> dict | None:
        return await self.fetchrow(
            """select r.*, s.name as suite_name from runs r
               left join suites s on s.id = r.suite_id where r.id = $1""",
            _uid(run_id),
        )

    async def set_run_status(self, run_id: str, status: str, *, error: str | None = None) -> None:
        stamp = {
            "RUNNING": "started_at = coalesce(started_at, now())",
            "COMPLETED": "completed_at = now()",
            "FAILED": "completed_at = now()",
            "CANCELLED": "completed_at = now()",
        }.get(status, "")
        sql = f"update runs set status = $2{', ' + stamp if stamp else ''}"
        if error is not None:
            sql += ", error = $3"
            await self.execute(sql + " where id = $1", _uid(run_id), status, error[:4000])
        else:
            await self.execute(sql + " where id = $1", _uid(run_id), status)

    async def run_status(self, run_id: str) -> str | None:
        row = await self.fetchrow("select status from runs where id = $1", _uid(run_id))
        return row["status"] if row else None

    # ---- generations ----
    async def create_generation(self, **f) -> dict:
        return await self.fetchrow(
            """insert into generations (run_id, task_id, task_code, task_title, model_id,
                   prompt, system_prompt, status)
               values ($1,$2,$3,$4,$5,$6,$7,'PENDING') returning *""",
            _uid(f["run_id"]), _uid(f["task_id"]) if f.get("task_id") else None,
            f.get("task_code") or "", f.get("task_title") or "", f["model_id"],
            f["prompt"], f.get("system_prompt") or "",
        )

    async def generations(self, run_id: str) -> list[dict]:
        return await self.fetch(
            "select * from generations where run_id = $1 order by task_code, model_id",
            _uid(run_id),
        )

    async def generation(self, gen_id: str) -> dict | None:
        return await self.fetchrow("select * from generations where id = $1", _uid(gen_id))

    async def reset_inflight(self, run_id: str) -> int:
        """Return generations abandoned mid-flight to PENDING.

        A worker killed by a redeploy leaves rows in RUNNING; without this the
        reclaimed run would skip them and report itself complete.
        """
        result = await self.execute(
            "update generations set status='PENDING' where run_id = $1 and status='RUNNING'",
            _uid(run_id),
        )
        return int(result.split()[-1]) if result else 0

    async def mark_generation_running(self, gen_id) -> None:
        await self.execute("update generations set status='RUNNING' where id = $1", _uid(gen_id))

    async def finish_generation(self, gen_id, **f) -> None:
        await self.execute(
            """update generations set status=$2, output=$3, error=$4, prompt_tokens=$5,
                   completion_tokens=$6, cost=$7, latency_ms=$8, checks=$9,
                   mechanics_score=$10, finish_reason=$11, completed_at=now()
               where id=$1""",
            _uid(gen_id), f["status"], f.get("output") or "", f.get("error"),
            f.get("prompt_tokens") or 0, f.get("completion_tokens") or 0,
            _dec(f.get("cost") or 0), f.get("latency_ms") or 0, f.get("checks"),
            f.get("mechanics_score"), f.get("finish_reason") or "",
        )

    async def save_judge(self, gen_id, *, status: str, judge: dict | None = None,
                         error: str | None = None, cost: float = 0.0) -> None:
        await self.execute(
            """update generations set judge=$2, judge_status=$3, judge_error=$4,
                   judge_cost=$5, overall_score=$6 where id=$1""",
            _uid(gen_id), judge, status, error, _dec(cost),
            _dec((judge or {}).get("overall")),
        )

    async def set_run_totals(self, run_id: str, totals: dict) -> None:
        await self.execute("update runs set totals = $2 where id = $1", _uid(run_id), totals)

    # ---- human ratings ----
    async def save_rating(self, gen_id: str, rater: str, scores: dict, overall_score,
                          comment: str) -> dict:
        return await self.fetchrow(
            """insert into human_ratings (generation_id, rater, scores, overall, comment)
               values ($1,$2,$3,$4,$5)
               on conflict (generation_id, rater) do update set
                   scores = excluded.scores, overall = excluded.overall,
                   comment = excluded.comment, created_at = now()
               returning *""",
            _uid(gen_id), rater, scores, _dec(overall_score), comment or "",
        )

    async def ratings_for(self, gen_id: str) -> list[dict]:
        return await self.fetch(
            "select * from human_ratings where generation_id = $1 order by created_at",
            _uid(gen_id),
        )

    async def review_queue(self, rater: str, limit: int = 25) -> list[dict]:
        """Generations this rater has not scored yet — model identity is NOT
        selected here, so the review screen stays blind by construction."""
        return await self.fetch(
            """select g.id, g.task_code, g.task_title, g.prompt, g.output, g.run_id
               from generations g
               where g.status = 'DONE' and coalesce(g.output,'') <> ''
                 and not exists (select 1 from human_ratings h
                                 where h.generation_id = g.id and h.rater = $1)
               order by g.created_at desc limit $2""",
            rater, limit,
        )

    # ---- leaderboard ----
    async def leaderboard(self, *, suite_id: str | None = None, run_id: str | None = None) -> list[dict]:
        clauses, args = ["g.status = 'DONE'"], []
        if run_id:
            args.append(_uid(run_id))
            clauses.append(f"g.run_id = ${len(args)}")
        if suite_id:
            args.append(_uid(suite_id))
            clauses.append(f"r.suite_id = ${len(args)}")
        # Human ratings are pre-aggregated per generation: joining them row by
        # row would count one answer several times and pull every average
        # toward whichever answers happen to have been reviewed twice.
        return await self.fetch(
            f"""select g.model_id,
                   count(*)::int as generations,
                   round(avg(g.overall_score)::numeric, 1) as judge_score,
                   round(avg(g.mechanics_score)::numeric, 1) as mechanics_score,
                   round(avg(h.overall)::numeric, 1) as human_score,
                   count(h.generation_id)::int as human_ratings,
                   round(avg(g.latency_ms)::numeric, 0) as avg_latency_ms,
                   coalesce(sum(g.cost + coalesce(g.judge_cost,0)), 0) as cost,
                   round(avg(g.completion_tokens)::numeric, 0) as avg_output_tokens
               from generations g
               join runs r on r.id = g.run_id
               left join (
                   select generation_id, avg(overall) as overall
                   from human_ratings group by generation_id
               ) h on h.generation_id = g.id
               where {' and '.join(clauses)}
               group by g.model_id
               order by judge_score desc nulls last""",
            *args,
        )

    async def dimension_averages(self, *, suite_id: str | None = None) -> list[dict]:
        """Per-model average for each rubric dimension, straight out of the
        stored judge JSON — no separate table to keep in step."""
        clause, args = "", []
        if suite_id:
            args.append(_uid(suite_id))
            clause = "and r.suite_id = $1"
        return await self.fetch(
            f"""select g.model_id, d.key as dimension,
                   round(avg((d.value)::numeric), 2) as score
               from generations g
               join runs r on r.id = g.run_id
               cross join lateral jsonb_each_text(g.judge -> 'scores') as d(key, value)
               where g.judge_status = 'DONE' {clause}
               group by g.model_id, d.key order by g.model_id, d.key""",
            *args,
        )

    async def error_taxonomy(self, *, model_id: str | None = None, limit: int = 12) -> list[dict]:
        clause, args = "", [limit]
        if model_id:
            args.append(model_id)
            clause = "and g.model_id = $2"
        return await self.fetch(
            f"""select lower(e ->> 'type') as error_type, count(*)::int as hits
               from generations g
               cross join lateral jsonb_array_elements(coalesce(g.judge -> 'errors','[]'::jsonb)) e
               where g.judge_status = 'DONE' and coalesce(e ->> 'type','') <> '' {clause}
               group by 1 order by hits desc limit $1""",
            *args,
        )


def _uid(value):
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


def _dec(value):
    """asyncpg encodes `numeric` from Decimal and rejects a bare float, so
    every price, cost and score has to be converted on the way in."""
    if value is None or value == "":
        return None
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))
