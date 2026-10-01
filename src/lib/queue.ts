import type { AnswerRow, StudentRow, SyncResult } from '../api/types';
import { ApiError } from '../api/types';
import { readJSON, writeJSON, type KV } from './storage';

/**
 * Offline-tolerant answer queue. Everything is written to storage first, then
 * flushed to the API in batches. Sync is idempotent: ids are client-generated
 * and the server ignores duplicates, so a retry after a dropped response is safe.
 */

export interface QueueState {
  students: StudentRow[];
  answers: AnswerRow[];
  /** Answers the server refused permanently (e.g. session closed before they synced). */
  lost: number;
}

export type FlushOutcome = 'synced' | 'empty' | 'offline' | 'rate_limited' | 'rejected' | 'busy';

export type Sender = (students: StudentRow[], answers: AnswerRow[]) => Promise<SyncResult>;

const studentKey = (s: StudentRow) => `${s.session_id}:${s.student_code}`;

const EMPTY: QueueState = { students: [], answers: [], lost: 0 };

export class SyncQueue {
  private state: QueueState;
  private flushing = false;
  private failures = 0;
  private listeners = new Set<(s: QueueState) => void>();

  constructor(
    private kv: KV,
    private send: Sender,
    private key = 'mc.queue',
    private batchSize = 25,
  ) {
    const loaded = readJSON<Partial<QueueState>>(kv, key, EMPTY);
    this.state = { students: loaded.students ?? [], answers: loaded.answers ?? [], lost: loaded.lost ?? 0 };
  }

  get snapshot(): QueueState {
    return this.state;
  }

  get pending(): number {
    return this.state.answers.length + this.state.students.length;
  }

  /** Exponential backoff for the next automatic retry: 1s, 2s, 4s … capped at 30s. */
  get retryDelayMs(): number {
    return this.failures === 0 ? 0 : Math.min(30_000, 1000 * 2 ** (this.failures - 1));
  }

  subscribe(fn: (s: QueueState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  addStudent(st: StudentRow) {
    if (this.state.students.some((x) => x.student_code === st.student_code && x.session_id === st.session_id)) return;
    this.set({ ...this.state, students: [...this.state.students, st] });
  }

  addAnswer(a: AnswerRow) {
    // One answer per (student, item, step): a duplicate lock replaces the queued one.
    const answers = this.state.answers.filter((x) => !(x.student_code === a.student_code && x.item_id === a.item_id && x.step_id === a.step_id));
    this.set({ ...this.state, answers: [...answers, a] });
  }

  async flush(): Promise<FlushOutcome> {
    if (this.flushing) return 'busy';
    if (this.pending === 0) return 'empty';
    this.flushing = true;
    try {
      while (this.pending > 0) {
        const students = this.state.students;
        const answers = this.state.answers.slice(0, this.batchSize);
        let res: SyncResult;
        try {
          res = await this.send(students, answers);
        } catch (e) {
          const code = e instanceof ApiError ? e.code : 'network';
          if (code === 'network' || code === 'rate_limited') {
            this.failures++;
            return code === 'network' ? 'offline' : 'rate_limited';
          }
          // Permanent refusal of the whole batch (e.g. session closed): drop it so the queue can't jam.
          this.drop(students.map(studentKey), answers.map((a) => a.answer_id), answers.length);
          this.failures = 0;
          return 'rejected';
        }
        const rejected = new Set(res.rejected);
        const lost = answers.filter((a) => rejected.has(a.answer_id)).length;
        this.drop(students.map(studentKey), answers.map((a) => a.answer_id), lost);
        this.failures = 0;
      }
      return 'synced';
    } finally {
      this.flushing = false;
    }
  }

  private drop(studentKeys: string[], answerIds: string[], lost: number) {
    const a = new Set(studentKeys);
    const b = new Set(answerIds);
    this.set({
      students: this.state.students.filter((x) => !a.has(studentKey(x))),
      answers: this.state.answers.filter((x) => !b.has(x.answer_id)),
      lost: this.state.lost + lost,
    });
  }

  private set(s: QueueState) {
    this.state = s;
    writeJSON(this.kv, this.key, s);
    for (const fn of this.listeners) fn(s);
  }
}
