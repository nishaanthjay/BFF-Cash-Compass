import { checkRateLimit } from '../lib/rateLimit';
import { readJSON, writeJSON, type KV } from '../lib/storage';
import { uuid } from '../lib/uuid';
import { buildSeed, type MockDB } from './seed';
import {
  ApiError,
  CHAPTER_CODE,
  normalizeChapter,
  type ApiClient,
  type ExportData,
  type ExportFilters,
  type Session,
} from './types';

export const DEMO_PASSCODE = 'demo';
const KEY = 'mc.mock.db.v2';

/**
 * In-browser stand-in for the Supabase RPCs. Enforces the same rules as the
 * SQL functions (open-session-only inserts, rate limits, passcode) so demo
 * mode exercises the real client paths.
 */
export function createMockApi(kv: KV, opts: { latencyMs?: number; now?: () => number; isOnline?: () => boolean } = {}): ApiClient {
  const now = opts.now ?? Date.now;
  const latency = opts.latencyMs ?? 120;
  const online = opts.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  let db: MockDB = readJSON<MockDB | null>(kv, KEY, null) ?? buildSeed(now());
  const save = () => writeJSON(kv, KEY, db);
  save();

  async function call<T>(fn: () => T): Promise<T> {
    if (latency) await new Promise((r) => setTimeout(r, latency));
    if (!online()) throw new ApiError('network', 'You appear to be offline');
    // Re-read so several tabs (facilitator + student in one browser) share one demo DB.
    db = readJSON<MockDB | null>(kv, KEY, null) ?? db;
    const out = fn();
    save();
    return out;
  }
  const auth = (p: string) => {
    if (p !== DEMO_PASSCODE) throw new ApiError('bad_passcode', 'Wrong passcode');
  };
  const stats = (sessionId: string) => {
    const attempts = db.attempts.filter((a) => a.session_id === sessionId);
    const answers = db.answers.filter((a) => a.session_id === sessionId);
    const per = new Map<string, number>();
    for (const a of answers) per.set(a.attempt_id, (per.get(a.attempt_id) ?? 0) + 1);
    return {
      attempts: attempts.length,
      responses: answers.length,
      completed: attempts.filter((a) => (per.get(a.attempt_id) ?? 0) >= a.item_count).length,
    };
  };
  const chapterOf = (sessionId: string) => db.sessions.find((s) => s.id === sessionId)?.chapter_code ?? '';

  return {
    mode: 'demo',

    joinSession: (code) =>
      call(() => {
        const c = normalizeChapter(code);
        const s = db.sessions.find((x) => x.chapter_code === c && x.status === 'open');
        if (!s) throw new ApiError('not_found', 'No open session for that chapter code');
        return { session_id: s.id, chapter_code: s.chapter_code };
      }),

    sync: (token, attempts, answers) =>
      call(() => {
        const t = now();
        const isOpen = (id: string) => db.sessions.some((s) => s.id === id && s.status === 'open');
        const decision = checkRateLimit({
          now: t,
          answerTimes: db.rateAnswers[token] ?? [],
          incoming: answers.filter((a) => !db.answers.some((x) => x.answer_id === a.answer_id)).length,
          attemptsInSession: 0,
          newAttempts: 0,
        });
        if (!decision.ok) throw new ApiError('rate_limited', 'Slow down a little');

        let nAttempts = 0;
        const rejected: string[] = [];
        for (const a of attempts) {
          if (db.attempts.some((x) => x.attempt_id === a.attempt_id)) continue;
          if (!isOpen(a.session_id)) {
            rejected.push(a.attempt_id);
            continue;
          }
          const k = `${token}:${a.session_id}`;
          const d = checkRateLimit({ now: t, answerTimes: [], incoming: 0, attemptsInSession: db.rateAttempts[k] ?? 0, newAttempts: 1 });
          if (!d.ok) {
            rejected.push(a.attempt_id);
            continue;
          }
          db.rateAttempts[k] = (db.rateAttempts[k] ?? 0) + 1;
          db.attempts.push({ ...a, started_at: a.started_at });
          nAttempts++;
        }
        let nAnswers = 0;
        for (const a of answers) {
          if (db.answers.some((x) => x.answer_id === a.answer_id)) continue; // idempotent retry
          const att = db.attempts.find((x) => x.attempt_id === a.attempt_id);
          if (!att || att.session_id !== a.session_id || !isOpen(a.session_id) || !(a.estimate >= 0) || !(a.estimate < 1e12)) {
            rejected.push(a.answer_id);
            continue;
          }
          db.answers.push(a);
          (db.rateAnswers[token] ??= []).push(t);
          nAnswers++;
        }
        db.rateAnswers[token] = (db.rateAnswers[token] ?? []).filter((x) => t - x < 60_000);
        return { attempts: nAttempts, answers: nAnswers, rejected };
      }),

    verifyPasscode: (p) => call(() => p === DEMO_PASSCODE),

    createSession: (p, code) =>
      call(() => {
        auth(p);
        const c = normalizeChapter(code);
        if (!CHAPTER_CODE.test(c)) throw new ApiError('invalid', 'Chapter codes are 3–10 letters or numbers');
        if (db.sessions.some((s) => s.chapter_code === c && s.status === 'open'))
          throw new ApiError('chapter_busy', 'That chapter already has an open session');
        const s: Session = { id: uuid(), chapter_code: c, status: 'open', created_at: new Date(now()).toISOString(), closed_at: null };
        db.sessions.push(s);
        return s;
      }),

    openSessions: (p) =>
      call(() => {
        auth(p);
        return db.sessions.filter((s) => s.status === 'open').map((s) => ({ ...s, ...stats(s.id) }));
      }),

    sessionStats: (p, id) =>
      call(() => {
        auth(p);
        const s = db.sessions.find((x) => x.id === id);
        if (!s) throw new ApiError('not_found');
        return { ...stats(id), status: s.status };
      }),

    closeSession: (p, id) =>
      call(() => {
        auth(p);
        const s = db.sessions.find((x) => x.id === id);
        if (!s) throw new ApiError('not_found');
        if (s.status === 'open') Object.assign(s, { status: 'closed', closed_at: new Date(now()).toISOString() });
      }),

    exportData: (p, f: ExportFilters = {}) =>
      call((): ExportData => {
        auth(p);
        const day = (iso: string) => iso.slice(0, 10);
        const ok = (chapter: string, iso: string) =>
          (!f.chapter || chapter === f.chapter) && (!f.from || day(iso) >= f.from) && (!f.to || day(iso) <= f.to);
        return {
          sessions: db.sessions.filter((s) => ok(s.chapter_code, s.created_at)),
          attempts: db.attempts.map((a) => ({ ...a, chapter_code: chapterOf(a.session_id) })).filter((a) => ok(a.chapter_code, a.started_at)),
          responses: db.answers.map((a) => ({ ...a, chapter_code: chapterOf(a.session_id) })).filter((a) => ok(a.chapter_code, a.answered_at)),
        };
      }),
  };
}

/** Wipe the demo database back to its seed (used by the "Reset demo" button). */
export function resetMock(kv: KV) {
  kv.removeItem(KEY);
}
