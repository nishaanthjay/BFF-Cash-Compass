import { defineProblem } from '../types';

/** DRAFT wording, from the Interaction & Admin Visual Spec, S1. */
export default defineProblem({
  id: 'S1',
  slug: 'hoodie-sale',
  title: 'The Hoodie Sale',
  version: 1,
  active: true,
  draft: true,
  module: 'skill',
  deca_category: 'spending_saving',
  families: ['percent', 'arithmetic'],
  scenario: { layout: 'priceTag', item: 'Hoodie', price: 48, badges: ['25% OFF'] },
  steps: [
    {
      id: 's1',
      kind: 'cold',
      label: 'Step 1 · cold estimate',
      prompt: 'The hoodie is $48 and 25% off. About how much do you pay? Tap the line.',
      input: { type: 'numberLine', min: 0, max: 60, scale: 'linear', unit: 'usd' },
      correct: 36,
      codes: [
        { code: 'PAD', value: 23 },
        { code: 'HALF', value: 24 },
        { code: 'DEC', value: 47.75 },
        { code: 'DAP', value: 12 },
      ],
    },
    {
      id: 's2',
      kind: 'control',
      label: 'Step 2 · 10% of $48',
      prompt: 'What is 10% of $48? Type your answer. You can shade the bar too if it helps.',
      input: { type: 'shade', whole: 48, unit: 'usd', readout: 'pct', typed: 'separate' },
      correct: 4.8,
      codes: [
        { code: 'PAD', value: 10 },
        { code: 'DEC', value: 0.48 },
      ],
    },
    {
      id: 's3',
      kind: 'guided',
      label: 'Step 3 · dollars off',
      prompt: 'Shade the bar to show 25% of $48. How many dollars come off?',
      input: { type: 'shade', whole: 48, unit: 'usd', readout: 'usd', typed: 'linked' },
      correct: 12,
      codes: [
        { code: 'PAD', value: 25 },
        { code: 'HALF', value: 24 },
        { code: 'DEC', value: 0.25 },
      ],
    },
    {
      id: 's4',
      kind: 'guided',
      label: 'Step 4 · final price',
      prompt: 'So what is the final price of the hoodie?',
      input: { type: 'numberLine', min: 0, max: 60, scale: 'linear', unit: 'usd' },
      correct: 36,
      codes: [
        { code: 'PAD', value: 23 },
        { code: 'HALF', value: 24 },
        { code: 'DEC', value: 47.75 },
        { code: 'DAP', value: 12 },
      ],
    },
  ],
  admin: [
    { type: 'dots', step: 's1', title: 'Step 1: what students expect to pay', primary: true },
    { type: 'codeBar', steps: ['s1', 's2', 's3', 's4'], title: 'Where the error shows up, by step' },
    { type: 'consistency', check: 'shadeMismatch', steps: ['s2'], title: 'Shaded bar vs typed answer (Step 2)', note: 'Students whose shading disagrees with the dollars they typed.' },
    { type: 'dots', step: 's4', title: 'Step 4: final price after working it out' },
  ],
  decision:
    'A big cluster at $23 means start with “percent is not dollars.” If Step 1 is fine but Step 2 errors are common, review percent arithmetic first.',
});
