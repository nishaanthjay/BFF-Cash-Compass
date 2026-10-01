/**
 * Data model shared by the Supabase client, the in-browser mock and the dashboard.
 * Privacy: no names, emails, schools, birthdates or IPs in any row. A student is an
 * anonymous code assigned at the start of the questionnaire.
 */
import type { Code } from '../items/families';
import type { Module } from '../items/types';
import type { InputMethod, DeviceType } from '../lib/telemetry';

export type SessionStatus = 'open' | 'closed';

export interface Session {
  id: string;
  chapter_code: string;
  cohort_label: string | null;
  modules: Module[];
  /** Exact problems for a short session (e.g. 5 picked or random). Empty/absent = everything in `modules`. */
  problem_ids?: string[];
  status: SessionStatus;
  created_at: string;
  closed_at: string | null;
}

export interface SessionStats {
  students: number;
  finished: number;
  responses: number;
}

export interface OpenSession extends Session, SessionStats {}

export interface JoinedSession {
  session_id: string;
  chapter_code: string;
  cohort_label: string | null;
  modules: Module[];
  problem_ids?: string[];
}

export interface StudentRow {
  student_code: string;
  session_id: string;
  /** Counterbalanced form per item, e.g. { S12: 'H', S11: 'AB' }. */
  forms: Record<string, string>;
  device_type: DeviceType;
  expected_steps: number;
  started_at: string;
}

/** One locked step answer (spec §3 data model). */
export interface AnswerRow {
  answer_id: string;
  session_id: string;
  student_code: string;
  item_id: string;
  item_version: number;
  step_id: string;
  form_version: string | null;
  raw_value: number | null;
  /** Structured extras: shaded fraction, chosen options, curve points, card order … */
  value: Record<string, unknown> | null;
  input_method: InputMethod | null;
  strategy_codes: Code[];
  correct_value: number | null;
  time_to_first_touch_ms: number | null;
  time_to_lock_ms: number | null;
  n_revisions: number;
  item_position: number;
  free_text: string | null;
  device_type: DeviceType;
  answered_at: string;
}

export interface ResponseRow extends AnswerRow {
  chapter_code: string;
  cohort_label: string | null;
}

/** Manual coding: replaces auto strategy codes and/or tags a free-text answer (e.g. survivorship present/partial/absent). */
export interface Recode {
  answer_id: string;
  codes: Code[];
  tag?: string | null;
  coded_at: string;
}

export interface ExportFilters {
  session_id?: string;
  chapter?: string;
  from?: string;
  to?: string;
}

export interface ExportData {
  sessions: Session[];
  students: (StudentRow & { chapter_code: string; finished_at: string | null })[];
  responses: ResponseRow[];
  recodes: Recode[];
}

export interface SyncResult {
  students: number;
  answers: number;
  rejected: string[];
}

export type ApiErrorCode = 'network' | 'rate_limited' | 'not_found' | 'session_closed' | 'bad_passcode' | 'invalid' | 'chapter_busy';

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ApiError';
  }
}

export interface ApiClient {
  readonly mode: 'demo' | 'supabase';
  // Student (anonymous)
  joinSession(chapterCode: string): Promise<JoinedSession>;
  /** Step ids (item_id.step_id) already stored for this code in this session, for resume. */
  resumeStudent(sessionId: string, studentCode: string): Promise<{ locked: string[] } | null>;
  sync(deviceToken: string, students: StudentRow[], answers: AnswerRow[]): Promise<SyncResult>;
  // Facilitator (single shared passcode)
  verifyPasscode(passcode: string): Promise<boolean>;
  createSession(passcode: string, chapterCode: string, modules: Module[], cohortLabel: string | null, problemIds?: string[]): Promise<Session>;
  openSessions(passcode: string): Promise<OpenSession[]>;
  sessionStats(passcode: string, sessionId: string): Promise<SessionStats & { status: SessionStatus }>;
  closeSession(passcode: string, sessionId: string): Promise<void>;
  exportData(passcode: string, filters?: ExportFilters): Promise<ExportData>;
  recode(passcode: string, answerId: string, codes: Code[], tag?: string | null): Promise<void>;
}

export const CHAPTER_CODE = /^[A-Z0-9]{3,10}$/;

export function normalizeChapter(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
