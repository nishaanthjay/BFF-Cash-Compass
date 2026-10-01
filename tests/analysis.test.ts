import { describe, expect, it } from 'vitest';
import { applyFilters, summarize } from '../src/lib/analysis';
import type { ExportData } from '../src/api/types';
import type { DecaCategory } from '../src/items/types';
import { answer, attempt } from './fixtures';

function data(): ExportData {
  const a1 = attempt('s1', 2);
  const a2 = attempt('s1', 2);
  const a3 = attempt('s2', 2);
  const tag = (r: ReturnType<typeof answer>, chapter: string, day = '2026-09-01') => ({ ...r, chapter_code: chapter, answered_at: `${day}T10:00:00.000Z` });
  return {
    sessions: [
      { id: 's1', chapter_code: 'AAA', status: 'closed', created_at: '2026-09-01T09:00:00Z', closed_at: null },
      { id: 's2', chapter_code: 'BBB', status: 'closed', created_at: '2026-09-10T09:00:00Z', closed_at: null },
    ],
    attempts: [
      { ...a1, chapter_code: 'AAA' },
      { ...a2, chapter_code: 'AAA' },
      { ...a3, chapter_code: 'BBB', started_at: '2026-09-10T09:00:00Z' },
    ],
    responses: [
      tag(answer(a1, 'x', 50), 'AAA'), // ln .5
      tag(answer(a1, 'y', 400), 'AAA'), // ln 4
      tag(answer(a2, 'x', 200), 'AAA'), // ln 2   (a2 incomplete)
      tag(answer(a3, 'x', 0), 'BBB', '2026-09-10'), // excluded
      tag(answer(a3, 'y', 100), 'BBB', '2026-09-10'), // exact
    ],
  };
}
const cat = (id: string): DecaCategory => (id === 'x' ? 'investing' : 'credit_debt');

describe('summarize', () => {
  const s = summarize(data(), cat, ['y', 'x']);
  it('counts responses, chapters, sessions', () => {
    expect([s.responses, s.chapters, s.sessions]).toEqual([5, 2, 2]);
  });
  it('completion = attempts with every item answered / attempts', () => {
    expect(s.completed).toBe(2);
    expect(s.completionRate).toBeCloseTo(2 / 3);
  });
  it('per-item medians exclude zero guesses and report n', () => {
    const x = s.items.find((i) => i.item_id === 'x')!;
    expect(x.n).toBe(3);
    expect(x.excluded).toBe(1);
    expect(x.median).toBeCloseTo((Math.log(0.5) + Math.log(2)) / 2);
    expect(s.items.map((i) => i.item_id)).toEqual(['y', 'x']);
  });
  it('direction shares sum to 1 and count zero guesses as under', () => {
    const x = s.items.find((i) => i.item_id === 'x')!;
    expect(x.under).toBeCloseTo(2 / 3);
    expect(x.over).toBeCloseTo(1 / 3);
    const y = s.items.find((i) => i.item_id === 'y')!;
    expect(y.under + y.over + y.exact).toBeCloseTo(1);
    expect(y.exact).toBeCloseTo(0.5);
  });
  it('category medians', () => {
    expect(s.categories.find((c) => c.category === 'credit_debt')!.median).toBeCloseTo(Math.log(4) / 2);
  });
  it('flags low-n chapters', () => {
    expect(s.perChapter.every((c) => c.lowN)).toBe(true);
  });
});

describe('applyFilters', () => {
  it('filters by chapter and date range', () => {
    expect(applyFilters(data(), { chapter: 'BBB' }).responses).toHaveLength(2);
    expect(applyFilters(data(), { from: '2026-09-05' }).responses).toHaveLength(2);
    expect(applyFilters(data(), { to: '2026-09-05' }).attempts).toHaveLength(2);
  });
});
