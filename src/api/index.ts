import { browserKV } from '../lib/storage';
import { createMockApi } from './mock';
import { createSupabaseApi } from './supabase';
import { IS_DEMO, SUPABASE_ANON_KEY, SUPABASE_URL } from './env';
import type { ApiClient } from './types';

export { IS_DEMO } from './env';

/** One client for the whole app: Supabase when configured, otherwise the in-browser DEMO mock. */
export const api: ApiClient = IS_DEMO ? createMockApi(browserKV()) : createSupabaseApi(SUPABASE_URL!, SUPABASE_ANON_KEY!);
