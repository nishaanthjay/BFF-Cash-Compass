import type { ExportData, ExportFilters, Recode, ResponseRow } from '../api/types';
import type { Code } from '../items/families';
import { median } from './logError';
import { mulberry32 } from './rng';

/** Cells with fewer students than this are hidden in projector mode. */
export const MIN_CELL = 5;
/** Per-workshop distributions switch from dots to a histogram above this n (pooled views). */
export const HISTOGRAM_N = 60;
export const FAST_FINISH_MS = 3 * 60_000;

export type RecodeMap = Map<string, Recode>;

export function recodeMap(recodes: Recode[]): RecodeMap {
  return new Map(recodes.map((r) => [r.answer_id, r]));
}

/** Manual codes win over the automatic first pass. */
export function codesOf(r: ResponseRow, rc: RecodeMap): Code[] {
  const m = rc.get(r.answer_id);
  return m && m.codes.length ? m.codes : r.strategy_codes;
}

export function applyFilters(data: ExportData, f: ExportFilters): ExportData {
  const day = (iso: string) => iso.slice(0, 10);
  const ok = (sid: string, chapter: string, iso: string) =>
    (!f.session_id || sid === f.session_id) && (!f.chapter || chapter === f.chapter) && (!f.from || day(iso) >= f.from) && (!f.to || day(iso) <= f.to);
  const chapterOf = new Map(data.sessions.map((s) => [s.id, s.chapter_code]));
  return {
    sessions: data.sessions.filter((s) => ok(s.id, s.chapter_code, s.created_at)),
    students: data.students.filter((s) => ok(s.session_id, s.chapter_code, s.started_at)),
    responses: data.responses.filter((r) => ok(r.session_id, chapterOf.get(r.session_id) ?? r.chapter_code, r.answered_at)),
    recodes: data.recodes,
  };
}

export function stepRows(data: ExportData, item: string, step: string): ResponseRow[] {
  return data.responses.filter((r) => r.item_id === item && r.step_id === step);
}

/** Students who reached this item (used for "n = 22, 2 blank"). */
export function reached(data: ExportData, item: string): number {
  return new Set(data.responses.filter((r) => r.item_id === item).map((r) => `${r.session_id}:${r.student_code}`)).size;
}

export interface CodeShare {
  code: Code;
  n: number;
  share: number;
}

/** Share of answers carrying each code (an answer can carry several). */
export function codeShares(rows: ResponseRow[], rc: RecodeMap): CodeShare[] {
  const counts = new Map<Code, number>();
  for (const r of rows) for (const c of codesOf(r, rc)) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts.entries()].map(([code, n]) => ({ code, n, share: rows.length ? n / rows.length : 0 })).sort((a, b) => b.n - a.n);
}

export function shareCorrect(rows: ResponseRow[], rc: RecodeMap): number | null {
  const scored = rows.filter((r) => codesOf(r, rc).length > 0);
  return scored.length ? scored.filter((r) => codesOf(r, rc).includes('CORR')).length / scored.length : null;
}

export interface RatingPair {
  student: string;
  gut: number;
  post: number;
}

export function ratingPairs(data: ExportData, item: string, gut: string, post: string): RatingPair[] {
  const key = (r: ResponseRow) => `${r.session_id}:${r.student_code}`;
  const g = new Map(stepRows(data, item, gut).filter((r) => r.raw_value !== null).map((r) => [key(r), r]));
  const out: RatingPair[] = [];
  for (const p of stepRows(data, item, post)) {
    const a = g.get(key(p));
    if (a && p.raw_value !== null) out.push({ student: p.student_code, gut: a.raw_value as number, post: p.raw_value });
  }
  return out;
}

/** Shade bar vs typed answer disagree by more than 1% of the whole. */
export function shadeMismatch(rows: ResponseRow[], whole: number): ResponseRow[] {
  return rows.filter((r) => {
    const f = r.value?.fraction;
    return typeof f === 'number' && r.raw_value !== null && Math.abs(f * whole - r.raw_value) > whole * 0.01;
  });
}

/** Receipt: total ≠ base + the tax the student typed (±1 cent). */
export function receiptMismatch(data: ExportData, item: string, base: number, taxStep: string, totalStep: string): { checked: number; mismatched: ResponseRow[] } {
  const key = (r: ResponseRow) => `${r.session_id}:${r.student_code}`;
  const tax = new Map(stepRows(data, item, taxStep).map((r) => [key(r), r.raw_value]));
  const totals = stepRows(data, item, totalStep).filter((r) => r.raw_value !== null && tax.get(key(r)) != null);
  return { checked: totals.length, mismatched: totals.filter((r) => Math.abs((r.raw_value as number) - (base + (tax.get(key(r)) as number))) > 0.011) };
}

export function split<K extends string>(rows: { k: K | null }[]): { key: K; n: number; share: number }[] {
  const m = new Map<K, number>();
  for (const r of rows) if (r.k) m.set(r.k, (m.get(r.k) ?? 0) + 1);
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  return [...m.entries()].map(([key, n]) => ({ key, n, share: total ? n / total : 0 })).sort((a, b) => b.n - a.n);
}

export interface QualityFlags {
  straightLined: string[];
  identical: string[];
  tooFast: string[];
}

/** Data-quality flags per student code (exploratory). */
export function qualityFlags(data: ExportData): QualityFlags {
  const by = new Map<string, ResponseRow[]>();
  for (const r of data.responses) by.set(`${r.session_id}:${r.student_code}`, [...(by.get(`${r.session_id}:${r.student_code}`) ?? []), r]);
  const out: QualityFlags = { straightLined: [], identical: [], tooFast: [] };
  for (const [k, rows] of by) {
    const code = k.split(':')[1];
    const ratings = rows.filter((r) => r.step_id === 'gut' || r.step_id === 'post').map((r) => r.raw_value);
    if (ratings.length >= 4 && new Set(ratings).size === 1) out.straightLined.push(code);
    const nums = rows.filter((r) => r.raw_value !== null && r.step_id !== 'gut' && r.step_id !== 'post').map((r) => r.raw_value);
    if (nums.length >= 5) {
      const top = Math.max(...[...new Set(nums)].map((v) => nums.filter((x) => x === v).length));
      if (top / nums.length >= 0.6) out.identical.push(code);
    }
  }
  for (const s of data.students) if (s.finished_at && Date.parse(s.finished_at) - Date.parse(s.started_at) < FAST_FINISH_MS) out.tooFast.push(s.student_code);
  return out;
}

export interface TopBar {
  started: number;
  finished: number;
  medianMinutes: number | null;
  unk: number;
  methods: { key: string; n: number; share: number }[];
  devices: { key: string; n: number; share: number }[];
  flags: QualityFlags;
}

export function topBar(data: ExportData, rc: RecodeMap): TopBar {
  const finished = data.students.filter((s) => s.finished_at);
  return {
    started: data.students.length,
    finished: finished.length,
    medianMinutes: median(finished.map((s) => (Date.parse(s.finished_at!) - Date.parse(s.started_at)) / 60_000)),
    unk: data.responses.filter((r) => codesOf(r, rc).includes('UNK')).length,
    methods: split(data.responses.map((r) => ({ k: r.input_method }))),
    devices: split(data.students.map((s) => ({ k: s.device_type }))),
    flags: qualityFlags(data),
  };
}

export interface Bin {
  x0: number;
  x1: number;
  n: number;
}

/** Equal-width bins (log-spaced on log axes). */
export function histogram(values: number[], min: number, max: number, bins: number, log = false): Bin[] {
  const f = (v: number) => (log ? Math.log(v) : v);
  const g = (v: number) => (log ? Math.exp(v) : v);
  const a = f(min);
  const b = f(max);
  const out: Bin[] = Array.from({ length: bins }, (_, i) => ({ x0: g(a + ((b - a) * i) / bins), x1: g(a + ((b - a) * (i + 1)) / bins), n: 0 }));
  for (const v of values) {
    if (log && v <= 0) continue;
    const i = Math.min(bins - 1, Math.max(0, Math.floor(((f(v) - a) / (b - a)) * bins)));
    out[i].n++;
  }
  return out;
}

// ───────────── Stage 2 helpers ─────────────

export const studentKey = (r: { session_id: string; student_code: string }) => `${r.session_id}:${r.student_code}`;

export interface CurvePts {
  key: string;
  code: string;
  y5: number | null;
  y10: number;
}

/** Year-5 / year-10 points from a curve step (y10 falls back to raw_value). */
export function curvePoints(rows: ResponseRow[]): CurvePts[] {
  const out: CurvePts[] = [];
  for (const r of rows) {
    const y10 = typeof r.value?.y10 === 'number' ? (r.value.y10 as number) : r.raw_value;
    if (y10 === null || y10 === undefined) continue;
    out.push({ key: studentKey(r), code: r.student_code, y5: typeof r.value?.y5 === 'number' ? (r.value.y5 as number) : null, y10 });
  }
  return out;
}

export type CurveShape = 'straight' | 'convex' | 'concave' | 'no midpoint';

/**
 * Shape from the year-5 point against the straight line between start and year 10.
 * Within ±4% of the straight-line midpoint = straight; below = convex (curving up, compounding-like);
 * above = concave. Without a year-5 point the shape can't be told.
 */
export function curveShape(start: number, y5: number | null, y10: number, tolFrac = 0.04): CurveShape {
  if (y5 === null) return 'no midpoint';
  const mid = (start + y10) / 2;
  if (Math.abs(y5 - mid) <= Math.abs(mid) * tolFrac) return 'straight';
  return y5 < mid ? 'convex' : 'concave';
}

export interface CardStat {
  id: string;
  n: number;
  share: number;
  /** Mean 1-based position in the stack among students who stacked it. */
  avgPos: number | null;
}

/** How often each card was stacked (and where). `rows` = one stack answer per student. */
export function cardFrequency(rows: ResponseRow[], ids: string[]): CardStat[] {
  const stacks = rows.map((r) => (r.value?.choice as string[] | undefined) ?? []);
  return ids.map((id) => {
    const pos = stacks.map((s) => s.indexOf(id)).filter((i) => i >= 0);
    return { id, n: pos.length, share: stacks.length ? pos.length / stacks.length : 0, avgPos: pos.length ? pos.reduce((a, b) => a + b + 1, 0) / pos.length : null };
  });
}

export interface WaterfallStep {
  id: string;
  label: string;
  share: number;
  /** Running total after this card, weighting each card by the share of students who stacked it. */
  classEnd: number;
  correctEnd: number;
}

/** Class-average vs correct profit breakdown (spec F5). Unstacked cards show up as a gap. */
export function waterfall(rows: ResponseRow[], cards: { id: string; label: string; amount: number; sign: 1 | -1 }[]): { steps: WaterfallStep[]; implied: number } {
  const freq = new Map(cardFrequency(rows, cards.map((c) => c.id)).map((f) => [f.id, f.share]));
  let cls = 0;
  let cor = 0;
  const steps = cards.map((c) => {
    const share = freq.get(c.id) ?? 0;
    cls += c.sign * c.amount * share;
    cor += c.sign * c.amount;
    return { id: c.id, label: c.label, share, classEnd: cls, correctEnd: cor };
  });
  return { steps, implied: cls };
}

export interface XY {
  key: string;
  code: string;
  x: number | null;
  y: number | null;
  belief?: boolean;
  /** correct / wrong flag on the x step (for mode: 'correct') */
  xCorrect?: boolean;
}

/** Join two steps per student (and optionally a belief rating) for scatter plots. */
export function joinSteps(data: ExportData, item: string, xStep: string, yStep: string, rc: RecodeMap, beliefStep?: { step: string; min: number }): XY[] {
  const xs = new Map(stepRows(data, item, xStep).map((r) => [studentKey(r), r]));
  const bs = beliefStep ? new Map(stepRows(data, item, beliefStep.step).map((r) => [studentKey(r), r])) : null;
  const out: XY[] = [];
  for (const y of stepRows(data, item, yStep)) {
    const x = xs.get(studentKey(y));
    if (!x) continue;
    const b = bs?.get(studentKey(y));
    out.push({
      key: studentKey(y),
      code: y.student_code,
      x: x.raw_value,
      y: y.raw_value,
      xCorrect: codesOf(x, rc).includes('CORR'),
      belief: b && b.raw_value !== null && beliefStep ? b.raw_value >= beliefStep.min : undefined,
    });
  }
  return out;
}

/** Counts below / about / above a reference value (±tol%). */
export function vsReference(rows: ResponseRow[], ref: number, tolPct: number): { below: number; exact: number; above: number } {
  const t = Math.abs(ref) * (tolPct / 100) + 0.005;
  let below = 0;
  let exact = 0;
  let above = 0;
  for (const r of rows) {
    if (r.raw_value === null) continue;
    if (Math.abs(r.raw_value - ref) <= t) exact++;
    else if (r.raw_value < ref) below++;
    else above++;
  }
  return { below, exact, above };
}

/** 2×2: did the student's x answer land within ±withinPct of ref, and do they believe (rating ≥ min)? */
export function quadrantCounts(data: ExportData, item: string, x: { step: string; ref: number; withinPct: number }, belief: { step: string; min: number }) {
  const bs = new Map(stepRows(data, item, belief.step).map((r) => [studentKey(r), r.raw_value]));
  const q = { goodBelieves: 0, goodDoubts: 0, badBelieves: 0, badDoubts: 0 };
  for (const r of stepRows(data, item, x.step)) {
    const b = bs.get(studentKey(r));
    if (r.raw_value === null || b === undefined || b === null) continue;
    const good = Math.abs(r.raw_value - x.ref) <= x.ref * (x.withinPct / 100);
    const believes = b >= belief.min;
    if (good) q[believes ? 'goodBelieves' : 'goodDoubts']++;
    else q[believes ? 'badBelieves' : 'badDoubts']++;
  }
  return q;
}

/** Paired step values per student (e.g. S7 Step 1 → Step 3). */
export function pairedValues(data: ExportData, item: string, a: string, b: string): { key: string; code: string; a: number; b: number }[] {
  const as = new Map(stepRows(data, item, a).map((r) => [studentKey(r), r]));
  const out: { key: string; code: string; a: number; b: number }[] = [];
  for (const rb of stepRows(data, item, b)) {
    const ra = as.get(studentKey(rb));
    if (ra && ra.raw_value !== null && rb.raw_value !== null) out.push({ key: studentKey(rb), code: rb.student_code, a: ra.raw_value, b: rb.raw_value });
  }
  return out;
}

/** Split choice answers by whether another step landed within ±withinPct of ref. */
export function choiceSplit(data: ExportData, item: string, step: string, by: { step: string; ref: number; withinPct: number }) {
  const bs = new Map(stepRows(data, item, by.step).map((r) => [studentKey(r), r.raw_value]));
  const groups = { near: {} as Record<string, number>, far: {} as Record<string, number> };
  for (const r of stepRows(data, item, step)) {
    const v = bs.get(studentKey(r));
    if (v === undefined || v === null) continue;
    const g = Math.abs(v - by.ref) <= by.ref * (by.withinPct / 100) ? groups.near : groups.far;
    for (const c of (r.value?.choice as string[] | undefined) ?? []) g[c] = (g[c] ?? 0) + 1;
  }
  return groups;
}

// ───────────── Stage 3 helpers ─────────────


export const choiceOf = (r: ResponseRow): string[] => (r.value?.choice as string[] | undefined) ?? [];

export interface SankeyData {
  columns: { label: string; nodes: { label: string; n: number; tone: 'corr' | 'wrong' | 'unk' }[] }[];
  /** links[c] connects column c to column c+1: from node index, to node index, count */
  links: { from: number; to: number; n: number }[][];
  n: number;
}

/** Flow of students across steps. Each node group is defined by codes or a chosen option; leftovers go to "Other". */
export function sankey(
  data: ExportData,
  item: string,
  columns: { step: string; label: string; groups: { label: string; codes?: Code[]; choice?: string; tone?: 'corr' | 'wrong' | 'unk' }[] }[],
  rc: RecodeMap,
): SankeyData {
  const per = columns.map((c) => new Map(stepRows(data, item, c.step).map((r) => [studentKey(r), r])));
  const groupOf = (ci: number, r: ResponseRow): number => {
    const groups = columns[ci].groups;
    const i = groups.findIndex((g) => (g.codes ? codesOf(r, rc).some((c) => g.codes!.includes(c)) : g.choice ? choiceOf(r).includes(g.choice) : false));
    return i >= 0 ? i : groups.length; // "Other"
  };
  const keys = [...per[0].keys()].filter((k) => per.every((m) => m.has(k)));
  const nodes = columns.map((c) => [...c.groups.map((g) => ({ label: g.label, n: 0, tone: g.tone ?? 'wrong' })), { label: 'Other', n: 0, tone: 'unk' as const }]);
  const links: Map<string, number>[] = columns.slice(1).map(() => new Map());
  for (const k of keys) {
    const idx = per.map((m, ci) => groupOf(ci, m.get(k)!));
    idx.forEach((g, ci) => nodes[ci][g].n++);
    for (let ci = 0; ci < idx.length - 1; ci++) links[ci].set(`${idx[ci]}:${idx[ci + 1]}`, (links[ci].get(`${idx[ci]}:${idx[ci + 1]}`) ?? 0) + 1);
  }
  return {
    columns: columns.map((c, i) => ({ label: c.label, nodes: nodes[i].filter((n, j) => n.n > 0 || j < c.groups.length) })),
    links: links.map((m) => [...m.entries()].map(([k, n]) => ({ from: Number(k.split(':')[0]), to: Number(k.split(':')[1]), n }))),
    n: keys.length,
  };
}

export interface PairPattern {
  SS: number;
  SL: number;
  LS: number;
  LL: number;
  n: number;
  /** (SL − LS) / n: share more "soon then later" than "later then soon". */
  net: number | null;
}

/** Cross-problem choice pattern: first letter from item A (S = early option), second from item B. */
export function pairPattern(data: ExportData, a: { item: string; step: string; early: string }, b: { item: string; step: string; early: string }): PairPattern {
  const bs = new Map(stepRows(data, b.item, b.step).map((r) => [studentKey(r), choiceOf(r)[0]]));
  const out: PairPattern = { SS: 0, SL: 0, LS: 0, LL: 0, n: 0, net: null };
  for (const r of stepRows(data, a.item, a.step)) {
    const bc = bs.get(studentKey(r));
    const ac = choiceOf(r)[0];
    if (!ac || !bc) continue;
    const k = `${ac === a.early ? 'S' : 'L'}${bc === b.early ? 'S' : 'L'}` as 'SS' | 'SL' | 'LS' | 'LL';
    out[k]++;
    out.n++;
  }
  out.net = out.n ? (out.SL - out.LS) / out.n : null;
  return out;
}

/** Share correct on `step` for students whose choices on two other problems match a pattern. */
export function correctByGroup(data: ExportData, rc: RecodeMap, step: { item: string; step: string }, g: { a: { item: string; step: string; pick: string }; b: { item: string; step: string; pick: string } }) {
  const as = new Map(stepRows(data, g.a.item, g.a.step).map((r) => [studentKey(r), choiceOf(r)[0]]));
  const bs = new Map(stepRows(data, g.b.item, g.b.step).map((r) => [studentKey(r), choiceOf(r)[0]]));
  const yes: ResponseRow[] = [];
  const no: ResponseRow[] = [];
  for (const r of stepRows(data, step.item, step.step)) {
    const k = studentKey(r);
    if (!as.has(k) || !bs.has(k)) continue;
    (as.get(k) === g.a.pick && bs.get(k) === g.b.pick ? yes : no).push(r);
  }
  const share = (rows: ResponseRow[]) => shareCorrect(rows, rc);
  return { yes: { n: yes.length, share: share(yes) }, no: { n: no.length, share: share(no) } };
}

export const quantile = (xs: number[], q: number): number | null => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return null;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  return s[lo] + (s[Math.min(s.length - 1, lo + 1)] - s[lo]) * (pos - lo);
};

const med = (xs: number[]) => quantile(xs, 0.5);

/** Values by counterbalanced form (form_version) for one step. */
export function valuesByForm(rows: ResponseRow[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const r of rows) if (r.form_version && r.raw_value !== null) m.set(r.form_version, [...(m.get(r.form_version) ?? []), r.raw_value]);
  return m;
}

export interface Anchoring {
  index: number | null;
  lo: number | null;
  hi: number | null;
  /** Smallest anchoring index this sample could reliably detect (80% power, 5% level; normal approximation). */
  mde: number | null;
  nHigh: number;
  nLow: number;
}

/** Anchoring index (median high − median low) ÷ (anchor high − anchor low), with a seeded bootstrap interval. */
export function anchoring(high: number[], low: number[], anchorHigh: number, anchorLow: number, iterations = 1000, seed = 7): Anchoring {
  const span = anchorHigh - anchorLow;
  const out: Anchoring = { index: null, lo: null, hi: null, mde: null, nHigh: high.length, nLow: low.length };
  if (!high.length || !low.length) return out;
  out.index = (med(high)! - med(low)!) / span;
  const r = mulberry32(seed);
  const pick = (xs: number[]) => Array.from({ length: xs.length }, () => xs[Math.floor(r() * xs.length)]);
  const boots: number[] = [];
  for (let i = 0; i < iterations; i++) boots.push((med(pick(high))! - med(pick(low))!) / span);
  out.lo = quantile(boots, 0.025);
  out.hi = quantile(boots, 0.975);
  const all = [...high, ...low];
  const mean = all.reduce((a, b) => a + b, 0) / all.length;
  const sd = Math.sqrt(all.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, all.length - 1));
  out.mde = (2.8 * sd * Math.sqrt(1 / high.length + 1 / low.length)) / span;
  return out;
}

/** Gaussian kernel density at `points` (Silverman bandwidth). Used for ridgelines when n is large. */
export function kde(values: number[], points: number[]): number[] {
  const n = values.length;
  if (n < 2) return points.map(() => 0);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) || 1;
  const h = 1.06 * sd * n ** -0.2;
  return points.map((x) => values.reduce((a, v) => a + Math.exp(-0.5 * ((x - v) / h) ** 2), 0) / (n * h * Math.sqrt(2 * Math.PI)));
}

/** Spearman rank correlation between a student's order and the computed order (both lists of the same ids). */
export function spearman(order: string[], truth: string[]): number | null {
  const n = truth.length;
  if (n < 2 || order.length !== n || order.some((id) => !truth.includes(id))) return null;
  let d2 = 0;
  for (const id of truth) d2 += (order.indexOf(id) - truth.indexOf(id)) ** 2;
  return 1 - (6 * d2) / (n * (n * n - 1));
}

/** Average position (1 = top) per card across students' rankings. */
export function averageRanks(rows: ResponseRow[], ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const lists = rows.map(choiceOf).filter((l) => l.length === ids.length);
  for (const id of ids) out[id] = lists.length ? lists.reduce((a, l) => a + l.indexOf(id) + 1, 0) / lists.length : NaN;
  return out;
}

/** Share of students who put each card first / last. */
export function firstLastShares(rows: ResponseRow[], ids: string[]): { id: string; first: number; last: number }[] {
  const lists = rows.map(choiceOf).filter((l) => l.length === ids.length);
  return ids.map((id) => ({ id, first: lists.filter((l) => l[0] === id).length, last: lists.filter((l) => l[l.length - 1] === id).length }));
}

/** Per-cell intensity for a calendar step: share who tapped it (multi) or average count per student (count). */
export function calendarIntensity(rows: ResponseRow[], cells: number): { cell: number; value: number }[] {
  const n = rows.length || 1;
  return Array.from({ length: cells }, (_, k) => {
    const i = k + 1;
    let total = 0;
    for (const r of rows) {
      const counts = r.value?.counts as Record<string, number> | undefined;
      const sel = r.value?.cells as number[] | undefined;
      total += counts ? counts[i] ?? 0 : sel?.includes(i) ? 1 : 0;
    }
    return { cell: i, value: total / n };
  });
}

export function bucketCounts(rows: ResponseRow[], buckets: { label: string; min: number; max: number }[]): number[] {
  return buckets.map((b) => rows.filter((r) => r.raw_value !== null && r.raw_value >= b.min && r.raw_value < b.max).length);
}

/** 2×2 of "step x correct?" by "step y correct?" per student. */
export function correct2x2(data: ExportData, item: string, xStep: string, yStep: string, rc: RecodeMap) {
  const ys = new Map(stepRows(data, item, yStep).map((r) => [studentKey(r), codesOf(r, rc).includes('CORR')]));
  const out = { both: 0, xOnly: 0, yOnly: 0, neither: 0, n: 0 };
  for (const r of stepRows(data, item, xStep)) {
    const y = ys.get(studentKey(r));
    if (y === undefined) continue;
    const x = codesOf(r, rc).includes('CORR');
    out[x && y ? 'both' : x ? 'xOnly' : y ? 'yOnly' : 'neither']++;
    out.n++;
  }
  return out;
}

/** (guess ÷ truth) per answer, skipping non-positive guesses. */
export function ratioRows(rows: ResponseRow[], truth: number): ResponseRow[] {
  return rows.filter((r) => r.raw_value !== null && r.raw_value > 0).map((r) => ({ ...r, raw_value: (r.raw_value as number) / truth }));
}

/** (gut rating, |log10 error|) per student, for "confident and far off". */
export function confidencePoints(data: ExportData, item: string, gutStep: string, step: string, truth: number): XY[] {
  const gs = new Map(stepRows(data, item, gutStep).map((r) => [studentKey(r), r.raw_value]));
  const out: XY[] = [];
  for (const r of stepRows(data, item, step)) {
    const g = gs.get(studentKey(r));
    if (g === undefined || g === null || r.raw_value === null || r.raw_value <= 0) continue;
    out.push({ key: studentKey(r), code: r.student_code, x: g, y: Math.abs(Math.log10(r.raw_value / truth)) });
  }
  return out;
}
