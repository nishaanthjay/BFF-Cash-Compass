import { aprForTarget, fvMonthly, round2 } from '../finance';
import { defineProblem } from '../types';

const balance = fvMonthly(200, 7, 14); // $56,807.34
const aprNeeded = aprForTarget(200, 14, 1_000_000); // ≈ 36.5% a year, added monthly

/** DRAFT wording, from the Interaction & Admin Visual Spec, F3. $200 a month, 7%, 14 years. */
export default defineProblem({
  id: 'F3',
  slug: 'millionaire-by-30',
  title: 'Millionaire by 30',
  version: 1,
  active: true,
  draft: true,
  module: 'feasibility',
  deca_category: 'investing',
  families: ['feasibility', 'compounding'],
  scenario: {
    layout: 'claim',
    who: '@millionaire_mike',
    source: 'chat',
    claim: 'Save $200 every month starting at 16 and you’ll be a millionaire by 30. Easy!',
    facts: [
      { label: 'Saved each month', value: '$200' },
      { label: 'Interest rate', value: '7% a year, added monthly' },
      { label: 'Time', value: '14 years (age 16 to 30)' },
    ],
  },
  steps: [
    { id: 'gut', kind: 'rating_gut', label: 'Gut rating', prompt: 'How believable is this claim? Go with your gut.', input: { type: 'dial' } },
    {
      id: 's1',
      kind: 'cold',
      label: 'Step 1 · balance guess',
      prompt: 'Using the numbers above, about how much will be in the account at age 30? Tap the line.',
      input: { type: 'numberLine', min: 10000, max: 5000000, scale: 'log', unit: 'usd' },
      correct: round2(balance),
      codes: [
        { code: 'CLAIM', value: 1000000 },
        { code: 'NOINT', value: 33600 },
      ],
    },
    {
      id: 's2',
      kind: 'control',
      label: 'Step 2 · total you put in',
      prompt: 'How much money in total do you put in over the 14 years?',
      input: { type: 'number', unit: 'usd' },
      correct: 33600,
      codes: [{ code: 'DEC', value: 3360 }],
    },
    {
      id: 's3',
      kind: 'guided',
      label: 'Step 3 · balance at 7%',
      prompt: 'Now work it out. How much is in the account after 14 years at 7% a year, added monthly? You can use a calculator.',
      input: { type: 'number', unit: 'usd' },
      calculator: true,
      correct: round2(balance),
      codes: [{ code: 'NOINT', value: 33600 }],
    },
    {
      id: 's4',
      kind: 'guided',
      label: 'Step 4 · how many times too high',
      prompt: 'The claim says $1,000,000. How many times bigger is that than your answer to Step 3?',
      input: { type: 'number', unit: 'times' },
      calculator: true,
      correct: round2(1_000_000 / balance),
      correctTolPct: 3,
    },
    {
      id: 's5',
      kind: 'guided',
      label: 'Step 5 · saving needed',
      prompt: 'About how much would you need to save EACH MONTH, at 7%, to have $1,000,000 after 14 years? You can use a calculator.',
      input: { type: 'number', unit: 'usd' },
      calculator: true,
      correct: round2(1_000_000 / (balance / 200)),
      correctTolPct: 2,
      codes: [{ code: 'LIN', value: 5952 }],
    },
    {
      id: 's6',
      kind: 'guided',
      label: 'Step 6 · return needed',
      prompt: 'What yearly return (added monthly) would make $200 a month reach $1,000,000 in 14 years? Answer as a percent. You can use a calculator.',
      input: { type: 'number', unit: 'percent' },
      calculator: true,
      correct: round2(aprNeeded),
      correctTolPct: 3,
      codes: [{ code: 'LIN', value: 205 }],
    },
    { id: 'post', kind: 'rating_post', label: 'Rating after the math', prompt: 'Now that you have worked through it, how believable is the claim?', input: { type: 'dial' } },
  ],
  admin: [
    { type: 'logRatio', title: 'Step 1: how far off, in either direction', step: 's1', truth: round2(balance), unit: 'usd' },
    { type: 'confError', title: 'Confident and far off?', gut: 'gut', step: 's1', truth: round2(balance) },
    { type: 'dumbbell', gut: 'gut', post: 'post', title: 'Believability: gut vs after the math' },
    { type: 'calibration', gut: 'gut', post: 'post', title: 'Calibration' },
  ],
  decision: 'If students who underestimated compounding in S6 overestimate here, they are reacting to the story, not the math.',
  notes: ['Step 6 assumes the return is added every month, the same convention as S8.'],
});
