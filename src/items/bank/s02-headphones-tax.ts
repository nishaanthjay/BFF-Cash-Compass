import { defineProblem } from '../types';

/** DRAFT wording, from the Interaction & Admin Visual Spec, S2. Wake County, NC sales tax 7.25%. */
export default defineProblem({
  id: 'S2',
  slug: 'headphones-tax',
  title: 'Headphones in Wake County',
  version: 1,
  active: true,
  draft: true,
  module: 'skill',
  deca_category: 'spending_saving',
  families: ['percent', 'arithmetic'],
  scenario: {
    layout: 'receipt',
    title: 'Wake County, NC · sales tax 7.25%',
    lines: [
      { label: 'Headphones', value: 80 },
      { label: 'Tax', fromStep: 's3' },
      { label: 'Total', fromStep: 's4' },
    ],
  },
  steps: [
    {
      id: 's1',
      kind: 'cold',
      label: 'Step 1 · cold estimate',
      prompt: 'Headphones cost $80 and sales tax is 7.25%. About how much do you pay at the register?',
      input: { type: 'numberLine', min: 70, max: 110, scale: 'linear', unit: 'usd' },
      correct: 85.8,
      codes: [
        { code: 'NOTAX', value: 80 },
        { code: 'PAD', value: 87.25 },
      ],
    },
    {
      id: 's2',
      kind: 'control',
      label: 'Step 2 · 1% of $80',
      prompt: 'What is 1% of $80?',
      input: { type: 'number', unit: 'usd' },
      correct: 0.8,
      codes: [
        { code: 'PAD', value: 1 },
        { code: 'DEC', value: 8 },
      ],
    },
    {
      id: 's3',
      kind: 'guided',
      label: 'Step 3 · tax in dollars',
      prompt: 'How much is the tax in dollars? Type it on the tax line.',
      input: { type: 'number', unit: 'usd' },
      correct: 5.8,
      codes: [
        { code: 'PAD', value: 7.25 },
        { code: 'DEC', value: 58 },
      ],
    },
    {
      id: 's4',
      kind: 'guided',
      label: 'Step 4 · total',
      prompt: 'What is the total? Type it on the total line.',
      input: { type: 'number', unit: 'usd' },
      correct: 85.8,
      codes: [
        { code: 'NOTAX', value: 80 },
        { code: 'PAD', value: 87.25 },
      ],
    },
  ],
  admin: [
    {
      type: 'shareBar',
      step: 's1',
      title: 'Step 1: total at the register',
      buckets: [
        { label: '$85.80 (correct)', codes: ['CORR'] },
        { label: '$80 (tax left out)', codes: ['NOTAX'] },
        { label: '$87.25 (percent as dollars)', codes: ['PAD'] },
      ],
    },
    { type: 'dots', step: 's1', title: 'Step 1: every answer', primary: true },
    { type: 'funnel', steps: ['s1', 's2', 's3', 's4'], title: 'Where accuracy drops, step by step' },
    { type: 'consistency', check: 'receiptTotal', steps: ['s3', 's4'], title: 'Does their total equal $80 + their tax?', note: 'Internal consistency: total ≠ 80 + the tax they typed.' },
  ],
  decision: 'If Step 3 is right but Step 4 is wrong, the gap is adding. If Step 3 is wrong, it is the percent.',
  notes: ['Axis is $70–$110, not the spec’s $70–$100: on $70–$100 the correct $85.80 sits at the centre of the line, which the spec’s own range rule forbids.'],
});
