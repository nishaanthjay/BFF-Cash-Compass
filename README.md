# BFFA Money Check

A financial-literacy diagnostic for grades 6–8, run once at the start of a BFF of America chapter workshop. Students answer
25 multi-step money problems (S11 is delivered as two items, S11A and S11B, so the bank has 26 files). The facilitator gets a live
"where is the gap?" dashboard to decide what to teach first.

> **Status: all four build stages are done.** Item wording is **DRAFT**, written from the *Interaction and Admin Visual
> Spec*. It is marked "Draft wording" in the admin pages. Replace it with approved wording before using results for
> anything beyond workshop teaching (see [docs/ITEM_FORMAT.md](docs/ITEM_FORMAT.md)).

## Quick start (demo mode, zero infrastructure)

```bash
npm install
npm run dev        # http://localhost:5173
```

With no Supabase env vars, the app runs against an **in-browser mock API** with seeded, clearly labelled **DEMO DATA**
(about 8 workshops of synthetic students, one live and one deliberately low-n). Everything works, including the admin dashboard.

| Where | What |
|---|---|
| `/` | Student join (chapter code, or `/?c=CODE` from the QR) |
| `/facilitator` | Passcode **`demo`** → pick modules → start a session → project code + QR |
| `/analysis` | Same passcode → Problems, Teach first, Students, Quality tabs; CSV export |
| `/analysis/item/S6` | One problem's charts and "facilitator decision" |

To demo the whole loop on one laptop, start session `TX999` on `/facilitator`, then open `/?c=TX999` in another tab. Both tabs share
the demo database in localStorage. "Reset demo data" restores the seed.

## How it works

1. **Facilitator** starts a session for a chapter code and picks modules (Skill, Feasibility, Hybrid). The screen shows the code,
   a QR code and live counts. Closing the session stops new answers.
2. **Student** joins with the chapter code and gets a random **anonymous student code** to write down (it lets them resume
   on another device). Then one question per screen. **Lock answer** is final: no back button, **no feedback of any kind**,
   no timers, no points. A typed number box is always available beside any slider or tap input, and there are no default values.
3. **Order** is seeded by the student code: random within modules, with rules such as S6 before H1, S11A/S11B at least 5 items apart
   (order counterbalanced), and F1 kept away from S4/S5. S11 order and the S12 anchor (high/low/none) are balanced by a hash of the code.
4. **Admin** has per-problem pages (beeswarm dots with the correct value as a solid line and predicted wrong answers as dashed
   lines, plus problem-specific charts) and cross-item views:

   | View | Where |
   |---|---|
   | D1 Teach-first ranking, D2 gap map (problem × skill family), D3 class radar (workshop vs pooled), D4 compounding panel ("linear on 3 or more problems"), D5 believable-but-wrong rate | Teach first tab |
   | D6 student drilldown by anonymous code | Students tab |
   | D7 instrument quality (difficulty, discrimination), unmatched-answer recode tool, typed vs dragged | Quality tab |
   | D8 projector mode (checkbox in the scope card): no student codes, no recode tool, cells under 5 students hidden | everywhere |

Every chart shows n and the date. Wrong-answer patterns are coded automatically (within ±1% of a predicted wrong value);
answers that match nothing are `UNK` and can be recoded by hand. Manual codes override automatic ones everywhere.

## Overrides of the earlier brief

The Interaction and Admin Visual Spec replaced these earlier rules, so the app now does the opposite:
- **In-app strategy coding** (earlier: no auto-tagging).
- **Anonymous student-code drilldown** (earlier: no per-student pairing). Codes are random and tied to no name.
- **Live workshop view**, polling every 10 s (earlier: no live dashboards).
- **No reveal screen.** Students never see correct answers or feedback. Done says only "All answers saved".
- Single-phase: no pre/post/delayed logic anywhere.

## Privacy

- **No student identifiers**: no names, emails, schools, birthdates or student IDs, and no IP address in our tables.
- A row stores only: session (so the chapter code), anonymous student code, problem/step, answer, input method, timings, and timestamps.
- Free-text answers show a "don't type names" hint, and emails and phone numbers are redacted in the browser before saving.
- The device token (rate limiting) is a random per-browser UUID in a separate table, never attached to answers.
- **Caveat:** Supabase and Vercel keep their own platform request logs, which can include IP addresses. That is outside our tables
  and our control. Say so in any consent notice.

## Honest limits (also shown on the charts)

- Wording is DRAFT. Reference values were checked against the spec's scenario numbers; F6's $1,548 "realistic revenue" is not a multiple of
  the $40 lawn price, so it is a labelled reference line, not a computed answer.
- **S11** is hypothetical choices, so it shows present-bias patterns, not real behaviour.
- **S12** needs the pooled view: per workshop there are too few students to detect a typical anchoring effect. The chart shows the
  anchoring index, a bootstrap interval and the minimum detectable effect.
- **F6/F7** depend on the scenario assumptions shown on the page.
- **Timing and input-method comparisons are exploratory.** Students are not randomly assigned to typed vs dragged.
- Some tolerance bands are tighter than ±1% (S5 step 3, S6 step 3a, S10 steps 3a/4) because the simple and compound answers are less than 1% apart.
- S2 and S10 axes were widened from the spec so the answer isn't at the centre of the line.
- With every module selected, a session is well over 12 minutes. Pick modules per workshop.
- The Supabase client has been tested only against local SQL and the mock, not a live Supabase project.

## Offline tolerance

Answers are written to localStorage **before** any network call, then synced in idempotent batches with backoff, on reconnect,
on tab focus and every 20 s. Rate limits: 60 answers per minute and 3 student codes per device per session. The server accepts
answers only for an **open** session, so leave sessions open a few minutes after the last student finishes.

## Real deployment

### 1. Supabase
1. Create a free project.
2. Run the migrations in `supabase/migrations/` in order (`0001` … `0004`), in the SQL editor or with `supabase db push`.
3. **Set the facilitator passcode** (the migration installs a placeholder):
   ```sql
   update public.app_config set passcode_hash = crypt('your-long-passcode', gen_salt('bf', 10));
   ```
4. Copy the **Project URL** and **anon public key** (Settings → API).

Security model: RLS on every table with **no policies**, all table privileges revoked from `anon`. The browser can only call
SECURITY DEFINER functions: `join_session`, `resume_student`, `sync_answers` (open sessions, rate-limited), the passcode-gated
`fac_*` functions and `export_data`, and `heartbeat`. `supabase/tests/smoke.sql` exercises all of it as the `anon` role
(run it after the migrations on a database that has `anon` and `authenticated` roles; it passes on Postgres 16).

### 2. Vercel
Import the repo (Vite, `npm run build`, output `dist`). Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
(see [.env.example](.env.example)). `vercel.json` rewrites all paths to `index.html`.

### 3. GitHub Actions
Add secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MC_PASSCODE`.
- `heartbeat.yml`: daily `heartbeat()` so the free tier never pauses.
- `backup.yml`: every Monday, exports every response to CSV + JSON as a workflow artifact (90 days).
- `ci.yml`: tests, contrast check and build on every push.

## Data export (CSV v2)

One row per locked step. Columns include `student_code`, `workshop_id`, `chapter_code`, `item_id`, `step_id`, `form_version`,
`raw_value`, `input_method`, `strategy_code` (after manual recodes) and `auto_strategy_code`, `manually_coded`, `correct_value`,
computed `signed_error`, `ape` and `log_ratio`, ratings, free text, `time_to_first_touch_ms`, `time_to_lock_ms`, `n_revisions`,
`device_type`, `item_position`, `value_json` and `answered_at`. Text starting with `=`, `+`, `-` or `@` is escaped against spreadsheet formulas.

## Development

```bash
npm test            # vitest (items, classifier, order engine, inputs, charts, analysis, CSV, mock API, token scan, contrast)
npm run contrast    # WCAG table (fails below AA)
npm run build       # typecheck + production build
node scripts/e2e.mjs http://localhost:5173 screenshots   # Playwright walk-through (375 px, offline, reduced motion)
```

```
src/styles/tokens.ts     the only file with hex colours / font sizes (enforced by tests/tokens.test.ts)
src/components/          shared components
src/items/               types, validator, finance helpers, bank/ (one file per problem)
src/inputs/              student inputs (number line, curve, dial, stack, dot grid/jar, calendar, shade bar, timeline, rank)
src/lib/                 pure logic: classify, order, forms, analysis, crossItem, queue, rateLimit, csv, telemetry
src/charts/              hand-built SVG charts for the admin pages
src/api/                 ApiClient interface, Supabase client, in-browser mock + DEMO seed
src/screens/             student, facilitator, analysis
supabase/                migrations + SQL smoke test
```

## Accessibility

- Every text/background pair is checked numerically (`npm run contrast`, also run in tests).
- Thick blue focus border plus hard shadow; semantic HTML; a label on every input; keyboard-operable inputs and typed alternatives.
- Meaning is never carried by colour alone: charts use shapes, direct labels and legends, and tables where useful.
- `prefers-reduced-motion` disables spring, wiggle and count-up. Tested at a 375 px viewport with no horizontal scroll.

<details><summary>Contrast results</summary>

| Use | FG | BG | Ratio | Min | Result |
|---|---|---|---|---|---|
| Body text on cream page | foreground | background | 14.36:1 | 4.5 | PASS |
| Body text on white card | foreground | card | 14.63:1 | 4.5 | PASS |
| Text on muted surface | foreground | muted | 13.35:1 | 4.5 | PASS |
| Secondary text on cream | mutedForeground | background | 4.67:1 | 4.5 | PASS |
| Secondary text on card | mutedForeground | card | 4.76:1 | 4.5 | PASS |
| Secondary text on muted surface | mutedStrong | muted | 6.92:1 | 4.5 | PASS |
| White on primary button | primaryForeground | primary | 4.88:1 | 4.5 | PASS |
| Blue numbers/labels on card | primary | card | 4.88:1 | 4.5 | PASS |
| Blue text on cream | primary | background | 4.79:1 | 4.5 | PASS |
| Links on cream | primaryDeep | background | 7.29:1 | 4.5 | PASS |
| Dark text on gold | tertiaryForeground | tertiary | 9.92:1 | 4.5 | PASS |
| Text on soft gold | foreground | tertiarySoft | 13.03:1 | 4.5 | PASS |
| Text on soft pink | foreground | secondarySoft | 12.06:1 | 4.5 | PASS |
| Text on soft mint | foreground | quaternarySoft | 12.90:1 | 4.5 | PASS |
| Text on soft blue | foreground | primarySoft | 12.55:1 | 4.5 | PASS |
| Dark text on mint chip | foreground | quaternary | 7.61:1 | 4.5 | PASS |
| Dark text on pink chip | foreground | secondary | 5.52:1 | 4.5 | PASS |
| Error text on card | danger | card | 6.57:1 | 4.5 | PASS |
| Error text on error surface | danger | dangerSurface | 6.05:1 | 4.5 | PASS |
| Error text on cream | danger | background | 6.46:1 | 4.5 | PASS |
| UI: 2px borders vs card | foreground | card | 14.63:1 | 3 | PASS |
| UI: focus ring vs cream | ring | background | 4.79:1 | 3 | PASS |
| UI: muted bar fill vs card | mutedForeground | card | 4.76:1 | 3 | PASS |
| UI: bar fill vs card | primary | card | 4.88:1 | 3 | PASS |

</details>

## Decisions and assumptions

- **Single-phase.** Taken once; no PRE/POST/DELAYED.
- **Migrations.** `0001` base, `0002` single phase, `0003` questionnaire (step responses, student codes, recodes), `0004` relaxes problem ids to allow S11A/S11B.
- **Join model.** Chapter code alone; one open session per chapter.
- **Truth snapshot.** Each answer stores its correct value at answer time, so later item edits don't rewrite past results.
- **Chart colours.** Correct = Ledger Blue, named wrong pattern = pink `#DB2777`, unclassified = gray, validated with a colour-vision check; shapes and labels carry meaning too. Gold marks the headline finding.
- **Brand colours.** `#0077B5` and `#FECE66` come from DESIGN.md and could **not** be checked against bffamerica.org (network blocked). Please verify.
- **Logo.** Placeholder text wordmark in `src/components/Wordmark.tsx`; swap in the official asset.
- **Tap-based stack/rank.** Stack and rank inputs use tap-to-add plus arrows and drag-to-reorder, not drag-from-pool, which is unreliable on touch.
- **Passcode.** One shared passcode in sessionStorage; wrong guesses are slowed server-side.
- **Hex outside tokens.** `index.html` (theme-color) and `public/favicon.svg` contain hex, outside `src/`.
