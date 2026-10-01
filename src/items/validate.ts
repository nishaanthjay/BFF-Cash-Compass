import { CODES } from './families';
import { DECA_CATEGORIES, type Problem } from './types';
import { correctOf } from './index';
import { within } from '../lib/classify';

/** Every problem id the spec defines. Order rules may mention ids not built yet. */
export const PLANNED_IDS = new Set([
  ...Array.from({ length: 15 }, (_, i) => `S${i + 1}`),
  ...Array.from({ length: 8 }, (_, i) => `F${i + 1}`),
  'H1',
  'H2',
]);

/** Returns human-readable problems; [] = bank is valid. Run via `npm test`. */
export function validateProblems(problems: Problem[]): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  const all = new Set(problems.map((p) => p.id));

  for (const p of problems) {
    const at = `[${p.id}]`;
    if (!/^[SFH]\d{1,2}$/.test(p.id)) out.push(`${at} id must look like S1, F2, H1`);
    if (ids.has(p.id)) out.push(`${at} duplicate id`);
    ids.add(p.id);
    if (!DECA_CATEGORIES.includes(p.deca_category)) out.push(`${at} unknown deca_category`);
    if (!p.steps.length) out.push(`${at} has no steps`);
    for (const ref of [...(p.order?.before ?? []), ...(p.order?.notAdjacent ?? [])]) if (!PLANNED_IDS.has(ref)) out.push(`${at} order rule references unknown ${ref}`);

    const stepIds = new Set<string>();
    for (const s of p.steps) {
      const st = `${at}.${s.id}`;
      if (stepIds.has(s.id)) out.push(`${st} duplicate step id`);
      stepIds.add(s.id);
      if (!s.prompt.trim()) out.push(`${st} empty prompt`);
      for (const c of s.codes ?? []) {
        if (!(c.code in CODES)) out.push(`${st} unknown code ${c.code}`);
        if (!Number.isFinite(c.value)) out.push(`${st} code ${c.code} has no numeric value`);
      }
      const truth = typeof s.correct === 'number' ? correctOf(s) : null;
      if (truth !== null) {
        for (const c of s.codes ?? []) if (within(c.value, truth, Math.max(c.tolPct ?? 1, s.correctTolPct ?? 1))) out.push(`${st} code ${c.code} (${c.value}) overlaps the correct value`);
        if (s.input.type === 'numberLine' || s.input.type === 'jar') {
          const { min, max, scale } = s.input;
          const pos = scale === 'log' ? (Math.log(truth) - Math.log(min)) / (Math.log(max) - Math.log(min)) : (truth - min) / (max - min);
          if (pos < 0.05 || pos > 0.95) out.push(`${st} correct value sits at the edge of the axis (${(pos * 100).toFixed(0)}%)`);
          if (Math.abs(pos - 0.5) < 0.03) out.push(`${st} correct value sits at the centre of the axis`);
          if (scale === 'log' && min <= 0) out.push(`${st} log axis needs min > 0`);
        }
      }
      if (s.correctChoice && s.input.type === 'choice') for (const c of s.correctChoice) if (!s.input.options.some((o) => o.id === c)) out.push(`${st} correctChoice ${c} is not an option`);
    }
    for (const c of p.admin) {
      const refs: string[] =
        c.type === 'scatter' ? [c.x.step, c.y.step, ...(c.belief ? [c.belief.step] : [])]
        : c.type === 'paired' ? [c.a, c.b]
        : c.type === 'choiceSplit' ? [c.step, c.by.step]
        : c.type === 'waterfall' ? [c.stack, c.profit]
        : c.type === 'quadrants' ? [c.x.step, c.belief.step]
        : 'step' in c ? [c.step] : 'steps' in c ? c.steps : 'gut' in c ? [c.gut, c.post] : [];
      for (const r of refs) if (!stepIds.has(r)) out.push(`${at} admin chart "${c.title}" references unknown step ${r}`);
    }
  }
  // before-cycles
  const edges = new Map(problems.map((p) => [p.id, (p.order?.before ?? []).filter((b) => all.has(b))]));
  const seen = new Set<string>();
  const stack = new Set<string>();
  const visit = (id: string): boolean => {
    if (stack.has(id)) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    stack.add(id);
    const cyc = (edges.get(id) ?? []).some(visit);
    stack.delete(id);
    return cyc;
  };
  for (const id of all) if (visit(id)) {
    out.push(`order rules contain a cycle involving ${id}`);
    break;
  }
  return out;
}
