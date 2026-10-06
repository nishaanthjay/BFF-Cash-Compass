import { describe, expect, it } from 'vitest';
import { createMockApi, DEMO_PASSCODE } from '../src/api/mock';
import { buildSeed } from '../src/api/seed';
import { memoryKV } from '../src/lib/storage';
import { ApiError } from '../src/api/types';
import { answer, student } from './fixtures';

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
    expect(await api.verifyPasscode(DEMO_PASSCODE)).toBe(true);
  });
  it('session lifecycle with modules; join returns modules', async () => {
    const api = make();
    const s = await api.createSession(DEMO_PASSCODE, 'tx-777', ['skill'], 'Grade 7');
    expect(await code(api.createSession(DEMO_PASSCODE, 'TX777', ['skill'], null))).toBe('chapter_busy');
    expect(await code(api.createSession(DEMO_PASSCODE, 'NEW01', [], null))).toBe('invalid');
    expect(await api.joinSession('tx777')).toMatchObject({ session_id: s.id, modules: ['skill'], cohort_label: 'Grade 7' });
    await api.closeSession(DEMO_PASSCODE, s.id);
    expect(await code(api.joinSession('TX777'))).toBe('session_closed');
  });
  it('students + answers: open sessions only, idempotent, no re-lock, resume by code', async () => {
    const api = make();
    const s = await api.createSession(DEMO_PASSCODE, 'AB123', ['skill'], null);
    const st = student(s.id, 'ABC234', 2);
    const a1 = answer(st, 'S1', 's1', 23, ['PAD']);
    expect(await api.sync('dev', [st], [a1])).toMatchObject({ students: 1, answers: 1, rejected: [] });
    expect(await api.sync('dev', [st], [a1])).toMatchObject({ students: 0, answers: 0, rejected: [] });
    const relock = answer(st, 'S1', 's1', 36);
    expect((await api.sync('dev', [], [relock])).rejected).toEqual([relock.answer_id]);
    expect(await api.resumeStudent(s.id, 'ABC234')).toEqual({ locked: ['S1.s1'] });
    expect(await api.resumeStudent(s.id, 'ZZZ999')).toBeNull();
    await api.sync('dev', [], [answer(st, 'S1', 's2', 4.8)]);
    expect((await api.sessionStats(DEMO_PASSCODE, s.id)).finished).toBe(1);
    await api.closeSession(DEMO_PASSCODE, s.id);
    const late = answer(st, 'S1', 's3', 12);
    expect((await api.sync('dev', [], [late])).rejected).toEqual([late.answer_id]);
  });
  it('recode is stored and exported', async () => {
    const api = make();
    const d = await api.exportData(DEMO_PASSCODE);
    const target = d.responses.find((r) => r.strategy_codes.includes('UNK'))!;
    await api.recode(DEMO_PASSCODE, target.answer_id, ['DEC'], null);
    const d2 = await api.exportData(DEMO_PASSCODE);
    expect(d2.recodes.find((r) => r.answer_id === target.answer_id)?.codes).toEqual(['DEC']);
  });
  it('rate limits by device token', async () => {
    const api = make();
    const s = await api.createSession(DEMO_PASSCODE, 'RL001', ['skill'], null);
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
