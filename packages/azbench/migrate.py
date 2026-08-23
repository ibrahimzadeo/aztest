"""Plain-SQL migration runner.

Why not create_all/metadata sync: it does not add columns to existing tables,
which is exactly the failure that shows up as 500s after a redeploy. Each
file in apps/api/migrations/*.sql runs once, in filename order, under a
Postgres advisory lock so two containers racing a redeploy is safe — the
loser waits and then finds nothing to do.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from pathlib import Path

import asyncpg

from .db import dsn

log = logging.getLogger("azbench.migrate")
LOCK_ID = 8123407  # arbitrary, stable
MIGRATIONS_DIR = Path(os.environ.get("MIGRATIONS_DIR", "/app/apps/api/migrations"))


async def wait_for_db(url: str, attempts: int = 60, delay: float = 2.0) -> None:
    """A fresh Postgres volume runs initdb first and refuses connections until
    it finishes; depends_on only waits for the container, not the cluster."""
    for attempt in range(1, attempts + 1):
        try:
            conn = await asyncpg.connect(url)
            await conn.close()
            return
        except Exception as exc:  # noqa: BLE001 — print the concrete reason
            print(f"  db not ready ({type(exc).__name__}: {exc}); retry {attempt}/{attempts}")
            await asyncio.sleep(delay)
    raise SystemExit("Postgres did not become reachable — giving up.")


async def migrate() -> None:
    url = dsn()
    print(f"Waiting for Postgres at {url.split('@')[-1]} ...")
    await wait_for_db(url)
    conn = await asyncpg.connect(url)
    try:
        await conn.execute("select pg_advisory_lock($1)", LOCK_ID)
        await conn.execute(
            """create table if not exists schema_migrations (
                   filename text primary key,
                   applied_at timestamptz not null default now())"""
        )
        applied = {r["filename"] for r in await conn.fetch("select filename from schema_migrations")}
        files = sorted(MIGRATIONS_DIR.glob("*.sql"))
        if not files:
            print(f"No migrations found in {MIGRATIONS_DIR}")
        for path in files:
            if path.name in applied:
                continue
            print(f"Applying {path.name} ...")
            async with conn.transaction():
                await conn.execute(path.read_text())
                await conn.execute(
                    "insert into schema_migrations (filename) values ($1)", path.name
                )
        print("Migrations up to date.")
    finally:
        await conn.execute("select pg_advisory_unlock($1)", LOCK_ID)
        await conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    try:
        asyncio.run(migrate())
    except Exception as exc:  # noqa: BLE001
        print(f"MIGRATION FAILED: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
