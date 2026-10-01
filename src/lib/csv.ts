import type { ResponseRow } from '../api/types';
import { logError } from './logError';

export const CSV_COLUMNS = [
  'answer_id',
  'attempt_id',
  'session_id',
  'chapter_code',
  'item_id',
  'item_version',
  'deca_category',
  'estimate',
  'truth',
  'log_error',
  'answered_at',
] as const;

/** RFC 4180 field escaping; also neutralises spreadsheet formula injection. */
export function csvField(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && typeof v === 'string') s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function responsesToCsv(rows: ResponseRow[], categoryOf: (itemId: string) => string | undefined): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) {
    const le = logError(r.estimate, r.truth);
    const rec: Record<(typeof CSV_COLUMNS)[number], unknown> = {
      answer_id: r.answer_id,
      attempt_id: r.attempt_id,
      session_id: r.session_id,
      chapter_code: r.chapter_code,
      item_id: r.item_id,
      item_version: r.item_version,
      deca_category: categoryOf(r.item_id) ?? '',
      estimate: r.estimate,
      truth: Number(r.truth.toFixed(4)),
      log_error: le === null ? '' : Number(le.toFixed(6)),
      answered_at: r.answered_at,
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
