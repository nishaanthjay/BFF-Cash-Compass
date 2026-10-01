import type { AnswerRow, AttemptRow, SyncResult } from '../api/types';
import { ApiError } from '../api/types';
import { readJSON, writeJSON, type KV } from './storage';

/**
 * Offline-tolerant answer queue. Everything is written to storage first, then
 * flushed to the API in batches. Sync is idempotent: ids are client-generated
 * and the server ignores duplicates, so a retry after a dropped response is safe.
 */

export interface QueueState {
  attempts: AttemptRow[];
  answers: AnswerRow[];
  /** Answers the server refused permanently (e.g. session closed before they synced). */
  lost: number;
}

export type FlushOutcome = 'synced' | 'empty' | 'offline' | 'rate_limited' | 'rejected' | 'busy';

export type Sender = (attempts: AttemptRow[], answers: AnswerRow[]) => Promise<SyncResult>;

const EMPTY: QueueState = { attempts: [], answers: [], lost: 0 };

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
    this.state = readJSON<QueueState>(kv, key, EMPTY);
  }

  get snapshot(): QueueState {
    return this.state;
  }

  get pending(): number {
    return this.state.answers.length + this.state.attempts.length;
  }

  /** Exponential backoff for the next automatic retry: 1s, 2s, 4s … capped at 30s. */
  get retryDelayMs(): number {
    return this.failures === 0 ? 0 : Math.min(30_000, 1000 * 2 ** (this.failures - 1));
  }

  subscribe(fn: (s: QueueState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  addAttempt(a: AttemptRow) {
    if (this.state.attempts.some((x) => x.attempt_id === a.attempt_id)) return;
    this.set({ ...this.state, attempts: [...this.state.attempts, a] });
  }

  addAnswer(a: AnswerRow) {
    // One answer per (attempt, item): a re-submit replaces the queued one.
    const answers = this.state.answers.filter((x) => !(x.attempt_id === a.attempt_id && x.item_id === a.item_id));
    this.set({ ...this.state, answers: [...answers, a] });
  }

  async flush(): Promise<FlushOutcome> {
    if (this.flushing) return 'busy';
    if (this.pending === 0) return 'empty';
    this.flushing = true;
    try {
      while (this.pending > 0) {
        const attempts = this.state.attempts;
        const answers = this.state.answers.slice(0, this.batchSize);
        let res: SyncResult;
        try {
          res = await this.send(attempts, answers);
        } catch (e) {
          const code = e instanceof ApiError ? e.code : 'network';
          if (code === 'network' || code === 'rate_limited') {
            this.failures++;
            return code === 'network' ? 'offline' : 'rate_limited';
          }
          // Permanent refusal of the whole batch (e.g. session closed): drop it so the queue can't jam.
          this.drop(attempts.map((a) => a.attempt_id), answers.map((a) => a.answer_id), answers.length);
          this.failures = 0;
          return 'rejected';
        }
        const rejected = new Set(res.rejected);
        const lost = answers.filter((a) => rejected.has(a.answer_id)).length;
        this.drop(attempts.map((a) => a.attempt_id), answers.map((a) => a.answer_id), lost);
        this.failures = 0;
      }
      return 'synced';
    } finally {
      this.flushing = false;
    }
  }

  private drop(attemptIds: string[], answerIds: string[], lost: number) {
    const a = new Set(attemptIds);
    const b = new Set(answerIds);
    this.set({
      attempts: this.state.attempts.filter((x) => !a.has(x.attempt_id)),
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
