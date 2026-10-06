import type { Module } from '../items/types';
import { checkRateLimit } from '../lib/rateLimit';
import { readJSON, writeJSON, type KV } from '../lib/storage';
import { uuid } from '../lib/uuid';
import { buildSeed, type SeedData } from './seed';
import { ApiError, CHAPTER_CODE, normalizeChapter, type ApiClient, type ExportData, type ExportFilters, type Session } from './types';

export const DEMO_PASSCODE = 'demo';
const KEY = 'mc.mock.db.v3';

/** Things created in this browser (the seed itself is regenerated in memory on load). */
interface LiveDB extends SeedData {
  closed: Record<string, string>; // seeded session id -> closed_at (if closed in demo)
  reopened: Record<string, true>; // seeded session ids reopened in demo
  rateAnswers: Record<string, number[]>;
  rateStudents: Record<string, number>;
}
const EMPTY: LiveDB = { sessions: [], students: [], answers: [], recodes: [], closed: {}, reopened: {}, rateAnswers: {}, rateStudents: {} };

/**
 * In-browser stand-in for the Supabase RPCs. Enforces the same rules as the SQL
 * (open-session-only inserts, rate limits, passcode) so demo mode exercises the
 * real client paths.
 */
export function createMockApi(kv: KV, opts: { latencyMs?: number; now?: () => number; isOnline?: () => boolean; seed?: SeedData } = {}): ApiClient {
  const now = opts.now ?? Date.now;
  const latency = opts.latencyMs ?? 120;
  const online = opts.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  let seed: SeedData | null = opts.seed ?? null;
  const getSeed = () => (seed ??= buildSeed(now()));
  let live: LiveDB = { ...EMPTY, ...readJSON<Partial<LiveDB>>(kv, KEY, {}) };

  const all = () => {
    const s = getSeed();
    return {
      sessions: [
        ...s.sessions.map((x) => (live.reopened[x.id] ? { ...x, status: 'open' as const, closed_at: null } : live.closed[x.id] ? { ...x, status: 'closed' as const, closed_at: live.closed[x.id] } : x)),
        ...live.sessions,
      ],
      students: [...s.students, ...live.students],
      answers: [...s.answers, ...live.answers],
      recodes: [...s.recodes, ...live.recodes],
    };
  };

  async function call<T>(fn: () => T): Promise<T> {
    if (latency) await new Promise((r) => setTimeout(r, latency));
    if (!online()) throw new ApiError('network', 'You appear to be offline');
    live = { ...EMPTY, ...readJSON<Partial<LiveDB>>(kv, KEY, {}) }; // share one demo DB across tabs
    const out = fn();
    writeJSON(kv, KEY, live);
    return out;
  }
  const auth = (p: string) => {
    if (p !== DEMO_PASSCODE) throw new ApiError('bad_passcode', 'Wrong passcode');
  };
  const sessionById = (id: string) => all().sessions.find((s) => s.id === id);
  const stats = (sessionId: string) => {
    const a = all();
    const students = a.students.filter((s) => s.session_id === sessionId);
    const answers = a.answers.filter((x) => x.session_id === sessionId);
    const per = new Map<string, number>();
    for (const x of answers) per.set(x.student_code, (per.get(x.student_code) ?? 0) + 1);
    return { students: students.length, responses: answers.length, finished: students.filter((s) => (per.get(s.student_code) ?? 0) >= s.expected_steps).length };
  };

  return {
    mode: 'demo',

    joinSession: (code) =>
      call(() => {
        const c = normalizeChapter(code);
        const s = all().sessions.find((x) => x.chapter_code === c && x.status === 'open');
        if (!s) {
          if (all().sessions.some((x) => x.chapter_code === c)) throw new ApiError('session_closed', 'That session has ended');
          throw new ApiError('not_found', 'No open session for that chapter code');
        }
        return { session_id: s.id, chapter_code: s.chapter_code, cohort_label: s.cohort_label, modules: s.modules, problem_ids: s.problem_ids ?? [] };
      }),

    resumeStudent: (sessionId, code) =>
      call(() => {
        const a = all();
        if (!a.students.some((s) => s.session_id === sessionId && s.student_code === code)) return null;
        return { locked: a.answers.filter((x) => x.session_id === sessionId && x.student_code === code).map((x) => `${x.item_id}.${x.step_id}`) };
      }),

    sync: (token, students, answers) =>
      call(() => {
        const t = now();
        const a = all();
        const isOpen = (id: string) => sessionById(id)?.status === 'open';
        const fresh = answers.filter((x) => !a.answers.some((y) => y.answer_id === x.answer_id));
        if (!checkRateLimit({ now: t, answerTimes: live.rateAnswers[token] ?? [], incoming: fresh.length, attemptsInSession: 0, newAttempts: 0 }).ok)
          throw new ApiError('rate_limited', 'Slow down a little');
        const rejected: string[] = [];
        let nStudents = 0;
        for (const st of students) {
          if (all().students.some((x) => x.session_id === st.session_id && x.student_code === st.student_code)) continue;
          const k = `${token}:${st.session_id}`;
          if (!isOpen(st.session_id) || !checkRateLimit({ now: t, answerTimes: [], incoming: 0, attemptsInSession: live.rateStudents[k] ?? 0, newAttempts: 1 }).ok) {
            rejected.push(st.student_code);
            continue;
          }
          live.rateStudents[k] = (live.rateStudents[k] ?? 0) + 1;
          live.students.push({ ...st, finished_at: null });
          nStudents++;
        }
        let nAnswers = 0;
        for (const x of fresh) {
          const now2 = all();
          const st = now2.students.find((s) => s.session_id === x.session_id && s.student_code === x.student_code);
          const dup = now2.answers.some((y) => y.session_id === x.session_id && y.student_code === x.student_code && y.item_id === x.item_id && y.step_id === x.step_id);
          const bad = x.raw_value !== null && !(x.raw_value >= 0 && x.raw_value < 1e12);
          if (!st || !isOpen(x.session_id) || dup || bad) {
            rejected.push(x.answer_id);
            continue;
          }
          live.answers.push(x);
          (live.rateAnswers[token] ??= []).push(t);
          nAnswers++;
          const mine = live.answers.filter((y) => y.session_id === x.session_id && y.student_code === x.student_code).length;
          const ls = live.students.find((s) => s.session_id === x.session_id && s.student_code === x.student_code);
          if (ls && mine >= ls.expected_steps) ls.finished_at = new Date(t).toISOString();
        }
        live.rateAnswers[token] = (live.rateAnswers[token] ?? []).filter((y) => t - y < 60_000);
        return { students: nStudents, answers: nAnswers, rejected };
      }),

    verifyPasscode: (p) => call(() => p === DEMO_PASSCODE),

    createSession: (p, code, modules: Module[], cohort, problemIds = []) =>
      call(() => {
        auth(p);
        const c = normalizeChapter(code);
        if (!CHAPTER_CODE.test(c)) throw new ApiError('invalid', 'Chapter codes are 3–10 letters or numbers');
        if (!modules.length) throw new ApiError('invalid', 'Pick at least one module');
        if (all().sessions.some((s) => s.chapter_code === c && s.status === 'open')) throw new ApiError('chapter_busy', 'That chapter already has an open session');
        const s: Session = { id: uuid(), chapter_code: c, cohort_label: cohort?.trim() || null, modules, problem_ids: problemIds, status: 'open', created_at: new Date(now()).toISOString(), closed_at: null };
        live.sessions.push(s);
        return s;
      }),

    openSessions: (p) =>
      call(() => {
        auth(p);
        return all()
          .sessions.filter((s) => s.status === 'open')
          .map((s) => ({ ...s, ...stats(s.id) }));
      }),

    recentSessions: (p) =>
      call(() => {
        auth(p);
        return all()
          .sessions.map((s) => ({ ...s, ...stats(s.id) }))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 15);
      }),

    reopenSession: (p, id) =>
      call(() => {
        auth(p);
        const s = sessionById(id);
        if (!s) throw new ApiError('not_found');
        if (s.status === 'open') return s;
        if (all().sessions.some((x) => x.chapter_code === s.chapter_code && x.status === 'open' && x.id !== id)) throw new ApiError('chapter_busy', 'That chapter already has an open session');
        const mine = live.sessions.find((x) => x.id === id);
        if (mine) Object.assign(mine, { status: 'open', closed_at: null });
        else {
          live.reopened[id] = true;
          delete live.closed[id];
        }
        return { ...s, status: 'open' as const, closed_at: null };
      }),

    sessionStats: (p, id) =>
      call(() => {
        auth(p);
        const s = sessionById(id);
        if (!s) throw new ApiError('not_found');
        return { ...stats(id), status: s.status };
      }),

    closeSession: (p, id) =>
      call(() => {
        auth(p);
        const s = sessionById(id);
        if (!s) throw new ApiError('not_found');
        if (s.status !== 'open') return;
        const at = new Date(now()).toISOString();
        const mine = live.sessions.find((x) => x.id === id);
        if (mine) Object.assign(mine, { status: 'closed', closed_at: at });
        else {
          live.closed[id] = at;
          delete live.reopened[id];
        }
      }),

    exportData: (p, f: ExportFilters = {}) =>
      call((): ExportData => {
        auth(p);
        const a = all();
        const sess = new Map(a.sessions.map((s) => [s.id, s]));
        const day = (iso: string) => iso.slice(0, 10);
        const ok = (sid: string, iso: string) => {
          const s = sess.get(sid);
          return !!s && (!f.session_id || sid === f.session_id) && (!f.chapter || s.chapter_code === f.chapter) && (!f.from || day(iso) >= f.from) && (!f.to || day(iso) <= f.to);
        };
        return {
          sessions: a.sessions.filter((s) => ok(s.id, s.created_at)),
          students: a.students.filter((s) => ok(s.session_id, s.started_at)).map((s) => ({ ...s, chapter_code: sess.get(s.session_id)!.chapter_code })),
          responses: a.answers
            .filter((x) => ok(x.session_id, x.answered_at))
            .map((x) => ({ ...x, chapter_code: sess.get(x.session_id)!.chapter_code, cohort_label: sess.get(x.session_id)!.cohort_label })),
          recodes: a.recodes,
        };
      }),

    recode: (p, answerId, codes, tag) =>
      call(() => {
        auth(p);
        live.recodes = live.recodes.filter((r) => r.answer_id !== answerId);
        live.recodes.push({ answer_id: answerId, codes, tag: tag ?? null, coded_at: new Date(now()).toISOString() });
      }),
  };
}

export function resetMock(kv: KV) {
  kv.removeItem(KEY);
}
