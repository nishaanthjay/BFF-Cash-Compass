import type { Unit } from '../items/types';
import { formatAxis, formatUnit } from '../lib/format';
import type { CurvePts } from '../lib/analysis';
import { chart, color, fontPx } from '../styles/tokens';
import { useWidth } from './useWidth';
import s from './charts.module.css';

type Props = {
  curves: CurvePts[];
  start: number;
  xMax: number;
  yMax: number;
  midX: number;
  linear: [number, number];
  truth: [number, number];
  unit: Unit;
  blank: number;
};

const H = 300;
const L = 52;
const R = 90;
const T = 16;
const B = 36;

/** Every student's growth curve as a thin line, with linear growth and true compounding as reference lines. */
export function Spaghetti({ curves, start, xMax, yMax, midX, linear, truth, unit, blank }: Props) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const x = (v: number) => L + (v / xMax) * (w - L - R);
  const y = (v: number) => T + (1 - Math.min(yMax, Math.max(0, v)) / yMax) * (H - T - B);
  const path = (pts: [number, number][]) => pts.map(([a, b]) => `${x(a)},${y(b)}`).join(' ');
  const yt = [0, yMax / 4, yMax / 2, (yMax * 3) / 4, yMax];
  return (
    <div ref={ref} className={s.wrap}>
      <div className={s.legend} aria-hidden>
        <span className={s.key}>
          <svg width="22" height="10"><line x1="0" y1="5" x2="22" y2="5" stroke={chart.axis} strokeWidth="2" opacity="0.7" /></svg> One student
        </span>
        <span className={s.key}>
          <svg width="22" height="10"><line x1="0" y1="5" x2="22" y2="5" stroke={color.foreground} strokeWidth="3" /></svg> True compounding
        </span>
        <span className={s.key}>
          <svg width="22" height="10"><line x1="0" y1="5" x2="22" y2="5" stroke={chart.wrong} strokeWidth="2.5" strokeDasharray="5 3" /></svg> Linear growth
        </span>
      </div>
      <svg className={s.svg} width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`${curves.length} growth curves. True value at year ${xMax}: ${formatUnit(truth[1], unit)}. Linear: ${formatUnit(linear[1], unit)}.`}>
        {yt.map((t) => (
          <g key={t}>
            <line x1={L} x2={w - R} y1={y(t)} y2={y(t)} stroke={chart.grid} />
            <text className={s.tick} x={L - 6} y={y(t) + 4} textAnchor="end" fontSize={fontPx.xs}>
              {formatAxis(t, unit)}
            </text>
          </g>
        ))}
        {[0, midX, xMax].map((t) => (
          <text key={t} className={s.tick} x={x(t)} y={H - B + 18} textAnchor="middle" fontSize={fontPx.xs}>
            {t}
          </text>
        ))}
        <text className={s.tick} x={(L + w - R) / 2} y={H - 4} textAnchor="middle" fontSize={fontPx.xs}>
          Years
        </text>
        <line x1={L} x2={w - R} y1={H - B} y2={H - B} stroke={color.foreground} strokeWidth={1.5} />
        {curves.map((c) => (
          <polyline key={c.key} points={path([[0, start], ...(c.y5 !== null ? ([[midX, c.y5]] as [number, number][]) : []), [xMax, c.y10]])} fill="none" stroke={chart.axis} strokeOpacity={0.35} strokeWidth={1.6} strokeLinejoin="round" />
        ))}
        <polyline points={path([[0, start], [midX, linear[0]], [xMax, linear[1]]])} fill="none" stroke={chart.wrong} strokeWidth={2.5} strokeDasharray="6 4" />
        <polyline points={path([[0, start], [midX, truth[0]], [xMax, truth[1]]])} fill="none" stroke={color.foreground} strokeWidth={3} />
        <text className={s.refLabel} x={x(xMax) + 8} y={y(truth[1]) + 4} fontSize={fontPx.xs} fill={color.foreground}>
          ✓ {formatUnit(truth[1], unit)}
        </text>
        <text className={s.refLabel} x={x(xMax) + 8} y={y(linear[1]) + 4} fontSize={fontPx.xs} fill={color.foreground}>
          Linear {formatUnit(linear[1], unit)}
        </text>
      </svg>
      <p className={s.note}>
        n = {curves.length}
        {blank ? `, ${blank} blank` : ''} · curves with no year-5 point are drawn straight
      </p>
    </div>
  );
}
