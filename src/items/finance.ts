/** Shared money math for the item bank and its tests. Pure, no UI. */

export interface Amortization {
  months: number;
  totalPaid: number;
  totalInterest: number;
  firstInterest: number;
  firstPrincipal: number;
  /** False when the payment doesn't even cover the first month's interest. */
  paysOff: boolean;
}

/** Fixed monthly payment on a balance; interest is charged monthly at apr/12 before each payment. */
export function amortize(balance: number, aprPercent: number, payment: number, maxMonths = 2400): Amortization {
  const r = aprPercent / 100 / 12;
  const firstInterest = balance * r;
  const paysOff = payment > firstInterest;
  if (!paysOff) return { months: Infinity, totalPaid: Infinity, totalInterest: Infinity, firstInterest, firstPrincipal: payment - firstInterest, paysOff };
  let owed = balance;
  let paid = 0;
  let months = 0;
  while (owed > 0.005 && months < maxMonths) {
    owed += owed * r;
    const pay = Math.min(payment, owed);
    owed -= pay;
    paid += pay;
    months++;
  }
  return { months, totalPaid: paid, totalInterest: paid - balance, firstInterest, firstPrincipal: payment - firstInterest, paysOff };
}

/** Future value of equal end-of-month deposits at apr/12 per month. */
export function fvMonthly(deposit: number, aprPercent: number, years: number): number {
  const r = aprPercent / 100 / 12;
  const n = years * 12;
  return r === 0 ? deposit * n : deposit * (((1 + r) ** n - 1) / r);
}

/** APR (percent, compounded monthly) at which equal monthly deposits reach `target` in `years`. Bisection. */
export function aprForTarget(deposit: number, years: number, target: number): number {
  let lo = 0;
  let hi = 5; // 500% a year is far beyond anything here
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (fvMonthly(deposit, mid * 100, years) < target) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 100;
}

export const compound = (principal: number, ratePercent: number, years: number) => principal * (1 + ratePercent / 100) ** years;
export const round2 = (x: number) => Math.round(x * 100) / 100;
