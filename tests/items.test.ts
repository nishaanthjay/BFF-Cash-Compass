import { describe, expect, it } from 'vitest';
import { ALL_ITEMS, explanationOf, getItems, promptOf, truthOf } from '../src/items';
import compound from '../src/items/samples/compoundGrowth';
import loan, { totalPaid } from '../src/items/samples/loanInterest';
import budget from '../src/items/samples/budget';
import { validateItems } from '../src/items/validate';
import { defineItem } from '../src/items/types';
import { renderTemplate } from '../src/lib/format';

describe('item bank', () => {
  it('every item passes validation (run this after importing the real bank)', () => {
    expect(validateItems(ALL_ITEMS)).toEqual([]);
  });
  it('renders every prompt and explanation with no unfilled placeholders', () => {
    for (const it of ALL_ITEMS) {
      expect(promptOf(it)).not.toMatch(/\{\w+/);
      expect(explanationOf(it)).not.toMatch(/\{\w+/);
    }
  });
  it('getItems returns active items in order', () => {
    expect(getItems().map((i) => i.order)).toEqual([1, 2, 3]);
  });
});

describe('sample truth functions (hand-computed)', () => {
  it('compound growth: 1000 × 1.07^20 = 3869.68', () => {
    expect(truthOf(compound)).toBeCloseTo(3869.68, 2);
  });
  it('budget: (12×15 − 60) × 10 = 1200', () => {
    expect(truthOf(budget)).toBe(1200);
  });
  it('loan: zero interest means you pay exactly the price', () => {
    expect(totalPaid(800, 0, 40)).toBeCloseTo(800, 6);
  });
  it('loan: one-month payoff adds one month of interest', () => {
    expect(totalPaid(100, 12, 1000)).toBeCloseTo(101, 6);
  });
  it('loan: $800 at 24% APR, $40/mo ≈ $1,032 (26 payments)', () => {
    const t = truthOf(loan);
    expect(t).toBeGreaterThan(1030);
    expect(t).toBeLessThan(1035);
  });
});

describe('validator catches bad items', () => {
  const base = defineItem({
    id: 'ok-item',
    title: 'OK',
    version: 1,
    active: true,
    deca_category: 'investing',
    unit: 'usd',
    prompt_template: 'Spend {x:usd}?',
    variables: { x: 5 },
    truth: ({ x }) => x,
    explanation: 'It is {truth:usd}.',
  });
  it('accepts a good item', () => expect(validateItems([base])).toEqual([]));
  it('flags missing variables, bad truth, bad category, duplicate ids', () => {
    const bad = [
      { ...base, prompt_template: 'Spend {y}?' },
      { ...base, id: 'neg', truth: () => -1 },
      { ...base, id: 'cat', deca_category: 'nope' as never },
      { ...base, id: 'leak', prompt_template: 'It is {truth}' },
    ];
    const problems = validateItems(bad).join('\n');
    expect(problems).toMatch(/\{y\}/);
    expect(problems).toMatch(/\[neg\] truth/);
    expect(problems).toMatch(/\[cat\] unknown deca_category/);
    expect(problems).toMatch(/\[leak\] prompt must not reveal/);
    expect(validateItems([base, base]).join()).toMatch(/duplicate id/);
  });
});

describe('renderTemplate', () => {
  it('formats placeholders', () => {
    expect(renderTemplate('{a:usd} at {r:pct} for {n}', { a: 1500, r: 6.5, n: 3 })).toBe('$1,500 at 6.5% for 3');
  });
});
