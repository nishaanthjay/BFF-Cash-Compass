import { describe, expect, it } from 'vitest';
import { assignForm, buildOrder } from '../src/lib/order';
import type { Problem } from '../src/items/types';
import { ALL_PROBLEMS } from '../src/items';

const mk = (id: string, order?: Problem['order']): Problem => ({ ...ALL_PROBLEMS[0], id, order });
// Mirrors the spec's contamination rules.
const bank: Problem[] = [
  mk('S4'),
  mk('S5'),
  mk('S6', { before: ['H1'], notAdjacent: ['S7', 'S8'] }),
  mk('S7', { notAdjacent: ['S8'] }),
  mk('S8'),
  mk('S9'),
  mk('S10'),
  mk('F1', { before: ['S4', 'S5'], notAdjacent: ['S4', 'S5'] }),
  mk('F2'),
  mk('H1'),
  mk('H2'),
];

describe('buildOrder', () => {
  it('holds every rule across 1,000 seeds', () => {
    for (let i = 0; i < 1000; i++) {
      const { ids } = buildOrder(bank, `seed-${i}`);
      expect(new Set(ids).size).toBe(bank.length);
      const at = (x: string) => ids.indexOf(x);
      expect(at('S6')).toBeLessThan(at('H1'));
      expect(at('F1')).toBeLessThan(at('S4'));
      expect(at('F1')).toBeLessThan(at('S5'));
      for (let k = 1; k < ids.length; k++) {
        const pair = [ids[k - 1], ids[k]].sort().join();
        expect(['S6,S7', 'S6,S8', 'S7,S8', 'F1,S4', 'F1,S5']).not.toContain(pair);
      }
    }
  });
  it('is deterministic per student code (resume reproduces the order)', () => {
    expect(buildOrder(bank, 'ABC234').ids).toEqual(buildOrder(bank, 'ABC234').ids);
  });
  it('actually randomizes', () => {
    const firsts = new Set(Array.from({ length: 50 }, (_, i) => buildOrder(bank, `k${i}`).ids[0]));
    expect(firsts.size).toBeGreaterThan(3);
  });
  it('ignores rules about problems not in the session', () => {
    const { ids } = buildOrder([mk('S6', { before: ['H1'] }), mk('S7')], 'x');
    expect(ids.sort()).toEqual(['S6', 'S7']);
  });
});

describe('assignForm', () => {
  it('is stable and roughly balanced', () => {
    const counts: Record<string, number> = { H: 0, L: 0, N: 0 };
    for (let i = 0; i < 3000; i++) counts[assignForm(`code${i}`, 'S12', ['H', 'L', 'N'])]++;
    for (const v of Object.values(counts)) expect(v).toBeGreaterThan(850);
    expect(assignForm('ABC234', 'S12', ['H', 'L', 'N'])).toBe(assignForm('ABC234', 'S12', ['H', 'L', 'N']));
  });
});
