import { describe, expect, it } from 'vitest';
import { ALL_PROBLEMS, correctOf, estimateMinutes, getProblem, problemsFor } from '../src/items';
import { validateProblems } from '../src/items/validate';
import { classify } from '../src/lib/classify';
import type { Problem } from '../src/items/types';

const step = (p: string, s: string) => getProblem(p)!.steps.find((x) => x.id === s)!;

describe('item bank', () => {
  it('passes the validator (run after every bank edit)', () => {
    expect(validateProblems(ALL_PROBLEMS)).toEqual([]);
  });
  it('every problem is marked DRAFT until the author reviews it', () => {
    expect(ALL_PROBLEMS.every((p) => p.draft)).toBe(true);
  });
  it('modules filter', () => {
    expect(problemsFor(['feasibility']).map((p) => p.id)).toEqual(['F2']);
    expect(estimateMinutes(problemsFor(['skill', 'feasibility']))).toBeGreaterThan(3);
  });
});

describe('reference values from the spec', () => {
  it('S1 hoodie: $36, PAD $23, HALF $24, DEC $47.75', () => {
    expect(correctOf(step('S1', 's1'))).toBe(36);
    expect(48 * 0.75).toBe(36);
    expect(classify(step('S1', 's1'), 23)).toEqual(['PAD']);
    expect(classify(step('S1', 's1'), 24)).toEqual(['HALF']);
    expect(classify(step('S1', 's1'), 47.75)).toEqual(['DEC']);
    expect(correctOf(step('S1', 's3'))).toBeCloseTo(48 * 0.25);
  });
  it('S2 headphones: $80 at 7.25% = $85.80; tax-neglected $80; percent-as-dollars $87.25', () => {
    expect(correctOf(step('S2', 's4'))).toBeCloseTo(80 * 1.0725, 2);
    expect(correctOf(step('S2', 's3'))).toBeCloseTo(80 * 0.0725, 2);
    expect(classify(step('S2', 's1'), 80)).toEqual(['NOTAX']);
    expect(classify(step('S2', 's1'), 87.25)).toEqual(['PAD']);
  });
  it('F2: 100× in 12 months = 46.8%/month; linear ≈ 8.3%', () => {
    expect(correctOf(step('F2', 's3'))).toBeCloseTo((100 ** (1 / 12) - 1) * 100, 1);
    expect(classify(step('F2', 's3'), 8)).toEqual(['LIN']);
    expect(classify(step('F2', 's3'), 47)).toEqual(['CORR']);
    expect(correctOf(step('F2', 's2'))).toBe(50000 / 500);
  });
});

describe('validator catches bad problems', () => {
  const base = getProblem('S1')!;
  const bad = (patch: Partial<Problem>) => validateProblems([{ ...base, ...patch }]).join('\n');
  it('flags a code overlapping the correct value', () => {
    expect(bad({ steps: [{ ...base.steps[0], codes: [{ code: 'PAD', value: 36.1 }] }] })).toMatch(/overlaps the correct value/);
  });
  it('flags a correct value at the edge or centre of the axis (anchoring)', () => {
    expect(bad({ steps: [{ ...base.steps[0], input: { type: 'numberLine', min: 0, max: 37, scale: 'linear', unit: 'usd' } }] })).toMatch(/edge/);
    expect(bad({ steps: [{ ...base.steps[0], input: { type: 'numberLine', min: 0, max: 72, scale: 'linear', unit: 'usd' } }] })).toMatch(/centre/);
  });
  it('flags admin charts pointing at missing steps and order cycles', () => {
    expect(bad({ admin: [{ type: 'dots', step: 'nope', title: 't' }] })).toMatch(/unknown step nope/);
    const a = { ...base, id: 'S1', order: { before: ['S2'] } };
    const b = { ...getProblem('S2')!, order: { before: ['S1'] } };
    expect(validateProblems([a, b]).join()).toMatch(/cycle/);
  });
});
