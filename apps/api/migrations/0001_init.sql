-- AzTest initial schema.
create table if not exists settings (
    key         text primary key,
    value       jsonb not null,
    updated_at  timestamptz not null default now()
);

create table if not exists models (
    id                  uuid primary key default gen_random_uuid(),
    model_id            text not null unique,
    label               text not null default '',
    enabled             boolean not null default true,
    input_price_per_m   numeric(12,4) not null default 0,
    output_price_per_m  numeric(12,4) not null default 0,
    max_output_tokens   integer,
    temperature         numeric(4,2),
    notes               text not null default '',
    created_at          timestamptz not null default now()
);

create table if not exists tasks (
    id            uuid primary key default gen_random_uuid(),
    code          text not null unique,
    title         text not null,
    category      text not null default 'general',
    register      text not null default 'neutral',
    prompt        text not null,
    system_prompt text not null default '',
    guidance      text not null default '',
    enabled       boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create table if not exists suites (
    id          uuid primary key default gen_random_uuid(),
    code        text not null unique,
    name        text not null,
    description text not null default '',
    created_at  timestamptz not null default now()
);

create table if not exists suite_tasks (
    suite_id uuid not null references suites(id) on delete cascade,
    task_id  uuid not null references tasks(id) on delete cascade,
    position integer not null default 0,
    primary key (suite_id, task_id)
);

create table if not exists runs (
    id                uuid primary key default gen_random_uuid(),
    kind              text not null default 'suite',
    label             text not null default '',
    suite_id          uuid references suites(id) on delete set null,
    status            text not null default 'QUEUED',
    models            jsonb not null default '[]'::jsonb,
    judge_model       text not null default '',
    judge_enabled     boolean not null default true,
    concurrency       integer not null default 3,
    temperature       numeric(4,2),
    max_output_tokens integer,
    totals            jsonb,
    error             text,
    created_at        timestamptz not null default now(),
    started_at        timestamptz,
    completed_at      timestamptz
);

create table if not exists generations (
    id                uuid primary key default gen_random_uuid(),
    run_id            uuid not null references runs(id) on delete cascade,
    task_id           uuid references tasks(id) on delete set null,
    task_code         text not null default '',
    task_title        text not null default '',
    model_id          text not null,
    prompt            text not null,
    system_prompt     text not null default '',
    output            text not null default '',
    status            text not null default 'PENDING',
    error             text,
    prompt_tokens     integer not null default 0,
    completion_tokens integer not null default 0,
    cost              numeric(12,6) not null default 0,
    latency_ms        integer not null default 0,
    checks            jsonb,
    mechanics_score   integer,
    judge             jsonb,
    judge_status      text not null default 'PENDING',
    judge_error       text,
    judge_cost        numeric(12,6) default 0,
    overall_score     numeric(5,1),
    created_at        timestamptz not null default now(),
    completed_at      timestamptz
);

create index if not exists generations_run_idx on generations(run_id);
create index if not exists generations_model_idx on generations(model_id);
create index if not exists generations_status_idx on generations(status);

create table if not exists human_ratings (
    id            uuid primary key default gen_random_uuid(),
    generation_id uuid not null references generations(id) on delete cascade,
    rater         text not null default 'reviewer',
    scores        jsonb not null default '{}'::jsonb,
    overall       numeric(5,1),
    comment       text not null default '',
    created_at    timestamptz not null default now(),
    unique (generation_id, rater)
);
