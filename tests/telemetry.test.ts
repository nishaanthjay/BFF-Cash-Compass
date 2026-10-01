import { describe, expect, it } from 'vitest';
import { record, start, summarize } from '../src/lib/telemetry';
import { formatCode, isStudentCode, newStudentCode, normalizeStudentCode } from '../src/lib/studentCode';
import { mulberry32 } from '../src/lib/rng';

const run = (events: [string, number][], lock = 20_000) => {
  let s = start(0);
  for (const [m, t] of events) s = record(s, m as never, t);
  return summarize(s, lock);
};

describe('telemetry (exploratory)', () => {
  it('typed only', () => {
    const r = run([['typed', 2000], ['typed', 2200], ['typed', 2400]]);
    expect(r.input_method).toBe('typed');
    expect(r.n_revisions).toBe(0); // one typing burst
    expect(r.time_to_first_touch_ms).toBe(2000);
    expect(r.time_to_lock_ms).toBe(20_000);
  });
  it('separate typing bursts count as revisions', () => {
    expect(run([['typed', 1000], ['typed', 6000]]).n_revisions).toBe(1);
  });
  it('drag then type', () => {
    expect(run([['dragged', 1000], ['typed', 3000]]).input_method).toBe('dragged_then_typed');
  });
  it('tapped vs dragged', () => {
    expect(run([['tapped', 1000]]).input_method).toBe('tapped');
    expect(run([['tapped', 1000], ['dragged', 2000]]).input_method).toBe('dragged');
    expect(run([['tapped', 1000], ['dragged', 2000]]).n_revisions).toBe(1);
  });
  it('typed first, then a visual adjustment is not "then typed"', () => {
    expect(run([['typed', 1000], ['dragged', 2000]]).input_method).toBe('dragged');
  });
  it('no interaction', () => {
    const r = run([]);
    expect(r.input_method).toBeNull();
    expect(r.time_to_first_touch_ms).toBeNull();
  });
});

describe('student codes', () => {
  it('generates 6 unambiguous characters', () => {
    const r = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      const c = newStudentCode(r);
      expect(isStudentCode(c)).toBe(true);
      expect(c).not.toMatch(/[01OIL]/);
    }
  });
  it('formats and normalizes', () => {
    expect(formatCode('ABC234')).toBe('ABC-234');
    expect(normalizeStudentCode('abc-234')).toBe('ABC234');
  });
});
