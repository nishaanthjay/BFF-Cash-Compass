import { amortize, round2 } from '../finance';
import { defineProblem } from '../types';

const card = amortize(1000, 22.15, 25);

/** DRAFT wording, from the Interaction & Admin Visual Spec, S14. $1,000 at 22.15% APR, $25 a month. */
export default defineProblem({
  id: 'S14',
  slug: 'credit-card-minimum',
  title: 'The Credit Card Minimum Trap',
  version: 1,
  active: true,
  draft: true,
  module: 'skill',
  deca_category: 'credit_debt',
  families: ['credit_risk', 'compounding'],
  scenario: {
    layout: 'situation',
    text: 'You owe $1,000 on a credit card. Interest is added every month on what you still owe. You pay the same amount each month and buy nothing else with the card.',
    facts: [
      { label: 'You owe', value: '$1,000' },
      { label: 'Interest', value: '22.15% a year' },
      { label: 'You pay', value: '$25 every month' },
    ],
  },
  steps: [
    {
      id: 's1',
      kind: 'cold',
      label: 'Step 1 · month it’s paid off',
      prompt: 'In which month will the card be paid off? Pick a year, then tap the month.',
      input: { type: 'calendar', mode: 'single', cells: 120, columns: 4, cellWord: 'Month', group: { size: 12, word: 'Year' }, unit: 'months' },
      correct: card.months,
      noUnk: true,
      codes: [{ code: 'NOINTDEBT', value: 40 }],
    },
    {
      id: 's2a',
      kind: 'control',
      label: 'Step 2a · monthly rate',
      prompt: 'The card charges 22.15% a year. About what percent is that each month?',
      input: { type: 'number', unit: 'percent' },
      correct: round2(22.15 / 12),
      correctTolPct: 1,
      codes: [{ code: 'PAD', value: 22.15 }],
    },
    {
      id: 's2b',
      kind: 'control',
      label: 'Step 2b · interest in month 1',
      prompt: 'How many dollars of interest are added in the first month on $1,000?',
      input: { type: 'number', unit: 'usd' },
      correct: round2(card.firstInterest),
      codes: [{ code: 'DEC', value: 1.85 }],
    },
    {
      id: 's3',
      kind: 'guided',
      label: 'Step 3 · split your first $25',
      prompt: 'Shade the part of your first $25 payment that pays down what you owe. The rest of the $25 is just interest.',
      input: { type: 'shade', whole: 25, unit: 'usd', readout: 'usd', typed: 'linked' },
      correct: round2(card.firstPrincipal),
      codes: [{ code: 'NOINTDEBT', value: 25 }],
    },
    {
      id: 's4a',
      kind: 'guided',
      label: 'Step 4a · total you pay',
      prompt: 'Add up everything you pay until the card is paid off. About how many dollars is that in total? You can use a calculator.',
      input: { type: 'number', unit: 'usd' },
      calculator: true,
      correct: round2(card.totalPaid),
      codes: [{ code: 'NOINTDEBT', value: 1000 }],
    },
    {
      id: 's4b',
      kind: 'guided',
      label: 'Step 4b · total interest',
      prompt: 'How many of those dollars are interest?',
      input: { type: 'number', unit: 'usd' },
      calculator: true,
      correct: round2(card.totalInterest),
      codes: [{ code: 'NOINTDEBT', value: 0 }],
    },
    {
      id: 's5',
      kind: 'choice',
      label: 'Step 5 · paying only $18',
      prompt: 'Now say you pay only $18 a month. What happens?',
      input: {
        type: 'choice',
        options: [
          { id: 'under5', label: 'It’s paid off in under 5 years' },
          { id: 'five10', label: 'It’s paid off in 5 to 10 years' },
          { id: 'over10', label: 'It’s paid off, but it takes over 10 years' },
          { id: 'never', label: 'It never gets paid off' },
        ],
      },
      correctChoice: ['never'],
    },
  ],
  admin: [
    { type: 'dots', step: 's1', title: 'Step 1: month the card is paid off', axis: { min: 0, max: 120, scale: 'linear', unit: 'months' }, primary: true },
    { type: 'dots', step: 's3', title: 'Step 3: how much of the first $25 pays down the debt', axis: { min: 0, max: 25, scale: 'linear', unit: 'usd' } },
    { type: 'choiceBar', step: 's5', title: 'Step 5: paying only $18 a month' },
    { type: 'codeBar', steps: ['s1', 's2a', 's2b', 's3', 's4a', 's4b'], title: 'Where the error shows up, by step' },
  ],
  decision: 'A cluster at month 40 plus a high “all principal” answer both point to ignoring interest on debt.',
});
