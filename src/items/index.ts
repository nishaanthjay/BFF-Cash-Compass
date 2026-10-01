import type { Form, Item, Variables } from './types';
import { renderTemplate } from '../lib/format';

type ItemModule = { default: Item | Item[] };

function collect(mods: Record<string, ItemModule>): Item[] {
  return Object.keys(mods)
    .sort()
    .flatMap((k) => {
      const d = mods[k].default;
      return Array.isArray(d) ? d : [d];
    });
}

/**
 * The real question bank: every file in ./bank is picked up automatically.
 * Each file default-exports an Item, an Item[], or the result of defineParallel().
 */
const bankItems = collect(import.meta.glob<ItemModule>('./bank/*.ts', { eager: true }));
const sampleItems = collect(import.meta.glob<ItemModule>('./samples/*.ts', { eager: true }));

/** SAMPLE items are used only while the bank is empty. */
export const ALL_ITEMS: Item[] = bankItems.length > 0 ? bankItems : sampleItems;
export const USING_SAMPLES = bankItems.length === 0;

export function getItems(form: Form, items: Item[] = ALL_ITEMS): Item[] {
  return items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it.active && it.form === form)
    .sort((a, b) => (a.it.order ?? Infinity) - (b.it.order ?? Infinity) || a.i - b.i)
    .map(({ it }) => it);
}

export function getItem(id: string, items: Item[] = ALL_ITEMS): Item | undefined {
  return items.find((it) => it.id === id);
}

export function truthOf(item: Item): number {
  return item.truth(item.variables);
}

function templateValues(item: Item): Variables {
  return { ...item.variables, ...(item.derived?.(item.variables) ?? {}), truth: truthOf(item) };
}

export function promptOf(item: Item): string {
  return renderTemplate(item.prompt_template, templateValues(item));
}

export function explanationOf(item: Item): string {
  return renderTemplate(item.explanation, templateValues(item));
}

export type { Item, Form } from './types';
