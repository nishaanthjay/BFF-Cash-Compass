import type { AnswerRow, AttemptRow } from '../src/api/types';

let n = 0;
export const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

export function attempt(session_id = 's1', item_count = 3): AttemptRow {
  return { attempt_id: id(), session_id, item_count, started_at: '2026-09-01T10:00:00.000Z' };
}

export function answer(a: AttemptRow, item_id: string, estimate: number, truth = 100): AnswerRow {
  return {
    answer_id: id(),
    attempt_id: a.attempt_id,
    session_id: a.session_id,
    item_id,
    item_version: 1,
    estimate,
    truth,
    answered_at: '2026-09-01T10:05:00.000Z',
  };
}
