import { describe, expect, it } from 'vitest';
import { createMockApi, DEMO_PASSCODE, LOGIN, SESSION_TTL_MS } from '../src/api/mock';
import { buildSeed } from '../src/api/seed';
import { memoryKV } from '../src/lib/storage';
import { ApiError } from '../src/api/types';
import { answer, signIn, student } from './fixtures';

const seed = buildSeed(Date.parse('2026-10-01T12:00:00Z'));
const make = () => createMockApi(memoryKV(), { latencyMs: 0, isOnline: () => true, seed });
const code = (p: Promise<unknown>) => p.then(() => 'ok', (e: ApiError) => e.code);

describe('demo seed', () => {
  it('has workshops of 15–30 students, one low-n and one live', () => {
    const sizes = seed.sessions.map((s) => seed.students.filter((x) => x.session_id === s.id).length);
    expect(sizes.filter((n) => n >= 15 && n <= 30).length).toBeGreaterThanOrEqual(6);
    expect(Math.min(...sizes)).toBeLessThan(5);
    expect(seed.sessions.filter((s) => s.status === 'open')).toHaveLength(1);
  });
  it('answers cluster on the predicted codes', () => {
    const s1 = seed.answers.filter((a) => a.item_id === 'S1' && a.step_id === 's1');
    expect(s1.filter((a) => a.strategy_codes.includes('PAD')).length).toBeGreaterThan(10);
  });
  it('is deterministic', () => {
    expect(buildSeed(Date.parse('2026-10-01T12:00:00Z')).answers.length).toBe(seed.answers.length);
  });
});

describe('mock API mirrors server rules', () => {
  it('passcode gate', async () => {
    const api = make();
    expect(await code(api.exportData('wrong'))).toBe('bad_passcode');
    expect(await code(api.exportData(DEMO_PASSCODE))).toBe('bad_passcode'); // the passcode itself is not a token
    const token = await api.login(DEMO_PASSCODE);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(await code(api.exportData(token!))).toBe('ok');
  });
  it('session lifecycle with modules; join returns modules', async () => {
    const api = make();
    const T = await signIn(api);
    const s = await api.createSession(T, 'tx-777', ['skill'], 'Grade 7');
    expect(await code(api.createSession(T, 'TX777', ['skill'], null))).toBe('chapter_busy');
    expect(await code(api.createSession(T, 'NEW01', [], null))).toBe('invalid');
    expect(await api.joinSession('tx777')).toMatchObject({ session_id: s.id, modules: ['skill'], cohort_label: 'Grade 7' });
    await api.closeSession(T, s.id);
    expect(await code(api.joinSession('TX777'))).toBe('session_closed');
  });
  it('students + answers: open sessions only, idempotent, no re-lock, resume by code', async () => {
    const api = make();
    const T = await signIn(api);
    const s = await api.createSession(T, 'AB123', ['skill'], null);
    const st = student(s.id, 'ABC234', 2);
    const a1 = answer(st, 'S1', 's1', 23, ['PAD']);
    expect(await api.sync('dev', [st], [a1])).toMatchObject({ students: 1, answers: 1, rejected: [] });
    expect(await api.sync('dev', [st], [a1])).toMatchObject({ students: 0, answers: 0, rejected: [] });
    const relock = answer(st, 'S1', 's1', 36);
    expect((await api.sync('dev', [], [relock])).rejected).toEqual([relock.answer_id]);
    expect(await api.resumeStudent(s.id, 'ABC234')).toEqual({ locked: ['S1.s1'] });
    expect(await api.resumeStudent(s.id, 'ZZZ999')).toBeNull();
    await api.sync('dev', [], [answer(st, 'S1', 's2', 4.8)]);
    expect((await api.sessionStats(T, s.id)).finished).toBe(1);
    await api.closeSession(T, s.id);
    const late = answer(st, 'S1', 's3', 12);
    expect((await api.sync('dev', [], [late])).rejected).toEqual([late.answer_id]);
  });
  it('recode is stored and exported', async () => {
    const api = make();
    const T = await signIn(api);
    const d = await api.exportData(T);
    const target = d.responses.find((r) => r.strategy_codes.includes('UNK'))!;
    await api.recode(T, target.answer_id, ['DEC'], null);
    const d2 = await api.exportData(T);
    expect(d2.recodes.find((r) => r.answer_id === target.answer_id)?.codes).toEqual(['DEC']);
  });
  it('rate limits by device token', async () => {
    const api = make();
    const T = await signIn(api);
    const s = await api.createSession(T, 'RL001', ['skill'], null);
    const st = student(s.id, 'ABC234', 100);
    await api.sync('dev', [st], []);
    await api.sync('dev', [], Array.from({ length: 60 }, (_, i) => answer(st, 'S1', `r${i}`, 1)));
    expect(await code(api.sync('dev', [], [answer(st, 'S1', 'more', 1)]))).toBe('rate_limited');
    expect(await code(api.sync('other', [], [answer(st, 'S1', 'more', 1)]))).toBe('ok');
  });
  it('offline = network error', async () => {
    const api = createMockApi(memoryKV(), { latencyMs: 0, isOnline: () => false, seed });
    expect(await code(api.joinSession('NC027'))).toBe('network');
  });
});

describe('passcode rate limiting (mirrors fac_login in migration 0007)', () => {
  const clock = () => {
    let t = Date.parse('2026-10-11T12:00:00Z');
    return { now: () => t, advance: (ms: number) => (t += ms) };
  };
  const at = (c: ReturnType<typeof clock>) => createMockApi(memoryKV(), { latencyMs: 0, isOnline: () => true, seed, now: c.now });

  it('a wrong passcode returns null (not an error) and is counted', async () => {
    const api = at(clock());
    expect(await api.login('nope')).toBeNull();
  });
  it('locks out after the allowed failures, even for the right passcode', async () => {
    const api = at(clock());
    for (let i = 0; i < LOGIN.maxFailures; i++) expect(await api.login(`guess${i}`)).toBeNull();
    expect(await code(api.login('guess-again'))).toBe('locked_out');
    expect(await code(api.login(DEMO_PASSCODE))).toBe('locked_out');
  });
  it('unlocks once the window has passed', async () => {
    const c = clock();
    const api = at(c);
    for (let i = 0; i < LOGIN.maxFailures; i++) await api.login(`guess${i}`);
    expect(await code(api.login(DEMO_PASSCODE))).toBe('locked_out');
    c.advance(LOGIN.windowMs + 1000);
    expect(await api.login(DEMO_PASSCODE)).not.toBeNull();
  });
  it('a few typos do not lock anyone out', async () => {
    const api = at(clock());
    for (let i = 0; i < LOGIN.maxFailures - 1; i++) await api.login(`typo${i}`);
    expect(await api.login(DEMO_PASSCODE)).not.toBeNull();
  });
  it('tokens expire', async () => {
    const c = clock();
    const api = at(c);
    const token = (await api.login(DEMO_PASSCODE))!;
    expect(await code(api.openSessions(token))).toBe('ok');
    c.advance(LOGIN.tokenTtlMs + 1000);
    expect(await code(api.openSessions(token))).toBe('bad_passcode');
  });
});

describe('session auto-close and closed-session joins (mirrors migration 0007)', () => {
  const clock = () => {
    let t = Date.parse('2026-10-11T12:00:00Z');
    return { now: () => t, advance: (ms: number) => (t += ms) };
  };
  it('students can join until the session is 6 hours old, then get session_closed (not "not found")', async () => {
    const c = clock();
    const api = createMockApi(memoryKV(), { latencyMs: 0, isOnline: () => true, seed, now: c.now });
    const T = await signIn(api);
    await api.createSession(T, 'AUTO12', ['skill'], null);
    c.advance(SESSION_TTL_MS - 60_000);
    expect(await code(api.joinSession('AUTO12'))).toBe('ok');
    c.advance(120_000);
    expect(await code(api.joinSession('AUTO12'))).toBe('session_closed');
    expect(await code(api.joinSession('NOSUCH'))).toBe('not_found');
  });
  it('answers to an auto-closed session are rejected', async () => {
    const c = clock();
    const api = createMockApi(memoryKV(), { latencyMs: 0, isOnline: () => true, seed, now: c.now });
    const T = await signIn(api);
    const s = await api.createSession(T, 'AUTO13', ['skill'], null);
    const st = student(s.id, 'ABC234', 3);
    await api.sync('dev', [st], []);
    c.advance(SESSION_TTL_MS + 60_000);
    const late = answer(st, 'S1', 's1', 36);
    expect((await api.sync('dev', [], [late])).rejected).toEqual([late.answer_id]);
  });
  it('reopening restarts the clock', async () => {
    const c = clock();
    const api = createMockApi(memoryKV(), { latencyMs: 0, isOnline: () => true, seed, now: c.now });
    const T = await signIn(api);
    const s = await api.createSession(T, 'AUTO14', ['skill'], null);
    c.advance(SESSION_TTL_MS + 60_000);
    expect(await code(api.joinSession('AUTO14'))).toBe('session_closed');
    await api.reopenSession(T, s.id);
    c.advance(SESSION_TTL_MS - 60_000);
    expect(await code(api.joinSession('AUTO14'))).toBe('ok');
  });
});

describe('per-problem counts (feeds the Quick check rotation)', () => {
  it('counts students, not rows, and needs a token', async () => {
    const api = make();
    const T = await signIn(api);
    expect(await code(api.problemCounts('nope'))).toBe('bad_passcode');
    const before = await api.problemCounts(T);
    const s = await api.createSession(T, 'CNT01', ['skill'], null);
    const a = student(s.id, 'ABC234', 5);
    const b = student(s.id, 'DEF234', 5);
    await api.sync('dev', [a, b], [answer(a, 'S9', 's1', 1), answer(a, 'S9', 's2', 1), answer(b, 'S9', 's1', 1), answer(b, 'F3', 'gut', 4)]);
    const after = await api.problemCounts(T);
    expect((after.S9 ?? 0) - (before.S9 ?? 0)).toBe(2);
    expect((after.F3 ?? 0) - (before.F3 ?? 0)).toBe(1);
  });
});
