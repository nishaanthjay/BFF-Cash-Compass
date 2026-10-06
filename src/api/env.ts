export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const IS_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
/** The in-browser fake-data mode is opt-in (VITE_DEMO=1, for local development only). Production never falls back to it. */
export const IS_DEMO = import.meta.env.VITE_DEMO === '1';
