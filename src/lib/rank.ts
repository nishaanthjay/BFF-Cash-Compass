import type { Step } from '../items/types';
import { seeded } from './rng';

/** The order a student first sees: a seeded shuffle, so a resume (and the analysis) can reproduce it. */
export function rankShown(step: Step, seed: string): string[] {
  if (step.input.type !== 'rank') return [];
  const ids = step.input.cards.map((c) => c.id);
  const r = seeded(`rank:${seed}:${step.id}`);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}
