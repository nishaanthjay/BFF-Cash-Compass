-- Problem S11 is delivered as two problems (S11A, S11B) so the two parts can sit far apart in a
-- student's order. Allow an optional trailing letter on item ids. Safe to re-run.
alter table public.step_responses drop constraint if exists step_responses_item_id_check;
alter table public.step_responses
  add constraint step_responses_item_id_check check (item_id ~ '^[SFH][0-9]{1,2}[A-Z]?$');
