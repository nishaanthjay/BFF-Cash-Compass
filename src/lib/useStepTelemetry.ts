import { useCallback, useRef } from 'react';
import { record, start, summarize, type RawMethod } from './telemetry';

/** React wrapper: call `mark(method)` on every input change, `finish()` when the answer locks. */
export function useStepTelemetry(key: string) {
  const state = useRef({ key, s: start(performance.now()) });
  if (state.current.key !== key) state.current = { key, s: start(performance.now()) };
  const mark = useCallback((m: RawMethod) => {
    state.current.s = record(state.current.s, m, performance.now());
  }, []);
  const finish = useCallback(() => summarize(state.current.s, performance.now()), []);
  return { mark, finish };
}
