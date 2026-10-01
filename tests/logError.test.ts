import { describe, expect, it } from 'vitest';
import { direction, logError, median, multiplier } from '../src/lib/logError';

describe('logError', () => {
  it('is ln(estimate / truth)', () => {
    expect(logError(200, 100)).toBeCloseTo(Math.log(2));
    expect(logError(50, 100)).toBeCloseTo(-Math.log(2));
    expect(logError(100, 100)).toBe(0);
  });
  it('is symmetric: 2× over and 2× under have equal magnitude', () => {
    expect(logError(200, 100)!).toBeCloseTo(-logError(50, 100)!);
  });
  it('is null for non-positive or non-finite inputs', () => {
    expect(logError(0, 100)).toBeNull();
    expect(logError(-5, 100)).toBeNull();
    expect(logError(5, 0)).toBeNull();
    expect(logError(Infinity, 1)).toBeNull();
    expect(logError(NaN, 1)).toBeNull();
  });
});

describe('median', () => {
  it('handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it('is null for empty input and ignores non-finite values', () => {
    expect(median([])).toBeNull();
    expect(median([NaN, 5])).toBe(5);
  });
  it('does not mutate its input', () => {
    const xs = [3, 1, 2];
    median(xs);
    expect(xs).toEqual([3, 1, 2]);
  });
});

describe('direction / multiplier', () => {
  it('classifies with a ±1% exact band', () => {
    expect(direction(Math.log(1.005))).toBe('exact');
    expect(direction(Math.log(0.5))).toBe('under');
    expect(direction(Math.log(3))).toBe('over');
  });
  it('multiplier is exp(|le|)', () => {
    expect(multiplier(Math.log(0.25))).toBeCloseTo(4);
  });
});
