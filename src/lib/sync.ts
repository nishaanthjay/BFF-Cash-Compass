import { useEffect, useSyncExternalStore } from 'react';
import { api } from '../api';
import { getDeviceToken } from './deviceToken';
import { SyncQueue, type QueueState } from './queue';
import { browserKV } from './storage';

const kv = browserKV();

/** App-wide answer queue backed by localStorage. */
export const queue = new SyncQueue(kv, (attempts, answers) => api.sync(getDeviceToken(kv), attempts, answers));

let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;

/** Flush now; on failure schedule a retry with exponential backoff. */
export async function syncNow() {
  clearTimeout(timer);
  const out = await queue.flush();
  if ((out === 'offline' || out === 'rate_limited') && queue.pending > 0) {
    timer = setTimeout(syncNow, queue.retryDelayMs);
  }
  return out;
}

function startAutoSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => void syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  // Safety net for flaky school wifi where 'online' never fires.
  setInterval(() => {
    if (queue.pending > 0) void syncNow();
  }, 20_000);
  void syncNow();
}

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

export function useQueue(): QueueState {
  useEffect(startAutoSync, []);
  return useSyncExternalStore(
    (cb) => queue.subscribe(cb),
    () => queue.snapshot,
    () => queue.snapshot,
  );
}
