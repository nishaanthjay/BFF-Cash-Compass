import { defineProblem } from '../types';

/** DRAFT wording, from the Interaction & Admin Visual Spec, S11 item B (shown much later than A). */
export default defineProblem({
  id: 'S11B',
  slug: 'present-bias-b',
  title: 'Pretend Prize · Both Later',
  version: 1,
  active: true,
  draft: true,
  module: 'skill',
  deca_category: 'decision_making',
  families: ['time_preference'],
  scenario: { layout: 'situation', text: 'Pretend you won a different prize. This is only pretend: no real money. Choose the one you would really pick.' },
  form: { key: 'S11', options: ['AB', 'BA'] },
  steps: [
    {
      id: 's1',
      kind: 'choice',
      label: 'Choice',
      prompt: 'Which would you pick?',
      input: {
        type: 'timeline',
        maxWeeks: 32,
        options: [
          { id: 'soon', label: 'In 26 weeks', amount: '$25', weeks: 26 },
          { id: 'later', label: 'In 30 weeks', amount: '$30', weeks: 30 },
        ],
      },
    },
  ],
  admin: [{ type: 'choiceBar', step: 's1', title: 'Choice: $25 in 26 weeks or $30 in 30 weeks' }],
  decision: 'Read this together with S11A: choosing $25 today but waiting for $30 here is the present-bias pattern.',
});
