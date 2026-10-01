/**
 * Per-step instrumentation (exploratory: not validated as confidence measures).
 * Pure reducer so it can be unit-tested; `useStepTelemetry` wraps it for React.
 */
export type RawMethod = 'typed' | 'dragged' | 'tapped';
export type InputMethod = 'typed' | 'dragged' | 'tapped' | 'dragged_then_typed';

export interface TelemetryState {
  shownAt: number;
  events: { m: RawMethod; t: number }[];
}

/** Typing within this many ms of the previous keystroke is one revision, not many. */
const TYPING_BURST_MS = 1500;

export function start(now: number): TelemetryState {
  return { shownAt: now, events: [] };
}

export function record(s: TelemetryState, m: RawMethod, now: number): TelemetryState {
  return { ...s, events: [...s.events, { m, t: now }] };
}

export function summarize(s: TelemetryState, lockedAt: number) {
  const ev = s.events;
  // Interactions: each tap/drag is one; a typing burst is one.
  let interactions = 0;
  ev.forEach((e, i) => {
    const prev = ev[i - 1];
    if (e.m === 'typed' && prev?.m === 'typed' && e.t - prev.t < TYPING_BURST_MS) return;
    interactions++;
  });
  const firstVisual = ev.findIndex((e) => e.m !== 'typed');
  const lastTyped = ev.map((e) => e.m).lastIndexOf('typed');
  let method: InputMethod | null = null;
  if (ev.length) {
    if (lastTyped >= 0 && firstVisual >= 0 && firstVisual < lastTyped) method = 'dragged_then_typed';
    else if (firstVisual < 0) method = 'typed';
    else if (ev.some((e) => e.m === 'dragged')) method = 'dragged';
    else method = 'tapped';
  }
  return {
    input_method: method,
    time_to_first_touch_ms: ev.length ? ev[0].t - s.shownAt : null,
    time_to_lock_ms: lockedAt - s.shownAt,
    n_revisions: Math.max(0, interactions - 1),
  };
}

export type DeviceType = 'phone' | 'tablet' | 'laptop';

export function deviceType(): DeviceType {
  if (typeof window === 'undefined') return 'laptop';
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const short = Math.min(window.screen?.width ?? 1024, window.screen?.height ?? 768);
  if (coarse && short < 600) return 'phone';
  if (coarse) return 'tablet';
  return 'laptop';
}
