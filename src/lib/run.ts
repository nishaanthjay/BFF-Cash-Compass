import { readJSON, writeJSON, type KV } from './storage';

/** A student's in-progress run, persisted so a reload (or a dead battery) resumes in place. */
export interface RunState {
  session_id: string;
  chapter_code: string;
  attempt_id: string;
  item_ids: string[];
  answers: Record<string, number>;
  phase: 'items' | 'reveal' | 'done';
  index: number;
  revealIndex: number;
  started_at: string;
}

const KEY = 'mc.run';

export function loadRun(kv: KV): RunState | null {
  return readJSON<RunState | null>(kv, KEY, null);
}

export function saveRun(kv: KV, run: RunState) {
  writeJSON(kv, KEY, run);
}

export function clearRun(kv: KV) {
  kv.removeItem(KEY);
}
