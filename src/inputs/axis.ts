import type { AxisSpec } from '../items/types';

/** Value ↔ fraction along an axis (linear or log). */
export function toFrac(v: number, a: AxisSpec): number {
  const t = a.scale === 'log' ? (Math.log(v) - Math.log(a.min)) / (Math.log(a.max) - Math.log(a.min)) : (v - a.min) / (a.max - a.min);
  return Math.min(1, Math.max(0, t));
}

export function fromFrac(t: number, a: AxisSpec): number {
  const c = Math.min(1, Math.max(0, t));
  return a.scale === 'log' ? Math.exp(Math.log(a.min) + c * (Math.log(a.max) - Math.log(a.min))) : a.min + c * (a.max - a.min);
}

function niceStep(raw: number): number {
  const e = 10 ** Math.floor(Math.log10(raw));
  const f = raw / e;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e;
}

/** Snap a tapped value: linear → a nice step (~1/400 of range); log → 3 significant digits. */
export function snap(v: number, a: AxisSpec): number {
  if (a.scale === 'log') return Number(v.toPrecision(3));
  const st = niceStep((a.max - a.min) / 400);
  return Number((Math.round(v / st) * st).toFixed(6));
}

/** Tick values: 1-2-5 per decade on log axes, nice linear steps otherwise. */
export function ticks(a: AxisSpec, max = 7): number[] {
  if (a.scale === 'log') {
    for (const mult of [[1, 2, 5], [1, 3], [1]]) {
      const out: number[] = [];
      for (let e = Math.floor(Math.log10(a.min)); e <= Math.ceil(Math.log10(a.max)); e++)
        for (const m of mult) {
          const v = m * 10 ** e;
          if (v >= a.min * 0.999 && v <= a.max * 1.001) out.push(v);
        }
      if (out.length <= max) return out;
    }
    return [a.min, a.max];
  }
  const st = niceStep((a.max - a.min) / (max - 1));
  const out: number[] = [];
  for (let v = Math.ceil(a.min / st) * st; v <= a.max + 1e-9; v += st) out.push(Number(v.toFixed(6)));
  return out;
}
