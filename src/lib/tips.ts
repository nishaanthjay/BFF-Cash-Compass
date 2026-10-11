import type { DecaCategory } from '../items/types';

/**
 * One short money tip for the finish screen, matched to a topic the student just worked on. Tips are general habits.
 * They never say what the right answer to a question was (Cash Compass gives no feedback).
 */
export const TIPS: Record<DecaCategory, string[]> = {
  spending_saving: [
    'Before you buy, ask “what will I really pay after tax and fees?”',
    'Pay yourself first: set a little aside the moment money comes in.',
    'A sale only saves money if you were going to buy it anyway.',
  ],
  credit_debt: [
    'Borrowed money costs extra. The longer you owe, the more you pay.',
    'Paying only the minimum keeps you in debt longer than you expect.',
    'Before you borrow, ask “when will I pay this back, and how?”',
  ],
  employment_income: [
    'Income is what you earn. What you keep is what’s left after costs.',
    'Count your time and your costs before you price a job or a side business.',
    'Your skills are the best investment you can make early on.',
  ],
  investing: [
    'Time is your superpower: money left alone for years grows more than you’d guess.',
    'If it sounds too good to be true, ask who gains when you say yes.',
    'Starting small and early beats waiting for a big amount.',
  ],
  risk_insurance: [
    'Insurance is a small, steady cost to avoid a big, sudden one.',
    'Read what a plan covers before you pay for it.',
    'Ask “what is the chance this happens, and what would it cost me?”',
  ],
  decision_making: [
    'When you feel rushed to decide, that’s a good time to wait a day.',
    'Compare at least two options before you commit.',
    'Check how a claim could be tested, not only how it sounds.',
  ],
};

/** A stable pick: the same student sees the same tip if the screen reloads. */
export function tipFor(categories: DecaCategory[], seed: string): { text: string; category: DecaCategory } {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = categories.length ? categories : (Object.keys(TIPS) as DecaCategory[]);
  const category = pool[h % pool.length];
  const list = TIPS[category];
  return { text: list[Math.floor(h / pool.length) % list.length], category };
}
