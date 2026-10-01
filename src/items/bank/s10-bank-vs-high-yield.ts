import { defineProblem } from '../types';

/** DRAFT wording, from the Interaction & Admin Visual Spec, S10. $500 for 3 years; A 4.00%, B 0.37%; prices up 3.4% a year. */
export default defineProblem({
  id: 'S10',
  slug: 'bank-vs-high-yield',
  title: 'Big Bank vs. High-Yield',
  version: 1,
  active: true,
  draft: true,
  module: 'skill',
  deca_category: 'investing',
  families: ['percent', 'compounding'],
  scenario: {
    layout: 'situation',
    text: 'You put $500 in each of two accounts for 3 years. You never add or take out money.',
    facts: [
      { label: 'Account A', value: '4.00% a year (online high-yield)' },
      { label: 'Account B', value: '0.37% a year (big bank)' },
    ],
  },
  steps: [
    {
      id: 's1',
      kind: 'cold',
      label: 'Step 1 · how much more A earns',
      prompt: 'After 3 years, about how many MORE dollars does Account A have than Account B? Tap the line.',
      input: { type: 'numberLine', min: 0, max: 150, scale: 'linear', unit: 'usd' },
      correct: 56.86,
      codes: [{ code: 'LIN', value: 54.45 }],
    },
    {
      id: 's2a',
      kind: 'control',
      label: 'Step 2a · year-1 interest, A',
      prompt: 'How much interest does Account A earn in the first year?',
      input: { type: 'number', unit: 'usd' },
      correct: 20,
      codes: [{ code: 'PAD', value: 4 }],
    },
    {
      id: 's2b',
      kind: 'control',
      label: 'Step 2b · year-1 interest, B',
      prompt: 'How much interest does Account B earn in the first year?',
      input: { type: 'number', unit: 'usd' },
      correct: 1.85,
      codes: [
        { code: 'DEC', value: 185 },
        { code: 'PAD', value: 0.37 },
      ],
    },
    {
      id: 's3a',
      kind: 'guided',
      label: 'Step 3a · balance after 3 years, A',
      prompt: 'How much is in Account A after 3 years? You can use a calculator.',
      input: { type: 'number', unit: 'usd' },
      calculator: true,
      correct: 562.43,
      correctTolPct: 0.1, // $560 (simple) is 0.4% below $562.43 (compound)
      codes: [{ code: 'LIN', value: 560, tolPct: 0.1 }],
    },
    {
      id: 's3b',
      kind: 'guided',
      label: 'Step 3b · balance after 3 years, B',
      prompt: 'How much is in Account B after 3 years? You can use a calculator.',
      input: { type: 'number', unit: 'usd' },
      calculator: true,
      correct: 505.57,
      codes: [{ code: 'DEC', value: 685 }],
    },
    {
      id: 's4',
      kind: 'guided',
      label: 'Step 4 · keeping up with prices',
      prompt: 'Prices go up 3.4% a year. After 3 years, how much money would you need to buy the same things that $500 buys today? You can use a calculator.',
      input: { type: 'number', unit: 'usd' },
      calculator: true,
      correct: 552.75,
      correctTolPct: 0.1, // $551 (simple) is 0.3% below $552.75 (compound)
      codes: [
        { code: 'LIN', value: 551, tolPct: 0.1 },
        { code: 'NOINT', value: 500 },
      ],
    },
    {
      id: 's5',
      kind: 'choice',
      label: 'Step 5 · which gains buying power',
      prompt: 'Which account ends with MORE buying power than the $500 you started with?',
      input: {
        type: 'choice',
        options: [
          { id: 'a', label: 'Only Account A' },
          { id: 'b', label: 'Only Account B' },
          { id: 'both', label: 'Both accounts' },
          { id: 'neither', label: 'Neither account' },
        ],
      },
      correctChoice: ['a'],
    },
  ],
  admin: [
    { type: 'dots', step: 's3a', title: 'Account A balance after 3 years', axis: { min: 450, max: 700, scale: 'linear', unit: 'usd' }, primary: true },
    { type: 'dots', step: 's3b', title: 'Account B balance after 3 years', axis: { min: 450, max: 700, scale: 'linear', unit: 'usd' } },
    {
      type: 'shareBar',
      step: 's2b',
      title: 'Who read 0.37% as 37%?',
      buckets: [
        { label: '$1.85 (right)', codes: ['CORR'] },
        { label: '$185 (read as 37%)', codes: ['DEC'] },
        { label: '$0.37 (percent as dollars)', codes: ['PAD'] },
      ],
    },
    { type: 'choiceBar', step: 's5', title: 'Which account gains buying power?' },
  ],
  decision: 'Any students who read 0.37% as 37% need a quick percent-notation refresh before interest topics.',
  notes: ['Step 1 axis is $0–$150, not the spec’s $0–$120: the correct $56.86 would sit on the centre of $0–$120, which the spec’s own range rule forbids.', 'Steps 3a and 4 use ±0.1% bands so simple and compound answers are told apart.'],
});
