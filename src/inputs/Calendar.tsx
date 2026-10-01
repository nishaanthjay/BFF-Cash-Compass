import { useState } from 'react';
import { Button } from '../components/Button';
import type { Unit } from '../items/types';
import { NumberField } from './NumberField';
import type { OnValue, StepValue } from './types';
import s from './Calendar.module.css';

type Spec = { mode: 'single' | 'multi' | 'count'; cells: number; columns: number; cellWord: string; group?: { size: number; word: string }; maxPerCell?: number; countWord?: string; unit: Unit };

/** What a calendar answer stores: single → [n]; multi → selected cells; count → { cell: lawns }. */
export const cellsOf = (v: StepValue): number[] => (Array.isArray(v.extra?.cells) ? (v.extra!.cells as number[]) : []);
export const countsOf = (v: StepValue): Record<string, number> => (v.extra?.counts && typeof v.extra.counts === 'object' ? (v.extra.counts as Record<string, number>) : {});

/**
 * C6 calendar / timeline tap. Cells are 1-based (month 74, day 19). Tap to choose a cell
 * (single), toggle cells (multi), or add one to a cell, wrapping to zero (count).
 * Long strips (e.g. 120 months) page by group so every tap target stays ≥44px.
 * Single mode keeps a typed box as the equal alternative.
 */
export function Calendar({ spec, value, onChange, label, unitPrice }: { spec: Spec; value: StepValue; onChange: OnValue; label: string; unitPrice?: number }) {
  const { mode, cells, columns, cellWord, group, maxPerCell = 6, countWord = 'item' } = spec;
  const groups = group ? Math.ceil(cells / group.size) : 1;
  const sel = cellsOf(value);
  const counts = countsOf(value);
  const [page, setPage] = useState(() => (sel[0] && group ? Math.floor((sel[0] - 1) / group.size) : 0));
  const from = group ? page * group.size + 1 : 1;
  const to = group ? Math.min(cells, from + group.size - 1) : cells;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const commit = (nextSel: number[], nextCounts: Record<string, number>, m: Parameters<OnValue>[1]) => {
    if (mode === 'single') onChange({ raw: nextSel[0] ?? null, extra: { cells: nextSel } }, m);
    else if (mode === 'multi') onChange({ raw: nextSel.length, extra: { cells: [...nextSel].sort((a, b) => a - b) } }, m);
    else {
      const sum = Object.values(nextCounts).reduce((a, b) => a + b, 0);
      onChange({ raw: unitPrice ? sum * unitPrice : sum, extra: { counts: nextCounts, lawns: sum } }, m);
    }
  };
  const tap = (i: number) => {
    if (mode === 'single') return commit([i], {}, 'tapped');
    if (mode === 'multi') return commit(sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i], {}, 'tapped');
    const next = { ...counts };
    const c = ((next[i] ?? 0) + 1) % (maxPerCell + 1);
    if (c === 0) delete next[i];
    else next[i] = c;
    commit([], next, 'tapped');
  };

  const readout =
    mode === 'single' ? (sel[0] ? `${cellWord} ${sel[0]}` : '—') : mode === 'multi' ? `${sel.length} chosen` : `${total} ${total === 1 ? countWord : `${countWord}s`}`;

  return (
    <div className={s.wrap}>
      <div className={s.readout} aria-live="polite">
        <span className="eyebrow">Your answer</span>
        <span className={s.readNum}>{readout}</span>
      </div>
      {group && (
        <div className={s.groups} role="group" aria-label={`Choose a ${group.word}`}>
          {Array.from({ length: groups }, (_, g) => (
            <button key={g} type="button" className={s.groupBtn} aria-pressed={g === page} data-has={sel.some((c) => c > g * group.size && c <= (g + 1) * group.size)} onClick={() => setPage(g)}>
              {group.word} {g + 1}
            </button>
          ))}
        </div>
      )}
      <div className={s.grid} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} role="group" aria-label={label}>
        {Array.from({ length: to - from + 1 }, (_, k) => {
          const i = from + k;
          const on = mode === 'count' ? (counts[i] ?? 0) > 0 : sel.includes(i);
          const inGroup = group ? ((i - 1) % group.size) + 1 : i;
          return (
            <button
              key={i}
              type="button"
              className={[s.cell, on && s.on].filter(Boolean).join(' ')}
              aria-pressed={mode === 'count' ? undefined : on}
              aria-label={mode === 'count' ? `${cellWord} ${i}, ${counts[i] ?? 0} ${countWord}s. Tap to add one.` : `${cellWord} ${i}${group ? ` (${group.word} ${Math.floor((i - 1) / group.size) + 1})` : ''}`}
              onClick={() => tap(i)}
            >
              {mode === 'count' ? (
                <>
                  <span>{inGroup}</span>
                  {(counts[i] ?? 0) > 0 && <span className={s.count}>×{counts[i]}</span>}
                </>
              ) : (
                inGroup
              )}
            </button>
          );
        })}
      </div>
      {mode === 'count' && (
        <>
          <p className={s.note}>Tap a day to add one {countWord}. Keep tapping to add more. After {maxPerCell}, it goes back to none.</p>
          {unitPrice !== undefined && (
            <p className={s.readNum} aria-live="polite">
              {total} {countWord}s × ${unitPrice} = ${(total * unitPrice).toLocaleString('en-US')}
            </p>
          )}
          {total > 0 && (
            <Button className={s.clear} variant="ghost" size="sm" onClick={() => commit([], {}, 'tapped')}>
              Clear all
            </Button>
          )}
        </>
      )}
      {mode === 'single' && (
        <NumberField unit={spec.unit} label={`Or type the ${cellWord.toLowerCase()} number`} value={sel[0] ?? null} onType={(n) => onChange({ raw: n, extra: { cells: n === null ? [] : [n] } }, 'typed')} />
      )}
    </div>
  );
}
