/** Log-scale helpers for the reveal number line. Pure, unit-tested. */

export type LogDomain = [number, number];

/** Domain around guess+truth spanning at least `minSpan`× (default 1 decade), padded each side. */
export function revealDomain(guess: number | null, truth: number, minSpan = 10): LogDomain {
  const vals = [truth, ...(guess && guess > 0 ? [guess] : [])];
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = Math.max(1.8, Math.sqrt(minSpan / (hi / lo)));
  return [lo / pad, hi * pad];
}

export function logPosition(v: number, [d0, d1]: LogDomain, x0: number, x1: number): number {
  const t = (Math.log(v) - Math.log(d0)) / (Math.log(d1) - Math.log(d0));
  return x0 + Math.min(1, Math.max(0, t)) * (x1 - x0);
}

/** "Nice" tick values (1-2-5 per decade, thinned to fit `maxTicks`). */
export function logTicks([d0, d1]: LogDomain, maxTicks: number): number[] {
  const sets = [[1, 2, 5], [1, 3], [1]];
  for (const mult of sets) {
    const out: number[] = [];
    for (let e = Math.floor(Math.log10(d0)); e <= Math.ceil(Math.log10(d1)); e++) {
      for (const m of mult) {
        const v = m * 10 ** e;
        if (v >= d0 && v <= d1) out.push(v);
      }
    }
    if (out.length <= maxTicks) return out;
  }
  // Very wide domains: every Nth decade.
  const decades: number[] = [];
  for (let e = Math.ceil(Math.log10(d0)); e <= Math.floor(Math.log10(d1)); e++) decades.push(10 ** e);
  const stepN = Math.ceil(decades.length / Math.max(1, maxTicks));
  return decades.filter((_, i) => i % stepN === 0);
}

/** Compact tick label: 500, 2K, 1.5M. */
export function compact(v: number, prefix = ''): string {
  const abs = Math.abs(v);
  const fmt = (n: number, s: string) => `${prefix}${Number(n.toFixed(n < 10 ? 1 : 0))}${s}`;
  if (abs >= 1e9) return fmt(v / 1e9, 'B');
  if (abs >= 1e6) return fmt(v / 1e6, 'M');
  if (abs >= 1e3) return fmt(v / 1e3, 'K');
  if (abs >= 1) return `${prefix}${Math.round(v)}`;
  return `${prefix}${Number(v.toPrecision(1))}`;
}
