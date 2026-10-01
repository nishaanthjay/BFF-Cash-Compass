import { describe, expect, it } from 'vitest';
import {
  anchoring, averageRanks, bucketCounts, calendarIntensity, confidencePoints, correct2x2, correctByGroup, firstLastShares, kde, pairPattern, quantile,
  ratioRows, recodeMap, sankey, spearman, valuesByForm,
} from '../src/lib/analysis';
import { buildSeed } from '../src/api/seed';
import { answer, dataset, resp, student } from './fixtures';

const rc = recodeMap([]);
const stu = (c: string) => student('s1', c, 9);
const A = stu('AAA222');
const B = stu('BBB333');
const C = stu('CCC444');
const D = stu('DDD555');

describe('sankey (S3)', () => {
  const d = dataset(
    [
      resp(answer(A, 'S3', 's1', 40, ['ADD'])), resp(answer(A, 'S3', 's3a', null, [], { value: { choice: ['base80'] } })), resp(answer(A, 'S3', 's4', 40, ['ADD'])),
      resp(answer(B, 'S3', 's1', 44.8, ['CORR'])), resp(answer(B, 'S3', 's3a', null, [], { value: { choice: ['base56'] } })), resp(answer(B, 'S3', 's4', 44.8, ['CORR'])),
      resp(answer(C, 'S3', 's1', 30, ['UNK'])), resp(answer(C, 'S3', 's3a', null, [], { value: { choice: ['base80'] } })), resp(answer(C, 'S3', 's4', 40, ['ADD'])),
      resp(answer(D, 'S3', 's1', 40, ['ADD'])),
    ],
    [A, B, C, D],
  );
  const cols = [
    { step: 's1', label: 'g1', groups: [{ label: 'right', codes: ['CORR' as const] }, { label: 'add', codes: ['ADD' as const] }] },
    { step: 's3a', label: 'base', groups: [{ label: '80', choice: 'base80' }, { label: '56', choice: 'base56' }] },
    { step: 's4', label: 'g3', groups: [{ label: 'right', codes: ['CORR' as const] }, { label: 'add', codes: ['ADD' as const] }] },
  ];
  it('counts only students with every step, and sends unmatched answers to Other', () => {
    const s = sankey(d, 'S3', cols, rc);
    expect(s.n).toBe(3); // D is missing steps
    expect(s.columns[0].nodes.map((n) => [n.label, n.n])).toEqual([['right', 1], ['add', 1], ['Other', 1]]);
    // A: add → 80 → add ; C: Other → 80 → add
    const toAdd = s.links[1].filter((l) => l.to === 1).reduce((a, l) => a + l.n, 0);
    expect(toAdd).toBe(2);
  });
});

describe('S11 pair pattern', () => {
  const ch = (st: typeof A, item: string, pick: string) => resp(answer(st, item, 's1', null, [], { value: { choice: [pick] } }));
  const d = dataset(
    [ch(A, 'S11A', 'soon'), ch(A, 'S11B', 'later'), ch(B, 'S11A', 'later'), ch(B, 'S11B', 'soon'), ch(C, 'S11A', 'soon'), ch(C, 'S11B', 'later'), ch(D, 'S11A', 'later'), ch(D, 'S11B', 'later')],
    [A, B, C, D],
  );
  const ref = { step: 's1', early: 'soon' };
  it('counts SS/SL/LS/LL and the net present-bias rate', () => {
    const p = pairPattern(d, { item: 'S11A', ...ref }, { item: 'S11B', ...ref });
    expect(p).toMatchObject({ SS: 0, SL: 2, LS: 1, LL: 1, n: 4 });
    expect(p.net).toBeCloseTo(0.25);
  });
  it('share correct on a step by choice pattern', () => {
    const d2 = dataset([...d.responses, resp(answer(A, 'S11A', 's3', 20, ['CORR'])), resp(answer(B, 'S11A', 's3', 5, ['PAD'])), resp(answer(C, 'S11A', 's3', 5, ['PAD']))], [A, B, C, D]);
    const g = correctByGroup(d2, rc, { item: 'S11A', step: 's3' }, { a: { item: 'S11A', step: 's1', pick: 'soon' }, b: { item: 'S11B', step: 's1', pick: 'later' } });
    expect(g.yes).toEqual({ n: 2, share: 0.5 }); // A (right) and C (wrong) are SL
    expect(g.no).toEqual({ n: 1, share: 0 });
  });
});

describe('anchoring (S12)', () => {
  const rows = (vals: number[], form: string, off = 0) => vals.map((v, i) => resp(answer(stu(`S${off + i}AAA`.slice(0, 6)), 'S12', 's2', v, [], { form_version: form })));
  it('groups values by form', () => {
    const m = valuesByForm([...rows([80, 70], 'H'), ...rows([30], 'L', 10), ...rows([50], 'N', 20)]);
    expect(m.get('H')).toEqual([80, 70]);
    expect([...m.keys()].sort()).toEqual(['H', 'L', 'N']);
  });
  it('index = (median high − median low) ÷ (80 − 25), with an interval that contains it', () => {
    const high = [60, 62, 65, 70, 72, 75, 58, 66];
    const low = [30, 32, 35, 38, 40, 42, 28, 36];
    const a = anchoring(high, low, 80, 25);
    expect(a.index).toBeCloseTo((65.5 - 35.5) / 55, 6);
    expect(a.lo!).toBeLessThanOrEqual(a.index!);
    expect(a.hi!).toBeGreaterThanOrEqual(a.index!);
    expect(anchoring(high, low, 80, 25)).toEqual(a); // seeded: reproducible
  });
  it('minimum detectable effect shrinks with n and is large for small workshops', () => {
    const noisy = (n: number) => Array.from({ length: n }, (_, i) => 45 + ((i * 37) % 40) - 20);
    const small = anchoring(noisy(8), noisy(8), 80, 25);
    const big = anchoring(noisy(200), noisy(200), 80, 25);
    expect(small.mde!).toBeGreaterThan(big.mde!);
    expect(small.mde!).toBeGreaterThan(0.25); // too small to see a typical anchoring effect
    expect(anchoring([], [1], 80, 25).index).toBeNull();
  });
  it('quantile and kde sanity', () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([], 0.5)).toBeNull();
    const dens = kde([10, 11, 12, 50], [11, 30, 50]);
    expect(dens[0]).toBeGreaterThan(dens[1]);
  });
});

describe('ranking analysis (F8)', () => {
  const order = ['a', 'b', 'c', 'd', 'e'];
  const rk = (st: typeof A, step: string, ids: string[]) => resp(answer(st, 'F8', step, null, [], { value: { choice: ids } }));
  it('spearman: 1 for identical, −1 for reversed, null for mismatched lists', () => {
    expect(spearman(order, order)).toBe(1);
    expect(spearman([...order].reverse(), order)).toBe(-1);
    expect(spearman(['b', 'a', 'c', 'd', 'e'], order)).toBeCloseTo(0.9);
    expect(spearman(['a', 'b'], order)).toBeNull();
  });
  it('average rank and first/last shares', () => {
    const rows = [rk(A, 's1', ['a', 'b', 'c', 'd', 'e']), rk(B, 's1', ['e', 'd', 'c', 'b', 'a'])];
    expect(averageRanks(rows, order)).toMatchObject({ a: 3, c: 3, e: 3 });
    const fl = firstLastShares(rows, order);
    expect(fl.find((x) => x.id === 'a')).toEqual({ id: 'a', first: 1, last: 1 });
    expect(fl.find((x) => x.id === 'c')).toEqual({ id: 'c', first: 0, last: 0 });
  });
});

describe('other Stage 3 helpers', () => {
  it('calendar intensity: share (multi) and average (count)', () => {
    const multi = [resp(answer(A, 'F7', 's1', 2, [], { value: { cells: [2, 3] } })), resp(answer(B, 'F7', 's1', 1, [], { value: { cells: [2] } }))];
    expect(calendarIntensity(multi, 3)).toEqual([{ cell: 1, value: 0 }, { cell: 2, value: 1 }, { cell: 3, value: 0.5 }]);
    const count = [resp(answer(A, 'F6', 's3', 160, [], { value: { counts: { '1': 2, '3': 2 } } })), resp(answer(B, 'F6', 's3', 40, [], { value: { counts: { '1': 1 } } }))];
    expect(calendarIntensity(count, 3).map((c) => c.value)).toEqual([1.5, 0, 1]);
  });
  it('bucket counts use [min, max)', () => {
    const rows = [10, 9, 9, 8, 11].map((v, i) => resp(answer(stu(`B${i}AAAA`.slice(0, 6)), 'S13', 's1a', v)));
    expect(bucketCounts(rows, [{ label: '11+', min: 10.5, max: Infinity }, { label: '10', min: 9.5, max: 10.5 }, { label: '9', min: 8.5, max: 9.5 }, { label: '≤8', min: -Infinity, max: 8.5 }])).toEqual([1, 1, 2, 1]);
  });
  it('2×2 of correct answers', () => {
    const d = dataset(
      [resp(answer(A, 'S4', 's2', 6, ['CORR'])), resp(answer(A, 'S4', 's3', 56, ['REVPCT'])), resp(answer(B, 'S4', 's2', 6, ['CORR'])), resp(answer(B, 'S4', 's3', 56.8, ['CORR'])), resp(answer(C, 'S4', 's2', 12, ['PAD'])), resp(answer(C, 'S4', 's3', 62, ['PAD']))],
      [A, B, C],
    );
    expect(correct2x2(d, 'S4', 's2', 's3', rc)).toEqual({ both: 1, xOnly: 1, yOnly: 0, neither: 1, n: 3 });
  });
  it('ratio rows drop non-positive guesses; confidence points use |log10 error|', () => {
    const rows = [resp(answer(A, 'F3', 's1', 5680.7)), resp(answer(B, 'F3', 's1', 0)), resp(answer(C, 'F3', 's1', 56807))];
    expect(ratioRows(rows, 56807).map((r) => Number(r.raw_value!.toFixed(3)))).toEqual([0.1, 1]);
    const d = dataset([...rows, resp(answer(A, 'F3', 'gut', 5)), resp(answer(C, 'F3', 'gut', 2))], [A, B, C]);
    const pts = confidencePoints(d, 'F3', 'gut', 's1', 56807.34);
    expect(pts).toHaveLength(2);
    expect(pts.find((p) => p.code === 'AAA222')).toMatchObject({ x: 5 });
    expect(pts.find((p) => p.code === 'AAA222')!.y!).toBeCloseTo(1, 2);
  });
});

describe('demo seed carries the Stage 3 phenomena', () => {
  const seed = buildSeed(Date.parse('2026-10-01T12:00:00Z'));
  const data = {
    sessions: seed.sessions,
    students: seed.students.map((s) => ({ ...s, chapter_code: '' })),
    responses: seed.answers.map((a) => ({ ...a, chapter_code: '', cohort_label: null })),
    recodes: seed.recodes,
  };
  it('assigns forms and records them on answers', () => {
    const withForms = seed.students.filter((s) => s.forms.S12);
    expect(withForms.length).toBeGreaterThan(50);
    const s12 = seed.answers.filter((a) => a.item_id === 'S12' && a.step_id === 's2');
    expect(s12.every((a) => ['H', 'L', 'N'].includes(a.form_version ?? ''))).toBe(true);
    expect(seed.answers.filter((a) => a.item_id === 'S12' && a.step_id === 's1').every((a) => a.form_version !== 'N')).toBe(true);
  });
  it('shows an anchoring pull in the pooled data (high anchor > low anchor)', () => {
    const by = valuesByForm(data.responses.filter((r) => r.item_id === 'S12' && r.step_id === 's2'));
    const a = anchoring(by.get('H')!, by.get('L')!, 80, 25);
    expect(a.index!).toBeGreaterThan(0.1);
    expect(a.lo!).toBeGreaterThan(0);
  });
  it('shows more SL than LS (present-bias pattern)', () => {
    const p = pairPattern(data, { item: 'S11A', step: 's1', early: 'soon' }, { item: 'S11B', step: 's1', early: 'soon' });
    expect(p.n).toBeGreaterThan(50);
    expect(p.SL).toBeGreaterThan(p.LS);
  });
  it('records the shuffled starting order for rankings', () => {
    const r = seed.answers.find((a) => a.item_id === 'F8' && a.step_id === 's1')!;
    expect((r.value!.shown as string[]).length).toBe(5);
    expect((r.value!.choice as string[]).length).toBe(5);
  });
  it('S11 parts sit at least 6 positions apart for every seeded student', () => {
    const pos = new Map<string, Record<string, number>>();
    for (const a of seed.answers) if ((a.item_id === 'S11A' || a.item_id === 'S11B') && a.step_id === 's1') pos.set(`${a.session_id}${a.student_code}`, { ...(pos.get(`${a.session_id}${a.student_code}`) ?? {}), [a.item_id]: a.item_position });
    const both = [...pos.values()].filter((v) => v.S11A && v.S11B);
    expect(both.length).toBeGreaterThan(50);
    for (const v of both) expect(Math.abs(v.S11A - v.S11B)).toBeGreaterThanOrEqual(6);
  });
});
