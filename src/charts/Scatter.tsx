import type { AxisSpec } from '../items/types';
import { toFrac, ticks } from '../inputs/axis';
import { formatAxis } from '../lib/format';
import type { XY } from '../lib/analysis';
import { hashString } from '../lib/rng';
import { chart, color, fontPx } from '../styles/tokens';
import { useWidth } from './useWidth';
import s from './charts.module.css';

type XCfg = { kind: 'num'; axis: AxisSpec } | { kind: 'cat'; labels: [string, string] };
type Props = {
  points: XY[];
  x: XCfg;
  y: AxisSpec;
  diagonal?: boolean;
  refX?: number;
  refY?: number;
  showBelief?: boolean;
  yLabel: string;
  xLabel: string;
  showCodes: boolean;
};

const H = 300;
const L = 56;
const R = 20;
const T = 30;
const B = 48;
const RAD = 5;

/** Two-step scatter (numeric or two-column x). Diamonds mark students who still believe the claim. */
export function Scatter({ points, x, y, diagonal, refX, refY, showBelief, yLabel, xLabel, showCodes }: Props) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const px = (v: number) => (x.kind === 'num' ? L + toFrac(v, x.axis) * (w - L - R) : 0);
  const py = (v: number) => T + (1 - toFrac(v, y)) * (H - T - B);
  const catX = (p: XY) => {
    const col = p.xCorrect ? 1 : 0;
    const jitter = ((hashString(p.key) % 1000) / 1000 - 0.5) * 0.5;
    return L + ((col + 0.5 + jitter) / 2) * (w - L - R);
  };
  const pts = points.filter((p) => p.y !== null && (x.kind === 'cat' || p.x !== null));
  const xt = x.kind === 'num' ? ticks(x.axis, Math.max(3, Math.floor(w / 90))) : [];
  const yt = ticks(y, 6);
  return (
    <div ref={ref} className={s.wrap}>
      <svg className={s.svg} width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`${yLabel} against ${xLabel}, ${pts.length} students`}>
        {yt.map((t) => (
          <g key={t}>
            <line x1={L} x2={w - R} y1={py(t)} y2={py(t)} stroke={chart.grid} />
            <text className={s.tick} x={L - 6} y={py(t) + 4} textAnchor="end" fontSize={fontPx.xs}>
              {formatAxis(t, y.unit)}
            </text>
          </g>
        ))}
        <line x1={L} x2={w - R} y1={H - B} y2={H - B} stroke={color.foreground} strokeWidth={1.5} />
        {x.kind === 'num'
          ? xt.map((t) => (
              <g key={t}>
                <line x1={px(t)} x2={px(t)} y1={T} y2={H - B} stroke={chart.grid} />
                <text className={s.tick} x={px(t)} y={H - B + 16} textAnchor="middle" fontSize={fontPx.xs}>
                  {formatAxis(t, x.axis.unit)}
                </text>
              </g>
            ))
          : x.labels.map((l, i) => (
              <text key={l} className={s.tick} x={L + ((i + 0.5) / 2) * (w - L - R)} y={H - B + 16} textAnchor="middle" fontSize={fontPx.xs}>
                {l}
              </text>
            ))}
        {x.kind === 'cat' && <line x1={L + (w - L - R) / 2} x2={L + (w - L - R) / 2} y1={T} y2={H - B} stroke={chart.grid} strokeDasharray="3 3" />}
        {diagonal && x.kind === 'num' && <line x1={px(Math.max(x.axis.min, y.min))} y1={py(Math.max(x.axis.min, y.min))} x2={px(Math.min(x.axis.max, y.max))} y2={py(Math.min(x.axis.max, y.max))} stroke={color.foreground} strokeWidth={2} strokeDasharray="6 4" />}
        {refX !== undefined && x.kind === 'num' && (
          <g>
            <line x1={px(refX)} x2={px(refX)} y1={T} y2={H - B} stroke={color.foreground} strokeWidth={2.5} />
            <text className={s.refLabel} x={px(refX) + 4} y={T + 10} fontSize={fontPx.xs} fill={color.foreground}>
              ✓
            </text>
          </g>
        )}
        {refY !== undefined && (
          <g>
            <line x1={L} x2={w - R} y1={py(refY)} y2={py(refY)} stroke={color.foreground} strokeWidth={2.5} />
            <text className={s.refLabel} x={w - R - 4} y={py(refY) - 4} textAnchor="end" fontSize={fontPx.xs} fill={color.foreground}>
              ✓ true value
            </text>
          </g>
        )}
        {pts.map((p) => {
          const cx = x.kind === 'num' ? px(p.x as number) : catX(p);
          const cy = py(p.y as number);
          const title = showCodes ? p.code : 'student';
          return showBelief && p.belief ? (
            <path key={p.key} d={`M ${cx} ${cy - RAD - 1} L ${cx + RAD + 1} ${cy} L ${cx} ${cy + RAD + 1} L ${cx - RAD - 1} ${cy} Z`} fill={chart.wrong} stroke={color.card} strokeWidth={1}>
              <title>{title}</title>
            </path>
          ) : (
            <circle key={p.key} cx={cx} cy={cy} r={RAD} fill={chart.correct} fillOpacity={0.8} stroke={color.card} strokeWidth={1}>
              <title>{title}</title>
            </circle>
          );
        })}
        <text className={s.tick} x={(L + w - R) / 2} y={H - 8} textAnchor="middle" fontSize={fontPx.xs}>
          {xLabel}
        </text>
        <text className={s.tick} x={L} y={T - 14} fontSize={fontPx.xs}>
          {yLabel}
        </text>
      </svg>
      <p className={s.note}>n = {pts.length} students</p>
    </div>
  );
}
