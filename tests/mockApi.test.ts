import { describe, expect, it } from 'vitest';
import { createMockApi, DEMO_PASSCODE } from '../src/api/mock';
import { memoryKV } from '../src/lib/storage';
import { ApiError } from '../src/api/types';
import { answer, attempt } from './fixtures';

const make = () => createMockApi(memoryKV(), { latencyMs: 0, isOnline: () => true });
const code = (p: Promise<unknown>) => p.then(() => 'ok', (e: ApiError) => e.code);

describe('mock API (demo mode) mirrors server rules', () => {
  it('ships seeded DEMO DATA', async () => {
    const api = make();
    const d = await api.exportData(DEMO_PASSCODE);
    expect(d.responses.length).toBeGreaterThan(100);
    expect(new Set(d.responses.map((r) => r.chapter_code)).size).toBeGreaterThanOrEqual(8);
  });
  it('requires the passcode', async () => {
    const api = make();
    expect(await code(api.exportData('wrong'))).toBe('bad_passcode');
    expect(await api.verifyPasscode('wrong')).toBe(false);
  });
  it('one open session per chapter; join only open sessions', async () => {
    const api = make();
    const s = await api.createSession(DEMO_PASSCODE, 'tx-777');
    expect(s.chapter_code).toBe('TX777');
    expect(await code(api.createSession(DEMO_PASSCODE, 'TX777'))).toBe('chapter_busy');
    expect((await api.joinSession('tx777')).session_id).toBe(s.id);
    await api.closeSession(DEMO_PASSCODE, s.id);
    expect(await code(api.joinSession('TX777'))).toBe('not_found');
  });
  it('accepts answers for open sessions only, idempotently', async () => {
    const api = make();
    const s = await api.createSession(DEMO_PASSCODE, 'AB123');
    const a = attempt(s.id, 1);
    const r = answer(a, 'x', 10);
    expect(await api.sync('dev', [a], [r])).toMatchObject({ attempts: 1, answers: 1, rejected: [] });
    expect(await api.sync('dev', [a], [r])).toMatchObject({ attempts: 0, answers: 0, rejected: [] });
    expect((await api.sessionStats(DEMO_PASSCODE, s.id)).completed).toBe(1);
    await api.closeSession(DEMO_PASSCODE, s.id);
    const late = answer(a, 'y', 10);
    expect((await api.sync('dev', [], [late])).rejected).toEqual([late.answer_id]);
  });
  it('rate limits by device token', async () => {
    const api = make();
    const s = await api.createSession(DEMO_PASSCODE, 'RL001');
    const a = attempt(s.id, 40);
    await api.sync('dev', [a], []);
    const batch = Array.from({ length: 30 }, (_, i) => answer(a, `i${i}`, 1));
    await api.sync('dev', [], batch);
    expect(await code(api.sync('dev', [], [answer(a, 'more', 1)]))).toBe('rate_limited');
    expect(await code(api.sync('other-device', [], [answer(a, 'more', 1)]))).toBe('ok');
  });
  it('reports network errors when offline', async () => {
    const api = createMockApi(memoryKV(), { latencyMs: 0, isOnline: () => false });
    expect(await code(api.joinSession('TX014'))).toBe('network');
  });
});
