import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { Unit } from '../items/types';
import { formatUnit } from '../lib/format';
import { NumberField } from './NumberField';
import type { OnValue, StepValue } from './types';
import s from './ShadeBar.module.css';

type Props = {
  whole: number;
  unit: Unit;
  readout: 'usd' | 'pct';
  /** linked: shading IS the answer (raw = dollars). separate: the typed box is the answer, the bar is scratch. */
  typed: 'linked' | 'separate';
  value: StepValue;
  onChange: OnValue;
  label: string;
};

const frac = (v: StepValue) => (typeof v.extra?.fraction === 'number' ? (v.extra.fraction as number) : null);

/** C7 shade bar: shade part of the whole. Snaps to whole percents. Starts empty. */
export function ShadeBar({ whole, unit, readout, typed, value, onChange, label }: Props) {
  const drag = useRef<{ moved: boolean; f: number } | null>(null);
  const f = frac(value);

  const emit = (fraction: number, method: Parameters<OnValue>[1]) => {
    const fr = Math.round(Math.min(1, Math.max(0, fraction)) * 100) / 100;
    onChange(typed === 'linked' ? { raw: Number((fr * whole).toFixed(2)), extra: { fraction: fr } } : { raw: value.raw, extra: { fraction: fr } }, method);
    return fr;
  };
  const at = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return (e.clientX - r.left) / r.width;
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 0.01 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -0.01 : 0;
    if (!d) return;
    e.preventDefault();
    emit((f ?? 0) + d, 'dragged');
  };

  const pct = f === null ? null : Math.round(f * 100);
  return (
    <div className={s.wrap}>
      <div className={s.readout} aria-live="polite">
        <span className="eyebrow">Shaded</span>
        <span className={s.readNum}>
          {pct === null ? '—' : readout === 'pct' ? `${pct}%` : `${pct}% = ${formatUnit((f ?? 0) * whole, unit)}`}
        </span>
      </div>
      <div
        className={s.bar}
        role="slider"
        tabIndex={0}
        aria-label={`${label}. Shade part of the bar. The whole bar is ${formatUnit(whole, unit)}.`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
        aria-valuetext={pct === null ? 'Nothing shaded yet' : `${pct} percent shaded`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { moved: false, f: emit(at(e), null) };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          drag.current.moved = true;
          drag.current.f = emit(at(e), null);
        }}
        onPointerUp={() => {
          if (!drag.current) return;
          emit(drag.current.f, drag.current.moved ? 'dragged' : 'tapped');
          drag.current = null;
        }}
        onKeyDown={onKey}
      >
        {f !== null && <div className={s.fill} style={{ width: `${f * 100}%` }} />}
        <div className={s.grid} aria-hidden>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        {f === null && <span className={s.empty}>Tap or drag to shade</span>}
      </div>
      <div className={s.scale} aria-hidden>
        <span>0</span>
        <span>{formatUnit(whole, unit)}</span>
      </div>
      <NumberField
        unit={unit}
        label={typed === 'linked' ? 'Or type the dollars' : 'Your answer'}
        value={typed === 'linked' ? value.raw : value.raw}
        onType={(n) =>
          onChange(
            typed === 'linked'
              ? { raw: n, extra: { fraction: n === null ? null : Math.min(1, Math.max(0, n / whole)) } }
              : { raw: n, extra: value.extra },
            'typed',
          )
        }
      />
    </div>
  );
}
