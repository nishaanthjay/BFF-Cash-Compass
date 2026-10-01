export const DECA_CATEGORIES = [
  'spending_saving',
  'credit_debt',
  'employment_income',
  'investing',
  'risk_insurance',
  'decision_making',
] as const;
export type DecaCategory = (typeof DECA_CATEGORIES)[number];

export const DECA_LABELS: Record<DecaCategory, string> = {
  spending_saving: 'Spending & Saving',
  credit_debt: 'Credit & Debt',
  employment_income: 'Employment & Income',
  investing: 'Investing',
  risk_insurance: 'Risk & Insurance',
  decision_making: 'Decision Making',
};

export type Unit = 'usd' | 'percent' | 'months' | 'years' | 'count';
export type Variables = Record<string, number>;

/**
 * One scored question. Pure data: no UI or scoring logic lives here except `truth`.
 *
 * Templates use `{name}` or `{name:fmt}` placeholders, where fmt is one of
 * usd | usd0 | pct | int. `{truth}` / `{truth:fmt}` is also available inside
 * the explanation.
 */
export interface Item {
  /** Unique, stable id, e.g. "compound-growth". Never reuse an id for a different question. */
  id: string;
  /** Short human label for charts/tables. */
  title: string;
  /** Bump when the wording or numbers change; stored with every response. */
  version: number;
  active: boolean;
  deca_category: DecaCategory;
  prompt_template: string;
  variables: Variables;
  truth: (v: Variables) => number;
  unit: Unit;
  explanation: string;
  /** Optional extra values for templates, computed from variables (e.g. rule-of-72 doubling time). */
  derived?: (v: Variables) => Variables;
  /** Display order (ascending). Defaults to file order. */
  order?: number;
  /** True for the placeholder SAMPLE items only. */
  sample?: boolean;
}

/** Identity helper that gives item files type-checking and autocomplete. */
export function defineItem(item: Item): Item {
  return item;
}
