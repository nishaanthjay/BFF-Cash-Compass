import type { Code, Family } from './families';

export const DECA_CATEGORIES = ['spending_saving', 'credit_debt', 'employment_income', 'investing', 'risk_insurance', 'decision_making'] as const;
export type DecaCategory = (typeof DECA_CATEGORIES)[number];
export const DECA_LABELS: Record<DecaCategory, string> = {
  spending_saving: 'Spending & Saving',
  credit_debt: 'Credit & Debt',
  employment_income: 'Employment & Income',
  investing: 'Investing',
  risk_insurance: 'Risk & Insurance',
  decision_making: 'Decision Making',
};

export type Module = 'skill' | 'feasibility' | 'hybrid';
export const MODULE_LABELS: Record<Module, string> = { skill: 'Skill & bias (S1–S15)', feasibility: 'Feasibility (F1–F8)', hybrid: 'Hybrid (H1–H2)' };

export type Unit = 'usd' | 'percent' | 'months' | 'years' | 'times' | 'count' | 'days';

/** Answers the student already locked on this problem, by step id (for steps whose truth depends on them). */
export type Prior = Record<string, number | null>;

// ───────────── input specs: one variant per component ─────────────

export interface AxisSpec {
  min: number;
  max: number;
  scale: 'linear' | 'log';
  unit: Unit;
}

export interface StackCard {
  id: string;
  label: string;
  /** Printed on the card, e.g. "$6,000" or "8% of the sale price". Never a verdict. */
  amount?: string;
  distractor?: boolean;
}

export type InputSpec =
  | { type: 'number'; unit: Unit } // typed only (keypad + native input)
  | ({ type: 'numberLine' } & AxisSpec) // C1
  | ({ type: 'jar' } & AxisSpec) // C5 (fill line on a jar)
  | { type: 'curve'; xMax: number; yMax: number; start: number; midX: number; unit: Unit } // C2
  | { type: 'dotGrid'; total: number; columns: number; itemWord: string } // C5 dot grid (tap to fill)
  | { type: 'calendar'; mode: 'single' | 'multi' | 'count'; cells: number; columns: number; cellWord: string; group?: { size: number; word: string }; maxPerCell?: number; countWord?: string; unitPrice?: number; unit: Unit } // C6
  | { type: 'timeline'; options: { id: string; label: string; amount: string; weeks: number }[]; maxWeeks: number } // C8
  | { type: 'rank'; cards: { id: string; label: string }[]; topLabel: string; bottomLabel: string }
  | { type: 'stack'; cards: StackCard[]; poolLabel: string; areaLabel: string } // C4
  | { type: 'dial'; low?: string; high?: string } // C3 believability 1–5 (custom end labels allowed)
  | { type: 'shade'; whole: number; unit: Unit; readout: 'usd' | 'pct'; typed?: 'linked' | 'separate' } // C7
  | { type: 'choice'; options: { id: string; label: string }[]; multi?: boolean; other?: boolean }
  | { type: 'text'; placeholder?: string };

// ───────────── scenario layouts (presentation data) ─────────────

export type Scenario =
  | { layout: 'situation'; text: string; facts?: { label: string; value: string }[] }
  | { layout: 'jars'; text: string; labels: string[]; fromSteps: (string | null)[] }
  | { layout: 'priceTag'; item: string; price: number; badges: string[] }
  | { layout: 'receipt'; title: string; lines: { label: string; value?: number; fromStep?: string }[] }
  | { layout: 'claim'; who: string; source: 'post' | 'chat' | 'message' | 'speech' | 'ad'; claim: string; facts?: { label: string; value: string }[] };

// ───────────── problem & steps ─────────────

export interface PredictedCode {
  code: Code;
  value: number;
  /** Override the default ±1% band (e.g. "≈8%" for 100% ÷ 12). */
  tolPct?: number;
}

export interface Step {
  id: string;
  kind: 'cold' | 'control' | 'guided' | 'rating_gut' | 'rating_post' | 'why' | 'choice';
  prompt: string;
  input: InputSpec;
  /** Correct value (number) or one computed from the student's earlier locked answers. */
  correct?: number | ((prior: Prior) => number | null);
  /** Override the ±1% CORR band (e.g. when two valid methods differ slightly). */
  correctTolPct?: number;
  codes?: PredictedCode[];
  /** Correct option id(s) for choice steps. */
  correctChoice?: string[];
  calculator?: boolean;
  /** Integer-valued or scenario-assumption steps: never auto-code an unmatched answer as UNK. */
  noUnk?: boolean;
  optional?: boolean;
  /** Show this step only to students assigned one of these forms (e.g. the anchor question in S12). */
  forms?: string[];
  promptByForm?: Record<string, string>;
  /** Short facilitator label for charts, e.g. "Step 1 · cold estimate". */
  label: string;
}

export interface ScatterAxis {
  step: string;
  /** 'correct' plots whether the step was correct (categorical) instead of its value. */
  mode?: 'value' | 'correct';
  axis?: AxisSpec;
}

export type ChartSpec =
  | { type: 'dots'; step: string; title: string; axis?: AxisSpec; primary?: boolean }
  | { type: 'spaghetti'; step: string; title: string; start: number; xMax: number; yMax: number; midX: number; linear: [number, number]; truth: [number, number]; unit: Unit }
  | { type: 'curveShapes'; step: string; title: string; start: number; midX: number }
  | { type: 'scatter'; title: string; x: ScatterAxis; y: ScatterAxis; diagonal?: boolean; note?: string; refX?: number; refY?: number; belief?: { step: string; min: number } }
  | { type: 'tileGrid'; step: string; title: string; note: string }
  | { type: 'vsRef'; step: string; title: string; ref: number; tolPct: number; labels: [string, string, string]; unit: Unit }
  | { type: 'paired'; a: string; b: string; title: string; axis: AxisSpec; note: string }
  | { type: 'choiceSplit'; step: string; title: string; by: { step: string; ref: number; withinPct: number; yes: string; no: string } }
  | { type: 'cardHeat'; step: string; title: string }
  | { type: 'waterfall'; stack: string; profit: string; title: string; cards: { id: string; label: string; amount: number; sign: 1 | -1 }[]; correct: number }
  | { type: 'sankey'; title: string; columns: { step: string; label: string; groups: { label: string; codes?: Code[]; choice?: string; tone?: 'corr' | 'wrong' | 'unk' }[] }[] }
  | { type: 'pairTiles'; title: string; note: string; a: { item: string; step: string; early: string; late: string; word: string }; b: { item: string; step: string; early: string; late: string; word: string } }
  | { type: 'correctSplit'; title: string; step: string; group: { a: { item: string; step: string; pick: string }; b: { item: string; step: string; pick: string }; yes: string; no: string } }
  | { type: 'ridgeline'; title: string; step: string; anchors: Record<string, number>; labels: Record<string, string>; unit: Unit; axis: AxisSpec }
  | { type: 'logRatio'; title: string; step: string; truth: number; marks?: { value: number; label: string }[]; unit: Unit }
  | { type: 'confError'; title: string; gut: string; step: string; truth: number }
  | { type: 'slope'; title: string; first: string; second: string; order: string[]; labels: Record<string, string> }
  | { type: 'rankCorr'; title: string; first: string; second: string; order: string[] }
  | { type: 'firstLast'; title: string; step: string; labels: Record<string, string> }
  | { type: 'calendarHeat'; title: string; step: string; cells: number; columns: number; cellWord: string; maxPerCell?: number }
  | { type: 'valueBuckets'; title: string; step: string; note?: string; buckets: { label: string; min: number; max: number; tone: 'corr' | 'wrong' | 'unk' | 'neutral' }[] }
  | { type: 'twoByTwo'; title: string; note: string; x: { step: string; label: string }; y: { step: string; label: string } }
  | { type: 'quadrants'; title: string; x: { step: string; ref: number; withinPct: number; good: string; bad: string }; belief: { step: string; min: number; yes: string; no: string } }
  | { type: 'codeBar'; steps: string[]; title: string }
  | { type: 'funnel'; steps: string[]; title: string }
  | { type: 'shareBar'; step: string; title: string; buckets: { label: string; codes: Code[] }[] }
  | { type: 'dumbbell'; gut: string; post: string; title: string }
  | { type: 'calibration'; gut: string; post: string; title: string }
  | { type: 'choiceBar'; step: string; title: string }
  | { type: 'textTags'; step: string; title: string; tags: string[] }
  | { type: 'consistency'; title: string; note: string; check: 'receiptTotal' | 'shadeMismatch'; steps: string[] };

export interface OrderRule {
  /** This problem must appear before these problems. */
  before?: string[];
  /** Never directly next to these problems. */
  notAdjacent?: string[];
  /** At least `gap` other problems between this one and `with` (e.g. S11 parts A and B). */
  minGap?: { with: string; gap: number };
}

export interface Problem {
  id: string; // 'S1'
  slug: string; // 'hoodie-sale'
  title: string;
  version: number;
  active: boolean;
  /** Wording drafted from the interaction spec; needs author review. */
  draft: boolean;
  module: Module;
  deca_category: DecaCategory;
  families: Family[];
  scenario: Scenario;
  steps: Step[];
  order?: OrderRule;
  /**
   * Counterbalanced form. Problems sharing a `key` share one assignment per student
   * (e.g. S11A and S11B both read forms.S11). Assigned from a hash of the student code.
   */
  form?: { key: string; options: string[] };
  /** For counterbalanced order: form option -> problem ids in the order they must appear. */
  orderByForm?: Record<string, string[]>;
  /** Admin charts, in display order. The first `primary` dots chart is the headline. */
  admin: ChartSpec[];
  /** What the facilitator should take from the charts. */
  decision: string;
  notes?: string[];
}

export function defineProblem(p: Problem): Problem {
  return p;
}
