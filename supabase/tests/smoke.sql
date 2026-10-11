-- Smoke test for the migrations (0001 → 0008). Run against a scratch database:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/smoke.sql
-- Every check raises on failure.
\set QUIET on
update app_config set passcode_hash = crypt('test-pass', gen_salt('bf', 4));

set role anon;

-- Facilitator calls take a token from fac_login (migration 0007).
select set_config('smoke.tok', fac_login('test-pass'), false);

-- 1. Tables are unreachable for anon.
do $$ begin
  begin perform 1 from sessions; raise exception 'FAIL: anon can read sessions';
  exception when insufficient_privilege then null; end;
  begin perform 1 from step_responses; raise exception 'FAIL: anon can read step_responses';
  exception when insufficient_privilege then null; end;
  begin perform 1 from students; raise exception 'FAIL: anon can read students';
  exception when insufficient_privilege then null; end;
  begin insert into recodes default values; raise exception 'FAIL: anon can write recodes';
  exception when insufficient_privilege then null; end;
  begin perform _check_token('x'); raise exception 'FAIL: anon can call _check_token';
  exception when insufficient_privilege then null; end;
end $$;

-- 2. Passcode gate: only a token from fac_login opens the facilitator functions.
do $$ begin
  if fac_login('nope') is not null then raise exception 'FAIL: wrong passcode accepted'; end if;
  if length(current_setting('smoke.tok')) <> 64 then raise exception 'FAIL: right passcode gave no token'; end if;
  begin perform fac_open_sessions('nope'); raise exception 'FAIL: open_sessions without token';
  exception when raise_exception then if sqlerrm <> 'bad_passcode' then raise; end if; end;
  begin perform fac_open_sessions('test-pass'); raise exception 'FAIL: the passcode itself works as a token';
  exception when raise_exception then if sqlerrm <> 'bad_passcode' then raise; end if; end;
  begin perform _expire_sessions(); raise exception 'FAIL: anon can call _expire_sessions';
  exception when insufficient_privilege then null; end;
  begin perform set_facilitator_passcode('abcdefghijklmnop'); raise exception 'FAIL: anon can rotate the passcode';
  exception when insufficient_privilege then null; end;
  begin perform _sync_answers_core(gen_random_uuid(), '[]', '[]'); raise exception 'FAIL: anon can call the sync core';
  exception when insufficient_privilege then null; end;
end $$;

-- 3. Session lifecycle, students, answers, resume, recode, rate limits.
do $$
declare
  s sessions; j record; r jsonb; tok uuid := gen_random_uuid(); ans jsonb := '[]';
  stu jsonb := jsonb_build_object('student_code', 'ABC234', 'device_type', 'laptop', 'expected_steps', 2, 'started_at', now(), 'forms', '{}'::jsonb);
  a1 uuid := gen_random_uuid();
  mk jsonb;
begin
  s := fac_create_session(current_setting('smoke.tok'), 'tx-014', array['skill', 'feasibility'], 'Grade 7');
  if s.chapter_code <> 'TX014' or s.modules <> array['skill', 'feasibility'] then raise exception 'FAIL: create %', s; end if;
  begin perform fac_create_session(current_setting('smoke.tok'), 'TX014', array['skill'], null); raise exception 'FAIL: two open sessions';
  exception when raise_exception then if sqlerrm <> 'chapter_busy' then raise; end if; end;
  begin perform fac_create_session(current_setting('smoke.tok'), 'NEW01', array['bogus'], null); raise exception 'FAIL: bad module accepted';
  exception when raise_exception then if sqlerrm not like 'invalid:%' then raise; end if; end;

  begin perform fac_create_session(current_setting('smoke.tok'), 'SHORT1', array['skill','feasibility','hybrid'], null, array['S1','bogus']); raise exception 'FAIL: bad problem id accepted';
  exception when raise_exception then if sqlerrm not like 'invalid:%' then raise; end if; end;
  declare sh sessions; jj record;
  begin
    sh := fac_create_session(current_setting('smoke.tok'), 'SHORT1', array['skill','feasibility','hybrid'], null, array['S1','S11A','S11B','F2','H1']);
    select * into jj from join_session('short1');
    if jj.problem_ids <> array['S1','S11A','S11B','F2','H1'] then raise exception 'FAIL: problem_ids not returned by join'; end if;
    perform fac_close_session(current_setting('smoke.tok'), sh.id);
  end;

  select * into j from join_session('tx014');
  if j.session_id is distinct from s.id or j.modules <> array['skill', 'feasibility'] then raise exception 'FAIL: join_session'; end if;

  stu := stu || jsonb_build_object('session_id', s.id);
  mk := jsonb_build_object('session_id', s.id, 'student_code', 'ABC234', 'item_id', 'S1', 'item_version', 1, 'form_version', null,
          'input_method', 'dragged', 'strategy_codes', '["PAD"]'::jsonb, 'correct_value', 36, 'time_to_first_touch_ms', 1200,
          'time_to_lock_ms', 9000, 'n_revisions', 1, 'item_position', 1, 'device_type', 'laptop', 'answered_at', now());
  r := sync_answers(tok, jsonb_build_array(stu), jsonb_build_array(mk || jsonb_build_object('answer_id', a1, 'step_id', 's1', 'raw_value', 23)));
  if (r->>'students')::int <> 1 or (r->>'answers')::int <> 1 then raise exception 'FAIL: sync %', r; end if;

  -- split-problem ids (S11A) are accepted; malformed ids are refused per row
  r := sync_answers(tok, '[]', jsonb_build_array(mk || jsonb_build_object('answer_id', gen_random_uuid(), 'item_id', 'S11A', 'step_id', 'sp', 'raw_value', 1)));
  if (r->>'answers')::int <> 1 then raise exception 'FAIL: S11A refused %', r; end if;
  r := sync_answers(tok, '[]', jsonb_build_array(mk || jsonb_build_object('answer_id', gen_random_uuid(), 'item_id', 'S11a', 'step_id', 'sp2', 'raw_value', 1)));
  if jsonb_array_length(r->'rejected') <> 1 then raise exception 'FAIL: lowercase id accepted %', r; end if;

  -- idempotent retry
  r := sync_answers(tok, jsonb_build_array(stu), jsonb_build_array(mk || jsonb_build_object('answer_id', a1, 'step_id', 's1', 'raw_value', 23)));
  if (r->>'answers')::int <> 0 or jsonb_array_length(r->'rejected') <> 0 then raise exception 'FAIL: retry not idempotent %', r; end if;
  -- second lock of the same step under a new id is refused (no going back)
  r := sync_answers(tok, '[]', jsonb_build_array(mk || jsonb_build_object('answer_id', gen_random_uuid(), 'step_id', 's1', 'raw_value', 36)));
  if jsonb_array_length(r->'rejected') <> 1 then raise exception 'FAIL: relock accepted %', r; end if;
  -- negative value rejected per row
  r := sync_answers(tok, '[]', jsonb_build_array(mk || jsonb_build_object('answer_id', gen_random_uuid(), 'step_id', 's9', 'raw_value', -1)));
  if jsonb_array_length(r->'rejected') <> 1 then raise exception 'FAIL: negative accepted %', r; end if;
  -- unknown student refused
  r := sync_answers(tok, '[]', jsonb_build_array(mk || jsonb_build_object('answer_id', gen_random_uuid(), 'step_id', 's2', 'raw_value', 4.8, 'student_code', 'ZZZ999')));
  if jsonb_array_length(r->'rejected') <> 1 then raise exception 'FAIL: unknown student accepted %', r; end if;

  -- resume returns locked step ids, not values
  r := resume_student(s.id, 'ABC234');
  if not (r->'locked' @> '["S1.s1","S11A.sp"]'::jsonb) or jsonb_array_length(r->'locked') <> 2 then raise exception 'FAIL: resume %', r; end if;
  if resume_student(s.id, 'NOPE22') is not null then raise exception 'FAIL: resume unknown code'; end if;

  -- finishing sets finished_at
  r := sync_answers(tok, '[]', jsonb_build_array(mk || jsonb_build_object('answer_id', gen_random_uuid(), 'step_id', 's2', 'raw_value', 4.8)));
  if (fac_session_stats(current_setting('smoke.tok'), s.id)->>'finished')::int <> 1 then raise exception 'FAIL: finished %', fac_session_stats(current_setting('smoke.tok'), s.id); end if;

  -- recode
  perform fac_recode(current_setting('smoke.tok'), a1, array['CORR'], 'manual');
  if (export_data(current_setting('smoke.tok'))->'recodes'->0->>'tag') <> 'manual' then raise exception 'FAIL: recode'; end if;

  -- rate limit: no more than 60 new answers a minute
  for i in 1..50 loop
    ans := ans || (mk || jsonb_build_object('answer_id', gen_random_uuid(), 'step_id', 'r' || i, 'raw_value', i));
  end loop;
  perform sync_answers(tok, '[]', ans);
  ans := '[]';
  for i in 51..57 loop
    ans := ans || (mk || jsonb_build_object('answer_id', gen_random_uuid(), 'step_id', 'r' || i, 'raw_value', i));
  end loop;
  perform sync_answers(tok, '[]', ans); -- exactly 60 in the window: still allowed
  begin
    perform sync_answers(tok, '[]', jsonb_build_array(mk || jsonb_build_object('answer_id', gen_random_uuid(), 'step_id', 'over', 'raw_value', 1)));
    raise exception 'FAIL: rate limit not enforced';
  exception when raise_exception then if sqlerrm <> 'rate_limited' then raise; end if; end;

  -- device may start at most 3 codes per session
  for i in 1..3 loop
    r := sync_answers(tok, jsonb_build_array(stu || jsonb_build_object('student_code', 'DEF23' || (i + 1))), '[]');
  end loop;
  if jsonb_array_length(r->'rejected') <> 1 then raise exception 'FAIL: student-per-device limit %', r; end if;

  -- closed session: no join, no inserts, no resume
  perform fac_close_session(current_setting('smoke.tok'), s.id);
  begin perform * from join_session('TX014'); raise exception 'FAIL: joined a closed session';
  exception when raise_exception then if sqlerrm <> 'session_closed' then raise; end if; end;
  r := sync_answers(gen_random_uuid(), '[]', jsonb_build_array(mk || jsonb_build_object('answer_id', gen_random_uuid(), 'step_id', 'late', 'raw_value', 1)));
  if jsonb_array_length(r->'rejected') <> 1 then raise exception 'FAIL: insert into closed session'; end if;
  if resume_student(s.id, 'ABC234') is not null then raise exception 'FAIL: resume into closed session'; end if;

  r := export_data(current_setting('smoke.tok'), s.id);
  if jsonb_array_length(r->'responses') <> 60 or jsonb_array_length(r->'students') <> 3 then
    raise exception 'FAIL: export % responses, % students', jsonb_array_length(r->'responses'), jsonb_array_length(r->'students');
  end if;
  -- per-problem student counts (migration 0008): needs a token, counts students not rows
  r := fac_problem_counts(current_setting('smoke.tok'));
  if (r->>'S1')::int <> 1 then raise exception 'FAIL: problem counts %', r; end if;
  begin perform fac_problem_counts('nope'); raise exception 'FAIL: problem counts without token';
  exception when raise_exception then if sqlerrm <> 'bad_passcode' then raise; end if; end;
  perform heartbeat();
  raise notice 'ALL SMOKE CHECKS PASSED';
end $$;
reset role;

-- 4. Reopen, recent sessions, closed-session join (migration 0006).
do $$
declare s sessions; r sessions; n int; caught text;
begin
  s := fac_create_session(current_setting('smoke.tok'), 'REOP1', array['skill'], 'x', '{}');
  perform fac_close_session(current_setting('smoke.tok'), s.id);
  begin perform * from join_session('reop1'); raise exception 'FAIL: closed join returned no error';
  exception when raise_exception then if sqlerrm <> 'session_closed' then raise; end if; end;
  if exists (select 1 from join_session('nosuch1')) then raise exception 'FAIL: unknown code returned a row'; end if;
  select count(*) into n from fac_recent_sessions(current_setting('smoke.tok'), 50) where id = s.id and status = 'closed';
  if n <> 1 then raise exception 'FAIL: recent sessions'; end if;
  r := fac_reopen_session(current_setting('smoke.tok'), s.id);
  if r.status <> 'open' or r.closed_at is not null then raise exception 'FAIL: reopen %', r; end if;
  if not exists (select 1 from join_session('reop1')) then raise exception 'FAIL: join after reopen'; end if;
  perform fac_close_session(current_setting('smoke.tok'), s.id);
  perform fac_create_session(current_setting('smoke.tok'), 'REOP1', array['skill'], null, '{}');
  begin perform fac_reopen_session(current_setting('smoke.tok'), s.id); raise exception 'FAIL: reopen while chapter busy';
  exception when raise_exception then if sqlerrm <> 'chapter_busy' then raise; end if; end;
  begin perform fac_reopen_session('wrong', s.id); raise exception 'FAIL: reopen without token';
  exception when raise_exception then if sqlerrm <> 'bad_passcode' then raise; end if; end;
  raise notice 'reopen checks passed';
end $$;

-- 5. Hardening (migration 0007): lockout, token expiry, session auto-close, join throttle, grants.
reset role;
delete from fac_login_failures;
do $$
declare cfg app_config; tok text; n int; r record;
begin
  select * into cfg from app_config;

  -- Failed guesses are recorded (fac_login returns NULL instead of raising, so the row commits).
  for i in 1..cfg.login_max_failures loop
    if fac_login('guess-' || i) is not null then raise exception 'FAIL: wrong guess accepted'; end if;
  end loop;
  select count(*) into n from fac_login_failures;
  if n <> cfg.login_max_failures then raise exception 'FAIL: % failures logged, expected %', n, cfg.login_max_failures; end if;
  -- ...and then the client is locked out, even with the right passcode.
  begin perform fac_login('test-pass'); raise exception 'FAIL: not locked out after repeated failures';
  exception when raise_exception then if sqlerrm <> 'locked_out' then raise; end if; end;
  -- Once the window passes, the right passcode works again.
  update fac_login_failures set at = now() - cfg.login_window - interval '1 minute';
  tok := fac_login('test-pass');
  if tok is null then raise exception 'FAIL: login after lockout window'; end if;

  -- Global cap: failures from many clients also lock everyone out.
  delete from fac_login_failures;
  insert into fac_login_failures (client) select 'bot-' || g from generate_series(1, cfg.login_global_max_failures) g;
  begin perform fac_login('test-pass'); raise exception 'FAIL: global lockout not enforced';
  exception when raise_exception then if sqlerrm <> 'locked_out' then raise; end if; end;
  delete from fac_login_failures;

  -- Tokens expire and are stored hashed.
  tok := fac_login('test-pass');
  perform _check_token(tok);
  if exists (select 1 from fac_tokens where token_hash = tok) then raise exception 'FAIL: token stored in clear'; end if;
  update fac_tokens set expires_at = now() - interval '1 second';
  begin perform _check_token(tok); raise exception 'FAIL: expired token accepted';
  exception when raise_exception then if sqlerrm <> 'bad_passcode' then raise; end if; end;

  -- Rotation: new passcode works, old one and old tokens do not.
  tok := fac_login('test-pass');
  perform set_facilitator_passcode('a brand new passcode');
  begin perform _check_token(tok); raise exception 'FAIL: token survived rotation';
  exception when raise_exception then if sqlerrm <> 'bad_passcode' then raise; end if; end;
  if fac_login('test-pass') is not null then raise exception 'FAIL: old passcode still works'; end if;
  if fac_login('a brand new passcode') is null then raise exception 'FAIL: new passcode rejected'; end if;
  begin perform set_facilitator_passcode('short'); raise exception 'FAIL: weak passcode accepted';
  exception when raise_exception then if sqlerrm not like 'passcode must%' then raise; end if; end;
  delete from fac_login_failures;
  update app_config set passcode_hash = crypt('test-pass', gen_salt('bf', 4));
end $$;

-- Sessions auto-close after session_ttl, join says so, reopen restarts the clock.
do $$
declare tok text := fac_login('test-pass'); s sessions; r sessions; cfg app_config;
begin
  select * into cfg from app_config;
  s := fac_create_session(tok, 'AUTO12', array['skill'], null, '{}');
  update sessions set opened_at = now() - cfg.session_ttl - interval '1 minute' where id = s.id;
  begin perform * from join_session('AUTO12'); raise exception 'FAIL: expired session still joinable';
  exception when raise_exception then if sqlerrm <> 'session_closed' then raise; end if; end;
  perform _expire_sessions(); -- join_session's own sweep is rolled back by the exception it raises; the next call repeats it
  if (select status from sessions where id = s.id) <> 'closed' then raise exception 'FAIL: expired session not closed'; end if;
  r := fac_reopen_session(tok, s.id);
  if r.status <> 'open' or r.opened_at < now() - interval '1 minute' then raise exception 'FAIL: reopen did not restart the clock'; end if;
  if not exists (select 1 from join_session('AUTO12')) then raise exception 'FAIL: join after reopen'; end if;
  perform fac_close_session(tok, s.id);
end $$;

-- Join throttle: repeated wrong codes from one client are refused; real codes do not count.
do $$
declare cfg app_config;
begin
  select * into cfg from app_config;
  delete from join_misses;
  for i in 1..cfg.join_miss_limit loop
    if exists (select 1 from join_session('NOPE' || i)) then raise exception 'FAIL: unknown code matched'; end if;
  end loop;
  begin perform * from join_session('NOPE0'); raise exception 'FAIL: join guessing not throttled';
  exception when raise_exception then if sqlerrm <> 'rate_limited' then raise; end if; end;
  delete from join_misses;
end $$;

-- Grants: anon gets exactly the allowed functions; authenticated gets none.
do $$
declare bad text;
begin
  select string_agg(p.proname, ', ') into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute');
  if bad is not null then raise exception 'FAIL: authenticated can execute: %', bad; end if;
  select string_agg(p.proname, ', ') into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('join_session', 'resume_student', 'sync_answers', 'heartbeat', 'fac_login', 'fac_create_session', 'fac_open_sessions',
                           'fac_recent_sessions', 'fac_reopen_session', 'fac_session_stats', 'fac_close_session', 'fac_recode', 'export_data', 'fac_problem_counts');
  if bad is not null then raise exception 'FAIL: anon can execute internal functions: %', bad; end if;
  raise notice 'hardening checks passed';
end $$;
