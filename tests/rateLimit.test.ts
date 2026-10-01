import { describe, expect, it } from 'vitest';
import { checkRateLimit, RATE } from '../src/lib/rateLimit';

const now = 1_000_000;
const base = { now, answerTimes: [] as number[], incoming: 0, attemptsInSession: 0, newAttempts: 0 };

describe('checkRateLimit', () => {
  it('allows a normal run', () => {
    expect(checkRateLimit({ ...base, incoming: 12 }).ok).toBe(true);
  });
  it('blocks more than 30 answers in a rolling minute', () => {
    const answerTimes = Array.from({ length: 25 }, (_, i) => now - i * 1000);
    expect(checkRateLimit({ ...base, answerTimes, incoming: 5 }).ok).toBe(true);
    const d = checkRateLimit({ ...base, answerTimes, incoming: 6 });
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.reason).toBe('answers');
      expect(d.retryAfterMs).toBeGreaterThan(0);
      expect(d.retryAfterMs).toBeLessThanOrEqual(RATE.windowMs);
    }
  });
  it('forgets answers older than the window', () => {
    const answerTimes = Array.from({ length: 30 }, () => now - RATE.windowMs - 1);
    expect(checkRateLimit({ ...base, answerTimes, incoming: 30 }).ok).toBe(true);
  });
  it('limits attempts per device per session', () => {
    expect(checkRateLimit({ ...base, attemptsInSession: 2, newAttempts: 1 }).ok).toBe(true);
    const d = checkRateLimit({ ...base, attemptsInSession: 3, newAttempts: 1 });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe('attempts');
  });
});
