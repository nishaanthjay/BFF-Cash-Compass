# Adding questions (the item bank)

Items are TypeScript objects, so they're version-controlled and deployed with the app (push to `main`, and Vercel redeploys).

## How to add the real bank

1. Create one file per question in `src/items/bank/`, e.g. `src/items/bank/01-emergency-fund.ts`.
2. Run `npm test`. The item validator checks every item (see below) and names any problems.
3. Commit and push.

As soon as `src/items/bank/` contains at least one file, the 3 SAMPLE items in `src/items/samples/` are **no longer used**. You don't need to delete them.

Files are loaded in filename order, and `order` overrides that. Prefixing filenames with `01-`, `02-` … keeps things obvious.

## Template

```ts
import { defineItem } from '../types';

export default defineItem({
  id: 'emergency-fund',          // lowercase-with-dashes, unique, never reused
  title: 'Emergency fund',       // short label used in analysis charts
  version: 1,                    // bump when wording or numbers change
  active: true,                  // false = hidden from students, kept for analysis
  order: 1,
  deca_category: 'spending_saving', // spending_saving | credit_debt | employment_income | investing | risk_insurance | decision_making
  unit: 'usd',                   // usd | percent | months | years | count
  prompt_template:
    'You save {weekly:usd} a week. About how many weeks until you have {goal:usd}?',
  variables: { weekly: 25, goal: 1000 },
  truth: ({ weekly, goal }) => goal / weekly,
  explanation: '{goal:usd} ÷ {weekly:usd} a week = {truth:int} weeks.',
});
```

### Placeholders
- `{name}`: a plain number with separators (`1,000`)
- `{name:usd}`: `$1,000`, or `$12.50` when there are cents
- `{name:usd0}`: whole dollars
- `{name:pct}`: `7%`
- `{name:int}`: rounded integer
- `{truth}` / `{truth:usd0}` …: the computed true value. **Explanation only**; the validator rejects it in prompts.

### Derived values
If an explanation needs a number that isn't an input, add
`derived: (v) => ({ double: Math.round(72 / v.rate) })` and use `{double}`
(see `src/items/samples/compoundGrowth.ts`).

## What the validator checks (`src/items/validate.ts`)
- the id is unique and well formed, the title is present, and the version is a positive integer
- `deca_category` is one of the six
- every `{placeholder}` has a value, and `{truth}` doesn't appear in the prompt
- `truth()` returns a finite number greater than 0, because log error needs a positive truth
- at least one item is active

## Versioning
Every response stores `item_id`, `item_version` **and** a snapshot of the true value,
so editing an item never rewrites the analysis of old answers. If you change the numbers or wording, bump `version`.
