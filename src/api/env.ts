export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
/** Supabase's publishable key (sb_publishable_…). The older VITE_SUPABASE_ANON_KEY name still works. */
export const SUPABASE_ANON_KEY = ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)) as string | undefined;
export const IS_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
/** The in-browser fake-data mode is opt-in (VITE_DEMO=1, for local development only). Production never falls back to it. */
export const IS_DEMO = import.meta.env.VITE_DEMO === '1';
