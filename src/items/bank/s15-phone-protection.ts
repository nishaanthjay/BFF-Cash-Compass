import { defineProblem } from '../types';

/** DRAFT wording, from the Interaction & Admin Visual Spec, S15. 10% crack, $300 repair, $60 plan. */
export default defineProblem({
  id: 'S15',
  slug: 'phone-protection',
  title: 'Phone Protection Plan',
  version: 1,
  active: true,
  draft: true,
  module: 'skill',
  deca_category: 'risk_insurance',
  families: ['credit_risk'],
  scenario: {
    layout: 'situation',
    text: 'A store sells a $60 protection plan for a new phone. If the screen cracks during the year, the plan pays for the whole repair. A repair costs $300. About 1 in 10 phones crack in a year.',
    facts: [
      { label: 'Plan', value: '$60 for a year' },
      { label: 'Screen repair', value: '$300' },
      { label: 'Phones that crack', value: 'about 1 in 10 each year' },
    ],
  },
  steps: [
    {
      id: 's1a',
      kind: 'cold',
      label: 'Step 1a · phones that crack',
      prompt: 'Out of 100 phones, how many do you expect to crack in a year? Tap the phones.',
      input: { type: 'dotGrid', total: 100, columns: 10, itemWord: 'phone' },
      correct: 10,
      noUnk: true,
    },
    {
      id: 's1b',
      kind: 'cold',
      label: 'Step 1b · expected repair cost per phone',
      prompt: 'On average, how much repair money do you expect to spend on ONE phone in a year?',
      input: { type: 'number', unit: 'usd' },
      correct: 30,
      codes: [
        { code: 'WORST', value: 300 },
        { code: 'DEC', value: 3 },
      ],
    },
    {
      id: 's2a',
      kind: 'control',
      label: 'Step 2a · cracks among 100 students',
      prompt: '100 students each have this phone. How many cracked screens do you expect in a year?',
      input: { type: 'number', unit: 'count' },
      correct: 10,
      codes: [{ code: 'WORST', value: 100 }],
    },
    {
      id: 's2b',
      kind: 'guided',
      label: 'Step 2b · total repair cost',
      prompt: 'About how much would all those repairs cost in total?',
      input: { type: 'number', unit: 'usd' },
      correct: 3000,
      codes: [
        { code: 'WORST', value: 30000 },
        { code: 'DEC', value: 300 },
      ],
    },
    {
      id: 's3',
      kind: 'guided',
      label: 'Step 3 · break-even crack chance',
      prompt: 'At what chance of cracking would the $60 plan cost the same as the repairs you expect? Answer as a percent.',
      input: { type: 'number', unit: 'percent' },
      correct: 20,
      codes: [{ code: 'RATE', value: 10 }],
    },
    {
      id: 's4',
      kind: 'why',
      label: 'When it could still make sense',
      prompt: 'When might the plan still make sense, even if it costs more than the repairs you expect? Write a short answer, or skip.',
      input: { type: 'text', placeholder: 'Type a short answer. Please don’t type any names.' },
      optional: true,
    },
  ],
  admin: [
    { type: 'dots', step: 's1b', title: 'Step 1b: expected repair cost per phone (log scale)', axis: { min: 1, max: 1000, scale: 'log', unit: 'usd' }, primary: true },
    {
      type: 'valueBuckets',
      title: 'Step 1a: phones expected to crack, out of 100',
      step: 's1a',
      buckets: [
        { label: 'More than 10', min: 10.5, max: Infinity, tone: 'neutral' },
        { label: '10 (right)', min: 9.5, max: 10.5, tone: 'corr' },
        { label: 'Fewer than 10', min: -Infinity, max: 9.5, tone: 'neutral' },
      ],
    },
    {
      type: 'shareBar',
      step: 's3',
      title: 'Step 3: break-even crack chance',
      buckets: [
        { label: '20% (right)', codes: ['CORR'] },
        { label: '10% (the crack chance itself)', codes: ['RATE'] },
      ],
    },
    { type: 'codeBar', steps: ['s1b', 's2a', 's2b', 's3'], title: 'Where the error shows up, by step' },
  ],
  decision: 'Many $300 answers mean worst-case thinking dominates. Start with expected value.',
});
