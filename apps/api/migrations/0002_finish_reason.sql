-- Why an answer is missing matters: "the model wrote nothing" and "the model
-- was cut off at the token cap" look identical without this column, and they
-- have opposite fixes.
alter table generations add column if not exists finish_reason text not null default '';
