import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { AxisSpec } from '../items/types';
import { formatAxis, formatUnit } from '../lib/format';
import { color, fontPx } from '../styles/tokens';
import { NumberField } from './NumberField';
import { fromFrac, snap, ticks, toFrac } from './axis';
import type { OnValue, StepValue } from './types';
import s from './JarInput.module.css';

const W = 250;
const H = 280;
const TOP = 24;
const BOT = H - 16;
const INK = color.foreground;

/**
 * C5 fillable jar. The fill line appears where the student first taps and can be
 * dragged. Axis is fixed per item (log if it spans orders of magnitude). A typed
 * box is always available and stays in sync. No default level.
 */
export function JarInput({ axis, value, onChange, label }: { axis: AxisSpec; value: StepValue; onChange: OnValue; label: string }) {
  const gesture = useRef<{ moved: boolean; last: number } | null>(null);
  const v = value.raw;
  const yOf = (val: number) => BOT - toFrac(val, axis) * (BOT - TOP);
  const fromPointer = (e: PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const py = ((e.clientY - r.top) / r.height) * H;
    return snap(fromFrac((BOT - py) / (BOT - TOP), axis), axis);
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = { moved: false, last: fromPointer(e) };
    onChange({ raw: gesture.current.last }, null);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current) return;
    gesture.current.moved = true;
    gesture.current.last = fromPointer(e);
    onChange({ raw: gesture.current.last }, null);
  };
  const onUp = () => {
    if (!gesture.current) return;
    onChange({ raw: gesture.current.last }, gesture.current.moved ? 'dragged' : 'tapped');
    gesture.current = null;
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (v === null) return;
    const dir = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = axis.scale === 'log' ? v * (dir > 0 ? 1.02 : 1 / 1.02) : v + (dir * (axis.max - axis.min)) / 100;
    onChange({ raw: snap(Math.min(axis.max, Math.max(axis.min, next)), axis) }, 'dragged');
  };
  const fillY = v === null ? BOT : Math.min(BOT, Math.max(TOP, yOf(v)));
  const tks = ticks(axis, 6);
  const jar = `M 38 ${TOP} L 38 ${BOT - 14} Q 38 ${BOT} 54 ${BOT} L 146 ${BOT} Q 162 ${BOT} 162 ${BOT - 14} L 162 ${TOP}`;

  return (
    <div className={s.wrap}>
      <div className={s.row}>
        <div
          className={s.jarBox}
          role="slider"
          tabIndex={0}
          aria-label={`${label}. Tap the jar to set the fill line, or type it below.`}
          aria-orientation="vertical"
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
          <svg className={s.svg} viewBox={`0 0 ${W} ${H}`} aria-hidden>
            <defs>
              <clipPath id="jarclip">
                <path d={`${jar} Z`} />
              </clipPath>
            </defs>
            {v !== null && <rect x={30} y={fillY} width={140} height={BOT - fillY + 2} fill={color.tertiary} clipPath="url(#jarclip)" />}
            {v !== null && <line x1={30} x2={170} y1={fillY} y2={fillY} stroke={INK} strokeWidth={3} clipPath="url(#jarclip)" />}
            <path d={jar} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
            {tks.map((t) => (
              <g key={t}>
                <line x1={162} x2={172} y1={yOf(t)} y2={yOf(t)} stroke={INK} strokeWidth={2} />
                <text className={s.tickLabel} x={176} y={yOf(t) + 4} fontSize={fontPx.xs}>
                  {formatAxis(t, axis.unit)}
                </text>
              </g>
            ))}
            {v === null && (
              <text className={s.hint} x={100} y={H / 2} textAnchor="middle" fontSize={fontPx.sm}>
                Tap the jar
              </text>
            )}
          </svg>
        </div>
        <div className={s.side}>
          {v !== null && (
            <p className={`${s.bubble} ${s.big}`}>
              {formatUnit(v, axis.unit)}
            </p>
          )}
          {axis.scale === 'log' && <p className={s.note}>The jar stretches: each step up is bigger than the one before.</p>}
          <NumberField unit={axis.unit} value={v} onType={(n) => onChange({ raw: n }, 'typed')} />
        </div>
      </div>
    </div>
  );
}
