# Adding and editing problems (the item bank, v2)

Problems are TypeScript data files, so they are version-controlled and deployed with the app. The student screens and the admin
pages are both generated from the same file: input components come from each step's `input`, charts come from `admin`.

## How to add or replace a problem

1. Create or edit one file per problem in `src/items/bank/`, e.g. `s07-rule-of-72.ts`. Files are collected automatically.
2. Run `npm test`. The validator (`src/items/validate.ts`) checks the whole bank and names any problem.
3. Commit and push; Vercel redeploys.

Wording in the current bank is **DRAFT** (`draft: true` shows a "Draft wording" tag in the admin pages). Replace it, then remove the flag.

## Shape of a problem

```ts
import { defineProblem } from '../types';

export default defineProblem({
  id: 'S7',                       // S1–S15, F1–F8, H1–H2; a letter suffix is allowed (S11A). Never reuse an id.
  slug: 'rule-of-72',
  title: 'Rule of 72 Race',
  version: 1,                     // bump when wording or numbers change
  active: true,                   // false = hidden from students, kept for analysis
  draft: true,
  module: 'skill',                // skill | feasibility | hybrid (the facilitator picks modules per session)
  deca_category: 'investing',
  families: ['compounding'],      // arithmetic | percent | compounding | time_preference | credit_risk | feasibility
  scenario: { layout: 'situation', text: '…', facts: [{ label: 'Start', value: '$1,000' }] },
  order: { notAdjacent: ['S8'] }, // optional ordering rules, see below
  steps: [ /* see below */ ],
  admin: [ /* chart specs, see below */ ],
  decision: 'What the facilitator should do with this chart.',
  notes: ['Honest-limit note shown on the page.'],
});
```

**Scenario layouts:** `priceTag`, `receipt`, `claim` (always "someone says…", with `source`), `situation`, `jars`.

## Steps

Each step is one screen, locked on confirm. There is no feedback and no back button.

```ts
{
  id: 's1',
  kind: 'cold',            // cold | control | guided | rating_gut | rating_post | why | choice
  label: 'Step 1 · years to double',   // short label used in admin charts
  prompt: 'About how many years until the $1,000 becomes $2,000?',
  input: { type: 'numberLine', min: 0, max: 50, scale: 'linear', unit: 'years' },
  correct: 11.9,           // a number, or a function of the student's earlier locked answers
  codes: [{ code: 'LIN', value: 16.7 }],   // predicted wrong answers (auto strategy codes)
}
```

**Inputs** (`input.type`): `number`, `numberLine` (linear or log; never a default), `jar`, `curve`, `stack`, `dotGrid`, `calendar`
(`single`/`multi`/`count`), `timeline`, `rank`, `shade`, `choice`, `text`, `dial`. Every input has a typed alternative and no default value.

**Classification** (`src/lib/classify.ts`): an answer within ±1% of `correct` gets `CORR`; within ±1% of a predicted `codes[].value`
gets that code (several can match); otherwise `UNK`. Overrides:
- `correctTolPct` / `codes[].tolPct`: a tighter or looser band when two valid methods are less than 1% apart.
- `noUnk: true`: never code an unmatched answer as `UNK` (integer or assumption-based steps).
- `correctChoice`: correct option id(s) for `choice` steps.

**Forms:** `form: { key, options }` on the problem, then `forms` / `promptByForm` on steps, shows different steps or wording per student
(S12 anchor high/low/none; S11A/S11B order). The form is assigned from a hash of the student code and recorded as `form_version`.

**Order rules** (`src/lib/order.ts`): `order: { before, notAdjacent, minGap }` plus `orderByForm`. The engine shuffles with a seed from the student code,
rejects sequences that break a rule, and reports `relaxed: true` if no valid order exists.

## Admin charts (`admin`)

A list of chart specs, rendered in order on `/analysis/item/:id`. Common types: `dots` (beeswarm with reference lines; set `primary: true` for the first),
`codeBar`, `funnel`, `dumbbell`, `calibration`, `scatter`, `spaghetti`, `waterfall`, `sankey`, `pairTiles`, `ridgeline`, `logRatio`, `slope`, `calendarHeat`, `twoByTwo`.
The full union is `ChartSpec` in `src/items/types.ts`; the validator checks that every referenced step exists.

## What the validator checks

- ids are unique and well formed; every module/family/category is valid
- every code value is finite, and the correct value is not within ±1% of any predicted wrong value
- on number lines and jars, the correct value is not at the edge or the centre of the axis
- order rules, forms and chart specs reference real problems and steps
- at least one problem is active

## Versioning

Every answer stores `item_id`, `item_version`, `form_version` and a snapshot of the correct value, so editing a problem never rewrites old results.
Bump `version` when you change numbers or wording.
