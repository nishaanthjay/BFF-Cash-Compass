import { DECA_CATEGORIES, type Item } from './types';
import { templateVars } from '../lib/format';

/** Returns a list of human-readable problems. Empty list = bank is valid. */
export function validateItems(items: Item[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();

  for (const it of items) {
    const where = `[${it.id}]`;
    if (!it.id) problems.push(`item with empty id`);
    if (ids.has(it.id)) problems.push(`${where} duplicate id`);
    ids.add(it.id);
    if (!it.slot) problems.push(`${where} missing slot`);
    if (it.form !== 'A' && it.form !== 'B') problems.push(`${where} form must be "A" or "B"`);
    if (!DECA_CATEGORIES.includes(it.deca_category)) problems.push(`${where} unknown deca_category "${it.deca_category}"`);
    if (!Number.isInteger(it.version) || it.version < 1) problems.push(`${where} version must be a positive integer`);

    const values = { ...it.variables, ...(it.derived?.(it.variables) ?? {}), truth: 1 };
    for (const name of templateVars(it.prompt_template)) {
      if (name === 'truth') problems.push(`${where} prompt must not reveal {truth}`);
      else if (!(name in values)) problems.push(`${where} prompt uses {${name}} but no value is defined`);
    }
    for (const name of templateVars(it.explanation)) {
      if (!(name in values)) problems.push(`${where} explanation uses {${name}} but no value is defined`);
    }

    let t: number;
    try {
      t = it.truth(it.variables);
    } catch (e) {
      problems.push(`${where} truth() threw: ${(e as Error).message}`);
      continue;
    }
    if (!Number.isFinite(t) || t <= 0) problems.push(`${where} truth() must be a finite number > 0 (got ${t})`);
  }

  // Parallel forms: every active slot has exactly one A and one B with matching category/unit.
  const active = items.filter((i) => i.active);
  const slots = new Map<string, Item[]>();
  for (const it of active) slots.set(it.slot, [...(slots.get(it.slot) ?? []), it]);
  for (const [slot, group] of slots) {
    const forms = group.map((g) => g.form).sort().join('');
    if (forms !== 'AB') problems.push(`[slot ${slot}] needs exactly one active A and one active B (has "${forms}")`);
    else if (group[0].deca_category !== group[1].deca_category || group[0].unit !== group[1].unit)
      problems.push(`[slot ${slot}] A and B must share deca_category and unit`);
  }
  return problems;
}
