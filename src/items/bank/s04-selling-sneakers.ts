import { defineProblem } from '../types';

/** DRAFT wording, from the Interaction & Admin Visual Spec, S4. 12% app fee: $50 − fee = $44; list $56.82 to keep $50. */
export default defineProblem({
  id: 'S4',
  slug: 'selling-sneakers',
  title: 'Selling Sneakers Online',
  version: 1,
  active: true,
  draft: true,
  module: 'skill',
  deca_category: 'spending_saving',
  families: ['percent'],
  scenario: {
    layout: 'situation',
    text: 'You sell your sneakers on an app. The app takes a fee of 12% of the price they sell for.',
    facts: [{ label: 'App fee', value: '12% of the sale price' }],
  },
  steps: [
    {
      id: 's1',
      kind: 'cold',
      label: 'Step 1 · what you keep',
      prompt: 'You list the sneakers for $50 and they sell. About how much do you keep after the fee? Tap the line.',
      input: { type: 'numberLine', min: 30, max: 65, scale: 'linear', unit: 'usd' },
      correct: 44,
      codes: [
        { code: 'GROSS', value: 50 },
        { code: 'PAD', value: 38 },
      ],
    },
    {
      id: 's2',
      kind: 'control',
      label: 'Step 2 · the fee in dollars',
      prompt: 'How many dollars is the fee on a $50 sale?',
      input: { type: 'number', unit: 'usd' },
      correct: 6,
      codes: [{ code: 'PAD', value: 12 }],
    },
    {
      id: 's3',
      kind: 'guided',
      label: 'Step 3 · list price to keep $50',
      prompt: 'You want to keep exactly $50 AFTER the fee. What price should you list the sneakers for? Tap the line.',
      input: { type: 'numberLine', min: 40, max: 80, scale: 'linear', unit: 'usd' },
      correct: 56.82,
      codes: [
        { code: 'REVPCT', value: 56 },
        { code: 'PAD', value: 62 },
      ],
    },
    {
      id: 's4a',
      kind: 'guided',
      label: 'Step 4a · check: the fee',
      prompt: 'Check your answer. At the price you picked in Step 3, how many dollars is the fee? (12% of that price.)',
      input: { type: 'number', unit: 'usd' },
      correct: (p) => (p.s3 == null ? null : p.s3 * 0.12),
    },
    {
      id: 's4b',
      kind: 'guided',
      label: 'Step 4b · check: what you keep',
      prompt: 'And how much do you keep at that price after the fee?',
      input: { type: 'number', unit: 'usd' },
      correct: (p) => (p.s3 == null ? null : p.s3 * 0.88),
    },
  ],
  admin: [
    { type: 'dots', step: 's3', title: 'Step 3: list price to keep $50', primary: true },
    { type: 'twoByTwo', title: 'Fee in dollars × reverse percent', note: 'Students right on the fee (Step 2) but not on the list price (Step 3) have a reverse-percent gap.', x: { step: 's2', label: 'Step 2 right' }, y: { step: 's3', label: 'Step 3 right' } },
    { type: 'vsRef', step: 's4b', title: 'Does their own list price really leave $50?', ref: 50, tolPct: 2, labels: ['Keeps less than $50', 'Keeps $50', 'Keeps more than $50'], unit: 'usd' },
    { type: 'codeBar', steps: ['s1', 's2', 's3'], title: 'Where the error shows up, by step' },
  ],
  decision: 'Students right on Step 2 but near $56 on Step 3 have a reverse-percent gap, which is the main target.',
});
