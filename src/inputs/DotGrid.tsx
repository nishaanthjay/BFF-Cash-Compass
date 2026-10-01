import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { NumberField } from './NumberField';
import type { OnValue, StepValue } from './types';
import s from './DotGrid.module.css';

type Props = { total: number; columns: number; itemWord: string; value: StepValue; onChange: OnValue; label: string };

/**
 * C5 dot grid. Tap (or drag across) the grid to fill that many items. Starts empty.
 * The whole grid is one slider for keyboards (←/→ ±1, ↑/↓ ±one row); a typed box is always there.
 */
export function DotGrid({ total, columns, itemWord, value, onChange, label }: Props) {
  const gesture = useRef<{ moved: boolean; n: number } | null>(null);
  const n = value.raw;
  const set = (v: number, m: Parameters<OnValue>[1]) => onChange({ raw: Math.min(total, Math.max(0, Math.round(v))) }, m);

  const indexAt = (e: PointerEvent): number | null => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const i = el?.getAttribute?.('data-i');
    return i === null || i === undefined ? null : Number(i);
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const i = indexAt(e);
    if (i === null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    // Tapping the last filled item steps back by one so a mis-tap is easy to fix.
    const next = n === i + 1 ? i : i + 1;
    gesture.current = { moved: false, n: next };
    set(next, null);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current) return;
    const i = indexAt(e);
    if (i === null || gesture.current.n === i + 1) return;
    gesture.current = { moved: true, n: i + 1 };
    set(i + 1, null);
  };
  const onUp = () => {
    if (!gesture.current) return;
    set(gesture.current.n, gesture.current.moved ? 'dragged' : 'tapped');
    gesture.current = null;
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? columns : e.key === 'ArrowUp' ? -columns : 0;
    if (!d) return;
    e.preventDefault();
    set((n ?? 0) + d, 'dragged');
  };

  return (
    <div className={s.wrap}>
      <div className={s.readout} aria-live="polite">
        <span className="eyebrow">Filled</span>
        <span className={s.readNum}>{n === null ? '—' : `${n} of ${total}`}</span>
      </div>
      <div
        className={s.grid}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        role="slider"
        tabIndex={0}
        aria-label={`${label}. Tap the ${itemWord}s to fill them in, or type the number below.`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={n ?? undefined}
        aria-valuetext={n === null ? 'None filled yet' : `${n} of ${total} ${itemWord}s`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        {Array.from({ length: total }, (_, i) => (
          <span key={i} data-i={i} aria-hidden className={[s.dot, total <= 20 && s.round, n !== null && i < n && s.on].filter(Boolean).join(' ')} />
        ))}
      </div>
      <NumberField unit="count" label={`Or type how many ${itemWord}s`} value={n} onType={(v) => (v === null ? onChange({ raw: null }, 'typed') : set(v, 'typed'))} />
    </div>
  );
}
