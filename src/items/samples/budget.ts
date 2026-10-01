import { defineParallel } from '../types';

/** SAMPLE ITEM: placeholder for testing only. Not part of the real question bank. */
export default defineParallel({
  slot: 'sample-summer-budget',
  title: 'SAMPLE · Summer job budget',
  version: 1,
  active: true,
  sample: true,
  order: 3,
  deca_category: 'spending_saving',
  unit: 'usd',
  prompt_template:
    'Your summer job pays {wage:usd} an hour. You work {hours} hours a week for {weeks} weeks and spend {spend:usd} a week on food and fun. How much money is left at the end of summer?',
  forms: {
    A: { wage: 12, hours: 15, weeks: 10, spend: 60 },
    B: { wage: 14, hours: 12, weeks: 10, spend: 70 },
  },
  truth: ({ wage, hours, weeks, spend }) => (wage * hours - spend) * weeks,
  explanation:
    'Each week you keep what you earn minus what you spend. Multiply that by {weeks} weeks: {truth:usd0} left over.',
});
