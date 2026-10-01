/**
 * Device-token rate limiting. The same constants are mirrored in
 * supabase/migrations/0001_init.sql (sync_answers) and enforced by the mock API.
 */
export const RATE = {
  /** Max answers a device may submit in any rolling window. */
  answersPerWindow: 30,
  windowMs: 60_000,
  /** Max run-throughs (attempts) a device may start in one session. */
  attemptsPerSession: 3,
} as const;

export type RateDecision = { ok: true } | { ok: false; reason: 'answers' | 'attempts'; retryAfterMs: number };

/**
 * @param answerTimes  epoch ms of this device's previously accepted answers
 * @param incoming     answers in the batch being submitted
 * @param attemptsInSession  attempts this device already started in the target session
 * @param newAttempts  attempts being started in this batch (for that session)
 */
export function checkRateLimit(args: {
  now: number;
  answerTimes: number[];
  incoming: number;
  attemptsInSession: number;
  newAttempts: number;
}): RateDecision {
  const { now, answerTimes, incoming, attemptsInSession, newAttempts } = args;
  if (newAttempts > 0 && attemptsInSession + newAttempts > RATE.attemptsPerSession) {
    return { ok: false, reason: 'attempts', retryAfterMs: Infinity };
  }
  const recent = answerTimes.filter((t) => now - t < RATE.windowMs).sort((a, b) => a - b);
  if (recent.length + incoming > RATE.answersPerWindow) {
    const overflow = recent.length + incoming - RATE.answersPerWindow;
    const freeAt = recent[Math.min(overflow, recent.length) - 1] ?? now;
    return { ok: false, reason: 'answers', retryAfterMs: Math.max(1000, freeAt + RATE.windowMs - now) };
  }
  return { ok: true };
}
