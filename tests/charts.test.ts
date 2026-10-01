import { describe, expect, it } from 'vitest';
import { cardFrequency, choiceSplit, curvePoints, curveShape, joinSteps, pairedValues, quadrantCounts, recodeMap, vsReference, waterfall } from '../src/lib/analysis';
import { fromFrac, snap, ticks, toFrac } from '../src/inputs/axis';
import { redact } from '../src/inputs/Choice';
import { answer, dataset, resp, student } from './fixtures';

const a = student('s1', 'AAA222', 9);
const b = student('s1', 'BBB333', 9);
const c = student('s1', 'CCC444', 9);

describe('curve analysis', () => {
  it('classifies shape against the straight line to year 10', () => {
    expect(curveShape(200, 280, 360)).toBe('straight');
    expect(curveShape(200, 294, 432)).toBe('convex');
    expect(curveShape(200, 380, 432)).toBe('concave');
    expect(curveShape(200, null, 432)).toBe('no midpoint');
  });
  it('reads y5/y10 from the stored value and falls back to raw_value', () => {
    const rows = [resp(answer(a, 'S6', 's1', 400, [], { value: { y5: 290, y10: 400 } })), resp(answer(b, 'S6', 's1', 360)), resp(answer(c, 'S6', 's1', null))];
    expect(curvePoints(rows).map((p) => [p.y5, p.y10])).toEqual([[290, 400], [null, 360]]);
  });
});

describe('card stacking', () => {
  const stack = (st: typeof a, ids: string[]) => resp(answer(st, 'F5', 's3a', null, [], { value: { choice: ids } }));
  const rows = [stack(a, ['sale', 'purchase', 'fee', 'ship']), stack(b, ['sale', 'purchase']), stack(c, ['purchase', 'sale', 'cool'])];
  it('frequency and average position', () => {
    const f = cardFrequency(rows, ['sale', 'fee', 'cool']);
    expect(f[0]).toMatchObject({ id: 'sale', n: 3, share: 1 });
    expect(f[0].avgPos).toBeCloseTo((1 + 1 + 2) / 3);
    expect(f[1]).toMatchObject({ n: 1 });
    expect(f[1].share).toBeCloseTo(1 / 3);
  });
  it('waterfall shows an unstacked cost as a gap vs the correct breakdown', () => {
    const cards = [
      { id: 'sale', label: 'Sale', amount: 220, sign: 1 as const },
      { id: 'purchase', label: 'Buy', amount: 150, sign: -1 as const },
      { id: 'fee', label: 'Fee', amount: 26.4, sign: -1 as const },
      { id: 'ship', label: 'Ship', amount: 12, sign: -1 as const },
    ];
    const w = waterfall(rows, cards);
    expect(w.steps.at(-1)!.correctEnd).toBeCloseTo(31.6, 2);
    expect(w.implied).toBeCloseTo(220 - 150 - 26.4 / 3 - 12 / 3, 2);
    expect(w.implied).toBeGreaterThan(31.6);
  });
});

describe('two-step joins', () => {
  const d = dataset(
    [
      resp(answer(a, 'H1', 's1', 430)), resp(answer(a, 'H1', 's4', 26)), resp(answer(a, 'H1', 'post', 2)),
      resp(answer(b, 'H1', 's1', 2000)), resp(answer(b, 'H1', 's4', 80)), resp(answer(b, 'H1', 'post', 5)),
      resp(answer(c, 'H1', 's1', 2100)), resp(answer(c, 'H1', 's4', 70)),
    ],
    [a, b, c],
  );
  it('joins x and y per student with belief', () => {
    const xy = joinSteps(d, 'H1', 's1', 's4', recodeMap([]), { step: 'post', min: 4 });
    expect(xy).toHaveLength(3);
    expect(xy.find((p) => p.code === 'BBB333')).toMatchObject({ x: 2000, y: 80, belief: true });
    expect(xy.find((p) => p.code === 'AAA222')!.belief).toBe(false);
    expect(xy.find((p) => p.code === 'CCC444')!.belief).toBeUndefined();
  });
  it('quadrants need both answers', () => {
    expect(quadrantCounts(d, 'H1', { step: 's1', ref: 431.78, withinPct: 25 }, { step: 'post', min: 4 })).toEqual({ goodBelieves: 0, goodDoubts: 1, badBelieves: 1, badDoubts: 0 });
  });
  it('paired values', () => {
    const p = dataset([resp(answer(a, 'S7', 's1', 12)), resp(answer(a, 'S7', 's3', 17)), resp(answer(b, 'S7', 's1', 20))], [a, b]);
    expect(pairedValues(p, 'S7', 's1', 's3')).toEqual([{ key: 's1:AAA222', code: 'AAA222', a: 12, b: 17 }]);
  });
  it('choice split by accuracy on another step', () => {
    const s = dataset(
      [
        resp(answer(a, 'S9', 's1', 2)), resp(answer(a, 'S9', 's3b', null, [], { value: { choice: ['yes'] } })),
        resp(answer(b, 'S9', 's1', 1)), resp(answer(b, 'S9', 's3b', null, [], { value: { choice: ['no'] } })),
      ],
      [a, b],
    );
    expect(choiceSplit(s, 'S9', 's3b', { step: 's1', ref: 1.967, withinPct: 25 })).toEqual({ near: { yes: 1 }, far: { no: 1 } });
  });
  it('below / exact / above a reference', () => {
    const rows = [1000, 2040, 2041, 2500].map((v, i) => resp(answer(student('s1', `X${i}AAA`), 'S8', 's4', v)));
    expect(vsReference(rows, 2040.18, 1)).toEqual({ below: 1, exact: 2, above: 1 });
  });
});

describe('input helpers', () => {
  const lin = { min: 0, max: 60, scale: 'linear' as const, unit: 'usd' as const };
  const log = { min: 100, max: 3000, scale: 'log' as const, unit: 'usd' as const };
  it('maps values and fractions both ways, linear and log', () => {
    expect(toFrac(30, lin)).toBe(0.5);
    expect(fromFrac(0.5, lin)).toBe(30);
    expect(fromFrac(toFrac(1020, log), log)).toBeCloseTo(1020, 6);
    expect(toFrac(5000, log)).toBe(1); // clamped
  });
  it('snaps to tidy values', () => {
    expect(snap(33.8123, lin)).toBeCloseTo(33.8, 1);
    expect(snap(707.4141, log)).toBe(707);
  });
  it('log ticks use 1-2-5 per decade and stay on the axis', () => {
    const t = ticks(log, 8);
    expect(t.every((v) => v >= 100 && v <= 3000)).toBe(true);
    expect(t).toContain(100);
    expect(t).toContain(1000);
  });
  it('redacts emails, phone numbers and handles from free text', () => {
    expect(redact('mail me at kid@school.org or 555-123-4567 or @someone')).toBe('mail me at [removed] or [removed] or [removed]');
    expect(redact('x'.repeat(500))).toHaveLength(400);
  });
});
