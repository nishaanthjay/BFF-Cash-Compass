import { describe, expect, it } from 'vitest';
import { ALL_PROBLEMS, estimateMinutes, MINUTES_PER_PROBLEM, minutesFor, pickUnits, problemsFor, QUICK_CHECK_MINUTES, QUICK_CHECK_SIZE } from '../src/items';
import { quickCheckPool, QUICK_CHECK_MODULES, selectQuickCheck, type ProblemCounts } from '../src/items/select';
import { buildOrder } from '../src/lib/order';

/** A deterministic "random": cycles through the given values. */
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length];
};
const idsOf = (counts: ProblemCounts, rand?: () => number) => selectQuickCheck(counts, rand).map((q) => q.unit.ids[0]);

describe('Quick check selection', () => {
  it('is 3 problems: one Skill, one Feasibility, one Hybrid', () => {
    const picks = selectQuickCheck({});
    expect(picks).toHaveLength(QUICK_CHECK_SIZE);
    expect(picks.map((q) => q.unit.module)).toEqual(QUICK_CHECK_MODULES);
    expect(picks.map((q) => q.unit.ids[0][0])).toEqual(['S', 'F', 'H']);
  });

  it('never picks the paired S11A/S11B (they need five problems between them)', () => {
    expect(quickCheckPool().flatMap((u) => u.ids)).not.toContain('S11A');
    for (let i = 0; i < 200; i++) expect(selectQuickCheck({}, Math.random).flatMap((q) => q.unit.ids)).not.toContain('S11B');
  });

  it('picks the problem with the fewest answers in each module', () => {
    const counts: ProblemCounts = {};
    for (const u of quickCheckPool()) counts[u.ids[0]] = 20;
    counts.S9 = 3;
    counts.F5 = 0;
    counts.H2 = 7;
    expect(idsOf(counts)).toEqual(['S9', 'F5', 'H2']);
  });

  it('treats a problem nobody has answered as 0', () => {
    const counts: ProblemCounts = {};
    for (const u of quickCheckPool()) counts[u.ids[0]] = 5;
    delete counts.F8;
    expect(idsOf(counts)[1]).toBe('F8');
  });

  it('breaks ties at random, using the whole tied set', () => {
    const skill = quickCheckPool().filter((u) => u.module === 'skill');
    const seen = new Set<string>();
    for (let i = 0; i < skill.length; i++) seen.add(idsOf({}, seq(i / skill.length + 0.001))[0]);
    expect(seen.size).toBe(skill.length);
    // the first of the ties and the last of the ties are both reachable, and nothing overflows at rand() = 0.999…
    expect(idsOf({}, () => 0)[0]).toBe(skill[0].ids[0]);
    expect(idsOf({}, () => 0.9999999)[0]).toBe(skill[skill.length - 1].ids[0]);
  });

  it('rotates: running it after each session covers every eligible problem', () => {
    const counts: ProblemCounts = {};
    const seen = new Set<string>();
    for (let session = 0; session < 40; session++) {
      for (const id of idsOf(counts, Math.random)) {
        seen.add(id);
        counts[id] = (counts[id] ?? 0) + 20; // a class of 20
      }
    }
    expect([...seen].sort()).toEqual(quickCheckPool().flatMap((u) => u.ids).sort());
    // and the load stays balanced: no problem gets more than one session more than another within a module
    for (const m of QUICK_CHECK_MODULES) {
      const ns = quickCheckPool().filter((u) => u.module === m).map((u) => counts[u.ids[0]] ?? 0);
      expect(Math.max(...ns) - Math.min(...ns)).toBeLessThanOrEqual(20);
    }
  });

  it('ignores counts for problems that are not in the pool', () => {
    expect(idsOf({ S11A: 0, S11B: 0, ZZ9: 0 })).toHaveLength(3);
  });

  it('builds a valid student order for every possible set without relaxing the rules', () => {
    const pool = quickCheckPool();
    const byModule = (m: string) => pool.filter((u) => u.module === m);
    for (const s of byModule('skill'))
      for (const f of byModule('feasibility'))
        for (const h of byModule('hybrid')) {
          const probs = problemsFor(['skill', 'feasibility', 'hybrid'], [...s.ids, ...f.ids, ...h.ids]);
          expect(probs).toHaveLength(3);
          expect(buildOrder(probs, 'ABC234', []).relaxed).toBe(false);
        }
  });
});

describe('time estimates', () => {
  it('is 2.8 minutes per problem, so the Quick check is about 8', () => {
    expect(MINUTES_PER_PROBLEM).toBe(2.8);
    expect(QUICK_CHECK_MINUTES).toBe(8);
    expect(minutesFor(3)).toBe(8);
    expect(minutesFor(10)).toBe(28);
    expect(minutesFor(0)).toBe(1);
  });
  it('estimateMinutes counts problems, not steps', () => {
    expect(estimateMinutes(problemsFor(['skill'], ['S1', 'S2', 'F1']))).toBe(8);
    expect(estimateMinutes(ALL_PROBLEMS.filter((p) => p.active))).toBe(minutesFor(ALL_PROBLEMS.filter((p) => p.active).length));
  });
  it('every pick unit is a real, active problem', () => {
    for (const u of pickUnits()) for (const id of u.ids) expect(ALL_PROBLEMS.find((p) => p.id === id)?.active).toBe(true);
  });
});
