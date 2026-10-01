/**
 * Weekly CSV backup (run by .github/workflows/backup.yml).
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY, MC_PASSCODE. Writes backups/money-check-<date>.csv and .json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createSupabaseApi } from '../src/api/supabase';
import { responsesToCsv } from '../src/lib/csv';

const { SUPABASE_URL, SUPABASE_ANON_KEY, MC_PASSCODE } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !MC_PASSCODE) {
  console.error('Missing SUPABASE_URL, SUPABASE_ANON_KEY or MC_PASSCODE');
  process.exit(1);
}

const api = createSupabaseApi(SUPABASE_URL, SUPABASE_ANON_KEY);
const data = await api.exportData(MC_PASSCODE);
const stamp = new Date().toISOString().slice(0, 10);
mkdirSync('backups', { recursive: true });
writeFileSync(`backups/money-check-${stamp}.csv`, responsesToCsv(data.responses, data.recodes));
writeFileSync(`backups/money-check-${stamp}.json`, JSON.stringify(data));
console.log(`Backed up ${data.responses.length} step responses, ${data.students.length} students, ${data.sessions.length} sessions.`);
