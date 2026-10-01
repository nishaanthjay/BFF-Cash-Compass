import { describe, expect, it } from 'vitest';
import { buildSeed } from '../src/api/seed';
import type { ExportData } from '../src/api/types';
import { recodeMap, studentKey } from '../src/lib/analysis';
import { compounding, feasibility, gapMap, instrumentQuality, methodComparison, pearson, problemScores, radar, studentSteps, teachFirst, unkRows } from '../src/lib/crossItem';

const seed = buildSeed(Date.UTC(2026, 9, 1));
const chapterOf = new Map(seed.sessions.map((s) => [s.id, s.chapter_code]));
const data: ExportData = {
  sessions: seed.sessions,
  students: seed.students.map((s) => ({ ...s, chapter_code: chapterOf.get(s.session_id) ?? '' })),
  responses: seed.answers.map((a) => ({ ...a, chapter_code: chapterOf.get(a.session_id) ?? '', cohort_label: null })),
  recodes: seed.recodes,
};
const rc = recodeMap(data.recodes);

describe('cross-item views', () => {
  const scores = problemScores(data, rc);
  it('scores every problem and ranks the biggest gap first', () => {
    expect(scores).toHaveLength(26);
    const t = teachFirst(scores);
    expect(t.length).toBeGreaterThan(15);
    for (let i = 1; i < t.length; i++) expect(t[i - 1].gap).toBeGreaterThanOrEqual(t[i].gap);
  });
  it('hides problems under the minimum cell', () => {
    const hidden = problemScores({ ...data, responses: data.responses.slice(0, 3) }, rc, 5);
    expect(hidden.every((s) => s.correct === null)).toBe(true);
  });
  it('builds the gap map and radar over all six families', () => {
    expect(gapMap(scores).cols).toHaveLength(6);
    const r = radar(scores);
    expect(r).toHaveLength(6);
    expect(r.filter((p) => p.value !== null).every((p) => p.value! >= 0 && p.value! <= 1)).toBe(true);
  });
  it('finds students who answer compounding items linearly (demo data)', () => {
    const c = compounding(data, rc);
    expect(c.threshold).toBe(3);
    expect(c.studentsAnswered).toBeGreaterThan(50);
    expect(c.studentsLinear).toBeGreaterThan(0);
    expect(c.studentsLinear).toBeLessThan(c.studentsAnswered);
  });
  it('computes a high-confidence-wrong rate on feasibility items', () => {
    const f = feasibility(data, rc);
    expect(f.perItem.length).toBeGreaterThan(2);
    expect(f.rate).not.toBeNull();
    expect(f.rate!).toBeGreaterThan(0);
    expect(f.rate!).toBeLessThan(1);
    expect(feasibility(data, rc, 1e9).rate).toBeNull();
  });
  it('lists one anonymous student in the order they saw the items', () => {
    const key = studentKey(data.responses[0]);
    const rows = studentSteps(data, rc, key);
    expect(rows.length).toBeGreaterThan(5);
    for (let i = 1; i < rows.length; i++) expect(rows[i].position).toBeGreaterThanOrEqual(rows[i - 1].position);
  });
  it('reports difficulty and discrimination, and the UNK list', () => {
    const q = instrumentQuality(data, rc);
    expect(q.some((x) => x.discrimination !== null)).toBe(true);
    expect(q.every((x) => x.difficulty === null || (x.difficulty >= 0 && x.difficulty <= 1))).toBe(true);
    expect(unkRows(data, rc).length).toBeGreaterThan(0);
    expect(methodComparison(data, rc).map((m) => m.method).sort()).toEqual(['dragged or tapped', 'typed']);
  });
  it('a recode moves an UNK answer out of the UNK list', () => {
    const u = unkRows(data, rc)[0];
    const rc2 = recodeMap([...data.recodes, { answer_id: u.answer_id, codes: ['CORR'], coded_at: '2026-10-01T00:00:00Z' }]);
    expect(unkRows(data, rc2).some((r) => r.answer_id === u.answer_id)).toBe(false);
  });
  it('pearson', () => {
    expect(pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])).toBeCloseTo(1);
    expect(pearson([1, 2], [1, 2])).toBeNull();
    expect(pearson([1, 1, 1, 1, 1], [1, 2, 3, 4, 5])).toBeNull();
  });
});
