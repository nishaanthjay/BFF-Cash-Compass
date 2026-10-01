export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
/** Demo mode whenever Supabase is not configured. */
export const IS_DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;
