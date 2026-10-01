import { defineProblem } from '../types';

/** DRAFT wording, from the Interaction & Admin Visual Spec, S12. Three randomized forms; typed answers only (a slider would anchor). */
export default defineProblem({
  id: 'S12',
  slug: 'backpack-anchor',
  title: 'The Backpack Price',
  version: 1,
  active: true,
  draft: true,
  module: 'skill',
  deca_category: 'decision_making',
  families: ['feasibility'],
  scenario: { layout: 'situation', text: 'Look at this school backpack. It is black, has three pockets, and has a laptop sleeve.' },
  // H = high anchor ($80), L = low anchor ($25), N = no anchor.
  form: { key: 'S12', options: ['H', 'L', 'N'] },
  steps: [
    {
      id: 's1',
      kind: 'choice',
      label: 'Anchor question (not scored)',
      prompt: 'Is the price of this backpack more or less than the number shown?',
      promptByForm: {
        H: 'Is the price of this backpack more or less than $80?',
        L: 'Is the price of this backpack more or less than $25?',
      },
      forms: ['H', 'L'],
      input: {
        type: 'choice',
        options: [
          { id: 'more', label: 'More' },
          { id: 'less', label: 'Less' },
        ],
      },
    },
    {
      id: 's2',
      kind: 'cold',
      label: 'Price estimate',
      prompt: 'What do you think this backpack costs in a store?',
      input: { type: 'number', unit: 'usd' },
    },
    {
      id: 's3',
      kind: 'guided',
      label: 'Most you would pay',
      prompt: 'What is the most you would pay for it?',
      input: { type: 'number', unit: 'usd' },
    },
    {
      id: 's4',
      kind: 'rating_gut',
      label: 'Confidence',
      prompt: 'How sure are you about your price guess?',
      input: { type: 'dial', low: 'Not sure at all', high: 'Very sure' },
    },
  ],
  admin: [
    {
      type: 'ridgeline',
      title: 'Price estimate by anchor condition',
      step: 's2',
      anchors: { H: 80, L: 25 },
      labels: { H: 'High anchor ($80)', L: 'Low anchor ($25)', N: 'No anchor' },
      unit: 'usd',
      axis: { min: 0, max: 150, scale: 'linear', unit: 'usd' },
    },
    {
      type: 'ridgeline',
      title: 'Most they would pay, by anchor condition',
      step: 's3',
      anchors: { H: 80, L: 25 },
      labels: { H: 'High anchor ($80)', L: 'Low anchor ($25)', N: 'No anchor' },
      unit: 'usd',
      axis: { min: 0, max: 150, scale: 'linear', unit: 'usd' },
    },
  ],
  decision: 'None at the individual-workshop level. This is a pooled-analysis chart. Never label individual students.',
  notes: ['Typed input only on this problem: a slider’s range and start position would act as an anchor and contaminate the one item built to measure anchoring.'],
});
