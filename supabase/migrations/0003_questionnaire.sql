-- Money Check v3: interactive questionnaire (multi-step problems, instrumentation,
-- strategy codes, anonymous student codes, manual recoding).
--
-- Replaces attempts/responses (prototype data only) with students/step_responses.
-- RLS stays ON with NO policies; all access through SECURITY DEFINER functions.
-- Privacy: no names, emails, schools, birthdates or IP addresses are stored.
-- Rate limits mirror src/lib/rateLimit.ts: 60 answers / 60 s per device token,
-- 3 student codes per device per session.

-- ───────────── drop v1 objects ─────────────
drop function if exists public.sync_answers(uuid, jsonb, jsonb);
drop function if exists public.join_session(text);
drop function if exists public.fac_create_session(text, text);
drop function if exists public.fac_open_sessions(text);
drop function if exists public.fac_session_stats(text, uuid);
drop function if exists public._session_stats(uuid);
drop function if exists public.export_data(text, text, date, date);
drop table if exists public.responses;
drop table if exists public.attempts;

-- ───────────── sessions: modules + cohort ─────────────
alter table public.sessions
  add column if not exists modules text[] not null default array['skill', 'feasibility', 'hybrid'],
  add column if not exists cohort_label text check (cohort_label is null or length(cohort_label) <= 60);
alter table public.sessions drop constraint if exists sessions_modules_check;
alter table public.sessions add constraint sessions_modules_check
  check (cardinality(modules) between 1 and 3 and modules <@ array['skill', 'feasibility', 'hybrid']);

-- ───────────── students (anonymous codes) ─────────────
create table public.students (
  session_id     uuid not null references public.sessions (id) on delete cascade,
  student_code   text not null check (student_code ~ '^[A-HJ-KM-NP-Z2-9]{6}$'),
  forms          jsonb not null default '{}'::jsonb,
  device_type    text not null check (device_type in ('phone', 'tablet', 'laptop')),
  expected_steps int  not null check (expected_steps between 1 and 1000),
  started_at     timestamptz not null,
  finished_at    timestamptz,
  received_at    timestamptz not null default now(),
  primary key (session_id, student_code)
);

-- ───────────── step responses (spec §3 data model) ─────────────
create table public.step_responses (
  answer_id              uuid primary key,
  session_id             uuid not null,
  student_code           text not null,
  item_id                text not null check (item_id ~ '^[SFH][0-9]{1,2}$'),
  item_version           int  not null check (item_version >= 1),
  step_id                text not null check (step_id ~ '^[a-z0-9_]{1,24}$'),
  form_version           text check (form_version is null or length(form_version) <= 8),
  raw_value              numeric check (raw_value is null or (raw_value >= 0 and raw_value < 1e12)),
  value                  jsonb check (value is null or pg_column_size(value) < 4000),
  input_method           text check (input_method is null or input_method in ('typed', 'dragged', 'tapped', 'dragged_then_typed')),
  strategy_codes         text[] not null default '{}',
  correct_value          numeric,
  time_to_first_touch_ms int check (time_to_first_touch_ms is null or time_to_first_touch_ms >= 0),
  time_to_lock_ms        int check (time_to_lock_ms is null or time_to_lock_ms >= 0),
  n_revisions            int not null default 0 check (n_revisions >= 0),
  item_position          int not null check (item_position between 1 and 100),
  free_text              text check (free_text is null or length(free_text) <= 400),
  device_type            text not null check (device_type in ('phone', 'tablet', 'laptop')),
  answered_at            timestamptz not null,
  received_at            timestamptz not null default now(),
  foreign key (session_id, student_code) references public.students (session_id, student_code) on delete cascade,
  unique (session_id, student_code, item_id, step_id)
);
create index step_responses_session on public.step_responses (session_id);
create index step_responses_item on public.step_responses (item_id, step_id);

-- Manual recoding (UNK tool) and free-text tags (e.g. survivorship present/partial/absent).
create table public.recodes (
  answer_id uuid primary key references public.step_responses (answer_id) on delete cascade,
  codes     text[] not null default '{}',
  tag       text check (tag is null or length(tag) <= 40),
  coded_at  timestamptz not null default now()
);

alter table public.device_rate drop constraint if exists device_rate_kind_check;
alter table public.device_rate add constraint device_rate_kind_check check (kind in ('answer', 'attempt', 'student'));

alter table public.students       enable row level security;
alter table public.step_responses enable row level security;
alter table public.recodes        enable row level security;
revoke all on public.students, public.step_responses, public.recodes from anon, authenticated;

-- ───────────── student API ─────────────

create or replace function public.join_session(p_chapter text)
returns table (session_id uuid, chapter_code text, cohort_label text, modules text[])
language sql security definer set search_path = public, pg_temp stable
as $$
  select s.id, s.chapter_code, s.cohort_label, s.modules
  from sessions s
  where s.chapter_code = upper(regexp_replace(coalesce(p_chapter, ''), '[^A-Za-z0-9]', '', 'g'))
    and s.status = 'open'
  limit 1;
$$;

-- Resume by anonymous code: returns the steps already stored (never their values).
create or replace function public.resume_student(p_session_id uuid, p_student_code text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp stable
as $$
begin
  if not exists (select 1 from students st join sessions s on s.id = st.session_id
                  where st.session_id = p_session_id and st.student_code = p_student_code and s.status = 'open') then
    return null;
  end if;
  return jsonb_build_object('locked', coalesce((
    select jsonb_agg(item_id || '.' || step_id) from step_responses
     where session_id = p_session_id and student_code = p_student_code), '[]'::jsonb));
end;
$$;

create or replace function public.sync_answers(p_device_token uuid, p_students jsonb, p_answers jsonb)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  a jsonb;
  v_rejected text[] := '{}';
  v_students int := 0;
  v_answers int := 0;
  v_recent int;
  v_incoming int;
  v_used int;
begin
  if p_device_token is null then raise exception 'invalid: device token required'; end if;
  if jsonb_typeof(coalesce(p_students, '[]')) <> 'array' or jsonb_typeof(coalesce(p_answers, '[]')) <> 'array' then
    raise exception 'invalid: arrays expected';
  end if;
  if jsonb_array_length(coalesce(p_answers, '[]')) > 50 or jsonb_array_length(coalesce(p_students, '[]')) > 10 then
    raise exception 'invalid: batch too large';
  end if;

  select count(*) into v_recent from device_rate
   where device_token = p_device_token and kind = 'answer' and at > now() - interval '60 seconds';
  select count(*) into v_incoming from jsonb_array_elements(coalesce(p_answers, '[]')) e
   where not exists (select 1 from step_responses r where r.answer_id = (e->>'answer_id')::uuid);
  if v_recent + v_incoming > 60 then raise exception 'rate_limited'; end if;

  for a in select * from jsonb_array_elements(coalesce(p_students, '[]')) loop
    continue when exists (select 1 from students where session_id = (a->>'session_id')::uuid and student_code = a->>'student_code');
    select count(*) into v_used from device_rate
     where device_token = p_device_token and kind = 'student' and session_id = (a->>'session_id')::uuid;
    if v_used >= 3 or not exists (select 1 from sessions where id = (a->>'session_id')::uuid and status = 'open') then
      v_rejected := v_rejected || (a->>'student_code');
      continue;
    end if;
    begin
      insert into students (session_id, student_code, forms, device_type, expected_steps, started_at)
      values ((a->>'session_id')::uuid, a->>'student_code', coalesce(a->'forms', '{}'::jsonb), a->>'device_type',
              (a->>'expected_steps')::int, least(coalesce((a->>'started_at')::timestamptz, now()), now()));
      insert into device_rate (device_token, kind, session_id) values (p_device_token, 'student', (a->>'session_id')::uuid);
      v_students := v_students + 1;
    exception when check_violation or not_null_violation or invalid_text_representation then
      v_rejected := v_rejected || (a->>'student_code');
    end;
  end loop;

  for a in select * from jsonb_array_elements(coalesce(p_answers, '[]')) loop
    continue when exists (select 1 from step_responses where answer_id = (a->>'answer_id')::uuid);
    if not exists (select 1 from students st join sessions s on s.id = st.session_id
                    where st.session_id = (a->>'session_id')::uuid and st.student_code = a->>'student_code' and s.status = 'open') then
      v_rejected := v_rejected || (a->>'answer_id');
      continue;
    end if;
    begin
      insert into step_responses (answer_id, session_id, student_code, item_id, item_version, step_id, form_version,
        raw_value, value, input_method, strategy_codes, correct_value, time_to_first_touch_ms, time_to_lock_ms,
        n_revisions, item_position, free_text, device_type, answered_at)
      values ((a->>'answer_id')::uuid, (a->>'session_id')::uuid, a->>'student_code', a->>'item_id', (a->>'item_version')::int,
        a->>'step_id', a->>'form_version', (a->>'raw_value')::numeric, nullif(a->'value', 'null'::jsonb), a->>'input_method',
        coalesce(array(select jsonb_array_elements_text(a->'strategy_codes')), '{}'), (a->>'correct_value')::numeric,
        (a->>'time_to_first_touch_ms')::int, (a->>'time_to_lock_ms')::int, coalesce((a->>'n_revisions')::int, 0),
        (a->>'item_position')::int, a->>'free_text', a->>'device_type',
        least(coalesce((a->>'answered_at')::timestamptz, now()), now()));
      insert into device_rate (device_token, kind, session_id) values (p_device_token, 'answer', (a->>'session_id')::uuid);
      v_answers := v_answers + 1;
      update students st set finished_at = now()
       where st.session_id = (a->>'session_id')::uuid and st.student_code = a->>'student_code' and st.finished_at is null
         and (select count(*) from step_responses r where r.session_id = st.session_id and r.student_code = st.student_code) >= st.expected_steps;
    exception when check_violation or not_null_violation or unique_violation or invalid_text_representation or numeric_value_out_of_range then
      v_rejected := v_rejected || (a->>'answer_id');
    end;
  end loop;

  return jsonb_build_object('students', v_students, 'answers', v_answers, 'rejected', to_jsonb(v_rejected));
end;
$$;

-- ───────────── facilitator API ─────────────

create or replace function public.fac_create_session(p_passcode text, p_chapter text, p_modules text[], p_cohort text)
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
    insert into sessions (chapter_code, modules, cohort_label)
    values (v_code, p_modules, nullif(trim(p_cohort), '')) returning * into v_row;
  exception when check_violation then raise exception 'invalid: modules or cohort';
  end;
  return v_row;
end;
$$;

create or replace function public._session_stats(p_session_id uuid)
returns table (students bigint, finished bigint, responses bigint)
language sql security definer set search_path = public, pg_temp stable
as $$
  select (select count(*) from students where session_id = p_session_id),
         (select count(*) from students where session_id = p_session_id and finished_at is not null),
         (select count(*) from step_responses where session_id = p_session_id);
$$;

create or replace function public.fac_open_sessions(p_passcode text)
returns table (id uuid, chapter_code text, cohort_label text, modules text[], status text, created_at timestamptz,
               closed_at timestamptz, students bigint, finished bigint, responses bigint)
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform _check_passcode(p_passcode);
  return query
    select s.id, s.chapter_code, s.cohort_label, s.modules, s.status, s.created_at, s.closed_at, st.students, st.finished, st.responses
      from sessions s, lateral _session_stats(s.id) st
     where s.status = 'open' order by s.created_at desc;
end;
$$;

create or replace function public.fac_session_stats(p_passcode text, p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_status text; st record;
begin
  perform _check_passcode(p_passcode);
  select status into v_status from sessions where id = p_session_id;
  if v_status is null then raise exception 'not_found'; end if;
  select * into st from _session_stats(p_session_id);
  return jsonb_build_object('status', v_status, 'students', st.students, 'finished', st.finished, 'responses', st.responses);
end;
$$;

create or replace function public.export_data(p_passcode text, p_session_id uuid default null, p_chapter text default null,
                                              p_from date default null, p_to date default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform _check_passcode(p_passcode);
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

create or replace function public.fac_recode(p_passcode text, p_answer_id uuid, p_codes text[], p_tag text)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform _check_passcode(p_passcode);
  if not exists (select 1 from step_responses where answer_id = p_answer_id) then raise exception 'not_found'; end if;
  insert into recodes (answer_id, codes, tag) values (p_answer_id, coalesce(p_codes, '{}'), p_tag)
  on conflict (answer_id) do update set codes = excluded.codes, tag = excluded.tag, coded_at = now();
end;
$$;

-- ───────────── grants ─────────────
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.join_session(text)                                   to anon;
grant execute on function public.resume_student(uuid, text)                           to anon;
grant execute on function public.sync_answers(uuid, jsonb, jsonb)                     to anon;
grant execute on function public.fac_verify(text)                                     to anon;
grant execute on function public.fac_create_session(text, text, text[], text)         to anon;
grant execute on function public.fac_open_sessions(text)                              to anon;
grant execute on function public.fac_session_stats(text, uuid)                        to anon;
grant execute on function public.fac_close_session(text, uuid)                        to anon;
grant execute on function public.export_data(text, uuid, text, date, date)            to anon;
grant execute on function public.fac_recode(text, uuid, text[], text)                 to anon;
grant execute on function public.heartbeat()                                          to anon;
