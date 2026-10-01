import { defineProblem } from '../types';

/** DRAFT wording, from the Interaction & Admin Visual Spec, F6. The realistic revenue/profit are scenario assumptions. */
export default defineProblem({
  id: 'F6',
  slug: 'lawn-business',
  title: 'The Lawn Business',
  version: 1,
  active: true,
  draft: true,
  module: 'feasibility',
  deca_category: 'employment_income',
  families: ['feasibility', 'arithmetic'],
  scenario: {
    layout: 'claim',
    who: '@lawnboss_sam',
    source: 'post',
    claim: 'Mow 5 lawns a day, 30 days a month, $40 a lawn. That’s $6,000 a month!',
  },
  steps: [
    { id: 'gut', kind: 'rating_gut', label: 'Gut rating', prompt: 'How believable is this claim? Go with your gut.', input: { type: 'dial' } },
    {
      id: 's2',
      kind: 'control',
      label: 'Step 2 · money per day in the claim',
      prompt: 'The claim says 5 lawns a day at $40 each. How much money a day is that?',
      input: { type: 'number', unit: 'usd' },
      correct: 200,
      codes: [{ code: 'DEC', value: 20 }],
    },
    {
      id: 's3',
      kind: 'cold',
      label: 'Step 3 · your real month',
      prompt: 'Now plan a REAL month. Tap the days you would really mow, and how many lawns you would do each day. Each lawn pays $40.',
      input: { type: 'calendar', mode: 'count', cells: 30, columns: 6, cellWord: 'Day', maxPerCell: 8, countWord: 'lawn', unitPrice: 40, unit: 'usd' },
      correct: 1548,
      noUnk: true,
      codes: [
        { code: 'CLAIM', value: 6000 },
        { code: 'MISS', value: 1298 },
      ],
    },
    {
      id: 's4',
      kind: 'guided',
      label: 'Step 4 · monthly costs',
      prompt: 'Mowing costs money too: fuel, blades, repairs. About how much would that cost you in a month?',
      input: { type: 'number', unit: 'usd' },
    },
    {
      id: 's5',
      kind: 'choice',
      label: 'Step 5 · least realistic part',
      prompt: 'Which part of the claim is the LEAST realistic?',
      input: {
        type: 'choice',
        options: [
          { id: 'days', label: 'Mowing 30 days a month' },
          { id: 'lawns', label: '5 lawns every day' },
          { id: 'costs', label: 'Not counting any costs' },
          { id: 'price', label: '$40 for every lawn' },
          { id: 'other', label: 'Something else' },
        ],
      },
    },
    { id: 'post', kind: 'rating_post', label: 'Rating after the math', prompt: 'Now that you have planned a real month, how believable is the claim?', input: { type: 'dial' } },
  ],
  admin: [
    { type: 'dots', step: 's3', title: 'Step 3: implied monthly revenue from their own calendar', axis: { min: 0, max: 7000, scale: 'linear', unit: 'usd' }, primary: true },
    { type: 'calendarHeat', title: 'Which days students chose to mow (lawns planned)', step: 's3', cells: 30, columns: 6, cellWord: 'Day', maxPerCell: 8 },
    { type: 'choiceBar', step: 's5', title: 'Least realistic part of the claim' },
    { type: 'dumbbell', gut: 'gut', post: 'post', title: 'Believability: gut vs after the math' },
    { type: 'calibration', gut: 'gut', post: 'post', title: 'Calibration' },
  ],
  decision: 'A high-revenue cluster near $6,000 means students accept a claim’s assumptions without questioning them.',
  notes: [
    'The realistic $1,548 revenue and $1,298 profit-after-costs lines are scenario assumptions, not market facts.',
    '$1,548 is not a multiple of the $40 lawn price, so no student’s calendar can land on it exactly. It is a reference line, not a target.',
  ],
});
