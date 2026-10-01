import type { ResponseRow } from '../api/types';
import type { AxisSpec } from '../items/types';
import { ticks, toFrac } from '../inputs/axis';
import { boxStats, ecdf, type Bias, type TrendPoint } from '../lib/crossItem';
import { formatAxis, formatUnit } from '../lib/format';
import { chart, color, fontPx } from '../styles/tokens';
import { useWidth } from './useWidth';
import s from './charts.module.css';

const PAD_X = 28;

function XAxis({ axis, w, y }: { axis: AxisSpec; w: number; y: number }) {
  const x = (v: number) => PAD_X + toFrac(v, axis) * (w - 2 * PAD_X);
  return (
    <g>
      <line x1={PAD_X} x2={w - PAD_X} y1={y} y2={y} stroke={color.foreground} strokeWidth={1.5} />
      {ticks(axis, w < 420 ? 4 : 7).map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={y} y2={y + 5} stroke={color.foreground} />
          <text className={s.tick} x={x(t)} y={y + 19} textAnchor="middle" fontSize={fontPx.xs}>
            {formatAxis(t, axis.unit)}
          </text>
        </g>
      ))}
    </g>
  );
}

const inAxis = (rows: ResponseRow[], axis: AxisSpec) => rows.filter((r) => r.raw_value !== null).map((r) => Math.min(axis.max, Math.max(axis.min, r.raw_value as number)));

/** Cumulative distribution: read off "what share of students answered at or below this?". */
export function Ecdf({ rows, axis, correct }: { rows: ResponseRow[]; axis: AxisSpec; correct: number | null }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const H = 260;
  const T = 16;
  const B = 36;
  const pts = ecdf(inAxis(rows, axis));
  const x = (v: number) => PAD_X + toFrac(v, axis) * (w - 2 * PAD_X);
  const y = (p: number) => T + (1 - p) * (H - T - B);
  const path = pts.length
    ? `M ${x(axis.min)} ${y(0)} ` + pts.map((q, i) => `L ${x(q.x)} ${y(i === 0 ? 0 : pts[i - 1].p)} L ${x(q.x)} ${y(q.p)}`).join(' ') + ` L ${x(axis.max)} ${y(1)}`
    : '';
  const below = correct !== null && pts.length ? pts.filter((q) => q.x < correct * 0.99).length / pts.length : null;
  return (
    <div ref={ref} className={s.wrap}>
      <svg className={s.svg} width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`Cumulative share of answers by value${below !== null ? `; ${Math.round(below * 100)}% answered below the correct value` : ''}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={PAD_X} x2={w - PAD_X} y1={y(g)} y2={y(g)} stroke={chart.grid} />
            <text className={s.tick} x={PAD_X - 6} y={y(g) + 4} textAnchor="end" fontSize={fontPx.xs}>
              {Math.round(g * 100)}%
            </text>
          </g>
        ))}
        {correct !== null && correct >= axis.min && correct <= axis.max && (
          <g>
            <line x1={x(correct)} x2={x(correct)} y1={T} y2={H - B} stroke={color.foreground} strokeWidth={2.5} />
            <text className={s.refLabel} x={x(correct) + 5} y={T + 12} fontSize={fontPx.xs} fill={color.foreground}>
              ✓ {formatUnit(correct, axis.unit)}
            </text>
          </g>
        )}
        <path d={path} fill="none" stroke={chart.correct} strokeWidth={3} strokeLinejoin="round" />
        <XAxis axis={axis} w={w} y={H - B} />
      </svg>
      {below !== null && <p className={s.note}>{Math.round(below * 100)}% of students answered below the correct value.</p>}
    </div>
  );
}

/** Horizontal box plot: box = middle half of students, whiskers = 10th to 90th percentile. */
export function BoxPlot({ rows, axis, correct }: { rows: ResponseRow[]; axis: AxisSpec; correct: number | null }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const b = boxStats(inAxis(rows, axis));
  const H = 130;
  const mid = 52;
  const x = (v: number) => PAD_X + toFrac(v, axis) * (w - 2 * PAD_X);
  if (!b) return <p className={s.note}>Not enough answers yet (needs 5).</p>;
  return (
    <div ref={ref} className={s.wrap}>
      <svg className={s.svg} width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`Box plot. Median ${formatUnit(b.median, axis.unit)}, middle half ${formatUnit(b.q1, axis.unit)} to ${formatUnit(b.q3, axis.unit)}`}>
        <line x1={x(b.p10)} x2={x(b.p90)} y1={mid} y2={mid} stroke={color.foreground} strokeWidth={2} />
        {[b.p10, b.p90].map((v) => (
          <line key={v} x1={x(v)} x2={x(v)} y1={mid - 10} y2={mid + 10} stroke={color.foreground} strokeWidth={2} />
        ))}
        <rect x={x(b.q1)} y={mid - 18} width={Math.max(2, x(b.q3) - x(b.q1))} height={36} fill={color.primarySoft} stroke={color.foreground} strokeWidth={2} rx={6} />
        <line x1={x(b.median)} x2={x(b.median)} y1={mid - 18} y2={mid + 18} stroke={color.foreground} strokeWidth={4} />
        <text className={s.refLabel} x={x(b.median)} y={mid + 36} textAnchor="middle" fontSize={fontPx.xs} fill={color.foreground}>
          median {formatUnit(b.median, axis.unit)}
        </text>
        {correct !== null && correct >= axis.min && correct <= axis.max && (
          <g>
            <line x1={x(correct)} x2={x(correct)} y1={14} y2={mid + 30} stroke={chart.wrong} strokeWidth={2.5} strokeDasharray="5 4" />
            <text className={s.refLabel} x={x(correct)} y={11} textAnchor="middle" fontSize={fontPx.xs} fill={color.foreground}>
              ✓ {formatUnit(correct, axis.unit)}
            </text>
          </g>
        )}
        <XAxis axis={axis} w={w} y={H - 28} />
      </svg>
      <p className={s.note}>n = {b.n}. Box = middle half of students; whiskers = 10th to 90th percentile.</p>
    </div>
  );
}

/** Diverging bars: which way students miss. Left of zero = guess low, right = guess high; each gridline is 10× too far. */
export function BiasBars({ items }: { items: Bias[] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const rowH = 30;
  const L = Math.min(190, w * 0.38);
  const lim = Math.max(0.15, ...items.map((i) => Math.abs(i.value) * 1.15));
  const x = (v: number) => L + ((v + lim) / (2 * lim)) * (w - L - 16);
  const H = items.length * rowH + 36;
  if (!items.length) return <p className={s.note}>Not enough numeric answers yet.</p>;
  return (
    <div ref={ref} className={s.wrap}>
      <svg className={s.svg} width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`Typical miss by problem: ${items.map((i) => `${i.id} ${i.value < 0 ? 'low' : 'high'} by ${Math.round(10 ** Math.abs(i.value) * 100) / 100} times`).join(', ')}`}>
        <line x1={x(0)} x2={x(0)} y1={0} y2={H - 24} stroke={color.foreground} strokeWidth={2} />
        {items.map((it, i) => {
          const y = i * rowH + 4;
          const x0 = x(0);
          const x1 = x(it.value);
          return (
            <g key={it.id}>
              <text className={s.tick} x={L - 8} y={y + 18} textAnchor="end" fontSize={fontPx.xs} fill={color.foreground}>
                {it.id} · {it.title.length > 22 && w < 520 ? `${it.title.slice(0, 20)}…` : it.title}
              </text>
              <rect x={Math.min(x0, x1)} y={y + 4} width={Math.max(2, Math.abs(x1 - x0))} height={18} fill={it.value < 0 ? chart.wrong : chart.correct} stroke={color.foreground} strokeWidth={1.5} rx={4} />
              <text className={s.refLabel} x={it.value < 0 ? x1 - 5 : x1 + 5} y={y + 18} textAnchor={it.value < 0 ? 'end' : 'start'} fontSize={fontPx.xs} fill={color.foreground}>
                {it.value < 0 ? '÷' : '×'}
                {Math.round(10 ** Math.abs(it.value) * 100) / 100}
              </text>
            </g>
          );
        })}
        <text className={s.tick} x={L} y={H - 6} fontSize={fontPx.xs}>
          ◂ guess too low
        </text>
        <text className={s.tick} x={w - 16} y={H - 6} textAnchor="end" fontSize={fontPx.xs}>
          guess too high ▸
        </text>
      </svg>
      <p className={s.note}>Median of answer ÷ correct value on each problem’s first question. “×3” = the typical answer is 3 times too high.</p>
    </div>
  );
}

/** Line chart: share correct per workshop, oldest to newest. */
export function TrendLine({ points }: { points: TrendPoint[] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const H = 240;
  const T = 20;
  const B = 44;
  const shown = points.filter((p) => p.value !== null);
  const x = (i: number) => PAD_X + 14 + (shown.length < 2 ? (w - 2 * PAD_X - 28) / 2 : (i / (shown.length - 1)) * (w - 2 * PAD_X - 28));
  const y = (v: number) => T + (1 - v) * (H - T - B);
  if (!shown.length) return <p className={s.note}>Not enough workshops yet.</p>;
  return (
    <div ref={ref} className={s.wrap}>
      <svg className={s.svg} width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`Share correct by workshop: ${shown.map((p) => `${p.label} ${Math.round((p.value as number) * 100)}%`).join(', ')}`}>
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={PAD_X} x2={w - PAD_X} y1={y(g)} y2={y(g)} stroke={chart.grid} />
            <text className={s.tick} x={PAD_X - 6} y={y(g) + 4} textAnchor="end" fontSize={fontPx.xs}>
              {Math.round(g * 100)}%
            </text>
          </g>
        ))}
        <polyline points={shown.map((p, i) => `${x(i)},${y(p.value as number)}`).join(' ')} fill="none" stroke={chart.correct} strokeWidth={3} strokeLinejoin="round" />
        {shown.map((p, i) => (
          <g key={`${p.label}-${i}`}>
            <circle cx={x(i)} cy={y(p.value as number)} r={6} fill={chart.correct} stroke={color.foreground} strokeWidth={2} />
            <text className={s.refLabel} x={x(i)} y={y(p.value as number) - 11} textAnchor="middle" fontSize={fontPx.xs} fill={color.foreground}>
              {Math.round((p.value as number) * 100)}%
            </text>
            <text className={s.tick} x={x(i)} y={H - 24} textAnchor="middle" fontSize={fontPx.xs} fill={color.foreground}>
              {p.label}
            </text>
            <text className={s.tick} x={x(i)} y={H - 9} textAnchor="middle" fontSize={fontPx.xs}>
              n={p.n}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Lollipop chart: one value per row (used for median seconds per problem). */
export function Lollipops({ rows, unit, max }: { rows: { label: string; v: number }[]; unit: string; max?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const rowH = 28;
  const L = Math.min(210, w * 0.4);
  const top = max ?? Math.max(1, ...rows.map((r) => r.v));
  const x = (v: number) => L + (v / top) * (w - L - 56);
  if (!rows.length) return <p className={s.note}>Not enough answers yet.</p>;
  return (
    <div ref={ref} className={s.wrap}>
      <svg className={s.svg} width={w} height={rows.length * rowH + 8} viewBox={`0 0 ${w} ${rows.length * rowH + 8}`} role="img" aria-label={rows.map((r) => `${r.label} ${r.v} ${unit}`).join(', ')}>
        {rows.map((r, i) => {
          const y = i * rowH + 16;
          return (
            <g key={r.label}>
              <text className={s.tick} x={L - 8} y={y + 4} textAnchor="end" fontSize={fontPx.xs} fill={color.foreground}>
                {r.label}
              </text>
              <line x1={L} x2={x(r.v)} y1={y} y2={y} stroke={color.foreground} strokeWidth={2} />
              <circle cx={x(r.v)} cy={y} r={7} fill={chart.correct} stroke={color.foreground} strokeWidth={2} />
              <text className={s.refLabel} x={x(r.v) + 12} y={y + 4} fontSize={fontPx.xs} fill={color.foreground}>
                {r.v}
                {unit}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
