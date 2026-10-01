import type { Recode, ResponseRow } from '../api/types';
import { errorMetrics } from './classify';

/** Spec §3 data model, plus computed error metrics. One row per locked step. */
export const CSV_COLUMNS = [
  'student_code',
  'workshop_id',
  'chapter_code',
  'cohort_label',
  'item_id',
  'item_version',
  'step_id',
  'form_version',
  'raw_value',
  'input_method',
  'strategy_code',
  'auto_strategy_code',
  'manually_coded',
  'text_tag',
  'correct_value',
  'signed_error',
  'ape',
  'log_ratio',
  'rating_gut',
  'rating_post',
  'free_text',
  'time_to_first_touch_ms',
  'time_to_lock_ms',
  'n_revisions',
  'device_type',
  'item_position',
  'value_json',
  'answered_at',
  'answer_id',
] as const;

/** RFC 4180 escaping; neutralises spreadsheet formulas in text (numbers stay numbers). */
export function csvField(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const round = (x: number | null, d = 6) => (x === null ? null : Number(x.toFixed(d)));

export function responsesToCsv(rows: ResponseRow[], recodes: Recode[] = []): string {
  const rc = new Map(recodes.map((r) => [r.answer_id, r]));
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) {
    const m = rc.get(r.answer_id);
    const codes = m && m.codes.length ? m.codes : r.strategy_codes;
    const e = errorMetrics(r.raw_value, r.correct_value);
    const rec: Record<(typeof CSV_COLUMNS)[number], unknown> = {
      student_code: r.student_code,
      workshop_id: r.session_id,
      chapter_code: r.chapter_code,
      cohort_label: r.cohort_label,
      item_id: r.item_id,
      item_version: r.item_version,
      step_id: r.step_id,
      form_version: r.form_version,
      raw_value: r.raw_value,
      input_method: r.input_method,
      strategy_code: codes.join('|'),
      auto_strategy_code: r.strategy_codes.join('|'),
      manually_coded: m && m.codes.length ? 1 : 0,
      text_tag: m?.tag ?? null,
      correct_value: r.correct_value,
      signed_error: round(e.signed_error),
      ape: round(e.ape),
      log_ratio: round(e.log_ratio),
      rating_gut: r.step_id === 'gut' ? r.raw_value : null,
      rating_post: r.step_id === 'post' ? r.raw_value : null,
      free_text: r.free_text,
      time_to_first_touch_ms: r.time_to_first_touch_ms,
      time_to_lock_ms: r.time_to_lock_ms,
      n_revisions: r.n_revisions,
      device_type: r.device_type,
      item_position: r.item_position,
      value_json: r.value ? JSON.stringify(r.value) : null,
      answered_at: r.answered_at,
      answer_id: r.answer_id,
    };
    lines.push(CSV_COLUMNS.map((c) => csvField(rec[c])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
