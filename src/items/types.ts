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
  | { type: 'stack'; cards: StackCard[]; poolLabel: string; areaLabel: string } // C4
  | { type: 'dial' } // C3 believability 1–5
  | { type: 'shade'; whole: number; unit: Unit; readout: 'usd' | 'pct'; typed?: 'linked' | 'separate' } // C7
  | { type: 'choice'; options: { id: string; label: string }[]; multi?: boolean; other?: boolean }
  | { type: 'text'; placeholder?: string };

// ───────────── scenario layouts (presentation data) ─────────────

export type Scenario =
  | { layout: 'situation'; text: string; facts?: { label: string; value: string }[] }
  | { layout: 'jars'; text: string; labels: string[]; fromSteps: (string | null)[] }
  | { layout: 'priceTag'; item: string; price: number; badges: string[] }
  | { layout: 'receipt'; title: string; lines: { label: string; value?: number; fromStep?: string }[] }
  | { layout: 'claim'; who: string; source: 'post' | 'chat' | 'message' | 'speech'; claim: string; facts?: { label: string; value: string }[] };

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
  optional?: boolean;
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
  /** Admin charts, in display order. The first `primary` dots chart is the headline. */
  admin: ChartSpec[];
  /** What the facilitator should take from the charts. */
  decision: string;
  notes?: string[];
}

export function defineProblem(p: Problem): Problem {
  return p;
}
