import { describe, expect, it } from 'vitest';
import { codeShares, codesOf, histogram, qualityFlags, ratingPairs, receiptMismatch, recodeMap, shadeMismatch, shareCorrect, topBar } from '../src/lib/analysis';
import { answer, dataset, resp, student } from './fixtures';
import { beeswarm } from '../src/charts/beeswarm';

const a = student('s1', 'AAA222', 3);
const b = student('s1', 'BBB333', 3);

describe('codes and shares', () => {
  const rows = [resp(answer(a, 'S1', 's1', 36, ['CORR'])), resp(answer(b, 'S1', 's1', 23, ['PAD'])), resp(answer(student('s1', 'CCC444'), 'S1', 's1', 30, ['UNK']))];
  it('manual recodes win over auto codes', () => {
    const rc = recodeMap([{ answer_id: rows[2].answer_id, codes: ['DEC'], coded_at: '' }]);
    expect(codesOf(rows[2], rc)).toEqual(['DEC']);
    expect(codesOf(rows[0], rc)).toEqual(['CORR']);
  });
  it('share per code and share correct', () => {
    const rc = recodeMap([]);
    expect(codeShares(rows, rc).map((c) => [c.code, c.n])).toEqual([['CORR', 1], ['PAD', 1], ['UNK', 1]]);
    expect(shareCorrect(rows, rc)).toBeCloseTo(1 / 3);
  });
});

describe('ratings', () => {
  it('pairs gut and post per student', () => {
    const d = dataset([resp(answer(a, 'F2', 'gut', 5)), resp(answer(a, 'F2', 'post', 2)), resp(answer(b, 'F2', 'gut', 4))], [a, b]);
    expect(ratingPairs(d, 'F2', 'gut', 'post')).toEqual([{ student: 'AAA222', gut: 5, post: 2 }]);
  });
});

describe('consistency checks', () => {
  it('shade vs typed mismatch beyond 1% of the whole', () => {
    const ok = resp(answer(a, 'S1', 's2', 4.8, [], { value: { fraction: 0.1 } }));
    const off = resp(answer(b, 'S1', 's2', 4.8, [], { value: { fraction: 0.25 } }));
    expect(shadeMismatch([ok, off], 48).map((r) => r.student_code)).toEqual(['BBB333']);
  });
  it('receipt total ≠ base + their own tax', () => {
    const d = dataset(
      [resp(answer(a, 'S2', 's3', 5.8)), resp(answer(a, 'S2', 's4', 85.8)), resp(answer(b, 'S2', 's3', 7.25)), resp(answer(b, 'S2', 's4', 85.8))],
      [a, b],
    );
    const r = receiptMismatch(d, 'S2', 80, 's3', 's4');
    expect(r.checked).toBe(2);
    expect(r.mismatched.map((x) => x.student_code)).toEqual(['BBB333']);
  });
});

describe('top bar & quality flags', () => {
  it('flags straight-lined ratings, identical answers and fast finishers', () => {
    const rows = [
      ...['g1', 'p1', 'g2', 'p2'].map((sid) => resp(answer(a, 'F2', sid.startsWith('g') ? 'gut' : 'post', 5, [], { item_id: sid.endsWith('1') ? 'F2' : 'F3' }))),
      ...['x1', 'x2', 'x3', 'x4', 'x5'].map((sid) => resp(answer(b, 'S1', sid, 10))),
    ];
    const d = dataset(rows, [a, b]);
    d.students[0].finished_at = '2026-09-01T10:02:00.000Z';
    const f = qualityFlags(d);
    expect(f.straightLined).toEqual(['AAA222']);
    expect(f.identical).toEqual(['BBB333']);
    expect(f.tooFast).toEqual(['AAA222']);
    const t = topBar(d, recodeMap([]));
    expect(t.started).toBe(2);
    expect(t.finished).toBe(1);
    expect(t.medianMinutes).toBeCloseTo(2);
    expect(t.methods[0]).toMatchObject({ key: 'typed', n: 9 });
  });
});

describe('histogram & beeswarm', () => {
  it('bins linear and log', () => {
    expect(histogram([1, 2, 3, 9], 0, 10, 2).map((b) => b.n)).toEqual([3, 1]);
    expect(histogram([1, 9, 100], 1, 100, 2, true).map((b) => b.n)).toEqual([2, 1]);
  });
  it('beeswarm never overlaps dots', () => {
    const xs = Array.from({ length: 80 }, (_, i) => 100 + (i % 7) * 3);
    const ys = beeswarm(xs, 5);
    for (let i = 0; i < xs.length; i++)
      for (let j = i + 1; j < xs.length; j++) expect(Math.hypot(xs[i] - xs[j], ys[i] - ys[j])).toBeGreaterThanOrEqual(10.9);
  });
});
