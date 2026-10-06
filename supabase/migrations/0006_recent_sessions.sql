-- Reopen/duplicate sessions and clearer student errors.
--  * fac_recent_sessions: the latest sessions of any status, with counts
--  * fac_reopen_session: closed -> open again (one open session per chapter)
--  * join_session: raises 'session_closed' when the code belongs to a session that has ended

create or replace function public.fac_recent_sessions(p_passcode text, p_limit int default 15)
returns table (id uuid, chapter_code text, cohort_label text, modules text[], problem_ids text[], status text, created_at timestamptz,
               closed_at timestamptz, students bigint, finished bigint, responses bigint)
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
begin
  perform _check_passcode(p_passcode);
  return query
    select s.id, s.chapter_code, s.cohort_label, s.modules, s.problem_ids, s.status, s.created_at, s.closed_at, st.students, st.finished, st.responses
      from sessions s, lateral _session_stats(s.id) st
     order by s.created_at desc
     limit greatest(1, least(coalesce(p_limit, 15), 50));
end;
$$;

create or replace function public.fac_reopen_session(p_passcode text, p_session_id uuid)
returns sessions
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare v_row sessions;
begin
  perform _check_passcode(p_passcode);
  select * into v_row from sessions where id = p_session_id;
  if not found then raise exception 'not_found'; end if;
  if v_row.status = 'open' then return v_row; end if;
  if exists (select 1 from sessions where chapter_code = v_row.chapter_code and status = 'open' and id <> v_row.id) then
    raise exception 'chapter_busy';
  end if;
  update sessions set status = 'open', closed_at = null where id = p_session_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.join_session(p_chapter text)
returns table (session_id uuid, chapter_code text, cohort_label text, modules text[], problem_ids text[])
language plpgsql security definer set search_path = public, pg_temp stable
as $$
declare v_code text := upper(regexp_replace(coalesce(p_chapter, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  return query
    select s.id, s.chapter_code, s.cohort_label, s.modules, s.problem_ids
      from sessions s
     where s.chapter_code = v_code and s.status = 'open'
     limit 1;
  if not found and exists (select 1 from sessions s where s.chapter_code = v_code) then
    raise exception 'session_closed';
  end if;
end;
$$;

revoke all on function public.fac_recent_sessions(text, int), public.fac_reopen_session(text, uuid), public.join_session(text) from public;
grant execute on function public.fac_recent_sessions(text, int), public.fac_reopen_session(text, uuid), public.join_session(text) to anon;
