import { browserKV } from '../lib/storage';
import { IS_CONFIGURED, SUPABASE_ANON_KEY, SUPABASE_URL } from './env';
import { ApiError, type ApiClient } from './types';

export { IS_CONFIGURED, IS_DEMO } from './env';

/**
 * The Supabase client is a separate chunk: demo mode (and the first paint on slow school wifi)
 * never downloads it. It starts loading immediately in real mode so the first call isn't delayed.
 */
function lazySupabase(url: string, key: string): ApiClient {
  let loaded: Promise<ApiClient> | null = null;
  const get = () => (loaded ??= import('./supabase').then((m) => m.createSupabaseApi(url, key)));
  void get();
  return {
    mode: 'supabase',
    joinSession: (...a) => get().then((c) => c.joinSession(...a)),
    resumeStudent: (...a) => get().then((c) => c.resumeStudent(...a)),
    sync: (...a) => get().then((c) => c.sync(...a)),
    verifyPasscode: (...a) => get().then((c) => c.verifyPasscode(...a)),
    createSession: (...a) => get().then((c) => c.createSession(...a)),
    openSessions: (...a) => get().then((c) => c.openSessions(...a)),
    recentSessions: (...a) => get().then((c) => c.recentSessions(...a)),
    reopenSession: (...a) => get().then((c) => c.reopenSession(...a)),
    sessionStats: (...a) => get().then((c) => c.sessionStats(...a)),
    closeSession: (...a) => get().then((c) => c.closeSession(...a)),
    exportData: (...a) => get().then((c) => c.exportData(...a)),
    recode: (...a) => get().then((c) => c.recode(...a)),
  };
}

/** Local-development mock: its own chunk, and only referenced when VITE_DEMO=1, so production bundles carry no fake data. */
function lazyMock(): ApiClient {
  let loaded: Promise<ApiClient> | null = null;
  const get = () => (loaded ??= import('./mock').then((m) => m.createMockApi(browserKV())));
  return {
    mode: 'demo',
    joinSession: (...a) => get().then((c) => c.joinSession(...a)),
    resumeStudent: (...a) => get().then((c) => c.resumeStudent(...a)),
    sync: (...a) => get().then((c) => c.sync(...a)),
    verifyPasscode: (...a) => get().then((c) => c.verifyPasscode(...a)),
    createSession: (...a) => get().then((c) => c.createSession(...a)),
    openSessions: (...a) => get().then((c) => c.openSessions(...a)),
    recentSessions: (...a) => get().then((c) => c.recentSessions(...a)),
    reopenSession: (...a) => get().then((c) => c.reopenSession(...a)),
    sessionStats: (...a) => get().then((c) => c.sessionStats(...a)),
    closeSession: (...a) => get().then((c) => c.closeSession(...a)),
    exportData: (...a) => get().then((c) => c.exportData(...a)),
    recode: (...a) => get().then((c) => c.recode(...a)),
  };
}

/** Used only when nothing is configured; the app shows a setup screen instead of calling it. */
function unconfigured(): ApiClient {
  const fail = () => Promise.reject(new ApiError('network', 'The server is not configured'));
  return { mode: 'supabase', joinSession: fail, resumeStudent: fail, sync: fail, verifyPasscode: fail, createSession: fail, openSessions: fail, recentSessions: fail, reopenSession: fail, sessionStats: fail, closeSession: fail, exportData: fail, recode: fail };
}

/** One client for the whole app: the in-browser mock only with VITE_DEMO=1, otherwise Supabase. */
export const api: ApiClient = import.meta.env.VITE_DEMO === '1' ? lazyMock() : IS_CONFIGURED ? lazySupabase(SUPABASE_URL!, SUPABASE_ANON_KEY!) : unconfigured();
