-- How many students have answered each problem so far. The facilitator screen uses it to rotate the Quick check:
-- for each module it picks the problem with the fewest students, so every problem collects responses over time.
-- Counts are per problem, never per student, and need a facilitator token like every other fac_* function.

create or replace function public.fac_problem_counts(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
stable
as $$
begin
  perform _check_token(p_token);
  return coalesce((
    select jsonb_object_agg(item_id, n)
      from (select item_id, count(distinct (session_id, student_code)) as n from step_responses group by item_id) t
  ), '{}'::jsonb);
end;
$$;

revoke all on function public.fac_problem_counts(text) from public, anon, authenticated;
grant execute on function public.fac_problem_counts(text) to anon;
