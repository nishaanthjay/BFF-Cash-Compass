import { browserKV } from '../lib/storage';
import { createMockApi } from './mock';
import { IS_DEMO, SUPABASE_ANON_KEY, SUPABASE_URL } from './env';
import type { ApiClient } from './types';

export { IS_DEMO } from './env';

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
    sessionStats: (...a) => get().then((c) => c.sessionStats(...a)),
    closeSession: (...a) => get().then((c) => c.closeSession(...a)),
    exportData: (...a) => get().then((c) => c.exportData(...a)),
    recode: (...a) => get().then((c) => c.recode(...a)),
  };
}

/** One client for the whole app: Supabase when configured, otherwise the in-browser DEMO mock. */
export const api: ApiClient = IS_DEMO ? createMockApi(browserKV()) : lazySupabase(SUPABASE_URL!, SUPABASE_ANON_KEY!);
