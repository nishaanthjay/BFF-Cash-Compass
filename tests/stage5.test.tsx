import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);
import { createMockApi, DEMO_PASSCODE } from '../src/api/mock';
import { buildSeed } from '../src/api/seed';
import type { ExportData } from '../src/api/types';
import { ChartCard } from '../src/components/ChartCard';
import { ALL_PROBLEMS, pickUnits, problemsFor, SHORT_SESSION_SIZE } from '../src/items';
import { recodeMap } from '../src/lib/analysis';
import { biasByProblem, boxStats, ecdf, medianSeconds, workshopTrend } from '../src/lib/crossItem';
import { assignForms, orderPairs } from '../src/lib/forms';
import { buildOrder } from '../src/lib/order';
import { memoryKV } from '../src/lib/storage';

const seed = buildSeed(Date.UTC(2026, 9, 1));
const chapterOf = new Map(seed.sessions.map((s) => [s.id, s.chapter_code]));
const data: ExportData = {
  sessions: seed.sessions,
  students: seed.students.map((s) => ({ ...s, chapter_code: chapterOf.get(s.session_id) ?? '' })),
  responses: seed.answers.map((a) => ({ ...a, chapter_code: chapterOf.get(a.session_id) ?? '', cohort_label: null })),
  recodes: seed.recodes,
};

describe('short sessions (random 5 / pick 5)', () => {
  it('problemsFor uses exact ids when given, modules otherwise', () => {
    expect(problemsFor(['skill', 'feasibility', 'hybrid'], ['S1', 'F2']).map((p) => p.id).sort()).toEqual(['F2', 'S1']);
    expect(problemsFor(['hybrid'])).toHaveLength(2);
  });
  it('S11A and S11B travel together as one pick', () => {
    const u = pickUnits();
    expect(u.find((x) => x.key === 'S11')?.ids.sort()).toEqual(['S11A', 'S11B']);
    expect(u.flatMap((x) => x.ids).sort()).toEqual(ALL_PROBLEMS.filter((p) => p.active).map((p) => p.id).sort());
  });
  it('the mock stores the problems and join returns them', async () => {
    const api = createMockApi(memoryKV(), { latencyMs: 0, isOnline: () => true, seed });
    await api.createSession(DEMO_PASSCODE, 'SHORT1', ['skill', 'feasibility', 'hybrid'], null, ['S1', 'S2', 'F2', 'S11A', 'S11B']);
    const j = await api.joinSession('short1');
    expect(j.problem_ids).toEqual(['S1', 'S2', 'F2', 'S11A', 'S11B']);
  });
  it('an order for any 5 picks is built without relaxing the rules, across many students', () => {
    const units = pickUnits();
    for (let i = 0; i < 200; i++) {
      const keys = [...units].sort(() => Math.random() - 0.5).slice(0, SHORT_SESSION_SIZE);
      const probs = problemsFor(['skill', 'feasibility', 'hybrid'], keys.flatMap((k) => k.ids));
      const code = `T${String(i).padStart(5, '0')}`;
      const { ids } = buildOrder(probs, code, orderPairs(probs, assignForms(probs, code)));
      expect([...ids].sort()).toEqual(probs.map((p) => p.id).sort());
    }
  });
});

describe('new chart data', () => {
  it('ecdf is sorted and ends at 1', () => {
    const e = ecdf([5, 1, 3]);
    expect(e.map((x) => x.x)).toEqual([1, 3, 5]);
    expect(e[2].p).toBe(1);
  });
  it('boxStats orders its quantiles and needs 5 values', () => {
    expect(boxStats([1, 2, 3])).toBeNull();
    const b = boxStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])!;
    expect(b.p10 <= b.q1 && b.q1 <= b.median && b.median <= b.q3 && b.q3 <= b.p90).toBe(true);
    expect(b.median).toBe(5.5);
  });
  it('bias, trend and time views work on the demo data', () => {
    const b = biasByProblem(data);
    expect(b.length).toBeGreaterThan(5);
    for (let i = 1; i < b.length; i++) expect(b[i].value).toBeGreaterThanOrEqual(b[i - 1].value);
    const t = workshopTrend(data, recodeMap(data.recodes));
    expect(t.length).toBeGreaterThanOrEqual(6);
    expect(t.every((p) => p.value === null || (p.value >= 0 && p.value <= 1))).toBe(true);
    const m = medianSeconds(data);
    expect(m.length).toBeGreaterThan(5);
    expect(m[0].seconds).toBeGreaterThanOrEqual(m[m.length - 1].seconds);
  });
});

describe('ChartCard expand', () => {
  it('opens a full-screen dialog and closes with Escape', () => {
    render(
      <ChartCard title="Test chart" n={3} date="Oct 1">
        <p>chart body</p>
      </ChartCard>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Expand chart: Test chart/ }));
    expect(screen.getByRole('dialog', { name: /Test chart \(expanded\)/ })).toBeTruthy();
    expect(screen.getAllByText('chart body')).toHaveLength(2);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('can be switched off', () => {
    render(
      <ChartCard title="Flat" n={1} date="x" expandable={false}>
        <p>x</p>
      </ChartCard>,
    );
    expect(screen.queryByRole('button', { name: /Expand/ })).toBeNull();
  });
});
