import { describe, expect, it } from 'vitest';
import { ALL_PROBLEMS, correctOf, formKeyOf, getProblem, problemsFor, promptFor, stepsFor } from '../src/items';
import { amortize, aprForTarget, fvMonthly } from '../src/items/finance';
import { validateProblems } from '../src/items/validate';
import { classify } from '../src/lib/classify';
import { assignForms, orderPairs } from '../src/lib/forms';
import { buildOrder } from '../src/lib/order';
import { rankShown } from '../src/lib/rank';
import type { Step } from '../src/items/types';

const step = (p: string, s: string): Step => getProblem(p)!.steps.find((x) => x.id === s)!;
const truth = (p: string, s: string) => correctOf(step(p, s))!;

describe('finance helpers', () => {
  it('amortize: S14 card pays off in 74 months; $18 never does', () => {
    const a = amortize(1000, 22.15, 25);
    expect(a.months).toBe(74);
    expect(a.firstInterest).toBeCloseTo(18.46, 2);
    expect(a.firstPrincipal / 25).toBeCloseTo(0.26, 2);
    expect(amortize(1000, 22.15, 18).paysOff).toBe(false);
    expect(amortize(1000, 0, 25).months).toBe(40); // zero interest: 1000 ÷ 25
  });
  it('fvMonthly: $200 a month at 7% for 14 years', () => {
    expect(fvMonthly(200, 7, 14)).toBeCloseTo(56807.34, 2);
    expect(fvMonthly(15, 5, 5)).toBeCloseTo(1020.09, 2);
    expect(fvMonthly(100, 0, 1)).toBe(1200);
  });
  it('aprForTarget inverts fvMonthly', () => {
    const apr = aprForTarget(200, 14, 1_000_000);
    expect(fvMonthly(200, apr, 14)).toBeCloseTo(1_000_000, 0);
    expect(apr).toBeGreaterThan(36);
    expect(apr).toBeLessThan(37);
  });
});

describe('Stage 3 reference values (recomputed from the scenario)', () => {
  it('S3: $80, 30% off then 20% off', () => {
    expect(truth('S3', 's1')).toBeCloseTo(80 * 0.7 * 0.8, 2);
    expect(truth('S3', 's2')).toBe(56);
    expect(truth('S3', 's3b')).toBeCloseTo(0.2 * 56, 2);
    expect(truth('S3', 's5')).toBeCloseTo((1 - 0.7 * 0.8) * 100, 6);
    expect(step('S3', 's3a').correctChoice).toEqual(['base56']);
  });
  it('S4: 12% app fee', () => {
    expect(truth('S4', 's1')).toBe(44);
    expect(truth('S4', 's3')).toBeCloseTo(50 / 0.88, 2);
    expect(classify(step('S4', 's3'), 56)).toEqual(['REVPCT']);
    expect(classify(step('S4', 's3'), 62)).toEqual(['PAD']);
    // the check steps depend on the student's own list price
    const own = { s3: 60 };
    expect(correctOf(step('S4', 's4a'), own)).toBeCloseTo(7.2, 6);
    expect(correctOf(step('S4', 's4b'), own)).toBeCloseTo(52.8, 6);
    expect(correctOf(step('S4', 's4a'), { s3: null })).toBeNull();
  });
  it('S10: two accounts for 3 years, then inflation', () => {
    const a = 500 * 1.04 ** 3;
    const b = 500 * 1.0037 ** 3;
    expect(truth('S10', 's3a')).toBeCloseTo(a, 2);
    expect(truth('S10', 's3b')).toBeCloseTo(b, 2);
    expect(truth('S10', 's1')).toBeCloseTo(a - b, 2);
    expect(truth('S10', 's2b')).toBeCloseTo(1.85, 6);
    expect(truth('S10', 's4')).toBeCloseTo(500 * 1.034 ** 3, 2);
    expect(a).toBeGreaterThan(500 * 1.034 ** 3); // A gains buying power
    expect(b).toBeLessThan(500 * 1.034 ** 3); // B loses it
  });
  it('S13: 3.4% inflation', () => {
    expect(truth('S13', 's1b')).toBeCloseTo(103.4, 6);
    expect(truth('S13', 's2')).toBeCloseTo(100 / 1.034, 2);
    expect(truth('S13', 's3b')).toBeCloseTo(100.37 / 1.034, 2);
    expect(truth('S13', 's3c')).toBeCloseTo(104 / 1.034, 2);
    expect(truth('S13', 's4')).toBeCloseTo(100 * 1.034 ** 10, 1);
    expect(100 / 103.4).toBeCloseTo(0.967, 3); // 9.67 of 10 items
  });
  it('S14: credit card minimum', () => {
    const a = amortize(1000, 22.15, 25);
    expect(truth('S14', 's1')).toBe(74);
    expect(truth('S14', 's2a')).toBeCloseTo(22.15 / 12, 2);
    expect(truth('S14', 's2b')).toBeCloseTo(18.46, 2);
    expect(truth('S14', 's3')).toBeCloseTo(6.54, 2);
    expect(truth('S14', 's4a')).toBeCloseTo(a.totalPaid, 2);
    expect(truth('S14', 's4b')).toBeCloseTo(a.totalPaid - 1000, 2);
    expect(step('S14', 's5').correctChoice).toEqual(['never']);
    expect(classify(step('S14', 's1'), 40)).toEqual(['NOINTDEBT']);
    expect(classify(step('S14', 's3'), 25)).toEqual(['NOINTDEBT']);
  });
  it('S15: expected value of a phone plan', () => {
    expect(truth('S15', 's1b')).toBe(0.1 * 300);
    expect(truth('S15', 's2b')).toBe(100 * 0.1 * 300);
    expect(truth('S15', 's3')).toBe((60 / 300) * 100);
    expect(classify(step('S15', 's3'), 10)).toEqual(['RATE']);
  });
  it('F3: $200 a month, 7%, 14 years', () => {
    expect(truth('F3', 's1')).toBeCloseTo(56807.34, 2);
    expect(truth('F3', 's2')).toBe(200 * 12 * 14);
    expect(truth('F3', 's4')).toBeCloseTo(1_000_000 / 56807.34, 1);
    expect(truth('F3', 's5')).toBeCloseTo(1_000_000 / (56807.34 / 200), 0);
    expect(classify(step('F3', 's4'), 18)).toEqual(['CORR']);
  });
  it('F4: 12% a month', () => {
    expect(truth('F4', 's3')).toBeCloseTo((1.12 ** 12 - 1) * 100, 1);
    expect(truth('F4', 's4')).toBeCloseTo(((1.12 ** 12 - 1) * 100) / 4.2, 0);
    expect(classify(step('F4', 's3'), 144)).toEqual(['LIN']);
  });
  it('F7: $1 trial, then $14.99', () => {
    expect(truth('F7', 's1b')).toBeCloseTo(1 + 11 * 14.99, 2);
    expect(truth('F7', 's2')).toBeCloseTo((1 + 11 * 14.99) / 12, 2);
    expect(classify(step('F7', 's1b'), 179.88)).toEqual(['NOTRIAL']);
    expect(classify(step('F7', 's1b'), 1)).toEqual(['FRAME']);
  });
  it('H2: doubling from 2¢ for 20 days vs $400 a day', () => {
    const total = (n: number) => 0.02 * (2 ** n - 1);
    expect(truth('H2', 's1b')).toBeCloseTo(total(20), 2);
    expect(truth('H2', 's2')).toBe(0.32);
    expect(truth('H2', 's3')).toBeCloseTo(total(10), 2);
    expect(truth('H2', 's5b')).toBe(8000);
    expect(truth('H2', 's4')).toBe(19); // first day B's running total passes A's
    expect(total(18)).toBeLessThan(400 * 18);
    expect(total(19)).toBeGreaterThan(400 * 19);
    expect(Math.log10(400 / total(20))).toBeCloseTo(-1.72, 2);
  });
  it('F8: computed order is ascending yearly growth', () => {
    const rates = [4.2, truth('F8', 's2b'), truth('F8', 's2c'), truth('F8', 's2d'), truth('F8', 's2e')];
    expect([...rates].sort((a, b) => a - b)).toEqual(rates);
    expect(truth('F8', 's2e')).toBe(9900);
  });
});

describe('forms and conditional steps', () => {
  it('S12 anchor question shows only for H and L, with the right prompt', () => {
    const p = getProblem('S12')!;
    const ids = (f: string) => stepsFor(p, { S12: f }).map((s) => s.id);
    expect(ids('H')).toEqual(['s1', 's2', 's3', 's4']);
    expect(ids('L')).toEqual(['s1', 's2', 's3', 's4']);
    expect(ids('N')).toEqual(['s2', 's3', 's4']);
    expect(promptFor(step('S12', 's1'), 'H')).toMatch(/\$80/);
    expect(promptFor(step('S12', 's1'), 'L')).toMatch(/\$25/);
  });
  it('S12 uses typed inputs only (a slider would anchor)', () => {
    for (const s of getProblem('S12')!.steps) expect(['number', 'choice', 'dial']).toContain(s.input.type);
  });
  it('S11A and S11B share one form key', () => {
    expect(formKeyOf(getProblem('S11A')!)).toBe('S11');
    expect(formKeyOf(getProblem('S11B')!)).toBe('S11');
    const set = problemsFor(['skill']);
    const forms = assignForms(set, 'ABC234');
    expect(Object.keys(forms).sort()).toEqual(['S11', 'S12']);
    expect(forms).toEqual(assignForms(set, 'ABC234'));
  });
  it('forms are roughly balanced across student codes', () => {
    const set = problemsFor(['skill']);
    const c = { AB: 0, BA: 0, H: 0, L: 0, N: 0 } as Record<string, number>;
    for (let i = 0; i < 3000; i++) {
      const f = assignForms(set, `code${i}`);
      c[f.S11]++;
      c[f.S12]++;
    }
    expect(c.AB).toBeGreaterThan(1350);
    expect(c.BA).toBeGreaterThan(1350);
    for (const k of ['H', 'L', 'N']) expect(c[k]).toBeGreaterThan(850);
  });
});

describe('S11: counterbalanced order with a minimum gap', () => {
  const all = problemsFor(['skill', 'feasibility', 'hybrid']);
  it('parts A and B are ≥5 problems apart and follow the assigned order, for 1,000 students', () => {
    const seen = { AB: 0, BA: 0 };
    for (let i = 0; i < 1000; i++) {
      const code = `stu${i}`;
      const forms = assignForms(all, code);
      const { ids, relaxed } = buildOrder(all, code, orderPairs(all, forms));
      expect(relaxed).toBe(false);
      const a = ids.indexOf('S11A');
      const b = ids.indexOf('S11B');
      expect(Math.abs(a - b)).toBeGreaterThanOrEqual(6); // five or more problems between
      expect(a < b ? 'AB' : 'BA').toBe(forms.S11);
      seen[forms.S11 as 'AB' | 'BA']++;
    }
    expect(seen.AB).toBeGreaterThan(400);
    expect(seen.BA).toBeGreaterThan(400);
  });
  it('still holds the Stage 1–2 rules with the full bank', () => {
    for (let i = 0; i < 300; i++) {
      const { ids } = buildOrder(all, `x${i}`, orderPairs(all, assignForms(all, `x${i}`)));
      const at = (x: string) => ids.indexOf(x);
      expect(at('S6')).toBeLessThan(at('H1'));
      expect(at('F1')).toBeLessThan(at('F5'));
      expect(at('F1')).toBeLessThan(at('S4'));
    }
  });
  it('relaxes (and says so) when a session is too short for the gap', () => {
    const tiny = ALL_PROBLEMS.filter((p) => ['S11A', 'S11B', 'S1'].includes(p.id));
    expect(buildOrder(tiny, 'x', [['S11A', 'S11B']]).relaxed).toBe(true);
  });
});

describe('ranking shuffle', () => {
  it('is deterministic per student and step, and is a permutation', () => {
    const st = step('F8', 's1');
    expect(rankShown(st, 'ABC234')).toEqual(rankShown(st, 'ABC234'));
    expect([...rankShown(st, 'ABC234')].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    const orders = new Set(Array.from({ length: 40 }, (_, i) => rankShown(st, `c${i}`).join('')));
    expect(orders.size).toBeGreaterThan(10);
  });
});

describe('the whole bank', () => {
  it('has all 25 spec problems (S11 as two parts) and validates', () => {
    const ids = ALL_PROBLEMS.map((p) => p.id).sort();
    expect(ids).toHaveLength(26);
    for (let i = 1; i <= 15; i++) if (i !== 11) expect(ids).toContain(`S${i}`);
    for (let i = 1; i <= 8; i++) expect(ids).toContain(`F${i}`);
    expect(ids).toEqual(expect.arrayContaining(['H1', 'H2', 'S11A', 'S11B']));
    expect(validateProblems(ALL_PROBLEMS)).toEqual([]);
  });
  it('no student-facing text reveals an answer or gives feedback', () => {
    const text = ALL_PROBLEMS.flatMap((p) => p.steps.map((s) => s.prompt + ' ' + Object.values(s.promptByForm ?? {}).join(' ')));
    for (const t of text) expect(t).not.toMatch(/\b(correct answer|the answer is|well done|nice job|spot on)\b/i);
  });
});
