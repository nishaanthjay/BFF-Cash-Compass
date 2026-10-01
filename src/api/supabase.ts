import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ApiError, normalizeChapter, type ApiClient, type ApiErrorCode, type ExportData, type OpenSession, type Session } from './types';

const KNOWN: ApiErrorCode[] = ['rate_limited', 'not_found', 'session_closed', 'bad_passcode', 'invalid', 'chapter_busy'];

function toApiError(err: { message?: string; code?: string } | null | undefined): ApiError {
  const msg = err?.message ?? '';
  const known = KNOWN.find((k) => msg === k || msg.startsWith(`${k}:`));
  if (known) return new ApiError(known, msg);
  if (/fetch|network|Load failed|timeout/i.test(msg) || (typeof navigator !== 'undefined' && !navigator.onLine))
    return new ApiError('network', msg);
  return new ApiError('invalid', msg || 'Unexpected server error');
}

/**
 * Supabase-backed client. Every call is an RPC to a SECURITY DEFINER function;
 * tables themselves are unreachable for the anon key (RLS on, no policies, no grants).
 */
export function createSupabaseApi(url: string, anonKey: string): ApiClient {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    let res;
    try {
      res = await sb.rpc(fn, args);
    } catch (e) {
      throw toApiError({ message: (e as Error).message });
    }
    if (res.error) throw toApiError(res.error);
    return res.data as T;
  }

  return {
    mode: 'supabase',
    joinSession: async (code) => {
      const rows = await rpc<{ session_id: string; chapter_code: string }[]>('join_session', { p_chapter: normalizeChapter(code) });
      if (!rows?.length) throw new ApiError('not_found');
      return rows[0];
    },
    sync: (token, attempts, answers) =>
      rpc('sync_answers', { p_device_token: token, p_attempts: attempts, p_answers: answers }),
    verifyPasscode: (p) => rpc<boolean>('fac_verify', { p_passcode: p }),
    createSession: (p, code) => rpc<Session>('fac_create_session', { p_passcode: p, p_chapter: normalizeChapter(code) }),
    openSessions: (p) => rpc<OpenSession[]>('fac_open_sessions', { p_passcode: p }),
    sessionStats: (p, id) => rpc('fac_session_stats', { p_passcode: p, p_session_id: id }),
    closeSession: async (p, id) => {
      await rpc('fac_close_session', { p_passcode: p, p_session_id: id });
    },
    exportData: (p, f = {}) =>
      rpc<ExportData>('export_data', { p_passcode: p, p_chapter: f.chapter ?? null, p_from: f.from ?? null, p_to: f.to ?? null }),
  };
}
