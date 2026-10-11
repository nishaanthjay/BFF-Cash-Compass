-- Hardening before real workshops.
--
--  1. Passcode brute-force protection. Every facilitator RPC used to take the passcode and raise 'bad_passcode'
--     on a mismatch. A raised exception rolls the whole transaction back, so a failed guess could never be
--     recorded. Instead the passcode is now checked ONCE by fac_login(), which logs failures and returns
--     NULL (no exception, so the log row commits). A correct passcode returns a random 256-bit token that is
--     valid for app_config.token_ttl (8 hours). All other fac_* functions and export_data take that token.
--     Lockout: login_max_failures failures per client, or login_global_max_failures failures from anyone,
--     inside login_window => fac_login raises 'locked_out'.
--  2. Sessions auto-close after app_config.session_ttl (6 hours) from when they were opened. There is no
--     pg_cron on the free tier, so the sweep runs lazily from join / sync / resume / fac_* / heartbeat.
--  3. join_session throttles repeated wrong codes per client (join_miss_limit per join_miss_window).
--  4. EXECUTE is revoked from public/authenticated everywhere and from anon on every internal function, and
--     default privileges stop new functions leaking to anon/authenticated again.
--  5. set_facilitator_passcode(): the supported way to rotate the passcode (service_role / SQL editor only).
--     A fresh database still carrying the 0001 placeholder passcode gets an unknown random one instead.

-- ───────────── config ─────────────
alter table public.app_config
  add column if not exists login_max_failures        int      not null default 8  check (login_max_failures between 1 and 100),
  add column if not exists login_global_max_failures int      not null default 40 check (login_global_max_failures between 1 and 1000),
  add column if not exists login_window              interval not null default '15 minutes',
  add column if not exists token_ttl                 interval not null default '8 hours',
  add column if not exists session_ttl               interval not null default '6 hours',
  add column if not exists join_miss_limit           int      not null default 100,
  add column if not exists join_miss_window          interval not null default '10 minutes';

-- ───────────── tables ─────────────
create table if not exists public.fac_login_failures (
  id     bigint generated always as identity primary key,
  client text not null,
  at     timestamptz not null default now()
);
create index if not exists fac_login_failures_client_at on public.fac_login_failures (client, at);
create index if not exists fac_login_failures_at on public.fac_login_failures (at);

create table if not exists public.fac_tokens (
  token_hash text primary key, -- sha256 of the token; the token itself is never stored
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.join_misses (
  id     bigint generated always as identity primary key,
  client text not null,
  at     timestamptz not null default now()
);
create index if not exists join_misses_client_at on public.join_misses (client, at);

alter table public.fac_login_failures enable row level security;
alter table public.fac_tokens         enable row level security;
alter table public.join_misses        enable row level security;
revoke all on public.fac_login_failures, public.fac_tokens, public.join_misses from public, anon, authenticated;

alter table public.sessions add column if not exists opened_at timestamptz not null default now();
update public.sessions set opened_at = created_at where opened_at > created_at;
create index if not exists sessions_open_opened_at on public.sessions (opened_at) where status = 'open';

-- ───────────── internal helpers (never callable by clients) ─────────────

-- Best-effort client identity for throttling. cf-connecting-ip is set by the edge and cannot be spoofed by the
-- caller; the leftmost X-Forwarded-For entry can, so it is only a last resort. The global failure cap in
-- fac_login is the real backstop if this ever collapses to 'unknown'.
create or replace function public._client_key()
returns text
language plpgsql stable
set search_path = public, pg_temp
as $$
declare h json; v text;
begin
  begin h := current_setting('request.headers', true)::json; exception when others then h := null; end;
  v := coalesce(h->>'cf-connecting-ip', h->>'x-real-ip', split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1));
  return coalesce(nullif(left(trim(v), 64), ''), 'unknown');
end;
$$;

create or replace function public._check_token(p_token text)
returns void
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if p_token is null or length(p_token) <> 64 or not exists (
    select 1 from fac_tokens where token_hash = encode(digest(p_token, 'sha256'), 'hex') and expires_at > now()
  ) then
    raise exception 'bad_passcode';
  end if;
end;
$$;

create or replace function public._expire_sessions()
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  update sessions set status = 'closed', closed_at = now()
   where status = 'open' and opened_at < now() - (select session_ttl from app_config);
$$;

-- Old passcode-based entry points are replaced by tokens.
drop function if exists public._check_passcode(text);
drop function if exists public.fac_verify(text);

-- ───────────── login ─────────────
create or replace function public.fac_login(p_passcode text)
returns text
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  cfg      app_config;
  v_client text := _client_key();
  v_mine   int;
  v_all    int;
  v_token  text;
begin
  perform pg_advisory_xact_lock(hashtext('fac_login')); -- one guess at a time, so parallel requests can't beat the counter
  select * into cfg from app_config;
  delete from fac_login_failures where at < now() - interval '1 day';
  delete from fac_tokens where expires_at < now();
  select count(*) into v_mine from fac_login_failures where client = v_client and at > now() - cfg.login_window;
  select count(*) into v_all  from fac_login_failures where at > now() - cfg.login_window;
  if v_mine >= cfg.login_max_failures or v_all >= cfg.login_global_max_failures then
    raise exception 'locked_out';
  end if;
  if p_passcode is not null and length(p_passcode) between 1 and 200 and cfg.passcode_hash = crypt(p_passcode, cfg.passcode_hash) then
    v_token := encode(gen_random_bytes(32), 'hex');
    insert into fac_tokens (token_hash, expires_at) values (encode(digest(v_token, 'sha256'), 'hex'), now() + cfg.token_ttl);
    return v_token;
  end if;
  insert into fac_login_failures (client) values (v_client); -- commits: we return normally instead of raising
  perform pg_sleep(0.2);
  return null;
end;
$$;

-- ───────────── rotation (SQL editor / service_role only; see SECURITY.md) ─────────────
create or replace function public.set_facilitator_passcode(p_new text)
returns void
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if p_new is null or length(p_new) < 12 then raise exception 'passcode must be at least 12 characters'; end if;
  update app_config set passcode_hash = crypt(p_new, gen_salt('bf', 12));
  delete from fac_tokens;          -- everyone signs in again with the new passcode
  delete from fac_login_failures;
end;
$$;

-- A database that still has the public placeholder passcode from 0001 gets an unknown random one: locked until rotated.
update public.app_config
   set passcode_hash = crypt(encode(gen_random_bytes(24), 'hex'), gen_salt('bf', 12))
 where passcode_hash = crypt('change-me-now', passcode_hash);

-- ───────────── student API ─────────────
drop function if exists public.join_session(text);
create function public.join_session(p_chapter text)
returns table (session_id uuid, chapter_code text, cohort_label text, modules text[], problem_ids text[])
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  cfg      app_config;
  v_code   text := upper(regexp_replace(coalesce(p_chapter, ''), '[^A-Za-z0-9]', '', 'g'));
  v_client text := _client_key();
  v_misses int;
begin
  perform _expire_sessions();
  select * into cfg from app_config;
  select count(*) into v_misses from join_misses where client = v_client and at > now() - cfg.join_miss_window;
  if v_misses >= cfg.join_miss_limit then raise exception 'rate_limited'; end if;

  return query
    select s.id, s.chapter_code, s.cohort_label, s.modules, s.problem_ids
      from sessions s
     where s.chapter_code = v_code and s.status = 'open'
     limit 1;
  if found then return; end if;

  if exists (select 1 from sessions s where s.chapter_code = v_code) then
    raise exception 'session_closed';
  end if;
  -- Unknown code: log the miss (we return normally, so the row commits) and return nothing.
  delete from join_misses where at < now() - interval '1 day';
  insert into join_misses (client) values (v_client);
end;
$$;

-- resume_student and sync_answers keep their bodies; they just sweep expired sessions first.
alter function public.sync_answers(uuid, jsonb, jsonb) rename to _sync_answers_core;
create function public.sync_answers(p_device_token uuid, p_students jsonb, p_answers jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform _expire_sessions();
  return _sync_answers_core(p_device_token, p_students, p_answers);
end;
$$;

alter function public.resume_student(uuid, text) rename to _resume_student_core;
create function public.resume_student(p_session_id uuid, p_student_code text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform _expire_sessions();
  return _resume_student_core(p_session_id, p_student_code);
end;
$$;

create or replace function public.heartbeat()
returns timestamptz
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from device_rate where at < now() - interval '2 days';
  delete from fac_login_failures where at < now() - interval '1 day';
  delete from join_misses where at < now() - interval '1 day';
  delete from fac_tokens where expires_at < now();
  perform _expire_sessions();
  return now();
end;
$$;

-- ───────────── facilitator API (token instead of passcode) ─────────────
drop function if exists public.fac_create_session(text, text, text[], text, text[]);
drop function if exists public.fac_open_sessions(text);
drop function if exists public.fac_recent_sessions(text, int);
drop function if exists public.fac_reopen_session(text, uuid);
drop function if exists public.fac_session_stats(text, uuid);
drop function if exists public.fac_close_session(text, uuid);
drop function if exists public.fac_recode(text, uuid, text[], text);
drop function if exists public.export_data(text, uuid, text, date, date);

create function public.fac_create_session(p_token text, p_chapter text, p_modules text[], p_cohort text, p_problems text[] default '{}')
returns sessions
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_chapter, ''), '[^A-Za-z0-9]', '', 'g'));
  v_row sessions;
begin
  perform _check_token(p_token);
  perform _expire_sessions();
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

create function public.fac_open_sessions(p_token text)
returns table (id uuid, chapter_code text, cohort_label text, modules text[], problem_ids text[], status text, created_at timestamptz,
               closed_at timestamptz, students bigint, finished bigint, responses bigint)
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
begin
  perform _check_token(p_token);
  perform _expire_sessions();
  return query
    select s.id, s.chapter_code, s.cohort_label, s.modules, s.problem_ids, s.status, s.created_at, s.closed_at, st.students, st.finished, st.responses
      from sessions s, lateral _session_stats(s.id) st
     where s.status = 'open' order by s.created_at desc;
end;
$$;

create function public.fac_recent_sessions(p_token text, p_limit int default 15)
returns table (id uuid, chapter_code text, cohort_label text, modules text[], problem_ids text[], status text, created_at timestamptz,
               closed_at timestamptz, students bigint, finished bigint, responses bigint)
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
begin
  perform _check_token(p_token);
  perform _expire_sessions();
  return query
    select s.id, s.chapter_code, s.cohort_label, s.modules, s.problem_ids, s.status, s.created_at, s.closed_at, st.students, st.finished, st.responses
      from sessions s, lateral _session_stats(s.id) st
     order by s.created_at desc
     limit greatest(1, least(coalesce(p_limit, 15), 50));
end;
$$;

create function public.fac_reopen_session(p_token text, p_session_id uuid)
returns sessions
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare v_row sessions;
begin
  perform _check_token(p_token);
  perform _expire_sessions();
  select * into v_row from sessions where id = p_session_id;
  if not found then raise exception 'not_found'; end if;
  if v_row.status = 'open' then return v_row; end if;
  if exists (select 1 from sessions where chapter_code = v_row.chapter_code and status = 'open' and id <> v_row.id) then
    raise exception 'chapter_busy';
  end if;
  update sessions set status = 'open', closed_at = null, opened_at = now() where id = p_session_id returning * into v_row;
  return v_row;
end;
$$;

create function public.fac_session_stats(p_token text, p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare v_status text; st record;
begin
  perform _check_token(p_token);
  perform _expire_sessions();
  select status into v_status from sessions where id = p_session_id;
  if v_status is null then raise exception 'not_found'; end if;
  select * into st from _session_stats(p_session_id);
  return jsonb_build_object('status', v_status, 'students', st.students, 'finished', st.finished, 'responses', st.responses);
end;
$$;

create function public.fac_close_session(p_token text, p_session_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
begin
  perform _check_token(p_token);
  update sessions set status = 'closed', closed_at = now() where id = p_session_id and status = 'open';
  if not found and not exists (select 1 from sessions where id = p_session_id) then
    raise exception 'not_found';
  end if;
end;
$$;

create function public.fac_recode(p_token text, p_answer_id uuid, p_codes text[], p_tag text)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
begin
  perform _check_token(p_token);
  if not exists (select 1 from step_responses where answer_id = p_answer_id) then raise exception 'not_found'; end if;
  insert into recodes (answer_id, codes, tag) values (p_answer_id, coalesce(p_codes, '{}'), p_tag)
  on conflict (answer_id) do update set codes = excluded.codes, tag = excluded.tag, coded_at = now();
end;
$$;

create function public.export_data(p_token text, p_session_id uuid default null, p_chapter text default null,
                                   p_from date default null, p_to date default null)
returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
begin
  perform _check_token(p_token);
  return jsonb_build_object(
    'sessions', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at) from sessions s
       where (p_session_id is null or s.id = p_session_id) and (p_chapter is null or s.chapter_code = p_chapter)
         and (p_from is null or s.created_at::date >= p_from) and (p_to is null or s.created_at::date <= p_to)), '[]'::jsonb),
    'students', coalesce((select jsonb_agg(to_jsonb(st) || jsonb_build_object('chapter_code', s.chapter_code) order by st.started_at)
       from students st join sessions s on s.id = st.session_id
       where (p_session_id is null or s.id = p_session_id) and (p_chapter is null or s.chapter_code = p_chapter)
         and (p_from is null or st.started_at::date >= p_from) and (p_to is null or st.started_at::date <= p_to)), '[]'::jsonb),
    'responses', coalesce((select jsonb_agg((to_jsonb(r) - 'received_at') || jsonb_build_object('chapter_code', s.chapter_code, 'cohort_label', s.cohort_label) order by r.answered_at)
       from step_responses r join sessions s on s.id = r.session_id
       where (p_session_id is null or s.id = p_session_id) and (p_chapter is null or s.chapter_code = p_chapter)
         and (p_from is null or r.answered_at::date >= p_from) and (p_to is null or r.answered_at::date <= p_to)), '[]'::jsonb),
    'recodes', coalesce((select jsonb_agg(to_jsonb(c)) from recodes c join step_responses r using (answer_id) join sessions s on s.id = r.session_id
       where (p_session_id is null or s.id = p_session_id) and (p_chapter is null or s.chapter_code = p_chapter)), '[]'::jsonb)
  );
end;
$$;

-- ───────────── grants ─────────────
-- Stop future functions from being executable by clients by default.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

revoke all on all functions in schema public from public, anon, authenticated;

-- Students: join, resume, sync, heartbeat (the keep-alive workflow also uses it).
grant execute on function public.join_session(text)                    to anon;
grant execute on function public.resume_student(uuid, text)            to anon;
grant execute on function public.sync_answers(uuid, jsonb, jsonb)      to anon;
grant execute on function public.heartbeat()                           to anon;
-- Facilitator: the browser only holds the anon key, so these stay reachable by anon, but each one refuses
-- anything without a token from fac_login (which is throttled and locks out on repeated failures).
grant execute on function public.fac_login(text)                                      to anon;
grant execute on function public.fac_create_session(text, text, text[], text, text[]) to anon;
grant execute on function public.fac_open_sessions(text)                              to anon;
grant execute on function public.fac_recent_sessions(text, int)                       to anon;
grant execute on function public.fac_reopen_session(text, uuid)                       to anon;
grant execute on function public.fac_session_stats(text, uuid)                        to anon;
grant execute on function public.fac_close_session(text, uuid)                        to anon;
grant execute on function public.fac_recode(text, uuid, text[], text)                 to anon;
grant execute on function public.export_data(text, uuid, text, date, date)            to anon;
-- Everything else (_check_token, _expire_sessions, _session_stats, _client_key, _sync_answers_core,
-- _resume_student_core, set_facilitator_passcode) is not executable by anon or authenticated.
