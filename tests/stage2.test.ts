import { describe, expect, it } from 'vitest';
import { ALL_PROBLEMS, correctOf, getProblem } from '../src/items';
import { classify } from '../src/lib/classify';
import { buildOrder } from '../src/lib/order';
import { problemsFor } from '../src/items';
import type { Step } from '../src/items/types';

const step = (p: string, s: string): Step => getProblem(p)!.steps.find((x) => x.id === s)!;
const truth = (p: string, s: string) => correctOf(step(p, s))!;

/** Each reference value is recomputed here from the scenario numbers, independently of the bank file. */
describe('Stage 2 reference values (recomputed from the scenario)', () => {
  it('S5: $100 at 2%', () => {
    expect(truth('S5', 's1')).toBe(100 * 1.02);
    expect(truth('S5', 's2')).toBe(3 * 2);
    expect(truth('S5', 's3')).toBeCloseTo(100 * 1.02 ** 3, 2);
  });
  it('S6: $200 at 8% for 10 years', () => {
    expect(truth('S6', 's1')).toBeCloseTo(200 * 1.08 ** 10, 2);
    expect(truth('S6', 's2')).toBe(216);
    expect(truth('S6', 's3a')).toBeCloseTo(200 * 1.08 ** 2, 2);
    expect(truth('S6', 's3b')).toBeCloseTo(200 * 1.08 ** 2 - 216, 2);
    expect(truth('S6', 's4')).toBeCloseTo(Math.log(2) / Math.log(1.08), 1);
    expect(truth('S6', 's5')).toBeCloseTo(200 * 1.08 ** 10 - (200 + 16 * 10), 2);
    expect(200 * 1.08 ** 5).toBeCloseTo(293.87, 2); // year-5 reference used by the dashboard
  });
  it('S7: $1,000 at 6%', () => {
    expect(truth('S7', 's1')).toBeCloseTo(Math.log(2) / Math.log(1.06), 1);
    expect(truth('S7', 's3')).toBeCloseTo(1000 / 60, 2);
    expect(truth('S7', 's4a')).toBeCloseTo(1000 * 1.06 ** 24, 2);
    expect(truth('S7', 's4b')).toBeCloseTo(1000 * 1.06 ** 36, 2);
    expect(truth('S7', 's5')).toBeCloseTo((2 ** (1 / 6) - 1) * 100, 1);
  });
  it('S8: $15 a month, 5 years, 5% a year paid monthly', () => {
    const r = 0.05 / 12;
    const fv = (m: number) => m * (((1 + r) ** 60 - 1) / r);
    expect(truth('S8', 's1')).toBeCloseTo(fv(15), 2);
    expect(truth('S8', 's3')).toBeCloseTo(fv(15) - 900, 2);
    expect(truth('S8', 's4')).toBeCloseTo(fv(30), 2);
    expect(truth('S8', 's4')).toBeCloseTo(2 * truth('S8', 's1'), 1); // exactly double
  });
  it('S9: $2,000 at 7%, age 14 vs 24, checked at 64', () => {
    expect(truth('S9', 's1')).toBeCloseTo(1.07 ** 10, 2);
    expect(truth('S9', 's1b')).toBeCloseTo(2000 * (1.07 ** 50 - 1.07 ** 40), -1);
    expect(truth('S9', 's2')).toBe(2140);
    expect(truth('S9', 's3a')).toBeCloseTo(Math.log(2) / Math.log(1.07), 1);
    expect(truth('S9', 's4')).toBeCloseTo(2000 / 1.07 ** 10, 1);
  });
  it('F1: house flip numbers', () => {
    const selling = 0.08 * 20000;
    const net = 20000 - 10000 - 6000 - 500 - 1000 - selling;
    const cash = 10000 + 6000 + 500 + 1000 + selling;
    expect(truth('F1', 's3')).toBe(selling);
    expect(truth('F1', 's4b')).toBe(net);
    expect(net).toBe(900);
    expect(truth('F1', 's5a')).toBe(cash);
    expect(truth('F1', 's5b')).toBeCloseTo((net / cash) * 100, 2);
    expect(truth('F1', 's6')).toBeCloseTo(((net / cash) * 100 * 365) / 165, 0);
    expect(truth('F1', 's7')).toBeCloseTo(17500 / (1 - 0.08), 2);
    expect(truth('F1', 's8b')).toBe(3000 - net);
    expect(step('F1', 's9').correctChoice).toEqual(['no']); // 0.7 × 20,000 − 6,000 = 8,000 < 10,000
    expect(0.7 * 20000 - 6000).toBeLessThan(10000);
  });
  it('F5: sneaker resale', () => {
    const fee = 0.12 * 220;
    const profit = 220 - 150 - fee - 12;
    expect(truth('F5', 's2')).toBeCloseTo(fee, 2);
    expect(truth('F5', 's3b')).toBeCloseTo(profit, 2);
    expect(truth('F5', 's1')).toBeCloseTo(31.6, 2);
    expect(truth('F5', 's4')).toBeCloseTo(profit / 3, 2);
  });
  it('H1: $200 at 8%, and the rate the claim would need', () => {
    expect(truth('H1', 's1')).toBeCloseTo(200 * 1.08 ** 10, 2);
    expect(truth('H1', 's4')).toBeCloseTo((10 ** (1 / 10) - 1) * 100, 1);
  });
});

describe('classifier on every documented wrong value', () => {
  it('each predicted value gets its own code and never CORR', () => {
    for (const p of ALL_PROBLEMS)
      for (const st of p.steps)
        for (const c of st.codes ?? []) {
          const got = classify(st, c.value);
          expect(got, `${p.id}.${st.id} ${c.code}=${c.value}`).toContain(c.code);
          expect(got, `${p.id}.${st.id} ${c.code}=${c.value}`).not.toContain('CORR');
        }
  });
  it('every numeric correct value classifies as CORR', () => {
    for (const p of ALL_PROBLEMS)
      for (const st of p.steps) if (typeof st.correct === 'number') expect(classify(st, st.correct), `${p.id}.${st.id}`).toContain('CORR');
  });
  it('S5 Step 3 tells $106 (simple) from $106.12 (compound)', () => {
    expect(classify(step('S5', 's3'), 106.12)).toEqual(['CORR']);
    expect(classify(step('S5', 's3'), 106)).toEqual(['LIN']);
  });
  it('S6 Step 3a tells $232 from $233.28', () => {
    expect(classify(step('S6', 's3a'), 233.28)).toEqual(['CORR']);
    expect(classify(step('S6', 's3a'), 232)).toEqual(['LIN']);
  });
  it('Rule of 72 answers are accepted (S7 Step 5 = 12%, S6 Step 4 = 9 years)', () => {
    expect(classify(step('S7', 's5'), 12)).toEqual(['CORR']);
    expect(classify(step('S6', 's4'), 9)).toEqual(['CORR']);
    expect(classify(step('S9', 's3a'), 72 / 7)).toEqual(['CORR']);
  });
  it('choice steps: the 70% rule answer', () => {
    expect(classify(step('F1', 's9'), null, {}, ['no'])).toEqual(['CORR']);
    expect(classify(step('F1', 's9'), null, {}, ['yes'])).toEqual([]);
  });
});

describe('order engine on the real bank', () => {
  const all = problemsFor(['skill', 'feasibility', 'hybrid']);
  it('holds every declared rule across 1,000 student codes', () => {
    for (let i = 0; i < 1000; i++) {
      const { ids, relaxed } = buildOrder(all, `code-${i}`);
      expect(relaxed).toBe(false);
      const at = (x: string) => ids.indexOf(x);
      expect(at('S6')).toBeLessThan(at('H1'));
      expect(at('F1')).toBeLessThan(at('F5'));
      const adjacent = (a: string, b: string) => Math.abs(at(a) - at(b)) === 1;
      expect(adjacent('S6', 'S7') || adjacent('S6', 'S8') || adjacent('S7', 'S8')).toBe(false);
      expect(adjacent('F1', 'S5')).toBe(false);
    }
  });
  it('also works for a single module', () => {
    expect(buildOrder(problemsFor(['hybrid']), 'x').ids.sort()).toEqual(['H1', 'H2']);
  });
});
