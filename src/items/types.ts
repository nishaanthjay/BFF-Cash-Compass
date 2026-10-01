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

export type Form = 'A' | 'B';
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
  /** Unique per form, e.g. "compound-growth-A". */
  id: string;
  /** Shared by the A and B versions of a parallel item; analysis groups by this. */
  slot: string;
  /** Short human label for charts/tables. */
  title: string;
  version: number;
  active: boolean;
  form: Form;
  deca_category: DecaCategory;
  prompt_template: string;
  variables: Variables;
  truth: (v: Variables) => number;
  unit: Unit;
  explanation: string;
  /** Optional extra values for templates, computed from variables (e.g. rule-of-72 doubling time). */
  derived?: (v: Variables) => Variables;
  /** Order within a form (ascending). Defaults to file order. */
  order?: number;
  /** True for the placeholder SAMPLE items only. */
  sample?: boolean;
}

/** Everything except the per-form fields. */
export type ParallelSpec = Omit<Item, 'id' | 'form' | 'variables'> & {
  forms: Record<Form, Variables>;
};

/** Define the A and B version of an item in one place (same structure, different numbers). */
export function defineParallel(spec: ParallelSpec): Item[] {
  const { forms, ...common } = spec;
  return (['A', 'B'] as const).map((form) => ({
    ...common,
    id: `${spec.slot}-${form}`,
    form,
    variables: forms[form],
  }));
}
