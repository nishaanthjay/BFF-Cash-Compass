import type { RawMethod } from '../lib/telemetry';

/** What a step input produces. `raw` is the number analysed; the rest is stored in `value`. */
export interface StepValue {
  raw: number | null;
  choice?: string[];
  text?: string;
  extra?: Record<string, unknown>;
}

export const EMPTY_VALUE: StepValue = { raw: null };

/** `method` is null for intermediate updates (mid-drag) that are not a new interaction. */
export type OnValue = (v: StepValue, method: RawMethod | null) => void;
