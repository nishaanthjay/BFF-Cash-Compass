import { defineProblem } from '../types';

/** DRAFT wording, from the Interaction & Admin Visual Spec, F4. 12% a month = 289.6% a year. */
export default defineProblem({
  id: 'F4',
  slug: 'twelve-percent-a-month',
  title: '“12% a Month, Guaranteed”',
  version: 2,
  active: true,
  draft: true,
  module: 'feasibility',
  deca_category: 'investing',
  families: ['feasibility', 'compounding'],
  scenario: {
    layout: 'claim',
    who: 'Unknown number',
    source: 'message',
    claim: 'Invest with us. We pay 12% EVERY month. Guaranteed! Send $500 today.',
  },
  steps: [
    { id: 'gut', kind: 'rating_gut', label: 'Gut rating', prompt: 'How believable is this message? Go with your gut.', input: { type: 'dial' } },
    {
      id: 's2',
      kind: 'cold',
      label: 'Step 2 · yearly equivalent guess',
      prompt: 'If money grows 12% EVERY month, about what percent has it grown after one year? Tap the line.',
      input: { type: 'numberLine', min: 10, max: 1000, scale: 'log', unit: 'percent' },
      correct: 289.6,
      correctTolPct: 5, // a tap on a line is an estimate
      codes: [
        { code: 'LIN', value: 144 },
        { code: 'FORGOTBASE', value: 389.6 },
      ],
    },
    {
      id: 's3',
      kind: 'guided',
      label: 'Step 3 · actual yearly equivalent',
      prompt: 'Now work it out. $100 grows 12% each month for 12 months. By what percent has it grown after 12 months? You can use a calculator.',
      input: { type: 'number', unit: 'percent' },
      calculator: true,
      correct: 289.6,
      codes: [
        { code: 'LIN', value: 144 },
        { code: 'FORGOTBASE', value: 389.6 },
      ],
    },
    {
      id: 's4',
      kind: 'guided',
      label: 'Step 4 · times a savings account',
      prompt: 'A savings account pays 4.2% a year. How many times bigger is this message’s yearly growth than the savings account’s?',
      input: { type: 'number', unit: 'times' },
      calculator: true,
      correct: 68.95,
      correctTolPct: 2,
      codes: [{ code: 'LIN', value: 34.29 }],
    },
    {
      id: 's5',
      kind: 'guided',
      label: 'Step 5 · what I would ask',
      prompt: 'Tap the cards in the order you would do them before sending money. Skip any you would not do.',
      input: {
        type: 'stack',
        poolLabel: 'Cards',
        areaLabel: 'What I would do first',
        cards: [
          { id: 'source', label: 'Ask: where does the money come from?' },
          { id: 'registered', label: 'Ask: is the company registered?' },
          { id: 'withdraw', label: 'Ask: can I take my money out any time?' },
          { id: 'others', label: 'Ask: who else has been paid?' },
          { id: 'join', label: 'Say: sounds great, I’d join', distractor: true },
        ],
      },
    },
    { id: 'post', kind: 'rating_post', label: 'Rating after the math', prompt: 'Now that you’ve done the math, how believable is the message?', input: { type: 'dial' } },
  ],
  admin: [
    { type: 'dots', step: 's2', title: 'Step 2: yearly equivalent guess (log scale)', primary: true },
    { type: 'cardHeat', step: 's5', title: 'What students would ask or do' },
    { type: 'dumbbell', gut: 'gut', post: 'post', title: 'Believability: gut vs after the math' },
    { type: 'calibration', gut: 'gut', post: 'post', title: 'Calibration' },
  ],
  decision: 'A big “sounds great, I’d join” bar after the math means the numbers didn’t change minds. Use the red-flag questions as the teaching frame.',
});
