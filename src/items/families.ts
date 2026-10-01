/** Error-code families (the six radar / gap-map axes). */
export const FAMILIES = ['arithmetic', 'percent', 'compounding', 'time_preference', 'credit_risk', 'feasibility'] as const;
export type Family = (typeof FAMILIES)[number];

export const FAMILY_LABELS: Record<Family, string> = {
  arithmetic: 'Arithmetic floor',
  percent: 'Percent translation',
  compounding: 'Compounding intuition',
  time_preference: 'Time preference',
  credit_risk: 'Credit & risk',
  feasibility: 'Feasibility',
};

/**
 * Error-code registry. Item files reference these codes; labels here are the
 * facilitator-facing names. Codes are first-pass auto classifications (±1% band)
 * and can be recoded manually.
 */
export const CODES = {
  CORR: { label: 'Correct', family: null },
  UNK: { label: 'Unclassified', family: null },
  PAD: { label: 'Percent read as dollars', family: 'percent' },
  HALF: { label: '“25% = half”', family: 'percent' },
  DEC: { label: 'Decimal slip', family: 'arithmetic' },
  DAP: { label: 'Discount given as the price', family: 'percent' },
  NOTAX: { label: 'Tax left out', family: 'percent' },
  ADD: { label: 'Adding error', family: 'arithmetic' },
  LIN: { label: 'Linear growth', family: 'compounding' },
  GROSS: { label: 'Gross, costs ignored', family: 'feasibility' },
  MISS: { label: 'Missing costs', family: 'feasibility' },
  CLAIM: { label: 'Took the claim at face value', family: 'feasibility' },
} as const;
export type Code = keyof typeof CODES;
