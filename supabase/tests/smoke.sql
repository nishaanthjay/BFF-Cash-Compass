-- Smoke test for 0001_init.sql. Run against a scratch database:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/smoke.sql
-- Every check raises on failure.
\set QUIET on
update app_config set passcode_hash = crypt('test-pass', gen_salt('bf', 4));

set role anon;

-- 1. Tables are unreachable for anon.
do $$ begin
  begin perform 1 from sessions; raise exception 'FAIL: anon can read sessions';
  exception when insufficient_privilege then null; end;
  begin insert into responses default values; raise exception 'FAIL: anon can insert responses';
  exception when insufficient_privilege then null; end;
  begin perform 1 from app_config; raise exception 'FAIL: anon can read app_config';
  exception when insufficient_privilege then null; end;
end $$;

-- 2. Private helpers are not callable.
do $$ begin
  begin perform _check_passcode('x'); raise exception 'FAIL: anon can call _check_passcode';
  exception when insufficient_privilege then null; end;
end $$;

-- 3. Passcode gate.
do $$ begin
  if fac_verify('nope') then raise exception 'FAIL: wrong passcode accepted'; end if;
  if not fac_verify('test-pass') then raise exception 'FAIL: right passcode rejected'; end if;
  begin perform fac_open_sessions('nope'); raise exception 'FAIL: open_sessions without passcode';
  exception when raise_exception then if sqlerrm <> 'bad_passcode' then raise; end if; end;
end $$;

-- 4. Session lifecycle, one open session per chapter, join, sync, rate limits.
do $$
declare
  s sessions; j record; r jsonb; tok uuid := gen_random_uuid(); att uuid := gen_random_uuid(); ans jsonb := '[]';
begin
  s := fac_create_session('test-pass', 'tx-014');
  if s.chapter_code <> 'TX014' then raise exception 'FAIL: chapter not normalised'; end if;
  begin perform fac_create_session('test-pass', 'TX014'); raise exception 'FAIL: two open sessions';
  exception when raise_exception then if sqlerrm <> 'chapter_busy' then raise; end if; end;

  select * into j from join_session('tx014');
  if j.session_id is distinct from s.id then raise exception 'FAIL: join_session'; end if;

  r := sync_answers(tok,
    jsonb_build_array(jsonb_build_object('attempt_id', att, 'session_id', s.id, 'item_count', 3, 'started_at', now())),
    jsonb_build_array(jsonb_build_object('answer_id', gen_random_uuid(), 'attempt_id', att, 'session_id', s.id,
      'item_id', 'sample-budget', 'item_version', 1, 'estimate', 1200, 'truth', 1200, 'answered_at', now())));
  if (r->>'attempts')::int <> 1 or (r->>'answers')::int <> 1 then raise exception 'FAIL: sync %', r; end if;

  -- idempotent retry: same payload again inserts nothing new, no error
  r := sync_answers(tok, jsonb_build_array(jsonb_build_object('attempt_id', att, 'session_id', s.id, 'item_count', 3, 'started_at', now())), '[]');
  if (r->>'attempts')::int <> 0 then raise exception 'FAIL: duplicate attempt inserted'; end if;

  -- negative estimate rejected per-row, not fatal
  r := sync_answers(tok, '[]', jsonb_build_array(jsonb_build_object('answer_id', gen_random_uuid(), 'attempt_id', att,
      'session_id', s.id, 'item_id', 'sample-loan', 'item_version', 1, 'estimate', -5, 'truth', 10, 'answered_at', now())));
  if jsonb_array_length(r->'rejected') <> 1 then raise exception 'FAIL: negative estimate accepted %', r; end if;

  -- answer rate limit: 31st answer in a minute is refused
  for i in 1..29 loop
    ans := ans || jsonb_build_object('answer_id', gen_random_uuid(), 'attempt_id', att, 'session_id', s.id,
      'item_id', 'item-' || i, 'item_version', 1, 'estimate', i, 'truth', 1, 'answered_at', now());
  end loop;
  r := sync_answers(tok, '[]', ans);
  begin
    perform sync_answers(tok, '[]', jsonb_build_array(jsonb_build_object('answer_id', gen_random_uuid(), 'attempt_id', att,
      'session_id', s.id, 'item_id', 'one-more', 'item_version', 1, 'estimate', 1, 'truth', 1, 'answered_at', now())));
    raise exception 'FAIL: rate limit not enforced';
  exception when raise_exception then if sqlerrm <> 'rate_limited' then raise; end if; end;

  -- attempt limit: 3 per device per session
  for i in 1..3 loop
    r := sync_answers(tok, jsonb_build_array(jsonb_build_object('attempt_id', gen_random_uuid(), 'session_id', s.id, 'item_count', 3, 'started_at', now())), '[]');
  end loop;
  if jsonb_array_length(r->'rejected') <> 1 then raise exception 'FAIL: attempt limit not enforced %', r; end if;

  if (fac_session_stats('test-pass', s.id)->>'responses')::int <> 30 then raise exception 'FAIL: stats %', fac_session_stats('test-pass', s.id); end if;

  -- closed session: no join, no inserts
  perform fac_close_session('test-pass', s.id);
  if exists (select 1 from join_session('TX014')) then raise exception 'FAIL: joined a closed session'; end if;
  r := sync_answers(gen_random_uuid(), '[]', jsonb_build_array(jsonb_build_object('answer_id', gen_random_uuid(), 'attempt_id', att,
      'session_id', s.id, 'item_id', 'late', 'item_version', 1, 'estimate', 1, 'truth', 1, 'answered_at', now())));
  if jsonb_array_length(r->'rejected') <> 1 then raise exception 'FAIL: insert into closed session %', r; end if;

  r := export_data('test-pass');
  if jsonb_array_length(r->'responses') <> 30 then raise exception 'FAIL: export %', jsonb_array_length(r->'responses'); end if;
  perform heartbeat();
  raise notice 'ALL SMOKE CHECKS PASSED';
end $$;
reset role;
