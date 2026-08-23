# AzTest — Azerbaijani LLM writing benchmark

A measurement tool for one question: **how well does a given LLM actually write
Azerbaijani?** It runs a library of Azerbaijani writing tasks across the models
you select, scores every answer three independent ways, and puts the results on
one leaderboard you can drill into.

Same shape and design language as Argus (Next.js web · FastAPI api · queue
worker · Postgres · Redis, on Coolify behind Traefik).

## What it measures

Three scoring layers, deliberately independent so they can disagree:

| Layer | What it is | Cost |
|---|---|---|
| **Mechanics** | Deterministic checks: stripped diacritics, missing `ə`, Cyrillic/Arabic leakage, Turkish forms where Azerbaijani differs (`değil`→`deyil`, `için`→`üçün`), colloquial Russian borrowings, degenerate repetition, invisible characters. Every flag carries its evidence. | free |
| **Judge** | An LLM scores six rubric dimensions 1–5 (orthography, grammar, naturalness, lexis/terminology, register, task compliance) and returns a concrete error list with corrections. The judge prompt is written in Azerbaijani. | 1 call per answer |
| **Human** | A blind review screen: the same rubric, model identity hidden. This is what calibrates the judge. | your time |

The leaderboard shows all three side by side, plus judge↔human agreement
(mean absolute difference). **Until you have human ratings, the judge number is
uncalibrated** — the UI says so where it matters.

### Honest limits

- The mechanics layer is a set of heuristics, not a grader. The Turkish-form and
  Russian-borrowing lists are short and curated; a hit is a flag for review.
- A judge scoring answers that include its own output has a self-preference
  bias. Blind human review is the check on that, which is why it ships.
- Nexum Router is flat-fee, so per-token cost is whatever effective rate you
  enter per model in Settings. Left at 0, cost columns read $0.

## Screens

- **Bench → Playground** — one prompt, N models, answers side by side. Optional judge.
- **Bench → Tasks** — the task library. 18 seeded tasks across 9 categories (formal
  correspondence, media, legal/finance, technical, translation EN/RU→AZ, colloquial,
  editing, creative, instruction-following), all editable.
- **Bench → Suites** — tasks grouped into one run. `AZ-CORE` (all 18) and
  `AZ-QUICK` (6) are seeded.
- **Results → Leaderboard** — per-model averages, a per-dimension heat table, the
  most common error types, judge↔human agreement.
- **Results → Runs** — run history; each run is a task × model matrix. Click a row
  for answers side by side, a cell for the full analysis (flags, metrics, judge
  verdict, error list).
- **Results → Review** — the blind rating queue.
- **Settings** — provider key (encrypted at rest), model roster with prices and
  limits pulled from the live provider catalog, judge model, run defaults.

## Architecture

```
aztest-web       Next.js 15 (standalone)     :3000   public domain
aztest-api       FastAPI                     :8000   internal (proxied at /api)
aztest-worker    queue consumer                      no port
aztest-migrate   one-shot: schema + seed              runs to completion
aztest-postgres  postgres:16-alpine
aztest-redis     redis:7-alpine
```

The web container proxies `/api/*` to the API container, so the whole app lives
on one domain: no CORS, no API hostname baked into the client bundle, and no
authenticated surface of its own facing the internet.

The API only *plans* a run — it writes one PENDING generation per task×model and
pushes the run id to Redis. The worker generates, checks and judges with bounded
concurrency. Nothing in the request path calls a model, so a slow provider never
blocks the UI.

```
packages/azbench/   nexum.py  checks.py  judge.py  rubric.py  db.py  secrets.py
                    seed.py   migrate.py
apps/api/           app/{main,deps,routes_*}.py  migrations/*.sql
apps/worker/        worker/main.py
apps/web/           app/*  lib/api.js
tests/              test_checks.py   (18 tests, no DB needed)
```

### Concurrency ceiling

Nexum Router returns **HTTP 429 at concurrency 4**. The worker caps in-flight
requests at `MAX_CONCURRENCY` (default 3) regardless of what a run requests,
because a 429 would otherwise land in the leaderboard as a model failure and
skew a number you read as a quality signal. The client also retries 429/5xx with
jittered backoff.

## Deploy (Coolify)

Docker-compose resource, deploy branch `main` — pushing to `main` *is* the deploy.

1. Create the app from this repo, compose file `docker-compose.yml`.
2. Set environment variables:

   | Variable | Notes |
   |---|---|
   | `POSTGRES_PASSWORD` | alphanumeric only; applied on first volume init and fixed after that |
   | `ENCRYPTION_KEY` | any passphrase; encrypts the provider key stored by the UI. **Changing it makes the stored key unreadable.** |
   | `AZTEST_API_KEY` | shared UI/API key; empty disables auth |
   | `SERVICE_FQDN_AZTEST_WEB_3000` | bare hostname, no scheme. The only domain the app needs. |
   | `NEXT_PUBLIC_API_URL` | leave **unset** — the UI calls `/api/v1` same-origin and Next.js proxies it to `aztest-api` |
   | `MAX_CONCURRENCY` | leave at 3 |

3. Deploy. `aztest-migrate` applies the schema and seeds the task library; the
   API and worker wait for it to finish.
4. Open the UI → **Settings**, paste the Nexum key, press *Bağlantını yoxla*.
5. **Settings → Modellər** → load the catalog, add the models to test, set prices.
6. **Settings** → pick the judge model.
7. **Bench → Dəstlər** → run `AZ-QUICK` first (6 tasks × N models) to sanity-check.

`GET /api/v1/health` echoes db, redis, auth and CORS state — one call verifies a deploy.

## Local development

Requires Docker (this Mac's Colima VM is currently unavailable — see project memory):

```bash
cp .env.example .env
docker compose up --build          # override file adds host ports 3100/8100/5433
```

Logic tests need no services:

```bash
python -m unittest discover -s tests -v
```
