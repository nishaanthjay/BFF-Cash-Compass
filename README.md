# BFFA Money Check

A financial-literacy diagnostic for grades 6–8, run once at the start of BFF of America chapter workshops.
Every question is a realistic money scenario, and the student types a **numeric estimate** (no multiple choice).
The size and direction of the gap between the estimate and the true value
(log error = `ln(estimate ÷ truth)`) shows where the misconceptions are.

Vite + React + TypeScript, Supabase (free tier), Framer Motion, Lucide and Recharts. The visual system is in [DESIGN.md](DESIGN.md).

> **SAMPLE ITEMS ONLY.** The repo ships 3 clearly labelled sample questions so the whole app can be tested.
> To add the real bank, see [docs/ITEM_FORMAT.md](docs/ITEM_FORMAT.md).

---

## Quick start (demo mode, zero infrastructure)

```bash
npm install
npm run dev        # http://localhost:5173
```

With no Supabase env vars set, the app runs against an **in-browser mock API** with seeded, clearly labelled
**DEMO DATA**: 8 chapters and about 560 synthetic responses, with one chapter deliberately low-n.
Everything works, including the analysis view.

| Where | What |
|---|---|
| `/` | Student join (try chapter code from a session you start below) |
| `/facilitator` | Passcode **`demo`** → start a session → project code + QR |
| `/analysis` | Same passcode → aggregate charts, filters, CSV export |
| `/preview/item`, `/preview/reveal` | Design-review routes for the two signature screens (demo mode only) |

To demo the whole loop on one laptop, open `/facilitator` in one tab and start session `TX999`. Then open `/?c=TX999` in
another tab: both tabs share the demo database in localStorage. "Reset demo data" on the analysis page restores the seed.

## How it works

1. **Facilitator** enters the passcode and starts a session for a chapter code. Each chapter can have one open session at a time.
   The screen shows the chapter code, a QR code (`https://<host>/?c=CODE`) and a live count of students started,
   students finished and answers received, refreshed every 5 s. Reloading the page resumes the open session. Closing the
   session stops all new answers.
2. **Student** types the chapter code (or scans the QR), then answers every question one per screen using the
   custom keypad (hardware keyboards and screen readers work too). After the last question, a **reveal** walks
   through each item on a log-scale number line with a one-line explanation, then a done screen.
3. **Analysis** (same passcode) shows aggregates only:
   - stat tiles: responses, chapters, sessions and completion rate
   - median log error per item and per DECA category
   - error direction (under / over) per item
   - responses per chapter, flagged as low-n below 10
   - filters by chapter and date range, with n shown on every chart
   - CSV export of the raw responses

## Privacy

- **No student identifiers of any kind**: no names, emails, schools, birthdates or student IDs.
- A response stores only: session (and so the chapter code), item id/version, the numeric estimate, the true value at
  answer time, and timestamps.
- `attempt_id` is a random id for one run-through, used only to compute the completion rate. A new one is generated
  every time, so it can't link a student across sessions.
- The device token used for rate limiting is a random per-browser UUID. It's stored in a separate table and never
  attached to responses.
- The join screen shows a plain-language privacy notice.

## Offline tolerance

Answers are written to localStorage **before** any network call, then synced in idempotent batches with exponential
backoff, retrying on reconnect, on tab focus and every 20 s. Both the run itself and the queue survive reloads. The done screen
shows "All answers saved" or "Waiting for wifi". Every font weight is fetched at startup, and the staff pages are split into
their own chunks so students download less.

The server only accepts answers for an **open** session. Answers still queued when the facilitator closes the session are refused,
and the done screen tells the student to let the facilitator know. **Leave sessions open a few minutes after the last student finishes.**

## Real deployment

### 1. Supabase
1. Create a free project.
2. Open the SQL editor and run `supabase/migrations/0001_init.sql`, then `0002_single_phase.sql`.
   With the Supabase CLI, run `supabase db push` instead.
3. **Set the facilitator passcode** (the migration installs a placeholder):
   ```sql
   update public.app_config set passcode_hash = crypt('your-long-passcode', gen_salt('bf', 10));
   ```
4. Copy the **Project URL** and the **anon public key** (Settings → API).

Security model: RLS is on for every table with **no policies**, and every table privilege is revoked from `anon`. The browser can
only call these SECURITY DEFINER functions:
- `join_session` and `sync_answers`: open sessions only, rate-limited to 30 answers/min and 3 attempts per session per device.
- `fac_*` and `export_data`: these require the passcode.
- `heartbeat`.

`supabase/tests/smoke.sql` exercises all of this as the `anon` role. It passes against Postgres 16.

### 2. Vercel
1. Import the repo. The framework is Vite; build with `npm run build` and output to `dist`.
2. Set the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see [.env.example](.env.example)).
3. Deploy. `vercel.json` rewrites every path to `index.html` so deep links like `/?c=TX014` and `/analysis` work.

### 3. GitHub Actions (keep-alive + backups)
Add these repo secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `MC_PASSCODE`.
- `heartbeat.yml`: calls `heartbeat()` once a day so the free tier never pauses (it also prunes old rate-limit rows).
- `backup.yml`: every Monday it exports every response to CSV + JSON and uploads them as a workflow artifact (kept 90 days).
- `ci.yml`: runs tests, the contrast check and the build on every push.

## Development

```bash
npm test            # vitest: log error/median, queue sync, rate limit, item truth fns + validator, CSV, analysis, mock API, token scan, contrast
npm run contrast    # WCAG table (fails below AA)
npm run build       # typecheck + production build
node scripts/e2e.mjs http://localhost:5173 screenshots   # Playwright walk-through in demo mode (375 px, offline, reduced motion)
```

Structure:
```
src/styles/tokens.ts     the only file with hex colours / font sizes (enforced by tests/tokens.test.ts)
src/components/          shared components (Button, Card, Input, NumberDisplay, Keypad, ProgressCoins, StatTile, ChartCard, …)
src/items/               item types, validator, samples/, bank/ (drop real items here)
src/lib/                 pure logic: logError, analysis, queue, rateLimit, csv, entry, verdict, logScale
src/api/                 ApiClient interface, Supabase client, in-browser mock + DEMO seed
src/screens/             student (Join, Run, Item, Reveal, Done), facilitator, analysis
supabase/                migrations + SQL smoke test
```

## Accessibility

- Every text/background pair is checked numerically (`npm run contrast`, which also runs in tests).
- Focus states are a thick blue border plus a hard shadow.
- Semantic HTML, a label on every input, and a keypad of real buttons, so it is keyboard-operable.
- Meaning is never carried by colour alone: verdicts and errors pair an icon with text, and the charts have legends,
  direct labels and a table view.
- `prefers-reduced-motion` disables spring, wiggle, count-up and the reveal animation. The e2e script verifies this.
- The layout was tested at a 375 px viewport with no horizontal scroll.

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

- **Single-phase diagnostic.** It is taken once at the start of a workshop. There are no session types (PRE/POST/DELAYED), no
  parallel forms A/B and no pre-vs-post comparison. Because the "no answers during PRE" rule went away, every student sees the reveal
  after their last question.
- **Migrations.** `0001_init.sql` was written after the single-phase decision, so it never had `session_type` or `form`, and no earlier
  migration ever existed in this repo. `0002_single_phase.sql` drops those columns, types and old function signatures with
  `IF EXISTS`, so it does nothing on a fresh database and cleans up any database built from an earlier draft.
- **Join model.** Students join by chapter code alone, which is why each chapter can have only one open session.
- **Truth snapshot.** Each response stores the true value at answer time, so later item edits don't silently change past results.
- **Zero guesses.** Estimates of 0 have no log error. They are excluded from medians (with the count shown), and they count as "under"
  in the direction table.
- **"Spot on"** on the student reveal means within 10%. "Exact" in analysis means within 1%.
- **Chart colours.** Error direction is a diverging encoding (under = pink `#DB2777`, exact = gray, over = Ledger Blue), validated with a
  colour-vision-deficiency palette check. The gold highlight is reserved for the headline ("biggest miss"), since there is no
  pre/post delta any more.
- **Brand colours.** `#0077B5` and `#FECE66` come from DESIGN.md. They could **not** be checked against bffamerica.org from the
  build environment (network egress blocked), so please verify them.
- **Logo.** The BFF logo is a placeholder text wordmark (`src/components/Wordmark.tsx`). Swap in the official asset there.
- **Passcode.** One shared passcode, kept in sessionStorage. Wrong guesses are slowed server-side (0.5 s each).
- **Icon rule exceptions.** DESIGN.md says icons always sit in a coloured circle. The exceptions are the keypad's backspace glyph and
  the small warning glyph inside the "Low n" chip.
- **Hex outside the tokens file.** `index.html` (theme-color) and `public/favicon.svg` contain hex, but both are outside `src/`.
