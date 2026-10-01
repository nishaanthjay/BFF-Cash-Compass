import type { Problem } from '../items/types';
import { hashString, seeded } from './rng';

/**
 * Item order for one student, seeded by their anonymous code so a resume
 * reproduces the same sequence. Enforces the contamination rules declared on
 * each problem (`order.before`, `order.notAdjacent`) by randomized topological
 * sort + rejection. Returns problem ids; item_position = index + 1.
 */
export function buildOrder(problems: Problem[], seedKey: string, maxTries = 5000): { ids: string[]; relaxed: boolean } {
  const ids = problems.map((p) => p.id);
  const present = new Set(ids);
  const before = new Map<string, Set<string>>(); // a -> must precede these
  const adj = new Map<string, Set<string>>();
  for (const p of problems) {
    for (const b of p.order?.before ?? []) if (present.has(b)) (before.get(p.id) ?? before.set(p.id, new Set()).get(p.id)!).add(b);
    for (const b of p.order?.notAdjacent ?? [])
      if (present.has(b)) {
        (adj.get(p.id) ?? adj.set(p.id, new Set()).get(p.id)!).add(b);
        (adj.get(b) ?? adj.set(b, new Set()).get(b)!).add(p.id);
      }
  }
  const rand = seeded(`order:${seedKey}`);

  const topo = (): string[] => {
    const indeg = new Map(ids.map((i) => [i, 0]));
    for (const [, set] of before) for (const b of set) indeg.set(b, (indeg.get(b) ?? 0) + 1);
    const out: string[] = [];
    let ready = ids.filter((i) => indeg.get(i) === 0);
    while (ready.length) {
      // Prefer a ready item not adjacent-forbidden to the previous one.
      const prev = out[out.length - 1];
      const okReady = ready.filter((r) => !prev || !adj.get(prev)?.has(r));
      const pool = okReady.length ? okReady : ready;
      const pick = pool[Math.floor(rand() * pool.length)];
      out.push(pick);
      ready = ready.filter((r) => r !== pick);
      for (const b of before.get(pick) ?? []) {
        indeg.set(b, indeg.get(b)! - 1);
        if (indeg.get(b) === 0) ready.push(b);
      }
    }
    return out.length === ids.length ? out : ids; // cycle guard (validator forbids cycles)
  };

  const valid = (seq: string[]) => seq.every((id, i) => i === 0 || !adj.get(seq[i - 1])?.has(id));
  for (let t = 0; t < maxTries; t++) {
    const seq = topo();
    if (valid(seq)) return { ids: seq, relaxed: false };
  }
  return { ids: topo(), relaxed: true };
}

/** Balanced-by-hash form assignment for counterbalanced items (e.g. S12 anchors H/L/N). */
export function assignForm(studentCode: string, problemId: string, forms: string[]): string {
  return forms[hashString(`${problemId}:${studentCode}`) % forms.length];
}
