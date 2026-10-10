import type { ExportData, ResponseRow } from '../api/types';

/** Which rows the dashboard shows: only real data (default), only the synthetic sample, or both. */
export type DataMode = 'real' | 'sample' | 'both';

const PREFIX = 'sample-';

/** True for a synthetic row's id (session id or answer id). */
export const isSampleId = (id: string) => id.startsWith(PREFIX);

/** Responses that belong to real students only (what the CSV export contains). */
export const realResponses = (rows: ResponseRow[]) => rows.filter((r) => !isSampleId(r.answer_id));

type Seed = {
  sessions: ExportData['sessions'];
  students: { session_id: string }[];
  answers: { session_id: string; answer_id: string }[];
  recodes: { answer_id: string }[];
};

/**
 * Turn the built-in synthetic workshops into dashboard data. Every id is prefixed so nothing can
 * collide with a real row, labels say SAMPLE, and every session is closed (no live polling).
 * Nothing here is ever sent to the server.
 */
export function sampleToExport(seed: Seed & Record<string, unknown>): ExportData {
  const chapterOf = new Map(seed.sessions.map((s) => [s.id, s.chapter_code]));
  const sid = (id: string) => PREFIX + id;
  const s = seed as unknown as {
    sessions: ExportData['sessions'];
    students: ExportData['students'];
    answers: ExportData['responses'];
    recodes: ExportData['recodes'];
  };
  return {
    sessions: s.sessions.map((x) => ({ ...x, id: sid(x.id), cohort_label: `SAMPLE · ${x.cohort_label ?? 'Workshop'}`, status: 'closed' as const, closed_at: x.closed_at ?? x.created_at })),
    students: s.students.map((x) => ({ ...x, session_id: sid(x.session_id), chapter_code: chapterOf.get(x.session_id) ?? '' })),
    responses: s.answers.map((a) => ({ ...a, session_id: sid(a.session_id), answer_id: sid(a.answer_id), chapter_code: chapterOf.get(a.session_id) ?? '', cohort_label: null })),
    recodes: s.recodes.map((r) => ({ ...r, answer_id: sid(r.answer_id) })),
  };
}

export function mergeSample(real: ExportData, sample: ExportData | null, mode: DataMode): ExportData {
  if (mode === 'real' || !sample) return real;
  if (mode === 'sample') return sample;
  return {
    sessions: [...real.sessions, ...sample.sessions],
    students: [...real.students, ...sample.students],
    responses: [...real.responses, ...sample.responses],
    recodes: [...real.recodes, ...sample.recodes],
  };
}

let cached: Promise<ExportData> | null = null;

/** Builds the sample once, in its own lazy chunk (only downloaded when someone turns the sample on). */
export function loadSample(): Promise<ExportData> {
  return (cached ??= import('../api/seed').then((m) => sampleToExport(m.buildSeed(Date.now()) as never)));
}
