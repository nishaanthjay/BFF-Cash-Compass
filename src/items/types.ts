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

export type InputSpec =
  | { type: 'number'; unit: Unit } // typed only (keypad + native input)
  | ({ type: 'numberLine' } & AxisSpec) // C1
  | { type: 'dial' } // C3 believability 1–5
  | { type: 'shade'; whole: number; unit: Unit; readout: 'usd' | 'pct'; typed?: 'linked' | 'separate' } // C7
  | { type: 'choice'; options: { id: string; label: string }[]; multi?: boolean; other?: boolean }
  | { type: 'text'; placeholder?: string };

// ───────────── scenario layouts (presentation data) ─────────────

export type Scenario =
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

export type ChartSpec =
  | { type: 'dots'; step: string; title: string; axis?: AxisSpec; primary?: boolean }
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
