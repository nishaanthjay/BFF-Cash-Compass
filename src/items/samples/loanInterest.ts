import { defineItem } from '../types';

/** Total paid on a balance with monthly compounding at `apr`% and a fixed monthly payment. */
export function totalPaid(balance: number, apr: number, payment: number): number {
  const r = apr / 100 / 12;
  let owed = balance;
  let paid = 0;
  for (let month = 0; month < 1200 && owed > 0.005; month++) {
    owed += owed * r;
    const pay = Math.min(payment, owed);
    owed -= pay;
    paid += pay;
  }
  return paid;
}

/** SAMPLE ITEM: placeholder for testing only. Not part of the real question bank. */
export default defineItem({
  id: 'sample-loan-interest',
  title: 'SAMPLE · Phone on credit',
  version: 1,
  active: true,
  sample: true,
  order: 2,
  deca_category: 'credit_debt',
  unit: 'usd',
  prompt_template:
    'A phone costs {price:usd}. You put it on a credit card with {apr:pct} interest per year and pay {payment:usd} every month until it is paid off. About how much do you pay in total?',
  variables: { price: 800, apr: 24, payment: 40 },
  truth: ({ price, apr, payment }) => totalPaid(price, apr, payment),
  explanation:
    'Small monthly payments stretch the loan out, and interest piles up every month. The {price:usd} phone really costs about {truth:usd0}.',
});
