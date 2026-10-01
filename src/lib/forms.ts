import type { Problem } from '../items/types';
import { formKeyOf } from '../items';
import { assignForm } from './order';

/** One counterbalanced form per key (problems sharing a key share the assignment), from the student code. */
export function assignForms(problems: Problem[], studentCode: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of problems) {
    if (!p.form) continue;
    const key = formKeyOf(p);
    if (!(key in out)) out[key] = assignForm(studentCode, key, p.form.options);
  }
  return out;
}

/** "A before B" pairs implied by the assigned forms (e.g. S11 "AB" → S11A before S11B). */
export function orderPairs(problems: Problem[], forms: Record<string, string>): [string, string][] {
  const pairs: [string, string][] = [];
  for (const p of problems) {
    if (!p.orderByForm) continue;
    const seq = p.orderByForm[forms[formKeyOf(p)]];
    if (seq) for (let i = 1; i < seq.length; i++) pairs.push([seq[i - 1], seq[i]]);
  }
  return pairs;
}
