import type { Unit, Variables } from '../items/types';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 2 });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export function formatValue(value: number, fmt?: string): string {
  switch (fmt) {
    case 'usd':
      return Number.isInteger(value) ? usd0.format(value) : usd.format(value);
    case 'usd0':
      return usd0.format(Math.round(value));
    case 'pct':
      return `${num.format(value)}%`;
    case 'int':
      return int.format(Math.round(value));
    default:
      return num.format(value);
  }
}

/** Format a value in an item's unit, rounded sensibly for display. */
export function formatUnit(value: number, unit: Unit): string {
  switch (unit) {
    case 'usd':
      return Math.abs(value) >= 100 ? usd0.format(Math.round(value)) : usd.format(value);
    case 'percent':
      return `${num.format(value)}%`;
    case 'months':
      return `${num.format(value)} mo`;
    case 'years':
      return `${num.format(value)} yr`;
    case 'count':
      return int.format(value);
  }
}

export const UNIT_AFFIX: Record<Unit, { prefix?: string; suffix?: string; word?: string }> = {
  usd: { prefix: '$', word: 'dollars' },
  percent: { suffix: '%', word: 'percent' },
  months: { suffix: 'months', word: 'months' },
  years: { suffix: 'years', word: 'years' },
  count: { word: '' },
};

/** Fill `{name}` / `{name:fmt}` placeholders. Unknown names are left visible so the validator catches them. */
export function renderTemplate(template: string, vars: Variables): string {
  return template.replace(/\{(\w+)(?::(\w+))?\}/g, (whole, name: string, fmt?: string) =>
    name in vars ? formatValue(vars[name], fmt) : whole,
  );
}

/** Placeholder names referenced by a template. */
export function templateVars(template: string): string[] {
  return [...template.matchAll(/\{(\w+)(?::\w+)?\}/g)].map((m) => m[1]);
}

/**
 * Format the raw keypad string with thousands separators while preserving
 * a trailing "." or trailing zeros the student is still typing.
 */
export function formatEntry(raw: string): string {
  if (raw === '') return '0';
  const [whole, frac] = raw.split('.');
  const w = int.format(Number(whole || '0'));
  return frac === undefined ? w : `${w}.${frac}`;
}
