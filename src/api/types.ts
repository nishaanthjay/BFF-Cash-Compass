/**
 * Data model shared by the Supabase client, the in-browser mock and analysis.
 * Privacy: nothing here identifies a student. A response is tied only to a
 * chapter code (via its session), an item, the numeric answer and timestamps.
 * `attempt_id` is a random id for one run-through, used for completion rate;
 * it is never reused and never linked across sessions.
 */

export type SessionStatus = 'open' | 'closed';

export interface Session {
  id: string;
  chapter_code: string;
  status: SessionStatus;
  created_at: string;
  closed_at: string | null;
}

export interface SessionStats {
  attempts: number;
  completed: number;
  responses: number;
}

export interface OpenSession extends Session, SessionStats {}

/** What a student gets back when they type a chapter code. */
export interface JoinedSession {
  session_id: string;
  chapter_code: string;
}

export interface AttemptRow {
  attempt_id: string;
  session_id: string;
  item_count: number;
  started_at: string;
}

export interface AnswerRow {
  answer_id: string;
  attempt_id: string;
  session_id: string;
  item_id: string;
  item_version: number;
  estimate: number;
  /** True value at answer time (snapshot, so later item edits don't rewrite history). */
  truth: number;
  answered_at: string;
}

export interface ResponseRow extends AnswerRow {
  chapter_code: string;
}

export interface ExportFilters {
  chapter?: string;
  /** ISO date (inclusive), compared against answered_at / started_at. */
  from?: string;
  to?: string;
}

export interface ExportData {
  sessions: Session[];
  attempts: (AttemptRow & { chapter_code: string })[];
  responses: ResponseRow[];
}

export interface SyncResult {
  attempts: number;
  answers: number;
  /** Ids the server refused permanently (e.g. the session was closed). */
  rejected: string[];
}

export type ApiErrorCode =
  | 'network'
  | 'rate_limited'
  | 'not_found'
  | 'session_closed'
  | 'bad_passcode'
  | 'invalid'
  | 'chapter_busy';

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
  sync(deviceToken: string, attempts: AttemptRow[], answers: AnswerRow[]): Promise<SyncResult>;
  // Facilitator (single shared passcode)
  verifyPasscode(passcode: string): Promise<boolean>;
  createSession(passcode: string, chapterCode: string): Promise<Session>;
  openSessions(passcode: string): Promise<OpenSession[]>;
  sessionStats(passcode: string, sessionId: string): Promise<SessionStats & { status: SessionStatus }>;
  closeSession(passcode: string, sessionId: string): Promise<void>;
  exportData(passcode: string, filters?: ExportFilters): Promise<ExportData>;
}

/** Chapter codes: 3–10 uppercase letters/digits. */
export const CHAPTER_CODE = /^[A-Z0-9]{3,10}$/;

export function normalizeChapter(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
