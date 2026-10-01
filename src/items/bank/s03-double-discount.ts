import { defineProblem } from '../types';

/** DRAFT wording, from the Interaction & Admin Visual Spec, S3. $80 jacket, 30% off, then 20% off at the register. */
export default defineProblem({
  id: 'S3',
  slug: 'double-discount',
  title: 'The Double-Discount Jacket',
  version: 1,
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
      prompt: 'The jacket is $80 and 30% off. Then you get an extra 20% off at the register. About how much do you pay? Tap the line.',
      input: { type: 'numberLine', min: 20, max: 80, scale: 'linear', unit: 'usd' },
      correct: 44.8,
      codes: [{ code: 'ADD', value: 40 }],
    },
    {
      id: 's2',
      kind: 'control',
      label: 'Step 2 · price after 30% off',
      prompt: 'What is the price after just the 30% off?',
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
      prompt: 'The extra 20% comes off at the register. Which amount does the 20% come off of?',
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
      prompt: 'How many dollars does the extra 20% take off?',
      input: { type: 'number', unit: 'usd' },
      correct: 11.2,
      codes: [{ code: 'ADD', value: 16 }],
    },
    {
      id: 's4',
      kind: 'guided',
      label: 'Step 4 · final price',
      prompt: 'So what is the final price of the jacket?',
      input: { type: 'number', unit: 'usd' },
      correct: 44.8,
      codes: [{ code: 'ADD', value: 40 }],
    },
    {
      id: 's5',
      kind: 'guided',
      label: 'Step 5 · total percent off',
      prompt: 'Compared with the $80 price tag, what percent off is that in total? Tap the line.',
      input: { type: 'numberLine', min: 0, max: 100, scale: 'linear', unit: 'percent' },
      correct: 44,
      codes: [{ code: 'ADD', value: 50 }],
    },
  ],
  admin: [
    {
      type: 'sankey',
      title: 'From first guess → which price got the 20% → final price',
      columns: [
        { step: 's1', label: 'Step 1 guess', groups: [{ label: '$44.80 (right)', codes: ['CORR'], tone: 'corr' }, { label: '$40 (50% off)', codes: ['ADD'], tone: 'wrong' }] },
        { step: 's3a', label: 'Price the 20% came off', groups: [{ label: '$80', choice: 'base80', tone: 'wrong' }, { label: '$56', choice: 'base56', tone: 'corr' }] },
        { step: 's4', label: 'Final price', groups: [{ label: '$44.80 (right)', codes: ['CORR'], tone: 'corr' }, { label: '$40 (50% off)', codes: ['ADD'], tone: 'wrong' }] },
      ],
    },
    { type: 'dots', step: 's5', title: 'Step 5: total percent off', primary: true },
    { type: 'codeBar', steps: ['s1', 's2', 's3b', 's4', 's5'], title: 'Where the error shows up, by step' },
  ],
  decision: 'A thick $80 → $40 flow means the group adds the percents (30% + 20% = 50%). That’s the gap to teach.',
});
