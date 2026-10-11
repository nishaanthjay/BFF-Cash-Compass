import { defineProblem } from '../types';

/** DRAFT wording, from the Interaction & Admin Visual Spec, S3. $80 jacket, 30% off, then 20% off at the register. */
export default defineProblem({
  id: 'S3',
  slug: 'double-discount',
  title: 'The Double-Discount Jacket',
  version: 2,
  active: true,
  draft: true,
  module: 'skill',
  deca_category: 'spending_saving',
  families: ['percent'],
  scenario: { layout: 'priceTag', item: 'Jacket', price: 80, badges: ['30% OFF', 'EXTRA 20% OFF AT THE REGISTER'] },
  steps: [
    {
      id: 's1',
      kind: 'cold',
      label: 'Step 1 · cold estimate',
      prompt: 'A jacket costs $80. It’s 30% off. At the register, you get an extra 20% off. About how much will you pay? Tap the line.',
      input: { type: 'numberLine', min: 20, max: 80, scale: 'linear', unit: 'usd' },
      correct: 44.8,
      correctTolPct: 5, // a tap on a line is an estimate
      codes: [{ code: 'ADDPCT', value: 40 }],
    },
    {
      id: 's2',
      kind: 'control',
      label: 'Step 2 · price after 30% off',
      prompt: 'What is the price after the 30% off, before the extra 20%?',
      input: { type: 'number', unit: 'usd' },
      correct: 56,
      codes: [
        { code: 'DAP', value: 24 },
        { code: 'PAD', value: 50 },
      ],
    },
    {
      id: 's3a',
      kind: 'guided',
      label: 'Step 3a · which price gets the extra 20%',
      prompt: 'The extra 20% is taken off at the register. 20% of which price?',
      input: {
        type: 'choice',
        options: [
          { id: 'base80', label: '$80, the original price' },
          { id: 'base56', label: '$56, the price after 30% off' },
        ],
      },
      correctChoice: ['base56'],
    },
    {
      id: 's3b',
      kind: 'guided',
      label: 'Step 3b · the extra discount in dollars',
      prompt: 'Using the price you picked, how many dollars is 20%?',
      input: { type: 'number', unit: 'usd' },
      correct: 11.2,
      codes: [{ code: 'WRONGBASE', value: 16 }],
    },
    {
      id: 's4',
      kind: 'guided',
      label: 'Step 4 · final price',
      prompt: 'What is the final price of the jacket?',
      input: { type: 'number', unit: 'usd' },
      correct: 44.8,
      codes: [{ code: 'ADDPCT', value: 40 }],
    },
    {
      id: 's5',
      kind: 'guided',
      label: 'Step 5 · total percent off',
      prompt: 'You started at $80. In total, what percent off did you get? Tap the line.',
      input: { type: 'numberLine', min: 0, max: 100, scale: 'linear', unit: 'percent' },
      correct: 44,
      codes: [{ code: 'ADDPCT', value: 50 }],
    },
    {
      id: 's6',
      kind: 'guided',
      label: 'Step 6 · two 50% discounts',
      prompt: 'Another store takes 50% off. Then it takes an extra 50% off. In total, what percent off is that? Type your answer.',
      input: { type: 'number', unit: 'percent' },
      correct: 75,
      codes: [{ code: 'ADDPCT', value: 100 }],
    },
  ],
  admin: [
    {
      type: 'sankey',
      title: 'From first guess → which price got the 20% → final price',
      columns: [
        { step: 's1', label: 'Step 1 guess', groups: [{ label: '$44.80 (right)', codes: ['CORR'], tone: 'corr' }, { label: '$40 (50% off)', codes: ['ADDPCT'], tone: 'wrong' }] },
        { step: 's3a', label: 'Price the 20% came off', groups: [{ label: '$80', choice: 'base80', tone: 'wrong' }, { label: '$56', choice: 'base56', tone: 'corr' }] },
        { step: 's4', label: 'Final price', groups: [{ label: '$44.80 (right)', codes: ['CORR'], tone: 'corr' }, { label: '$40 (50% off)', codes: ['ADDPCT'], tone: 'wrong' }] },
      ],
    },
    { type: 'dots', step: 's5', title: 'Step 5: total percent off', primary: true },
    { type: 'codeBar', steps: ['s1', 's2', 's3b', 's4', 's5', 's6'], title: 'Where the error shows up, by step' },
  ],
  decision: 'A thick $80 → $40 flow means the group adds the percents (30% + 20% = 50%). That’s the gap to teach. Step 6 (two 50% discounts) is the extreme case: adding the percents gives 100% off, the right answer is 75%.',
});
