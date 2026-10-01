-- Single-phase diagnostic: remove session types (PRE / POST / DELAYED) and parallel forms (A/B).
--
-- 0001_init.sql was written after the single-phase decision, so a fresh database
-- never has these columns and this migration is a no-op there. It exists so any
-- database built from an earlier pre/post draft converges on the same schema.
-- Every statement is guarded (IF EXISTS) and safe to re-run.

alter table if exists public.sessions  drop column if exists session_type;
alter table if exists public.sessions  drop column if exists form;
alter table if exists public.responses drop column if exists session_type;
alter table if exists public.responses drop column if exists form;
alter table if exists public.attempts  drop column if exists session_type;
alter table if exists public.attempts  drop column if exists form;

drop index if exists public.sessions_chapter_type_idx;
drop index if exists public.responses_session_type_idx;
drop type  if exists public.session_type;
drop type  if exists public.item_form;

-- Old pre/post function signatures (if they were ever deployed).
drop function if exists public.fac_create_session(text, text, text, text);
drop function if exists public.join_session(text, text);
