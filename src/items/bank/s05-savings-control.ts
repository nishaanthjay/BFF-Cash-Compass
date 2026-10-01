import { defineProblem } from '../types';

/** DRAFT wording, from the Interaction & Admin Visual Spec, S5. $100 at 2% a year. */
export default defineProblem({
  id: 'S5',
  slug: 'savings-control',
  title: 'The 2% Savings Control',
  version: 1,
  active: true,
  draft: true,
  module: 'skill',
  deca_category: 'spending_saving',
  families: ['arithmetic', 'compounding'],
  scenario: {
    layout: 'jars',
    text: 'You put $100 in a savings account. It pays 2% interest each year.',
    labels: ['End of year 1', 'End of year 2', 'End of year 3'],
    fromSteps: ['s1', null, 's3'],
  },
  steps: [
    {
      id: 's1',
      kind: 'control',
      label: 'Step 1 · balance after year 1',
      prompt: 'How much money is in the account at the end of year 1? Type it into jar 1.',
      input: { type: 'number', unit: 'usd' },
      correct: 102,
      codes: [
        { code: 'INTONLY', value: 2 },
        { code: 'NOINT', value: 100 },
      ],
    },
    {
      id: 's2',
      kind: 'guided',
      label: 'Step 2 · interest, paid out each year',
      prompt: 'Now say the bank pays you the interest each year, and you take it out. After 3 years, how much interest did you get in total?',
      input: { type: 'number', unit: 'usd' },
      correct: 6,
      codes: [
        { code: 'COMP', value: 6.12 },
        { code: 'NOINT', value: 0 },
      ],
    },
    {
      id: 's3',
      kind: 'guided',
      label: 'Step 3 · balance if interest stays in',
      prompt: 'Now the interest stays in the account. How much is in the account after 3 years? Type it into jar 3.',
      input: { type: 'number', unit: 'usd' },
      correct: 106.12,
      // Tight bands on purpose: $106 (simple) and $106.12 (compound) are 0.1% apart.
      correctTolPct: 0.01,
      codes: [
        { code: 'LIN', value: 106, tolPct: 0.05 },
        { code: 'NOINT', value: 100 },
      ],
    },
    {
      id: 's4',
      kind: 'why',
      label: 'Why is Step 3 bigger?',
      prompt: 'Why is the Step 3 answer a little bigger than $106? Write a short answer, or skip.',
      input: { type: 'text', placeholder: 'Type a short answer. Please don’t type any names.' },
      optional: true,
    },
  ],
  admin: [
    { type: 'tileGrid', step: 's1', title: 'Arithmetic floor: Step 1 by student', note: 'One tile per student. Shaded = $102. Unshaded = something else.' },
    {
      type: 'shareBar',
      step: 's3',
      title: 'Step 3: balance with interest left in',
      buckets: [
        { label: '$106.12 (compound)', codes: ['CORR'] },
        { label: '$106 (simple)', codes: ['LIN'] },
        { label: '$100 (no interest)', codes: ['NOINT'] },
      ],
    },
    { type: 'codeBar', steps: ['s1', 's2', 's3'], title: 'Where the error shows up, by step' },
  ],
  decision: 'If more than a few tiles are unshaded, review percent arithmetic first and treat compounding answers in later problems with caution.',
  notes: ['Step 3 bands are tight (±0.01%) so $106 (simple) and $106.12 (compound) are told apart. Answers like $106.1 will be coded UNK.'],
});
