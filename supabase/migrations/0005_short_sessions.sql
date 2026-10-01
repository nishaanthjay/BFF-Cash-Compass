-- Short sessions: a facilitator can fix the exact problems (e.g. 5 picked or random) instead of whole modules.
-- Empty problem_ids = everything in `modules` (the old behaviour).

alter table public.sessions add column if not exists problem_ids text[] not null default '{}';
alter table public.sessions drop constraint if exists sessions_problem_ids_check;
alter table public.sessions add constraint sessions_problem_ids_check
  check (cardinality(problem_ids) <= 30 and array_to_string(problem_ids, ',') ~ '^([SFH][0-9]{1,2}[A-Z]?(,|$))*$');

drop function if exists public.join_session(text);
create function public.join_session(p_chapter text)
returns table (session_id uuid, chapter_code text, cohort_label text, modules text[], problem_ids text[])
language sql security definer set search_path = public, pg_temp stable
as $$
  select s.id, s.chapter_code, s.cohort_label, s.modules, s.problem_ids
  from sessions s
  where s.chapter_code = upper(regexp_replace(coalesce(p_chapter, ''), '[^A-Za-z0-9]', '', 'g'))
    and s.status = 'open'
  limit 1;
$$;

drop function if exists public.fac_create_session(text, text, text[], text);
create function public.fac_create_session(p_passcode text, p_chapter text, p_modules text[], p_cohort text, p_problems text[] default '{}')
returns sessions
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_chapter, ''), '[^A-Za-z0-9]', '', 'g'));
  v_row sessions;
begin
  perform _check_passcode(p_passcode);
  if v_code !~ '^[A-Z0-9]{3,10}$' then raise exception 'invalid: chapter code'; end if;
  if exists (select 1 from sessions where chapter_code = v_code and status = 'open') then raise exception 'chapter_busy'; end if;
  begin
    insert into sessions (chapter_code, modules, cohort_label, problem_ids)
    values (v_code, p_modules, nullif(trim(p_cohort), ''), coalesce(p_problems, '{}')) returning * into v_row;
  exception when check_violation then raise exception 'invalid: modules, problems or cohort';
  end;
  return v_row;
end;
$$;

drop function if exists public.fac_open_sessions(text);
create function public.fac_open_sessions(p_passcode text)
returns table (id uuid, chapter_code text, cohort_label text, modules text[], problem_ids text[], status text, created_at timestamptz,
               closed_at timestamptz, students bigint, finished bigint, responses bigint)
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform _check_passcode(p_passcode);
  return query
    select s.id, s.chapter_code, s.cohort_label, s.modules, s.problem_ids, s.status, s.created_at, s.closed_at, st.students, st.finished, st.responses
      from sessions s, lateral _session_stats(s.id) st
     where s.status = 'open' order by s.created_at desc;
end;
$$;

revoke all on function public.join_session(text), public.fac_create_session(text, text, text[], text, text[]), public.fac_open_sessions(text) from public;
grant execute on function public.join_session(text), public.fac_create_session(text, text, text[], text, text[]), public.fac_open_sessions(text) to anon;
