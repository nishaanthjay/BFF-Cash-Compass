# Security

Cash Compass collects anonymous answers from minors, so the rules below matter. If you find a problem, email the
repository owner instead of opening a public issue.

## What is and isn't stored

- No names, emails, schools, birthdates, student IDs or IP addresses are stored with answers. A student is a random
  6-character code.
- Failed passcode attempts and wrong join codes are logged with a throttling key (the caller's IP address from the request
  headers, or `unknown`). Those rows are in their own tables (`fac_login_failures`, `join_misses`), never joined to answers,
  and deleted after a day.
- Supabase and Vercel keep their own request logs. That is outside this database.

## How the database is locked down

- Every table has row level security on and **no policies**; all table privileges are revoked from `anon` and
  `authenticated`. The browser cannot read or write a table directly.
- The browser only holds the Supabase **publishable (anon) key**, and talks to the database through `SECURITY DEFINER`
  functions (RPCs). Never put the secret / service-role key in the app, in GitHub secrets for this repo, or in Vercel.
- Students can call exactly four functions: `join_session`, `resume_student`, `sync_answers`, `heartbeat`.
- The `authenticated` role has no function access at all (the app never signs anyone in).
- Facilitator functions (`fac_*`, `export_data`) are reachable with the anon key because the facilitator's browser has
  nothing else, **but each one refuses to run without a valid token**. See below.
- Internal helpers (`_check_token`, `_expire_sessions`, `_session_stats`, `_client_key`, `_sync_answers_core`,
  `_resume_student_core`, `set_facilitator_passcode`) are not executable by `anon` or `authenticated`.
- New functions are no longer executable by anon/authenticated by default (`alter default privileges`). Grant on purpose.

## The facilitator passcode

There is one shared passcode. It is never in the code or in git.

1. The passcode is stored only as a salted bcrypt hash in `app_config.passcode_hash`.
2. `fac_login(passcode)` checks it. A correct passcode returns a random 256-bit token (only its SHA-256 is stored, valid
   for 8 hours). The browser keeps the token in `sessionStorage` and sends it with every facilitator call; the passcode
   itself is not kept or re-sent.
3. Wrong guesses are logged and **never raise an error** (an error would roll the log row back). After 8 failures from one
   client, or 40 from anyone, inside 15 minutes, `fac_login` raises `locked_out` until the window passes. Logins are also
   serialised and slowed slightly. Limits live in `app_config` (`login_max_failures`, `login_global_max_failures`,
   `login_window`, `token_ttl`) and can be changed with SQL.
4. The per-client key comes from the `cf-connecting-ip` header. If a proxy ever hides it, everyone shares the key `unknown`
   and the global cap is what protects you. One person (or a student on the school wifi who knows the URL) can therefore
   lock facilitators out for 15 minutes by guessing badly. That is the trade-off for stopping brute force.
5. Use a long passcode (a four-word phrase or longer). The lockout limits guessing to a few dozen tries per 15 minutes,
   but length is what makes that safe.

### Rotating the passcode

Do this when you first deploy, when someone who knew it leaves, and any time you think it leaked. Rotating signs
every facilitator out and clears the failure log.

**Option A: Supabase SQL editor** (runs as `postgres`). The editor keeps a query history, so delete the snippet afterwards.

```sql
select public.set_facilitator_passcode('your new long passcode here');
```

**Option B: psql, so the passcode never appears in a file or in shell history.** Use the connection string from
Supabase → Project Settings → Database.

```bash
read -rs NEWPASS            # type the passcode, press enter (nothing is echoed)
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -v p="$NEWPASS" -c "select public.set_facilitator_passcode(:'p')"
unset NEWPASS
```

The function refuses passcodes shorter than 12 characters. Afterwards update the `MC_PASSCODE` GitHub Actions secret
(used only by the weekly backup) so the backup can still sign in.

A brand-new database still carries a placeholder passcode from migration `0001`. Migration `0007` replaces it with a random
unknown one, so the facilitator pages stay locked until you rotate it. Nothing public can unlock them.

## Sessions and codes

- A session closes by itself 6 hours after it was opened (`app_config.session_ttl`). Reopening restarts the clock. Students
  who try to join an ended session are told it has ended; late answers to it are rejected.
- Automatic join codes are 6 characters from a 31-letter alphabet (about 900 million). Facilitators may still type a short
  code (3-10 characters), which is easier to guess; only do that for sessions that are not sensitive.
- Wrong join codes are throttled per client (100 misses per 10 minutes by default).

## Known limits (accepted)

- The Supabase security advisor will keep flagging the 13 anon-executable `SECURITY DEFINER` functions. That is the design:
  an RPC-only API with no accounts. Removing the warning would mean moving these calls behind an Edge Function that uses
  the service-role key.
- Six (nine after `0007`) tables show "RLS enabled, no policy". That is intentional: no policy means no direct access.
- A shared passcode means no per-person audit trail.
