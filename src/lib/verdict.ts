import { logError, multiplier } from './logError';

export type Verdict =
  | { kind: 'spot-on'; headline: string; detail: string }
  | { kind: 'under' | 'over'; headline: string; detail: string; times: number };

/** Within 10% counts as "spot on" for the student-facing reveal (analysis uses raw log error). */
export const SPOT_ON = Math.log(1.1);

function times(n: number): string {
  return n < 10 ? n.toFixed(1).replace(/\.0$/, '') : Math.round(n).toLocaleString('en-US');
}

export function verdictFor(guess: number, truth: number): Verdict {
  const le = logError(guess, truth);
  if (le === null) {
    return { kind: 'under', headline: 'Way too low', detail: 'A guess of zero can’t grow. The real number is bigger than nothing!', times: Infinity };
  }
  if (Math.abs(le) <= SPOT_ON) {
    return { kind: 'spot-on', headline: 'Spot on!', detail: 'Your guess was within 10% of the real number.' };
  }
  const m = multiplier(le);
  const kind = le < 0 ? 'under' : 'over';
  if (m < 2) {
    const pct = Math.round(Math.abs(guess / truth - 1) * 100);
    return {
      kind,
      times: m,
      headline: `${pct}% too ${kind === 'under' ? 'low' : 'high'}`,
      detail: kind === 'under' ? `Your guess was ${pct}% below the real number.` : `Your guess was ${pct}% above the real number.`,
    };
  }
  return {
    kind,
    times: m,
    headline: `${times(m)}× too ${kind === 'under' ? 'low' : 'high'}`,
    detail:
      kind === 'under'
        ? `The real number is ${times(m)} times bigger than your guess.`
        : `Your guess was ${times(m)} times bigger than the real number.`,
  };
}
