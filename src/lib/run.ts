import type { StepValue } from '../inputs/types';
import type { Module } from '../items/types';
import { readJSON, writeJSON, type KV } from './storage';

/** A student's questionnaire run, persisted locally so reloads and dead batteries resume in place. */
export interface RunState {
  v: 3;
  session_id: string;
  chapter_code: string;
  cohort_label: string | null;
  modules: Module[];
  student_code: string;
  /** Problem ids in the order this student sees them (item_position = index + 1). */
  sequence: string[];
  forms: Record<string, string>;
  /** Locked answers keyed `${problemId}.${stepId}`. */
  answers: Record<string, StepValue>;
  pi: number;
  si: number;
  started_at: string;
  done: boolean;
}

const KEY = 'mc.run';

export function loadRun(kv: KV): RunState | null {
  const r = readJSON<RunState | null>(kv, KEY, null);
  return r && r.v === 3 ? r : null;
}
export function saveRun(kv: KV, run: RunState) {
  writeJSON(kv, KEY, run);
}
export function clearRun(kv: KV) {
  kv.removeItem(KEY);
}
