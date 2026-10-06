import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { createMockApi, DEMO_PASSCODE } from '../src/api/mock';
import { buildSeed } from '../src/api/seed';
import { ApiError, CHAPTER_CODE } from '../src/api/types';
import { newChapterCode } from '../src/lib/chapterCode';
import { memoryKV } from '../src/lib/storage';
import { Landing } from '../src/screens/Landing';
import { STEPS } from '../src/screens/facilitator/HowTo';

afterEach(cleanup);
const seed = buildSeed(Date.UTC(2026, 9, 1));
const make = () => createMockApi(memoryKV(), { latencyMs: 0, isOnline: () => true, seed });
const code = (p: Promise<unknown>) => p.then(() => 'ok', (e: ApiError) => e.code);

describe('automatic chapter codes', () => {
  it('are valid, 5 long, and not repeating', () => {
    const codes = new Set(Array.from({ length: 200 }, () => newChapterCode()));
    expect(codes.size).toBeGreaterThan(190);
    for (const c of codes) {
      expect(c).toHaveLength(5);
      expect(CHAPTER_CODE.test(c)).toBe(true);
      expect(/[01OIL]/.test(c)).toBe(false);
    }
  });
});

describe('reopen and recent sessions (mock)', () => {
  it('lists recent sessions newest first, with a closed one reopenable', async () => {
    const api = make();
    const s = await api.createSession(DEMO_PASSCODE, 'NEW11', ['skill'], 'a', ['S1']);
    await api.closeSession(DEMO_PASSCODE, s.id);
    const recent = await api.recentSessions(DEMO_PASSCODE);
    expect(recent[0].id).toBe(s.id);
    expect(recent[0].status).toBe('closed');
    for (let i = 1; i < recent.length; i++) expect(recent[i - 1].created_at >= recent[i].created_at).toBe(true);
    const r = await api.reopenSession(DEMO_PASSCODE, s.id);
    expect(r.status).toBe('open');
    await expect(api.joinSession('new11')).resolves.toMatchObject({ problem_ids: ['S1'] });
  });
  it('refuses to reopen while the chapter has another open session, or with the wrong passcode', async () => {
    const api = make();
    const a = await api.createSession(DEMO_PASSCODE, 'BUSY1', ['skill'], null);
    await api.closeSession(DEMO_PASSCODE, a.id);
    await api.createSession(DEMO_PASSCODE, 'BUSY1', ['skill'], null);
    expect(await code(api.reopenSession(DEMO_PASSCODE, a.id))).toBe('chapter_busy');
    expect(await code(api.reopenSession('nope', a.id))).toBe('bad_passcode');
    expect(await code(api.reopenSession(DEMO_PASSCODE, 'missing'))).toBe('not_found');
  });
  it('a seeded closed session can be reopened and closed again', async () => {
    const api = make();
    const closed = (await api.recentSessions(DEMO_PASSCODE)).find((r) => r.status === 'closed' && !seed.sessions.some((x) => x.chapter_code === r.chapter_code && x.status === 'open'))!;
    await api.reopenSession(DEMO_PASSCODE, closed.id);
    expect((await api.openSessions(DEMO_PASSCODE)).some((o) => o.id === closed.id)).toBe(true);
    await api.closeSession(DEMO_PASSCODE, closed.id);
    expect((await api.openSessions(DEMO_PASSCODE)).some((o) => o.id === closed.id)).toBe(false);
  });
});

describe('student join errors (mock)', () => {
  it('tells a closed session from an unknown code', async () => {
    const api = make();
    const s = await api.createSession(DEMO_PASSCODE, 'END22', ['skill'], null);
    await api.closeSession(DEMO_PASSCODE, s.id);
    expect(await code(api.joinSession('END22'))).toBe('session_closed');
    expect(await code(api.joinSession('ZZZZ9'))).toBe('not_found');
  });
});

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

describe('landing page', () => {
  it('shows join and facilitator buttons at /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Landing />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Join a workshop/ }).getAttribute('href')).toBe('/join');
    expect(screen.getByRole('link', { name: /Facilitator log in/ }).getAttribute('href')).toBe('/facilitator');
  });
  it('sends old QR links (/?c=CODE) straight to the join screen', () => {
    render(
      <MemoryRouter initialEntries={['/?c=TX014']}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/join" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('where').textContent).toBe('/join?c=TX014');
  });
});

describe('how-to steps', () => {
  it('has five short steps', () => {
    expect(STEPS).toHaveLength(5);
    expect(STEPS.every((s) => s.length < 110)).toBe(true);
  });
});
