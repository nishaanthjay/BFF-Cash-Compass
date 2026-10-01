import type { AnswerRow, ExportData, ResponseRow, StudentRow } from '../src/api/types';
import type { Code } from '../src/items/families';

let n = 0;
export const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

export function student(session_id = 's1', code = 'ABC234', expected = 2): StudentRow {
  return { student_code: code, session_id, forms: {}, device_type: 'laptop', expected_steps: expected, started_at: '2026-09-01T10:00:00.000Z' };
}

export function answer(st: StudentRow, item_id: string, step_id: string, raw: number | null, codes: Code[] = [], extra: Partial<AnswerRow> = {}): AnswerRow {
  return {
    answer_id: id(),
    session_id: st.session_id,
    student_code: st.student_code,
    item_id,
    item_version: 1,
    step_id,
    form_version: null,
    raw_value: raw,
    value: null,
    input_method: 'typed',
    strategy_codes: codes,
    correct_value: null,
    time_to_first_touch_ms: 1000,
    time_to_lock_ms: 8000,
    n_revisions: 0,
    item_position: 1,
    free_text: null,
    device_type: 'laptop',
    answered_at: '2026-09-01T10:05:00.000Z',
    ...extra,
  };
}

export const resp = (a: AnswerRow, chapter = 'TX014'): ResponseRow => ({ ...a, chapter_code: chapter, cohort_label: null });

export function dataset(rows: ResponseRow[], students: StudentRow[]): ExportData {
  return {
    sessions: [...new Set(students.map((s) => s.session_id))].map((sid) => ({
      id: sid,
      chapter_code: 'TX014',
      cohort_label: null,
      modules: ['skill'],
      status: 'closed',
      created_at: '2026-09-01T09:00:00Z',
      closed_at: null,
    })),
    students: students.map((s) => ({ ...s, chapter_code: 'TX014', finished_at: null })),
    responses: rows,
    recodes: [],
  };
}
