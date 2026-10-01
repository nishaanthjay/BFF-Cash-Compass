import type { Unit } from '../items/types';

const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** Value in an item's unit: cents shown only when present. */
export function formatUnit(value: number, unit: Unit): string {
  switch (unit) {
    case 'usd':
      return Number.isInteger(Math.round(value * 100) / 100) && Math.abs(value) >= 1 ? usd0.format(value) : usd2.format(value);
    case 'percent':
      return `${num.format(value)}%`;
    case 'months':
      return `${num.format(value)} mo`;
    case 'years':
      return `${num.format(value)} yr`;
    case 'days':
      return `${num.format(value)} d`;
    case 'times':
      return `${num.format(value)}×`;
    case 'count':
      return int.format(value);
  }
}

/** Compact axis label: $500, $2K, 1.5M, 8%. */
export function formatAxis(value: number, unit: Unit): string {
  const abs = Math.abs(value);
  const c = (n: number, s: string) => `${Number(n.toFixed(n < 10 ? 1 : 0))}${s}`;
  const body = abs >= 1e6 ? c(value / 1e6, 'M') : abs >= 1e4 ? c(value / 1e3, 'K') : num.format(Number(value.toPrecision(3)));
  if (unit === 'usd') return `$${body}`;
  if (unit === 'percent') return `${body}%`;
  if (unit === 'times') return `${body}×`;
  return body;
}

export const UNIT_AFFIX: Record<Unit, { prefix?: string; suffix?: string; word: string }> = {
  usd: { prefix: '$', word: 'dollars' },
  percent: { suffix: '%', word: 'percent' },
  months: { suffix: 'months', word: 'months' },
  years: { suffix: 'years', word: 'years' },
  days: { suffix: 'days', word: 'days' },
  times: { suffix: '×', word: 'times' },
  count: { word: '' },
};

/** Live keypad formatting with separators, preserving a trailing "." while typing. */
export function formatEntry(raw: string): string {
  if (raw === '') return '0';
  const [whole, frac] = raw.split('.');
  const w = int.format(Number(whole || '0'));
  return frac === undefined ? w : `${w}.${frac}`;
}
