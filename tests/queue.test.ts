import { describe, expect, it, vi } from 'vitest';
import { SyncQueue, type Sender } from '../src/lib/queue';
import { memoryKV } from '../src/lib/storage';
import { ApiError, type SyncResult } from '../src/api/types';
import { answer, attempt } from './fixtures';

const ok = (): SyncResult => ({ attempts: 0, answers: 0, rejected: [] });

describe('SyncQueue', () => {
  it('persists to storage before sending and survives a reload', () => {
    const kv = memoryKV();
    const q1 = new SyncQueue(kv, vi.fn());
    const a = attempt();
    q1.addAttempt(a);
    q1.addAnswer(answer(a, 'x', 5));
    const q2 = new SyncQueue(kv, vi.fn());
    expect(q2.pending).toBe(2);
  });

  it('flushes attempts with answers and empties on success', async () => {
    const send = vi.fn<Sender>(async () => ok());
    const q = new SyncQueue(memoryKV(), send);
    const a = attempt();
    q.addAttempt(a);
    q.addAnswer(answer(a, 'x', 5));
    expect(await q.flush()).toBe('synced');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toHaveLength(1);
    expect(send.mock.calls[0][1]).toHaveLength(1);
    expect(q.pending).toBe(0);
  });

  it('keeps everything while offline, backs off, then syncs when back online', async () => {
    let online = false;
    const send = vi.fn<Sender>(async () => {
      if (!online) throw new ApiError('network');
      return ok();
    });
    const q = new SyncQueue(memoryKV(), send);
    const a = attempt();
    q.addAttempt(a);
    q.addAnswer(answer(a, 'x', 5));
    expect(await q.flush()).toBe('offline');
    expect(q.pending).toBe(2);
    expect(q.retryDelayMs).toBe(1000);
    await q.flush();
    expect(q.retryDelayMs).toBe(2000);
    online = true;
    expect(await q.flush()).toBe('synced');
    expect(q.pending).toBe(0);
    expect(q.retryDelayMs).toBe(0);
  });

  it('treats rate limiting as retryable', async () => {
    const q = new SyncQueue(memoryKV(), async () => {
      throw new ApiError('rate_limited');
    });
    q.addAnswer(answer(attempt(), 'x', 1));
    expect(await q.flush()).toBe('rate_limited');
    expect(q.pending).toBe(1);
  });

  it('dedupes: re-answering an item replaces the queued answer; duplicate attempts ignored', () => {
    const q = new SyncQueue(memoryKV(), vi.fn());
    const a = attempt();
    q.addAttempt(a);
    q.addAttempt(a);
    q.addAnswer(answer(a, 'x', 5));
    q.addAnswer(answer(a, 'x', 7));
    expect(q.snapshot.attempts).toHaveLength(1);
    expect(q.snapshot.answers.map((r) => r.estimate)).toEqual([7]);
  });

  it('sends in batches', async () => {
    const send = vi.fn<Sender>(async () => ok());
    const q = new SyncQueue(memoryKV(), send, 'k', 2);
    const a = attempt();
    for (const i of ['a', 'b', 'c', 'd', 'e']) q.addAnswer(answer(a, i, 1));
    await q.flush();
    expect(send.mock.calls.map((c) => c[1].length)).toEqual([2, 2, 1]);
  });

  it('drops answers the server rejects permanently and counts them as lost', async () => {
    const a = attempt();
    const r1 = answer(a, 'x', 1);
    const r2 = answer(a, 'y', 1);
    const q = new SyncQueue(memoryKV(), async () => ({ attempts: 0, answers: 1, rejected: [r2.answer_id] }));
    q.addAnswer(r1);
    q.addAnswer(r2);
    expect(await q.flush()).toBe('synced');
    expect(q.pending).toBe(0);
    expect(q.snapshot.lost).toBe(1);
  });

  it('does not run two flushes at once', async () => {
    let release!: () => void;
    const q = new SyncQueue(memoryKV(), () => new Promise<SyncResult>((r) => (release = () => r(ok()))));
    q.addAnswer(answer(attempt(), 'x', 1));
    const first = q.flush();
    expect(await q.flush()).toBe('busy');
    release();
    expect(await first).toBe('synced');
  });
});
