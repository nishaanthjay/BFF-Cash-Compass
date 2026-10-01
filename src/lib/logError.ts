/** ln(estimate / truth). Undefined (null) when either side is not strictly positive. */
export function logError(estimate: number, truth: number): number | null {
  if (!(estimate > 0) || !(truth > 0) || !Number.isFinite(estimate) || !Number.isFinite(truth)) return null;
  return Math.log(estimate / truth);
}

/** Median of finite numbers; null for an empty list. Does not mutate input. */
export function median(values: number[]): number | null {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = xs.length >> 1;
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

export type Direction = 'under' | 'over' | 'exact';

/** Within ±1% of truth counts as exact. */
export const EXACT_TOLERANCE = Math.log(1.01);

export function direction(le: number): Direction {
  if (Math.abs(le) <= EXACT_TOLERANCE) return 'exact';
  return le < 0 ? 'under' : 'over';
}

/** Human multiplier for a log error, e.g. 3.2 for "3.2× too low". */
export function multiplier(le: number): number {
  return Math.exp(Math.abs(le));
}
