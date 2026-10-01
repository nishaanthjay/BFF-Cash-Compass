-- BFFA Money Check: initial schema (single-phase diagnostic).
--
-- Security model
--   * Every table has Row Level Security ENABLED and NO policies, and all table
--     privileges are revoked from anon/authenticated. Clients cannot read or
--     write any table directly.
--   * All access goes through SECURITY DEFINER functions below. Anonymous
--     clients may only: resolve an OPEN session by chapter code, and insert
--     attempts/answers into an OPEN session (rate-limited per device token).
--   * Facilitator functions require the shared passcode (bcrypt hash in app_config).
--
-- Privacy: no student identifiers anywhere. device_rate holds a random
-- per-browser token used only for rate limiting and is never joined to responses.

create extension if not exists pgcrypto;

-- ───────────────────────────── tables ─────────────────────────────

create table public.app_config (
  id            int primary key default 1 check (id = 1),
  passcode_hash text not null
);

create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  chapter_code text not null check (chapter_code ~ '^[A-Z0-9]{3,10}$'),
  status       text not null default 'open' check (status in ('open', 'closed')),
  created_at   timestamptz not null default now(),
  closed_at    timestamptz
);
-- One open session per chapter: students join by chapter code alone.
create unique index sessions_one_open_per_chapter on public.sessions (chapter_code) where status = 'open';
create index sessions_created_at on public.sessions (created_at);

create table public.attempts (
  attempt_id  uuid primary key,
  session_id  uuid not null references public.sessions (id) on delete cascade,
  item_count  int  not null check (item_count between 1 and 100),
  started_at  timestamptz not null,
  received_at timestamptz not null default now()
);
create index attempts_session on public.attempts (session_id);

create table public.responses (
  answer_id    uuid primary key,
  attempt_id   uuid not null references public.attempts (attempt_id) on delete cascade,
  session_id   uuid not null references public.sessions (id) on delete cascade,
  item_id      text not null check (item_id ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  item_version int  not null check (item_version >= 1),
  estimate     numeric not null check (estimate >= 0 and estimate < 1e12),
  truth        numeric not null check (truth > 0),
  answered_at  timestamptz not null,
  received_at  timestamptz not null default now(),
  unique (attempt_id, item_id)
);
create index responses_session on public.responses (session_id);
create index responses_answered_at on public.responses (answered_at);

create table public.device_rate (
  device_token uuid not null,
  kind         text not null check (kind in ('answer', 'attempt')),
  session_id   uuid,
  at           timestamptz not null default now()
);
create index device_rate_lookup on public.device_rate (device_token, kind, at);

alter table public.app_config  enable row level security;
alter table public.sessions    enable row level security;
alter table public.attempts    enable row level security;
alter table public.responses   enable row level security;
alter table public.device_rate enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Placeholder passcode. CHANGE IT right after migrating:
--   update public.app_config set passcode_hash = crypt('your-passcode', gen_salt('bf', 10));
insert into public.app_config (passcode_hash) values (crypt('change-me-now', gen_salt('bf', 10)));

-- ─────────────────────── rate-limit constants ───────────────────────
-- Mirrors src/lib/rateLimit.ts (RATE): 30 answers / 60 s per device,
-- 3 attempts per device per session.

-- ───────────────────────────── helpers ─────────────────────────────

create or replace function public._check_passcode(p_passcode text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if p_passcode is null or not exists (
    select 1 from app_config where passcode_hash = crypt(p_passcode, passcode_hash)
  ) then
    perform pg_sleep(0.5); -- slow down guessing
    raise exception 'bad_passcode';
  end if;
end;
$$;

-- ───────────────────────── student (anon) API ─────────────────────────

create or replace function public.join_session(p_chapter text)
returns table (session_id uuid, chapter_code text)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select s.id, s.chapter_code
  from sessions s
  where s.chapter_code = upper(regexp_replace(coalesce(p_chapter, ''), '[^A-Za-z0-9]', '', 'g'))
    and s.status = 'open'
  limit 1;
$$;

-- Idempotent batch sync from the client's offline queue.
-- p_attempts: [{attempt_id, session_id, item_count, started_at}]
-- p_answers:  [{answer_id, attempt_id, session_id, item_id, item_version, estimate, truth, answered_at}]
create or replace function public.sync_answers(p_device_token uuid, p_attempts jsonb, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a          jsonb;
  v_rejected text[] := '{}';
  v_attempts int := 0;
  v_answers  int := 0;
  v_recent   int;
  v_incoming int;
  v_used     int;
  v_open     boolean;
begin
  if p_device_token is null then raise exception 'invalid: device token required'; end if;
  if jsonb_typeof(coalesce(p_attempts, '[]')) <> 'array' or jsonb_typeof(coalesce(p_answers, '[]')) <> 'array' then
    raise exception 'invalid: arrays expected';
  end if;
  if jsonb_array_length(coalesce(p_answers, '[]')) > 50 or jsonb_array_length(coalesce(p_attempts, '[]')) > 10 then
    raise exception 'invalid: batch too large';
  end if;

  -- Answer rate limit (new answers only; retries of already-stored ids are free).
  select count(*) into v_recent from device_rate
   where device_token = p_device_token and kind = 'answer' and at > now() - interval '60 seconds';
  select count(*) into v_incoming
    from jsonb_array_elements(coalesce(p_answers, '[]')) e
   where not exists (select 1 from responses r where r.answer_id = (e->>'answer_id')::uuid);
  if v_recent + v_incoming > 30 then raise exception 'rate_limited'; end if;

  -- Attempts
  for a in select * from jsonb_array_elements(coalesce(p_attempts, '[]')) loop
    continue when exists (select 1 from attempts where attempt_id = (a->>'attempt_id')::uuid);
    select exists (select 1 from sessions where id = (a->>'session_id')::uuid and status = 'open') into v_open;
    select count(*) into v_used from device_rate
     where device_token = p_device_token and kind = 'attempt' and session_id = (a->>'session_id')::uuid;
    if not v_open or v_used >= 3 then
      v_rejected := v_rejected || (a->>'attempt_id');
      continue;
    end if;
    insert into attempts (attempt_id, session_id, item_count, started_at)
    values ((a->>'attempt_id')::uuid, (a->>'session_id')::uuid, (a->>'item_count')::int,
            least(coalesce((a->>'started_at')::timestamptz, now()), now()))
    on conflict do nothing;
    insert into device_rate (device_token, kind, session_id) values (p_device_token, 'attempt', (a->>'session_id')::uuid);
    v_attempts := v_attempts + 1;
  end loop;

  -- Answers: only into an open session, for an attempt in that session.
  for a in select * from jsonb_array_elements(coalesce(p_answers, '[]')) loop
    continue when exists (select 1 from responses where answer_id = (a->>'answer_id')::uuid);
    if not exists (
      select 1 from attempts t join sessions s on s.id = t.session_id
       where t.attempt_id = (a->>'attempt_id')::uuid
         and s.id = (a->>'session_id')::uuid
         and s.status = 'open'
    ) then
      v_rejected := v_rejected || (a->>'answer_id');
      continue;
    end if;
    begin
      insert into responses (answer_id, attempt_id, session_id, item_id, item_version, estimate, truth, answered_at)
      values ((a->>'answer_id')::uuid, (a->>'attempt_id')::uuid, (a->>'session_id')::uuid, a->>'item_id',
              (a->>'item_version')::int, (a->>'estimate')::numeric, (a->>'truth')::numeric,
              least(coalesce((a->>'answered_at')::timestamptz, now()), now()))
      on conflict do nothing;
      insert into device_rate (device_token, kind, session_id) values (p_device_token, 'answer', (a->>'session_id')::uuid);
      v_answers := v_answers + 1;
    exception when check_violation or invalid_text_representation or numeric_value_out_of_range then
      v_rejected := v_rejected || (a->>'answer_id');
    end;
  end loop;

  return jsonb_build_object('attempts', v_attempts, 'answers', v_answers, 'rejected', to_jsonb(v_rejected));
end;
$$;

-- ───────────────────────── facilitator API ─────────────────────────

create or replace function public.fac_verify(p_passcode text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform _check_passcode(p_passcode);
  return true;
exception when others then
  return false;
end;
$$;

create or replace function public.fac_create_session(p_passcode text, p_chapter text)
returns sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_chapter, ''), '[^A-Za-z0-9]', '', 'g'));
  v_row  sessions;
begin
  perform _check_passcode(p_passcode);
  if v_code !~ '^[A-Z0-9]{3,10}$' then raise exception 'invalid: chapter code'; end if;
  if exists (select 1 from sessions where chapter_code = v_code and status = 'open') then
    raise exception 'chapter_busy';
  end if;
  insert into sessions (chapter_code) values (v_code) returning * into v_row;
  return v_row;
end;
$$;

create or replace function public._session_stats(p_session_id uuid)
returns table (attempts bigint, completed bigint, responses bigint)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    (select count(*) from attempts t where t.session_id = p_session_id),
    (select count(*) from attempts t
      where t.session_id = p_session_id
        and (select count(*) from responses r where r.attempt_id = t.attempt_id) >= t.item_count),
    (select count(*) from responses r where r.session_id = p_session_id);
$$;

create or replace function public.fac_open_sessions(p_passcode text)
returns table (id uuid, chapter_code text, status text, created_at timestamptz, closed_at timestamptz,
               attempts bigint, completed bigint, responses bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform _check_passcode(p_passcode);
  return query
    select s.id, s.chapter_code, s.status, s.created_at, s.closed_at, st.attempts, st.completed, st.responses
      from sessions s, lateral _session_stats(s.id) st
     where s.status = 'open'
     order by s.created_at desc;
end;
$$;

create or replace function public.fac_session_stats(p_passcode text, p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  st record;
begin
  perform _check_passcode(p_passcode);
  select status into v_status from sessions where id = p_session_id;
  if v_status is null then raise exception 'not_found'; end if;
  select * into st from _session_stats(p_session_id);
  return jsonb_build_object('status', v_status, 'attempts', st.attempts, 'completed', st.completed, 'responses', st.responses);
end;
$$;

create or replace function public.fac_close_session(p_passcode text, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform _check_passcode(p_passcode);
  update sessions set status = 'closed', closed_at = now() where id = p_session_id and status = 'open';
  if not found and not exists (select 1 from sessions where id = p_session_id) then
    raise exception 'not_found';
  end if;
end;
$$;

-- Raw rows for the private analysis view and the CSV export / weekly backup.
create or replace function public.export_data(p_passcode text, p_chapter text default null,
                                              p_from date default null, p_to date default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform _check_passcode(p_passcode);
  return jsonb_build_object(
    'sessions', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.created_at) from sessions s
       where (p_chapter is null or s.chapter_code = p_chapter)
         and (p_from is null or s.created_at::date >= p_from)
         and (p_to   is null or s.created_at::date <= p_to)), '[]'::jsonb),
    'attempts', coalesce((
      select jsonb_agg(jsonb_build_object('attempt_id', t.attempt_id, 'session_id', t.session_id,
                                          'item_count', t.item_count, 'started_at', t.started_at,
                                          'chapter_code', s.chapter_code) order by t.started_at)
        from attempts t join sessions s on s.id = t.session_id
       where (p_chapter is null or s.chapter_code = p_chapter)
         and (p_from is null or t.started_at::date >= p_from)
         and (p_to   is null or t.started_at::date <= p_to)), '[]'::jsonb),
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object('answer_id', r.answer_id, 'attempt_id', r.attempt_id,
                                          'session_id', r.session_id, 'chapter_code', s.chapter_code,
                                          'item_id', r.item_id, 'item_version', r.item_version,
                                          'estimate', r.estimate, 'truth', r.truth,
                                          'answered_at', r.answered_at) order by r.answered_at)
        from responses r join sessions s on s.id = r.session_id
       where (p_chapter is null or s.chapter_code = p_chapter)
         and (p_from is null or r.answered_at::date >= p_from)
         and (p_to   is null or r.answered_at::date <= p_to)), '[]'::jsonb)
  );
end;
$$;

-- Daily keep-alive (GitHub Actions) so the free tier doesn't pause; also prunes old rate rows.
create or replace function public.heartbeat()
returns timestamptz
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from device_rate where at < now() - interval '2 days';
  select now();
$$;

-- ───────────────────────────── grants ─────────────────────────────

revoke all on all functions in schema public from public, anon, authenticated;

grant execute on function public.join_session(text)                       to anon;
grant execute on function public.sync_answers(uuid, jsonb, jsonb)         to anon;
grant execute on function public.fac_verify(text)                         to anon;
grant execute on function public.fac_create_session(text, text)           to anon;
grant execute on function public.fac_open_sessions(text)                  to anon;
grant execute on function public.fac_session_stats(text, uuid)            to anon;
grant execute on function public.fac_close_session(text, uuid)            to anon;
grant execute on function public.export_data(text, text, date, date)      to anon;
grant execute on function public.heartbeat()                              to anon;
-- _check_passcode and _session_stats stay private (callable only by the definer functions).
