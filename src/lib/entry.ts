/** Pure helpers for the numeric estimate entry (keypad + hardware keyboard share these). */

export const MAX_INT_DIGITS = 10;
export const MAX_DECIMALS = 2;

export type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back' | 'clear';

export function pressKey(raw: string, key: Key): string {
  if (key === 'clear') return '';
  if (key === 'back') return raw.slice(0, -1);
  return sanitizeEntry(raw + key);
}

/** Keep digits and one decimal point, strip leading zeros, cap length. Accepts pasted "$1,200.50". */
export function sanitizeEntry(input: string): string {
  let out = '';
  let seenDot = false;
  for (const ch of input) {
    if (ch >= '0' && ch <= '9') out += ch;
    else if (ch === '.' && !seenDot) {
      seenDot = true;
      out += '.';
    }
  }
  let [whole, frac] = out.split('.');
  whole = whole.replace(/^0+(?=\d)/, '').slice(0, MAX_INT_DIGITS);
  if (frac === undefined) return whole;
  if (whole === '') whole = '0';
  return `${whole}.${frac.slice(0, MAX_DECIMALS)}`;
}

/** Parsed value, or null if nothing usable has been typed. */
export function entryValue(raw: string): number | null {
  if (raw === '' || raw === '.') return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}
