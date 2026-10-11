/**
 * Calm lines shown under the Lock button. They encourage effort and never hint at whether an answer is right:
 * Cash Compass gives no feedback of any kind.
 */
export const CALM_LINES = [
  'Take your time. A thoughtful guess is exactly what we want.',
  'No timer, no points. Go with your best thinking.',
  'It’s okay to be unsure. Pick what feels closest.',
  'Nobody is grading this. You’re helping your group learn.',
  'There’s no rush. Read it once more if you like.',
  'We’re curious how you see it. Your way of thinking counts.',
] as const;

export function calmLine(problemIndex: number, stepIndex: number): string {
  return CALM_LINES[(problemIndex * 3 + stepIndex) % CALM_LINES.length];
}
