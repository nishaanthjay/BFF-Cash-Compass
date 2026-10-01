-- Smoke test for the migrations (0001 → 0003). Run against a scratch database:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/smoke.sql
-- Every check raises on failure.
\set QUIET on
update app_config set passcode_hash = crypt('test-pass', gen_salt('bf', 4));

set role anon;

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
  begin perform _check_passcode('x'); raise exception 'FAIL: anon can call _check_passcode';
  exception when insufficient_privilege then null; end;
end $$;

-- 2. Passcode gate.
do $$ begin
  if fac_verify('nope') then raise exception 'FAIL: wrong passcode accepted'; end if;
  if not fac_verify('test-pass') then raise exception 'FAIL: right passcode rejected'; end if;
  begin perform fac_open_sessions('nope'); raise exception 'FAIL: open_sessions without passcode';
  exception when raise_exception then if sqlerrm <> 'bad_passcode' then raise; end if; end;
end $$;

-- 3. Session lifecycle, students, answers, resume, recode, rate limits.
do $$
declare
  s sessions; j record; r jsonb; tok uuid := gen_random_uuid(); ans jsonb := '[]';
  stu jsonb := jsonb_build_object('student_code', 'ABC234', 'device_type', 'laptop', 'expected_steps', 2, 'started_at', now(), 'forms', '{}'::jsonb);
  a1 uuid := gen_random_uuid();
  mk jsonb;
begin
  s := fac_create_session('test-pass', 'tx-014', array['skill', 'feasibility'], 'Grade 7');
  if s.chapter_code <> 'TX014' or s.modules <> array['skill', 'feasibility'] then raise exception 'FAIL: create %', s; end if;
  begin perform fac_create_session('test-pass', 'TX014', array['skill'], null); raise exception 'FAIL: two open sessions';
  exception when raise_exception then if sqlerrm <> 'chapter_busy' then raise; end if; end;
  begin perform fac_create_session('test-pass', 'NEW01', array['bogus'], null); raise exception 'FAIL: bad module accepted';
  exception when raise_exception then if sqlerrm not like 'invalid:%' then raise; end if; end;

  begin perform fac_create_session('test-pass', 'SHORT1', array['skill','feasibility','hybrid'], null, array['S1','bogus']); raise exception 'FAIL: bad problem id accepted';
  exception when raise_exception then if sqlerrm not like 'invalid:%' then raise; end if; end;
  declare sh sessions; jj record;
  begin
    sh := fac_create_session('test-pass', 'SHORT1', array['skill','feasibility','hybrid'], null, array['S1','S11A','S11B','F2','H1']);
    select * into jj from join_session('short1');
    if jj.problem_ids <> array['S1','S11A','S11B','F2','H1'] then raise exception 'FAIL: problem_ids not returned by join'; end if;
    perform fac_close_session('test-pass', sh.id);
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
  if (fac_session_stats('test-pass', s.id)->>'finished')::int <> 1 then raise exception 'FAIL: finished %', fac_session_stats('test-pass', s.id); end if;

  -- recode
  perform fac_recode('test-pass', a1, array['CORR'], 'manual');
  if (export_data('test-pass')->'recodes'->0->>'tag') <> 'manual' then raise exception 'FAIL: recode'; end if;

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
  perform fac_close_session('test-pass', s.id);
  if exists (select 1 from join_session('TX014')) then raise exception 'FAIL: joined a closed session'; end if;
  r := sync_answers(gen_random_uuid(), '[]', jsonb_build_array(mk || jsonb_build_object('answer_id', gen_random_uuid(), 'step_id', 'late', 'raw_value', 1)));
  if jsonb_array_length(r->'rejected') <> 1 then raise exception 'FAIL: insert into closed session'; end if;
  if resume_student(s.id, 'ABC234') is not null then raise exception 'FAIL: resume into closed session'; end if;

  r := export_data('test-pass', s.id);
  if jsonb_array_length(r->'responses') <> 60 or jsonb_array_length(r->'students') <> 3 then
    raise exception 'FAIL: export % responses, % students', jsonb_array_length(r->'responses'), jsonb_array_length(r->'students');
  end if;
  perform heartbeat();
  raise notice 'ALL SMOKE CHECKS PASSED';
end $$;
reset role;
