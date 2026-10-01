import { defineParallel } from '../types';

/** SAMPLE ITEM: placeholder for testing only. Not part of the real question bank. */
export default defineParallel({
  slot: 'sample-compound-growth',
  title: 'SAMPLE · Savings growth',
  version: 1,
  active: true,
  sample: true,
  order: 1,
  deca_category: 'investing',
  unit: 'usd',
  prompt_template:
    'You put {principal:usd} in a savings account that earns {rate:pct} interest per year. You never add or take out money. About how much is in the account after {years} years?',
  forms: {
    A: { principal: 1000, rate: 7, years: 20 },
    B: { principal: 1500, rate: 6, years: 25 },
  },
  truth: ({ principal, rate, years }) => principal * (1 + rate / 100) ** years,
  derived: ({ rate }) => ({ double: Math.round(72 / rate) }),
  explanation:
    'Interest earns interest. At {rate:pct} a year your money roughly doubles every {double} years, so it ends near {truth:usd0}.',
});
