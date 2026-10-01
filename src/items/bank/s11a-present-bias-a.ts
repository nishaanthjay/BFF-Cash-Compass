import { defineProblem } from '../types';

/** DRAFT wording, from the Interaction & Admin Visual Spec, S11 item A. Hypothetical choices, fixed amounts and delays. */
export default defineProblem({
  id: 'S11A',
  slug: 'present-bias-a',
  title: 'Pretend Prize · Now or Later',
  version: 1,
  active: true,
  draft: true,
  module: 'skill',
  deca_category: 'decision_making',
  families: ['time_preference'],
  scenario: { layout: 'situation', text: 'Pretend you won a prize. This is only pretend: no real money. Choose the one you would really pick.' },
  // The two parts of S11 sit at least five problems apart; which comes first is counterbalanced by form.
  form: { key: 'S11', options: ['AB', 'BA'] },
  orderByForm: { AB: ['S11A', 'S11B'], BA: ['S11B', 'S11A'] },
  order: { minGap: { with: 'S11B', gap: 5 } },
  steps: [
    {
      id: 's1',
      kind: 'choice',
      label: 'Choice',
      prompt: 'Which would you pick?',
      input: {
        type: 'timeline',
        maxWeeks: 8,
        options: [
          { id: 'soon', label: 'Today', amount: '$25', weeks: 0 },
          { id: 'later', label: 'In 4 weeks', amount: '$30', weeks: 4 },
        ],
      },
    },
    {
      id: 's2',
      kind: 'guided',
      label: 'Step C · switch point',
      prompt: 'What is the smallest amount, paid in 4 weeks, that would make you wait instead of taking $25 today? Tap the line.',
      input: { type: 'numberLine', min: 25, max: 60, scale: 'linear', unit: 'usd' },
    },
    {
      id: 's3',
      kind: 'guided',
      label: 'Step D · percent gained by waiting',
      prompt: 'By waiting 4 weeks you get $30 instead of $25. What percent MORE is $30 than $25?',
      input: { type: 'number', unit: 'percent' },
      correct: 20,
      codes: [{ code: 'PAD', value: 5 }],
    },
    {
      id: 's4',
      kind: 'choice',
      label: 'Step E · vs a savings account',
      prompt: 'A savings account pays 4% in a whole year. Is waiting 4 weeks for that extra money better or worse than the savings account?',
      input: {
        type: 'choice',
        options: [
          { id: 'better', label: 'Better than the savings account' },
          { id: 'worse', label: 'Worse than the savings account' },
          { id: 'same', label: 'About the same' },
        ],
      },
      correctChoice: ['better'],
    },
  ],
  admin: [
    {
      type: 'pairTiles',
      title: 'Choices across the two pairs',
      note: 'Hypothetical choices; small groups are noisy. “Soon, then later” (SL) is the present-bias pattern.',
      a: { item: 'S11A', step: 's1', early: 'soon', late: 'later', word: '$25 today vs $30 in 4 weeks' },
      b: { item: 'S11B', step: 's1', early: 'soon', late: 'later', word: '$25 in 26 weeks vs $30 in 30 weeks' },
    },
    { type: 'dots', step: 's2', title: 'Switch point: smallest amount (in 4 weeks) that makes them wait', primary: true },
    {
      type: 'correctSplit',
      title: 'Can they price waiting? Step D by choice pattern',
      step: 's3',
      group: { a: { item: 'S11A', step: 's1', pick: 'soon' }, b: { item: 'S11B', step: 's1', pick: 'later' }, yes: 'Present-biased pattern (SL)', no: 'Everyone else' },
    },
  ],
  decision: 'More SL than LS suggests present bias. Use it as a discussion hook about waiting, not as a label for any student.',
  notes: ['Hypothetical choices. Amounts and delays are fixed for every student; only the order of the two parts is counterbalanced.'],
});
