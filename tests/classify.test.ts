import { describe, expect, it } from 'vitest';
import { classify, errorMetrics, within } from '../src/lib/classify';
import type { Step } from '../src/items/types';

const step: Step = {
  id: 's1',
  kind: 'cold',
  label: 'x',
  prompt: 'x',
  input: { type: 'number', unit: 'usd' },
  correct: 36,
  codes: [
    { code: 'PAD', value: 23 },
    { code: 'HALF', value: 24 },
    { code: 'LIN', value: 8.33, tolPct: 4.1 },
  ],
};

describe('within (±1% band)', () => {
  it('includes the band edges plus half a cent', () => {
    expect(within(36.36, 36)).toBe(true);
    expect(within(35.64, 36)).toBe(true);
    expect(within(36.4, 36)).toBe(false);
  });
  it('honours a custom tolerance', () => {
    expect(within(8, 8.33, 4.1)).toBe(true);
    expect(within(8, 8.33)).toBe(false);
  });
});

describe('classify', () => {
  it('CORR within ±1%', () => expect(classify(step, 36.2)).toEqual(['CORR']));
  it('named wrong values', () => {
    expect(classify(step, 23)).toEqual(['PAD']);
    expect(classify(step, 8)).toEqual(['LIN']);
  });
  it('several codes can apply at once', () => {
    const s2: Step = { ...step, codes: [{ code: 'PAD', value: 23 }, { code: 'DEC', value: 23.1 }] };
    expect(classify(s2, 23.05)).toEqual(['PAD', 'DEC']);
  });
  it('anything else is UNK', () => expect(classify(step, 30)).toEqual(['UNK']));
  it('blank answers get no code', () => expect(classify(step, null)).toEqual([]));
  it('correct can depend on earlier answers', () => {
    const dep: Step = { ...step, correct: (p) => (p.s3 ?? 0) + 80, codes: [] };
    expect(classify(dep, 85.8, { s3: 5.8 })).toEqual(['CORR']);
    expect(classify(dep, 85.8, { s3: 7.25 })).toEqual(['UNK']);
  });
  it('choice steps compare sets', () => {
    const ch: Step = { ...step, correct: undefined, codes: [], input: { type: 'choice', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }, correctChoice: ['b'] };
    expect(classify(ch, null, {}, ['b'])).toEqual(['CORR']);
    expect(classify(ch, null, {}, ['a'])).toEqual([]);
  });
  it('steps with no truth (ratings) get no code', () => {
    const r: Step = { ...step, correct: undefined, codes: [], input: { type: 'dial' } };
    expect(classify(r, 4)).toEqual([]);
  });
});

describe('errorMetrics', () => {
  it('signed error, APE and log ratio', () => {
    const e = errorMetrics(23, 36);
    expect(e.signed_error).toBe(-13);
    expect(e.ape).toBeCloseTo(13 / 36);
    expect(e.log_ratio).toBeCloseTo(Math.log(23 / 36));
  });
  it('log ratio undefined for zero', () => expect(errorMetrics(0, 36).log_ratio).toBeNull());
});
