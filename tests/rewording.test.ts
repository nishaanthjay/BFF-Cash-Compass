import { describe, expect, it } from 'vitest';
import { correctOf, getProblem } from '../src/items';
import { CODES } from '../src/items/families';
import { classify } from '../src/lib/classify';

const step = (p: string, s: string) => getProblem(p)!.steps.find((x) => x.id === s)!;

describe('estimate steps are graded as estimates (±5%)', () => {
  it.each([
    ['S1', 's1', 35],
    ['S3', 's1', 43],
    ['F2', 's3', 45],
    ['F3', 's1', 55000],
    ['F4', 's2', 280],
    ['H1', 's1', 420],
    ['H1', 's4', 25],
    ['H2', 's1b', 20500],
  ])('%s %s accepts a close tap', (p, s, v) => {
    expect(classify(step(p, s), v)).toEqual(['CORR']);
  });
  it('still tells the predicted mistakes apart', () => {
    expect(classify(step('S1', 's1'), 24)).toEqual(['HALF']);
    expect(classify(step('S3', 's1'), 40)).toEqual(['ADDPCT']);
    expect(classify(step('H1', 's4'), 90)).toEqual(['LIN']);
  });
  it('S2 step 1 stays at ±1% so $87.25 (percent as dollars) is not called correct', () => {
    expect(classify(step('S2', 's1'), 87.25)).toEqual(['PAD']);
  });
});

describe('answer-key and code fixes', () => {
  it('uses only registered codes, and ADD was renamed', () => {
    expect('ADD' in CODES).toBe(false);
    expect(CODES.ADDPCT.family).toBe('percent');
    expect(CODES.WRONGBASE.family).toBe('percent');
    expect(CODES.FORGOTBASE.family).toBe('percent');
    expect(CODES.UNIT.family).toBe('arithmetic');
  });
  it('S3 step 3b: 20% of the original price is WRONGBASE', () => {
    expect(classify(step('S3', 's3b'), 16)).toEqual(['WRONGBASE']);
  });
  it('S3 step 6: two 50% discounts is 75% off, not 100%', () => {
    expect(correctOf(step('S3', 's6'))).toBe(75);
    expect(classify(step('S3', 's6'), 100)).toEqual(['ADDPCT']);
  });
  it('H2 step 2: 32 (cents typed as dollars) is UNIT', () => {
    expect(classify(step('H2', 's2'), 0.32)).toEqual(['CORR']);
    expect(classify(step('H2', 's2'), 32)).toEqual(['UNIT']);
  });
  it('F4 yearly growth: 389.6 is the total, not the growth', () => {
    expect(classify(step('F4', 's3'), 289.6)).toEqual(['CORR']);
    expect(classify(step('F4', 's3'), 389.6)).toEqual(['FORGOTBASE']);
    expect(classify(step('F4', 's2'), 389.6)).toEqual(['FORGOTBASE']);
  });
  it('F8 Claim E: 10,000% is FORGOTBASE; Claim C linear guess is 90%', () => {
    expect(classify(step('F8', 's2e'), 10000)).toEqual(['FORGOTBASE']);
    expect(classify(step('F8', 's2c'), 90)).toEqual(['LIN']);
  });
  it('F1 step 6 accepts simple scaling (10.42) and compounding (about 10.7)', () => {
    expect(classify(step('F1', 's6'), 10.42)).toEqual(['CORR']);
    expect(classify(step('F1', 's6'), 10.7)).toEqual(['CORR']);
  });
  it('F3 step 6 is a pick-one whose key is the 36% option', () => {
    const s = step('F3', 's6');
    expect(s.input.type).toBe('choice');
    expect(classify(s, null, {}, ['r36'])).toEqual(['CORR']);
    expect(classify(s, null, {}, ['r80'])).toEqual([]);
  });
});
