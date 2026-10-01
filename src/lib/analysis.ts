import type { ExportData, ExportFilters, ResponseRow } from '../api/types';
import { DECA_CATEGORIES, type DecaCategory } from '../items/types';
import { direction, logError, median } from './logError';

/** Chapters with fewer responses than this get a low-n warning. */
export const LOW_N = 10;

export interface ItemStat {
  item_id: string;
  n: number;
  /** Responses with estimate ≤ 0 (no defined log error), excluded from medians. */
  excluded: number;
  median: number | null;
  under: number;
  over: number;
  exact: number;
}

export interface CategoryStat {
  category: DecaCategory;
  n: number;
  median: number | null;
}

export interface ChapterStat {
  chapter: string;
  responses: number;
  attempts: number;
  lowN: boolean;
}

export interface Summary {
  responses: number;
  chapters: number;
  sessions: number;
  attempts: number;
  completed: number;
  completionRate: number | null;
  excluded: number;
  items: ItemStat[];
  categories: CategoryStat[];
  perChapter: ChapterStat[];
}

function inRange(iso: string, f: ExportFilters): boolean {
  const day = iso.slice(0, 10);
  if (f.from && day < f.from) return false;
  if (f.to && day > f.to) return false;
  return true;
}

export function applyFilters(data: ExportData, f: ExportFilters): ExportData {
  const chapterOk = (c: string) => !f.chapter || c === f.chapter;
  return {
    sessions: data.sessions.filter((s) => chapterOk(s.chapter_code) && inRange(s.created_at, f)),
    attempts: data.attempts.filter((a) => chapterOk(a.chapter_code) && inRange(a.started_at, f)),
    responses: data.responses.filter((r) => chapterOk(r.chapter_code) && inRange(r.answered_at, f)),
  };
}

/** Aggregate-only analysis. Item order follows `itemOrder`; unknown ids are appended. */
export function summarize(data: ExportData, categoryOf: (id: string) => DecaCategory | undefined, itemOrder: string[] = []): Summary {
  const { responses, attempts } = data;

  const byItem = new Map<string, ResponseRow[]>();
  for (const r of responses) byItem.set(r.item_id, [...(byItem.get(r.item_id) ?? []), r]);
  const ids = [...itemOrder.filter((id) => byItem.has(id)), ...[...byItem.keys()].filter((id) => !itemOrder.includes(id)).sort()];

  let excludedTotal = 0;
  const items: ItemStat[] = ids.map((item_id) => {
    const rows = byItem.get(item_id)!;
    const les = rows.map((r) => logError(r.estimate, r.truth)).filter((x): x is number => x !== null);
    const excluded = rows.length - les.length;
    excludedTotal += excluded;
    const dirs = les.map(direction);
    // Excluded (≤0) estimates are below any positive truth, so they count as "under".
    const share = (d: string) => (rows.length ? (dirs.filter((x) => x === d).length + (d === 'under' ? excluded : 0)) / rows.length : 0);
    return { item_id, n: rows.length, excluded, median: median(les), under: share('under'), over: share('over'), exact: share('exact') };
  });

  const categories: CategoryStat[] = DECA_CATEGORIES.map((category) => {
    const rows = responses.filter((r) => categoryOf(r.item_id) === category);
    const les = rows.map((r) => logError(r.estimate, r.truth)).filter((x): x is number => x !== null);
    return { category, n: rows.length, median: median(les) };
  }).filter((c) => c.n > 0);

  // Completion: an attempt is complete when it has an answer for every item it was dealt.
  const answered = new Map<string, Set<string>>();
  for (const r of responses) answered.set(r.attempt_id, (answered.get(r.attempt_id) ?? new Set()).add(r.item_id));
  const completed = attempts.filter((a) => (answered.get(a.attempt_id)?.size ?? 0) >= a.item_count).length;

  const chapters = new Map<string, ChapterStat>();
  const ch = (c: string) => chapters.get(c) ?? chapters.set(c, { chapter: c, responses: 0, attempts: 0, lowN: true }).get(c)!;
  for (const r of responses) ch(r.chapter_code).responses++;
  for (const a of attempts) ch(a.chapter_code).attempts++;
  const perChapter = [...chapters.values()]
    .map((c) => ({ ...c, lowN: c.responses < LOW_N }))
    .sort((a, b) => b.responses - a.responses || a.chapter.localeCompare(b.chapter));

  return {
    responses: responses.length,
    chapters: new Set(responses.map((r) => r.chapter_code)).size,
    sessions: new Set(responses.map((r) => r.session_id)).size,
    attempts: attempts.length,
    completed,
    completionRate: attempts.length ? completed / attempts.length : null,
    excluded: excludedTotal,
    items,
    categories,
    perChapter,
  };
}
