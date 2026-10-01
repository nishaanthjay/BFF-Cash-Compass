import { useLayoutEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import type { AxisSpec } from '../items/types';
import { formatAxis, formatUnit } from '../lib/format';
import { color, fontPx } from '../styles/tokens';
import { NumberField } from './NumberField';
import { fromFrac, snap, ticks, toFrac } from './axis';
import type { OnValue, StepValue } from './types';
import s from './NumberLineInput.module.css';

const H = 112;
const LINE_Y = 70;
const PAD = 22;
const INK = color.foreground;

/**
 * C1 number-line marker. No default: the marker appears where the student first
 * taps. Drag to adjust. The typed box is always available and stays in sync.
 */
export function NumberLineInput({ axis, value, onChange, label }: { axis: AxisSpec; value: StepValue; onChange: OnValue; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(340);
  const gesture = useRef<{ moved: boolean; last: number } | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const x0 = PAD;
  const x1 = w - PAD;
  const xOf = (v: number) => x0 + toFrac(v, axis) * (x1 - x0);
  const v = value.raw;
  const offLow = v !== null && v < axis.min;
  const offHigh = v !== null && v > axis.max;

  const fromPointer = (e: PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = e.clientX - r.left - (r.width - w) / 2;
    return snap(fromFrac((px - x0) / (x1 - x0), axis), axis);
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesture.current = { moved: false, last: fromPointer(e) };
    onChange({ raw: gesture.current.last }, null);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current) return;
    gesture.current.moved = true;
    gesture.current.last = fromPointer(e);
    onChange({ raw: gesture.current.last }, null);
  };
  // One interaction per gesture: a tap, or a drag.
  const onUp = () => {
    if (!gesture.current) return;
    onChange({ raw: gesture.current.last }, gesture.current.moved ? 'dragged' : 'tapped');
    gesture.current = null;
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (v === null) return; // no default: keyboard users type a value first
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = axis.scale === 'log' ? v * (dir > 0 ? 1.02 : 1 / 1.02) : v + dir * (axis.max - axis.min) / 100;
    onChange({ raw: snap(Math.min(axis.max, Math.max(axis.min, next)), axis) }, 'dragged');
  };

  const tks = ticks(axis, Math.max(3, Math.floor(w / 64)));
  const mx = v === null ? 0 : xOf(Math.min(axis.max, Math.max(axis.min, v)));
  const bubbleW = 92;
  const bx = Math.min(Math.max(mx, bubbleW / 2 + 2), w - bubbleW / 2 - 2);

  return (
    <div className={s.wrap}>
      <div
        ref={box}
        className={s.lineBox}
        role="slider"
        tabIndex={0}
        aria-label={`${label}. Tap the line to place your answer, or type it below.`}
        aria-valuemin={axis.min}
        aria-valuemax={axis.max}
        aria-valuenow={v ?? undefined}
        aria-valuetext={v === null ? 'No answer yet' : formatUnit(v, axis.unit)}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <svg className={s.svg} width={w} height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden>
          <line x1={x0} x2={x1} y1={LINE_Y} y2={LINE_Y} stroke={INK} strokeWidth={4} strokeLinecap="round" />
          {tks.map((t) => (
            <g key={t}>
              <line x1={xOf(t)} x2={xOf(t)} y1={LINE_Y - 8} y2={LINE_Y + 8} stroke={INK} strokeWidth={2} />
              <text className={s.tickLabel} x={xOf(t)} y={LINE_Y + 28} textAnchor="middle" fontSize={fontPx.xs}>
                {formatAxis(t, axis.unit)}
              </text>
            </g>
          ))}
          {v === null ? (
            <text className={s.hint} x={w / 2} y={LINE_Y - 22} textAnchor="middle" fontSize={fontPx.sm}>
              Tap anywhere on the line
            </text>
          ) : (
            <g>
              <rect x={bx - bubbleW / 2} y={4} width={bubbleW} height={30} rx={10} fill={color.primary} stroke={INK} strokeWidth={2} />
              <text className={s.bubble} x={bx} y={25} textAnchor="middle" fontSize={fontPx.base} fill={color.primaryForeground}>
                {offLow ? '◂ ' : ''}
                {formatUnit(v, axis.unit)}
                {offHigh ? ' ▸' : ''}
              </text>
              <line x1={mx} x2={mx} y1={34} y2={LINE_Y - 12} stroke={INK} strokeWidth={2.5} />
              <circle cx={mx} cy={LINE_Y} r={12} fill={color.primary} stroke={INK} strokeWidth={3} />
            </g>
          )}
        </svg>
      </div>
      {axis.scale === 'log' && <p className={s.scaleNote}>This line stretches: each step is bigger than the one before.</p>}
      <NumberField unit={axis.unit} value={v} onType={(n) => onChange({ raw: n }, 'typed')} />
    </div>
  );
}
