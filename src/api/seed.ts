import type { AnswerRow, AttemptRow, Session } from './types';
import { getItems, truthOf } from '../items';
import type { Item } from '../items/types';

/**
 * DEMO DATA: deterministic, synthetic responses so the analysis view has
 * something to show with zero infrastructure. Not real students.
 */
export interface MockDB {
  sessions: Session[];
  attempts: AttemptRow[];
  answers: AnswerRow[];
  /** device_token -> accepted answer timestamps (ms) */
  rateAnswers: Record<string, number[]>;
  /** `${device_token}:${session_id}` -> attempts started */
  rateAttempts: Record<string, number>;
}

/** Mulberry32 PRNG: same seed, same demo data. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(r: () => number) {
  const u = 1 - r();
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Typical bias (median log error) per category so the demo charts tell a story. */
const BIAS: Record<string, number> = {
  investing: -0.75, // exponential growth underestimated
  credit_debt: -0.22, // interest cost underestimated
  spending_saving: 0.08,
  employment_income: 0.15,
  risk_insurance: -0.3,
  decision_making: 0.1,
};

const CHAPTERS: [string, number][] = [
  ['TX014', 46],
  ['GA203', 38],
  ['CA118', 31],
  ['NY077', 27],
  ['IL052', 22],
  ['FL310', 17],
  ['OH029', 12],
  ['WA401', 3], // deliberately low-n
];

function hex(r: () => number, n: number) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(r() * 16).toString(16);
  return s;
}
function fakeUuid(r: () => number) {
  return `${hex(r, 8)}-${hex(r, 4)}-4${hex(r, 3)}-a${hex(r, 3)}-${hex(r, 12)}`;
}

function roundLikeAStudent(v: number, r: () => number): number {
  if (v <= 0) return 0;
  const mag = 10 ** Math.floor(Math.log10(v));
  const step = r() < 0.6 ? mag / 2 : mag / 10;
  return Math.max(step, Math.round(v / step) * step);
}

export function buildSeed(now = Date.now(), items: Item[] = getItems()): MockDB {
  const r = rng(20261001);
  const db: MockDB = { sessions: [], attempts: [], answers: [], rateAnswers: {}, rateAttempts: {} };
  const DAY = 86_400_000;

  CHAPTERS.forEach(([chapter, students], ci) => {
    const created = now - (40 - ci * 4) * DAY - Math.floor(r() * DAY);
    const session: Session = {
      id: fakeUuid(r),
      chapter_code: chapter,
      status: 'closed',
      created_at: new Date(created).toISOString(),
      closed_at: new Date(created + 50 * 60_000).toISOString(),
    };
    db.sessions.push(session);

    for (let s = 0; s < students; s++) {
      const attempt: AttemptRow = {
        attempt_id: fakeUuid(r),
        session_id: session.id,
        item_count: items.length,
        started_at: new Date(created + (2 + r() * 6) * 60_000).toISOString(),
      };
      db.attempts.push(attempt);
      // ~8% of students leave early
      const answeredCount = r() < 0.08 ? Math.floor(r() * items.length) : items.length;
      let t = Date.parse(attempt.started_at);
      items.slice(0, answeredCount).forEach((item) => {
        t += (35 + r() * 70) * 1000;
        const truth = truthOf(item);
        const skill = normal(r) * 0.15;
        const le = (BIAS[item.deca_category] ?? 0) + skill + normal(r) * 0.55;
        const estimate = r() < 0.015 ? 0 : roundLikeAStudent(truth * Math.exp(le), r);
        db.answers.push({
          answer_id: fakeUuid(r),
          attempt_id: attempt.attempt_id,
          session_id: session.id,
          item_id: item.id,
          item_version: item.version,
          estimate,
          truth,
          answered_at: new Date(t).toISOString(),
        });
      });
    }
  });
  return db;
}
