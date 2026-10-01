import type { Code } from '../items/families';
import { correctOf } from '../items';
import type { Prior, Step } from '../items/types';

/** Default auto-classification window: ±1% of the target value. */
export const DEFAULT_TOL_PCT = 1;

/** Within ±tol% of target, plus half a cent so cent-rounded answers match. */
export function within(value: number, target: number, tolPct = DEFAULT_TOL_PCT): boolean {
  if (!Number.isFinite(value) || !Number.isFinite(target)) return false;
  return Math.abs(value - target) <= Math.abs(target) * (tolPct / 100) + 0.005;
}

/**
 * First-pass strategy codes for one answer. Several codes may apply (e.g. two
 * predicted wrong values that coincide). Numeric answers that match nothing are
 * UNK. Non-numeric steps return [] unless they have a correct choice.
 */
export function classify(step: Step, raw: number | null, prior: Prior = {}, choice?: string[]): Code[] {
  if (step.correctChoice && choice) {
    const a = [...choice].sort().join('|');
    const b = [...step.correctChoice].sort().join('|');
    return a === b ? ['CORR'] : [];
  }
  if (raw === null || !Number.isFinite(raw)) return [];
  const truth = correctOf(step, prior);
  const codes: Code[] = [];
  if (truth !== null && within(raw, truth, step.correctTolPct)) codes.push('CORR');
  for (const c of step.codes ?? []) if (within(raw, c.value, c.tolPct)) codes.push(c.code);
  if (truth === null && !step.codes?.length) return codes;
  return codes.length ? codes : ['UNK'];
}

/** Signed error, absolute percentage error and log ratio, as in the data model. */
export function errorMetrics(raw: number | null, truth: number | null) {
  if (raw === null || truth === null || !Number.isFinite(raw) || !Number.isFinite(truth)) return { signed_error: null, ape: null, log_ratio: null };
  return {
    signed_error: raw - truth,
    ape: truth !== 0 ? Math.abs(raw - truth) / Math.abs(truth) : null,
    log_ratio: raw > 0 && truth > 0 ? Math.log(raw / truth) : null,
  };
}
