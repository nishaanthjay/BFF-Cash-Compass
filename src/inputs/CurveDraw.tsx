import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Unit } from '../items/types';
import { formatAxis, formatUnit } from '../lib/format';
import { color, fontPx } from '../styles/tokens';
import { NumberField } from './NumberField';
import { snap } from './axis';
import type { OnValue, StepValue } from './types';
import s from './CurveDraw.module.css';

type Spec = { xMax: number; yMax: number; start: number; midX: number; unit: Unit };
const W = 340;
const H = 250;
const L = 52;
const R = 16;
const T = 18;
const B = 40;
const INK = color.foreground;

export type CurvePoints = { y5: number | null; y10: number | null };
export const curveOf = (v: StepValue): CurvePoints => ({
  y5: typeof v.extra?.y5 === 'number' ? (v.extra.y5 as number) : null,
  y10: typeof v.extra?.y10 === 'number' ? (v.extra.y10 as number) : v.raw,
});

/**
 * C2 draw-your-curve. The year-0 value is fixed. The student places a year-10 point
 * (required) and, optionally, a year-5 point. Straight segments join the points, no
 * smoothing. The typed box edits the year-10 value.
 */
export function CurveDraw({ spec, value, onChange, label }: { spec: Spec; value: StepValue; onChange: OnValue; label: string }) {
  const [active, setActive] = useState<'y10' | 'y5'>('y10');
  const gesture = useRef<{ moved: boolean; pts: CurvePoints } | null>(null);
  const pts = curveOf(value);
  const x = (yr: number) => L + (yr / spec.xMax) * (W - L - R);
  const y = (val: number) => T + (1 - Math.min(spec.yMax, Math.max(0, val)) / spec.yMax) * (H - T - B);
  const axisY = { min: 0, max: spec.yMax, scale: 'linear' as const, unit: spec.unit };

  const emit = (p: CurvePoints, method: Parameters<OnValue>[1]) => onChange({ raw: p.y10, extra: { y5: p.y5, y10: p.y10 } }, method);
  const valueAt = (e: PointerEvent): number => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const py = ((e.clientY - r.top) / r.height) * H;
    return snap(Math.min(spec.yMax, Math.max(0, ((H - B - py) / (H - T - B)) * spec.yMax)), axisY);
  };
  const withPoint = (val: number): CurvePoints => (active === 'y10' ? { ...pts, y10: val } : { ...pts, y5: val });

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const next = withPoint(valueAt(e));
    gesture.current = { moved: false, pts: next };
    emit(next, null);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current) return;
    gesture.current.moved = true;
    gesture.current.pts = withPoint(valueAt(e));
    emit(gesture.current.pts, null);
  };
  const onUp = () => {
    if (!gesture.current) return;
    emit(gesture.current.pts, gesture.current.moved ? 'dragged' : 'tapped');
    gesture.current = null;
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = pts[active];
    if (cur === null) return;
    const d = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = Math.min(spec.yMax, Math.max(0, cur + (d * spec.yMax) / 100));
    emit(active === 'y10' ? { ...pts, y10: next } : { ...pts, y5: next }, 'dragged');
  };

  const line: [number, number][] = [[0, spec.start], ...(pts.y5 !== null ? ([[spec.midX, pts.y5]] as [number, number][]) : []), ...(pts.y10 !== null ? ([[spec.xMax, pts.y10]] as [number, number][]) : [])];
  const ticksY = [0, spec.yMax / 4, spec.yMax / 2, (spec.yMax * 3) / 4, spec.yMax];
  const label5 = pts.y5 !== null ? formatUnit(pts.y5, spec.unit) : null;
  const label10 = pts.y10 !== null ? formatUnit(pts.y10, spec.unit) : null;

  return (
    <div className={s.wrap}>
      <div className={s.pick} role="group" aria-label="Which point are you placing?">
        <button type="button" className={s.pickBtn} aria-pressed={active === 'y10'} onClick={() => setActive('y10')}>
          Year {spec.xMax} point
        </button>
        <button type="button" className={s.pickBtn} aria-pressed={active === 'y5'} onClick={() => setActive('y5')}>
          Year {spec.midX} point (optional)
        </button>
      </div>
      <div
        className={s.graph}
        role="slider"
        tabIndex={0}
        aria-label={`${label}. Choose a point above, then tap the graph. Or type the year ${spec.xMax} value below.`}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={spec.yMax}
        aria-valuenow={pts[active] ?? undefined}
        aria-valuetext={pts[active] === null ? `No year ${active === 'y10' ? spec.xMax : spec.midX} point yet` : formatUnit(pts[active] as number, spec.unit)}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <svg className={s.svg} viewBox={`0 0 ${W} ${H}`} aria-hidden>
          {ticksY.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={color.border} strokeWidth={1} />
              <text className={s.tickLabel} x={L - 6} y={y(t) + 4} textAnchor="end" fontSize={fontPx.xs}>
                {formatAxis(t, spec.unit)}
              </text>
            </g>
          ))}
          {[0, spec.midX, spec.xMax].map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={H - B} y2={H - B + 5} stroke={INK} strokeWidth={2} />
              <text className={s.tickLabel} x={x(t)} y={H - B + 19} textAnchor="middle" fontSize={fontPx.xs}>
                {t}
              </text>
            </g>
          ))}
          <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={INK} strokeWidth={2.5} />
          <line x1={L} x2={L} y1={T} y2={H - B} stroke={INK} strokeWidth={2.5} />
          <text className={s.axisTitle} x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize={fontPx.sm}>
            Years
          </text>
          {line.length > 1 && <polyline points={line.map(([a, b]) => `${x(a)},${y(b)}`).join(' ')} fill="none" stroke={color.primary} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />}
          <circle cx={x(0)} cy={y(spec.start)} r={7} fill={color.tertiary} stroke={INK} strokeWidth={3} />
          <text className={s.pointLabel} x={x(0) + 12} y={y(spec.start) + 22} fontSize={fontPx.sm} fill={INK}>
            {formatUnit(spec.start, spec.unit)}
          </text>
          {pts.y5 !== null && (
            <g>
              <circle cx={x(spec.midX)} cy={y(pts.y5)} r={8} fill={color.card} stroke={INK} strokeWidth={3} />
              <text className={s.pointLabel} x={x(spec.midX)} y={y(pts.y5) - 14} textAnchor="middle" fontSize={fontPx.sm} fill={INK}>
                {label5}
              </text>
            </g>
          )}
          {pts.y10 !== null && (
            <g>
              <circle cx={x(spec.xMax)} cy={y(pts.y10)} r={9} fill={color.primary} stroke={INK} strokeWidth={3} />
              <text className={s.pointLabel} x={x(spec.xMax) - 10} y={y(pts.y10) - 14} textAnchor="end" fontSize={fontPx.sm} fill={INK}>
                {label10}
              </text>
            </g>
          )}
          {pts.y10 === null && pts.y5 === null && (
            <text className={s.hint} x={(L + W - R) / 2} y={(T + H - B) / 2} textAnchor="middle" fontSize={fontPx.sm}>
              Tap the graph to place the point
            </text>
          )}
        </svg>
      </div>
      <p className={s.note}>The yellow dot is where the money starts. Your line is drawn straight between your points.</p>
      <NumberField
        unit={spec.unit}
        label={`Or type the year ${spec.xMax} value`}
        value={pts.y10}
        onType={(n) => emit({ ...pts, y10: n }, 'typed')}
      />
    </div>
  );
}
