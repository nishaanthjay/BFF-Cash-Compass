import { defineProblem } from '../types';

const day = (n: number) => 0.02 * 2 ** (n - 1);
const total = (n: number) => 0.02 * (2 ** n - 1);
// First day the doubling TOTAL beats the fixed TOTAL so far ($400 a day).
const crossover = Array.from({ length: 20 }, (_, i) => i + 1).find((n) => total(n) > 400 * n)!;

/** DRAFT wording, from the Interaction & Admin Visual Spec, H2. Option A $400/day; Option B 2¢ doubling. */
export default defineProblem({
  id: 'H2',
  slug: 'doubling-streak',
  title: 'The Doubling Streak',
  version: 1,
  active: true,
  draft: true,
  module: 'hybrid',
  deca_category: 'investing',
  families: ['compounding', 'feasibility'],
  scenario: {
    layout: 'situation',
    text: 'A game pays you every day for 20 days. You pick one way to be paid.',
    facts: [
      { label: 'Option A', value: '$400 every day' },
      { label: 'Option B', value: '2¢ on day 1, 4¢ on day 2, 8¢ on day 3… it doubles every day' },
    ],
  },
  steps: [
    {
      id: 's1a',
      kind: 'choice',
      label: 'Step 1a · which pays more',
      prompt: 'After all 20 days, which option pays more in total?',
      input: {
        type: 'choice',
        options: [
          { id: 'a', label: 'Option A: $400 every day' },
          { id: 'b', label: 'Option B: it doubles every day' },
        ],
      },
      correctChoice: ['b'],
    },
    {
      id: 's1b',
      kind: 'cold',
      label: 'Step 1b · best guess of Option B’s total',
      prompt: 'Give your best guess: how much does Option B pay in total over the 20 days?',
      input: { type: 'number', unit: 'usd' },
      correct: Number(total(20).toFixed(2)),
      codes: [{ code: 'LIN', value: 400 }],
    },
    {
      id: 's2',
      kind: 'control',
      label: 'Step 2 · day 5 reward',
      prompt: 'How much does Option B pay on day 5? (It starts at 2¢ and doubles each day.)',
      input: { type: 'number', unit: 'usd' },
      correct: Number(day(5).toFixed(2)),
      codes: [{ code: 'LIN', value: 0.1 }],
    },
    {
      id: 's3',
      kind: 'guided',
      label: 'Step 3 · total through day 10',
      prompt: 'How much has Option B paid in total after 10 days? You can use a calculator.',
      input: { type: 'number', unit: 'usd' },
      calculator: true,
      correct: Number(total(10).toFixed(2)),
      codes: [{ code: 'LIN', value: 0.2 }],
    },
    {
      id: 's4',
      kind: 'guided',
      label: 'Step 4 · day Option B catches up',
      prompt: 'On which day does Option B’s TOTAL so far first beat Option A’s total so far? Tap the day.',
      input: { type: 'calendar', mode: 'single', cells: 20, columns: 5, cellWord: 'Day', unit: 'days' },
      correct: crossover,
      noUnk: true,
      codes: [{ code: 'LIN', value: 12 }],
    },
    {
      id: 's5a',
      kind: 'guided',
      label: 'Step 5a · Option B total at day 20',
      prompt: 'After 20 days, how much has Option B paid in total? You can use a calculator.',
      input: { type: 'number', unit: 'usd' },
      calculator: true,
      correct: Number(total(20).toFixed(2)),
      codes: [{ code: 'LIN', value: 400 }],
    },
    {
      id: 's5b',
      kind: 'guided',
      label: 'Step 5b · Option A total at day 20',
      prompt: 'After 20 days, how much has Option A paid in total?',
      input: { type: 'number', unit: 'usd' },
      correct: 8000,
      codes: [{ code: 'DEC', value: 800 }],
    },
    {
      id: 's6',
      kind: 'choice',
      label: 'What I would want to know',
      prompt: 'An app says “your money doubles every day.” What would you want to know? Tap all that you would.',
      input: {
        type: 'choice',
        multi: true,
        options: [
          { id: 'howlong', label: 'How long does it keep doubling?' },
          { id: 'source', label: 'Where does the money come from?' },
          { id: 'real', label: 'Is anyone checking that the app is real?' },
          { id: 'withdraw', label: 'Can I take my money out?' },
          { id: 'nothing', label: 'Nothing, it sounds great' },
        ],
      },
    },
  ],
  admin: [
    { type: 'dots', step: 's4', title: 'Step 4: day Option B’s total catches up', axis: { min: 1, max: 20, scale: 'linear', unit: 'days' }, primary: true },
    { type: 'logRatio', title: 'Step 1b: guess vs the true total, in either direction', step: 's1b', truth: Number(total(20).toFixed(2)), marks: [{ value: 400, label: '$400 guess' }], unit: 'usd' },
    { type: 'choiceBar', step: 's1a', title: 'Step 1a: which option pays more' },
    { type: 'choiceBar', step: 's6', title: 'What students would want to know' },
  ],
  decision: 'A big “Option A pays more” bar alongside low guesses shows the exponential-growth gap clearly. It’s a strong opening demonstration.',
  notes: ['Option A pays a fixed $400 a day; Option B starts at 2¢. Day 19 is where B’s running total first passes A’s.'],
});
