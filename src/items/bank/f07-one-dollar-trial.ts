import { defineProblem } from '../types';

/** DRAFT wording, from the Interaction & Admin Visual Spec, F7. Price is illustrative. */
export default defineProblem({
  id: 'F7',
  slug: 'one-dollar-trial',
  title: 'The $1 Trial',
  version: 1,
  active: true,
  draft: true,
  module: 'feasibility',
  deca_category: 'spending_saving',
  families: ['feasibility', 'arithmetic'],
  scenario: {
    layout: 'claim',
    who: 'StreamBox',
    source: 'ad',
    claim: 'Try StreamBox for just $1 for your first month! Then $14.99 a month.',
  },
  steps: [
    { id: 'gut', kind: 'rating_gut', label: 'Gut rating', prompt: 'How believable is “just $1”? Go with your gut.', input: { type: 'dial' } },
    {
      id: 's1',
      kind: 'cold',
      label: 'Step 1 · months at full price',
      prompt: 'You sign up and never cancel. Tap every month in your first year when you pay the full $14.99.',
      input: { type: 'calendar', mode: 'multi', cells: 12, columns: 4, cellWord: 'Month', unit: 'count' },
      correct: 11,
      noUnk: true,
    },
    {
      id: 's1b',
      kind: 'guided',
      label: 'Step 1b · first-year total',
      prompt: 'How much do you pay in total over the first 12 months?',
      input: { type: 'number', unit: 'usd' },
      calculator: true,
      correct: 165.89,
      codes: [
        { code: 'FRAME', value: 1 },
        { code: 'NOTRIAL', value: 179.88 },
      ],
    },
    {
      id: 's2',
      kind: 'guided',
      label: 'Step 2 · average per month',
      prompt: 'What is the average you pay per month over that first year?',
      input: { type: 'number', unit: 'usd' },
      calculator: true,
      correct: 13.82,
      codes: [
        { code: 'FRAME', value: 1 },
        { code: 'NOTRIAL', value: 14.99 },
      ],
    },
    {
      id: 's3',
      kind: 'choice',
      label: 'Step 3 · is the $1 fair',
      prompt: 'How does the “$1” in the ad compare with what you really pay over the year?',
      input: {
        type: 'choice',
        options: [
          { id: 'misleading', label: 'The $1 is misleading' },
          { id: 'accurate', label: 'The $1 is accurate' },
          { id: 'depends', label: 'It depends' },
        ],
      },
    },
    {
      id: 's4',
      kind: 'choice',
      label: 'Step 4 · what to check',
      prompt: 'Before signing up, what would you check? Tap all that you would.',
      input: {
        type: 'choice',
        multi: true,
        options: [
          { id: 'renewal', label: 'When and how it renews' },
          { id: 'cancel', label: 'How and when to cancel' },
          { id: 'price', label: 'The price after the trial' },
          { id: 'contact', label: 'Who to contact if there’s a problem' },
          { id: 'nothing', label: 'Nothing, it looks fine' },
        ],
      },
    },
    { id: 'post', kind: 'rating_post', label: 'Rating after the math', prompt: 'Now that you have worked through it, how believable is “just $1”?', input: { type: 'dial' } },
  ],
  admin: [
    { type: 'dots', step: 's1b', title: 'Step 1b: first-year total', axis: { min: 0, max: 200, scale: 'linear', unit: 'usd' }, primary: true },
    { type: 'calendarHeat', title: 'Months students tapped as full price', step: 's1', cells: 12, columns: 4, cellWord: 'Month' },
    { type: 'choiceBar', step: 's4', title: 'What students would check before signing up' },
    { type: 'dumbbell', gut: 'gut', post: 'post', title: 'Believability: gut vs after the math' },
    { type: 'calibration', gut: 'gut', post: 'post', title: 'Calibration' },
  ],
  decision: 'If most students pick “nothing” or only the cancel date, renewal terms are the hook.',
  notes: ['Price is illustrative, not a real service’s price.'],
});
