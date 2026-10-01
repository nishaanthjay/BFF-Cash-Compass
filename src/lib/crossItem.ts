import type { ExportData, ResponseRow } from '../api/types';
import { ALL_PROBLEMS } from '../items';
import { FAMILIES, type Family } from '../items/families';
import type { Problem } from '../items/types';
import { codesOf, studentKey, type RecodeMap } from './analysis';

/** The step that stands for a problem in cross-item views: its first "cold" step. */
export const headlineStep = (p: Problem) => p.steps.find((s) => s.kind === 'cold') ?? p.steps[0];

const scored = (rows: ResponseRow[], rc: RecodeMap) => rows.filter((r) => codesOf(r, rc).length > 0);
const isCorr = (r: ResponseRow, rc: RecodeMap) => codesOf(r, rc).includes('CORR');

export interface ProblemScore {
  id: string;
  title: string;
  families: Family[];
  n: number;
  correct: number | null;
  /** Named wrong pattern (any code except CORR/UNK). */
  named: number | null;
  unk: number | null;
  topWrong: string | null;
}

/** Per-problem correctness on the headline step. `null` when fewer than `minCell` students answered. */
export function problemScores(data: ExportData, rc: RecodeMap, minCell = 0): ProblemScore[] {
  return ALL_PROBLEMS.map((p) => {
    const st = headlineStep(p);
    const rows = data.responses.filter((r) => r.item_id === p.id && r.step_id === st.id);
    const sc = scored(rows, rc);
    const hidden = rows.length === 0 || rows.length < minCell || sc.length === 0;
    const wrongCounts = new Map<string, number>();
    for (const r of sc) for (const c of codesOf(r, rc)) if (c !== 'CORR' && c !== 'UNK') wrongCounts.set(c, (wrongCounts.get(c) ?? 0) + 1);
    const top = [...wrongCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      id: p.id,
      title: p.title,
      families: p.families,
      n: rows.length,
      correct: hidden ? null : sc.filter((r) => isCorr(r, rc)).length / sc.length,
      named: hidden ? null : sc.filter((r) => codesOf(r, rc).some((c) => c !== 'CORR' && c !== 'UNK')).length / sc.length,
      unk: hidden ? null : sc.filter((r) => codesOf(r, rc).includes('UNK')).length / sc.length,
      topWrong: top ? top[0] : null,
    };
  });
}

/** D1: biggest gaps first. Problems with hidden/empty cells are left out. */
export function teachFirst(scores: ProblemScore[]): (ProblemScore & { gap: number })[] {
  return scores
    .filter((s) => s.correct !== null)
    .map((s) => ({ ...s, gap: 1 - (s.correct as number) }))
    .sort((a, b) => b.gap - a.gap || b.n - a.n);
}

export interface GapCell {
  id: string;
  family: Family;
  pct: number | null;
  n: number;
}

/** D2: problem × family heat map (only the families a problem is tagged with get a value). */
export function gapMap(scores: ProblemScore[]): { rows: string[]; cols: readonly Family[]; cells: GapCell[] } {
  const cells: GapCell[] = [];
  for (const s of scores) for (const f of s.families) cells.push({ id: s.id, family: f, pct: s.correct, n: s.n });
  const rows = scores.filter((s) => cells.some((c) => c.id === s.id && c.pct !== null)).map((s) => s.id);
  return { rows, cols: FAMILIES, cells };
}

export interface RadarPoint {
  family: Family;
  value: number | null;
  problems: number;
}

/** D3: mean correctness per family over the problems that have enough students. */
export function radar(scores: ProblemScore[]): RadarPoint[] {
  return FAMILIES.map((family) => {
    const xs = scores.filter((s) => s.families.includes(family) && s.correct !== null).map((s) => s.correct as number);
    return { family, value: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null, problems: xs.length };
  });
}

const LIN_THRESHOLD = 3;

export interface Compounding {
  perItem: { id: string; title: string; n: number; linear: number | null }[];
  /** Students with the LIN code on at least `LIN_THRESHOLD` compounding problems. */
  studentsLinear: number;
  studentsAnswered: number;
  threshold: number;
}

/** D4: how many students answer compounding questions as if growth were linear. */
export function compounding(data: ExportData, rc: RecodeMap, minCell = 0): Compounding {
  const probs = ALL_PROBLEMS.filter((p) => p.families.includes('compounding'));
  const perStudent = new Map<string, { linear: number; answered: number }>();
  const perItem = probs.map((p) => {
    const hasLin = p.steps.some((st) => st.codes?.some((c) => c.code === 'LIN'));
    const st = headlineStep(p);
    const rows = scored(data.responses.filter((r) => r.item_id === p.id && r.step_id === st.id), rc);
    for (const r of rows) {
      const e = perStudent.get(studentKey(r)) ?? { linear: 0, answered: 0 };
      e.answered++;
      if (codesOf(r, rc).includes('LIN')) e.linear++;
      perStudent.set(studentKey(r), e);
    }
    const lin = rows.filter((r) => codesOf(r, rc).includes('LIN')).length;
    return { id: p.id, title: p.title, n: rows.length, linear: !hasLin || rows.length === 0 || rows.length < minCell ? null : lin / rows.length };
  });
  const all = [...perStudent.values()];
  return { perItem, studentsLinear: all.filter((e) => e.linear >= LIN_THRESHOLD).length, studentsAnswered: all.length, threshold: LIN_THRESHOLD };
}

export interface Feasibility {
  perItem: { id: string; title: string; n: number; confidentWrong: number; rate: number | null }[];
  confidentWrong: number;
  n: number;
  rate: number | null;
}

/** D5: students who rated a claim believable (4–5) on the gut check but were NOT correct on its first scored step. */
export function feasibility(data: ExportData, rc: RecodeMap, minCell = 0): Feasibility {
  const perItem: Feasibility['perItem'] = [];
  let cw = 0;
  let total = 0;
  for (const p of ALL_PROBLEMS) {
    const gut = p.steps.find((s) => s.kind === 'rating_gut');
    if (!gut) continue;
    const judged = p.steps.find((s) => s.id !== gut.id && s.codes?.length && s.kind !== 'rating_post');
    if (!judged) continue;
    const gutRows = new Map(data.responses.filter((r) => r.item_id === p.id && r.step_id === gut.id && r.raw_value !== null).map((r) => [studentKey(r), r.raw_value as number]));
    const rows = scored(data.responses.filter((r) => r.item_id === p.id && r.step_id === judged.id && gutRows.has(studentKey(r))), rc);
    const bad = rows.filter((r) => (gutRows.get(studentKey(r)) as number) >= 4 && !isCorr(r, rc)).length;
    perItem.push({ id: p.id, title: p.title, n: rows.length, confidentWrong: bad, rate: rows.length && rows.length >= minCell ? bad / rows.length : null });
    cw += bad;
    total += rows.length;
  }
  return { perItem, confidentWrong: cw, n: total, rate: total && total >= minCell ? cw / total : null };
}

export interface StudentStep {
  item: string;
  title: string;
  step: string;
  position: number;
  raw: number | null;
  codes: string[];
  method: string | null;
  seconds: number | null;
}

/** D6: one anonymous code's answers, in the order the student saw them. */
export function studentSteps(data: ExportData, rc: RecodeMap, key: string): StudentStep[] {
  const title = new Map(ALL_PROBLEMS.map((p) => [p.id, p.title]));
  return data.responses
    .filter((r) => studentKey(r) === key)
    .sort((a, b) => a.item_position - b.item_position || a.answered_at.localeCompare(b.answered_at))
    .map((r) => ({
      item: r.item_id,
      title: title.get(r.item_id) ?? r.item_id,
      step: r.step_id,
      position: r.item_position,
      raw: r.raw_value,
      codes: codesOf(r, rc),
      method: r.input_method,
      seconds: r.time_to_lock_ms === null ? null : Math.round(r.time_to_lock_ms / 100) / 10,
    }));
}

export interface Quality {
  id: string;
  title: string;
  n: number;
  difficulty: number | null;
  /** Point-biserial correlation with the student's score on the OTHER problems (null when undefined). */
  discrimination: number | null;
}

/** D7: classical item statistics on each problem's headline step. */
export function instrumentQuality(data: ExportData, rc: RecodeMap): Quality[] {
  const heads = ALL_PROBLEMS.map((p) => ({ p, st: headlineStep(p) }));
  const byStudent = new Map<string, Map<string, number>>();
  for (const { p, st } of heads) {
    for (const r of scored(data.responses.filter((x) => x.item_id === p.id && x.step_id === st.id), rc)) {
      const m = byStudent.get(studentKey(r)) ?? new Map<string, number>();
      m.set(p.id, isCorr(r, rc) ? 1 : 0);
      byStudent.set(studentKey(r), m);
    }
  }
  return heads.map(({ p }) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const m of byStudent.values()) {
      if (!m.has(p.id) || m.size < 4) continue;
      const rest = [...m.entries()].filter(([k]) => k !== p.id).map(([, v]) => v);
      xs.push(m.get(p.id) as number);
      ys.push(rest.reduce((a, b) => a + b, 0) / rest.length);
    }
    const all = [...byStudent.values()].filter((m) => m.has(p.id)).map((m) => m.get(p.id) as number);
    return { id: p.id, title: p.title, n: all.length, difficulty: all.length ? all.reduce((a, b) => a + b, 0) / all.length : null, discrimination: pearson(xs, ys) };
  });
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 5) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

/** D7: answers no code matched, for the recode tool. */
export function unkRows(data: ExportData, rc: RecodeMap): ResponseRow[] {
  return data.responses.filter((r) => r.raw_value !== null && codesOf(r, rc).includes('UNK'));
}

/** D7: share correct by input method (typed vs dragged/tapped), exploratory. */
export function methodComparison(data: ExportData, rc: RecodeMap): { method: string; n: number; correct: number | null }[] {
  const groups = new Map<string, ResponseRow[]>();
  for (const r of data.responses) {
    if (!r.input_method || codesOf(r, rc).length === 0) continue;
    const g = r.input_method === 'typed' ? 'typed' : 'dragged or tapped';
    groups.set(g, [...(groups.get(g) ?? []), r]);
  }
  return [...groups.entries()].map(([method, rows]) => ({ method, n: rows.length, correct: rows.length ? rows.filter((r) => isCorr(r, rc)).length / rows.length : null }));
}

const medianOf = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

/** Cumulative share of answers at or below each value (step function), sorted. */
export function ecdf(values: number[]): { x: number; p: number }[] {
  const a = [...values].sort((x, y) => x - y);
  return a.map((x, i) => ({ x, p: (i + 1) / a.length }));
}

export interface BoxStats {
  n: number;
  p10: number;
  q1: number;
  median: number;
  q3: number;
  p90: number;
}

const q = (a: number[], f: number) => {
  const pos = (a.length - 1) * f;
  const lo = Math.floor(pos);
  return a[lo] + (a[Math.min(a.length - 1, lo + 1)] - a[lo]) * (pos - lo);
};

/** Box plot numbers: whiskers are the 10th and 90th percentiles (not min/max, so one wild answer doesn't squash the box). */
export function boxStats(values: number[]): BoxStats | null {
  if (values.length < 5) return null;
  const a = [...values].sort((x, y) => x - y);
  return { n: a.length, p10: q(a, 0.1), q1: q(a, 0.25), median: q(a, 0.5), q3: q(a, 0.75), p90: q(a, 0.9) };
}

export interface Bias {
  id: string;
  title: string;
  n: number;
  /** Median log10(answer ÷ correct): below 0 = students guess low, above 0 = high. 1 = ten times too high. */
  value: number;
}

/** Which way, and how far, students miss on each problem's headline question (positive-valued answers only). */
export function biasByProblem(data: ExportData, minCell = 0): Bias[] {
  const out: Bias[] = [];
  for (const p of ALL_PROBLEMS) {
    const st = headlineStep(p);
    if (typeof st.correct !== 'number' || st.correct <= 0) continue;
    const xs = data.responses.filter((r) => r.item_id === p.id && r.step_id === st.id && r.raw_value !== null && r.raw_value > 0).map((r) => Math.log10((r.raw_value as number) / (st.correct as number)));
    const m = medianOf(xs);
    if (m !== null && xs.length >= Math.max(5, minCell)) out.push({ id: p.id, title: p.title, n: xs.length, value: m });
  }
  return out.sort((a, b) => a.value - b.value);
}

export interface TrendPoint {
  label: string;
  value: number | null;
  n: number;
}

/** Share correct across every problem's headline step, per workshop, oldest first. */
export function workshopTrend(data: ExportData, rc: RecodeMap, minCell = 0): TrendPoint[] {
  const heads = new Set(ALL_PROBLEMS.map((p) => `${p.id}.${headlineStep(p).id}`));
  return [...data.sessions]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((s) => {
      const rows = scored(data.responses.filter((r) => r.session_id === s.id && heads.has(`${r.item_id}.${r.step_id}`)), rc);
      const n = new Set(data.responses.filter((r) => r.session_id === s.id).map((r) => r.student_code)).size;
      return { label: s.chapter_code, value: rows.length && n >= Math.max(1, minCell) ? rows.filter((r) => isCorr(r, rc)).length / rows.length : null, n };
    })
    .filter((p) => p.n > 0);
}

/** Median seconds to lock the headline question, per problem. Exploratory: reading speed and device matter. */
export function medianSeconds(data: ExportData, minCell = 0): { id: string; title: string; n: number; seconds: number }[] {
  const out: { id: string; title: string; n: number; seconds: number }[] = [];
  for (const p of ALL_PROBLEMS) {
    const st = headlineStep(p);
    const xs = data.responses.filter((r) => r.item_id === p.id && r.step_id === st.id && r.time_to_lock_ms !== null).map((r) => (r.time_to_lock_ms as number) / 1000);
    const m = medianOf(xs);
    if (m !== null && xs.length >= Math.max(5, minCell)) out.push({ id: p.id, title: p.title, n: xs.length, seconds: Math.round(m * 10) / 10 });
  }
  return out.sort((a, b) => b.seconds - a.seconds);
}
