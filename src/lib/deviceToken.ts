import { browserKV, type KV } from './storage';
import { uuid } from './uuid';

const KEY = 'mc.deviceToken';

/**
 * Random per-browser token used ONLY for rate limiting. It is never stored
 * alongside responses, so it cannot link a student's answers across sessions.
 */
export function getDeviceToken(kv: KV = browserKV()): string {
  let t = kv.getItem(KEY);
  if (!t) {
    t = uuid();
    kv.setItem(KEY, t);
  }
  return t;
}
