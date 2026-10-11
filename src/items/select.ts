import { pickUnits, QUICK_CHECK_SIZE, type PickUnit } from './index';
import type { Module } from './types';

/** One problem from each of these modules, in this order. */
export const QUICK_CHECK_MODULES: Module[] = ['skill', 'feasibility', 'hybrid'];

/** How many students have answered each problem so far, by problem id (S1, F3, S11A, ...). */
export type ProblemCounts = Record<string, number>;

export interface QuickPick {
  unit: PickUnit;
  /** Students who have reached this problem in earlier sessions. */
  n: number;
}

/**
 * Problems a Quick check can draw from. Paired problems (S11A + S11B) are left out: they must sit at least five problems
 * apart in a student's order, which a 3-problem set cannot do. They stay available under "I'll pick" and "Everything".
 */
export function quickCheckPool(units: PickUnit[] = pickUnits()): PickUnit[] {
  return units.filter((u) => u.ids.length === 1);
}

/**
 * Choose the Quick check: for each module (Skill, Feasibility, Hybrid), the problem that the fewest students have answered
 * so far. Ties are broken at random, so a brand-new database does not always start with the same three.
 * Run the same selection after each session and every problem ends up with responses over time.
 */
export function selectQuickCheck(counts: ProblemCounts, rand: () => number = Math.random, units: PickUnit[] = pickUnits()): QuickPick[] {
  const pool = quickCheckPool(units);
  const picks: QuickPick[] = [];
  for (const m of QUICK_CHECK_MODULES) {
    const inModule = pool.filter((u) => u.module === m).map((unit) => ({ unit, n: counts[unit.ids[0]] ?? 0 }));
    if (!inModule.length) continue;
    const fewest = Math.min(...inModule.map((c) => c.n));
    const ties = inModule.filter((c) => c.n === fewest);
    picks.push(ties[Math.min(ties.length - 1, Math.floor(rand() * ties.length))]);
  }
  return picks.slice(0, QUICK_CHECK_SIZE);
}
