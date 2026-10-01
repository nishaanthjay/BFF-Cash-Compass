import { describe, expect, it } from 'vitest';
import { entryValue, pressKey, sanitizeEntry } from '../src/lib/entry';
import { formatEntry } from '../src/lib/format';
import { verdictFor } from '../src/lib/verdict';
import { logTicks, revealDomain } from '../src/lib/logScale';

describe('keypad entry', () => {
  it('builds numbers and backspaces', () => {
    let r = '';
    for (const k of ['1', '2', '0', '0'] as const) r = pressKey(r, k);
    expect(r).toBe('1200');
    expect(pressKey(r, 'back')).toBe('120');
  });
  it('allows one decimal point and two decimals', () => {
    expect(sanitizeEntry('1.2.3')).toBe('1.23');
    expect(sanitizeEntry('9.999')).toBe('9.99');
    expect(sanitizeEntry('.5')).toBe('0.5');
  });
  it('strips leading zeros and junk from pasted values', () => {
    expect(sanitizeEntry('$001,250')).toBe('1250');
  });
  it('caps integer digits', () => {
    expect(sanitizeEntry('123456789012345')).toBe('1234567890');
  });
  it('parses or returns null', () => {
    expect(entryValue('')).toBeNull();
    expect(entryValue('.')).toBeNull();
    expect(entryValue('12.5')).toBe(12.5);
  });
  it('formats live with separators and keeps a trailing dot', () => {
    expect(formatEntry('1234567')).toBe('1,234,567');
    expect(formatEntry('12.')).toBe('12.');
    expect(formatEntry('')).toBe('0');
  });
});

describe('reveal helpers', () => {
  it('verdicts', () => {
    expect(verdictFor(1050, 1000).kind).toBe('spot-on');
    expect(verdictFor(1000, 3870).headline).toBe('3.9× too low');
    expect(verdictFor(1300, 1000).headline).toBe('30% too high');
    expect(verdictFor(0, 1000).kind).toBe('under');
  });
  it('domain spans at least a decade and contains both values', () => {
    const [a, b] = revealDomain(1000, 1200);
    expect(b / a).toBeGreaterThanOrEqual(10 - 1e-9);
    expect(a).toBeLessThan(1000);
    expect(b).toBeGreaterThan(1200);
  });
  it('ticks are nice and limited', () => {
    expect(logTicks([300, 30000], 20)).toEqual([500, 1000, 2000, 5000, 10000, 20000]);
    expect(logTicks([1, 1e9], 4).length).toBeLessThanOrEqual(5);
  });
});
