-- Per-model tuning knobs. A benchmark across a dozen models cannot hardcode
-- how each one is asked to think: deepseek-v4 spends its entire completion
-- budget reasoning and emits nothing, and the fix differs per vendor.
alter table models add column if not exists reasoning_effort text not null default '';
-- Escape hatch for vendor-specific request fields (enable_thinking,
-- thinking, chat_template_kwargs, top_p ...) so a new model quirk is a
-- settings change rather than a deploy.
alter table models add column if not exists extra_params jsonb not null default '{}'::jsonb;

-- Where the completion budget actually went. Without this, "spent 4000
-- tokens and said nothing" is invisible.
alter table generations add column if not exists reasoning_tokens integer not null default 0;
