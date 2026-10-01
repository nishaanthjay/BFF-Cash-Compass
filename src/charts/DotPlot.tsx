import type { ResponseRow } from '../api/types';
import type { AxisSpec, PredictedCode } from '../items/types';
import { CODES, type Code } from '../items/families';
import { ticks, toFrac } from '../inputs/axis';
import { codesOf, histogram, HISTOGRAM_N, type RecodeMap } from '../lib/analysis';
import { formatAxis, formatUnit } from '../lib/format';
import { chart, color, fontPx } from '../styles/tokens';
import { beeswarm } from './beeswarm';
import { useWidth } from './useWidth';
import s from './charts.module.css';

export type Selection = { label: string; rows: ResponseRow[] };

type Props = {
  rows: ResponseRow[];
  blank: number;
  axis: AxisSpec;
  correct: number | null;
  codes: PredictedCode[];
  rc: RecodeMap;
  onSelect?: (sel: Selection) => void;
};

const R = 5;
const PAD_X = 24;
const TOP = 46; // room for staggered reference labels

type Cls = 'corr' | 'wrong' | 'unk';
const cls = (codes: Code[]): Cls => (codes.includes('CORR') ? 'corr' : codes.some((c) => c !== 'UNK') ? 'wrong' : 'unk');
const FILL: Record<Cls, string> = { corr: chart.correct, wrong: chart.wrong, unk: chart.unk };

/**
 * Raw-dots-first distribution (beeswarm), with the correct value (solid) and the
 * predicted wrong values (dashed, labelled) as reference lines and ±1% bands.
 * Switches to a histogram above HISTOGRAM_N answers (pooled views).
 */
export function DotPlot({ rows, blank, axis, correct, codes, rc, onSelect }: Props) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const vals = rows.filter((r) => r.raw_value !== null);
  const x = (v: number) => PAD_X + toFrac(v, axis) * (w - 2 * PAD_X);
  const useHist = vals.length > HISTOGRAM_N;

  const xs = vals.map((r) => x(r.raw_value as number));
  const ys = useHist ? [] : beeswarm(xs, R);
  const spread = Math.max(R * 2, ...ys.map((y) => Math.abs(y) + R + 2));
  const bins = useHist ? histogram(vals.map((r) => r.raw_value as number), axis.min, axis.max, Math.min(40, Math.floor(w / 14)), axis.scale === 'log') : [];
  const maxBin = Math.max(1, ...bins.map((b) => b.n));
  const plotH = useHist ? 140 : Math.min(260, spread * 2 + 12);
  const mid = TOP + plotH / 2;
  const base = TOP + plotH;
  const H = base + 40;
  const below = vals.filter((r) => (r.raw_value as number) < axis.min).length;
  const above = vals.filter((r) => (r.raw_value as number) > axis.max).length;

  // Reference lines: correct + each distinct predicted value, labels staggered on 2 rows.
  const refs = [
    ...(correct !== null ? [{ code: 'CORR' as Code, value: correct, tol: 1 }] : []),
    ...codes.map((c) => ({ code: c.code, value: c.value, tol: c.tolPct ?? 1 })),
  ]
    .filter((r) => r.value >= axis.min && r.value <= axis.max)
    .sort((a, b) => a.value - b.value);

  const select = (code: Code, value: number) => {
    if (!onSelect) return;
    const hit = rows.filter((r) => codesOf(r, rc).includes(code) && (code === 'CORR' || Math.abs((r.raw_value ?? NaN) - value) <= Math.abs(value) * 0.011 + 0.01));
    onSelect({ label: `${code === 'CORR' ? 'Correct' : `${code} · ${CODES[code].label}`} (${formatUnit(value, axis.unit)})`, rows: hit });
  };

  const tks = ticks(axis, Math.max(3, Math.floor(w / 80)));
  return (
    <div ref={ref} className={s.wrap}>
      <div className={s.legend} aria-hidden>
        <span className={s.key}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill={chart.correct} /></svg> Correct (±1%)
        </span>
        <span className={s.key}>
          <svg width="12" height="12"><path d="M6 0 L12 6 L6 12 L0 6 Z" fill={chart.wrong} /></svg> Named wrong pattern
        </span>
        <span className={s.key}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="none" stroke={color.mutedStrong} strokeWidth="1.8" /></svg> Unclassified
        </span>
      </div>
      <svg className={s.svg} width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`Distribution of ${vals.length} answers${axis.scale === 'log' ? ' on a log scale' : ''}.`}>
        {refs.map((r, i) => {
          const rx = x(r.value);
          const lo = x(Math.max(axis.min, r.value * (1 - r.tol / 100)));
          const hi = x(Math.min(axis.max, r.value * (1 + r.tol / 100)));
          const corr = r.code === 'CORR';
          const ly = i % 2 ? 30 : 14;
          return (
            <g key={`${r.code}-${r.value}`}>
              <rect x={Math.min(lo, rx - 3)} y={TOP - 4} width={Math.max(6, hi - lo)} height={plotH + 8} fill={corr ? chart.bandCorrect : chart.band} pointerEvents="none" />
              {onSelect && (
                <rect
                  className={s.band}
                  x={rx - 11}
                  y={TOP - 4}
                  width={22}
                  height={plotH + 8}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`List students near ${formatUnit(r.value, axis.unit)} (${r.code})`}
                  onClick={() => select(r.code, r.value)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && select(r.code, r.value)}
                />
              )}
              <line pointerEvents="none" x1={rx} x2={rx} y1={ly + 4} y2={base} stroke={corr ? color.foreground : chart.wrong} strokeWidth={corr ? 2.5 : 2} strokeDasharray={corr ? undefined : '5 4'} />
              <text pointerEvents="none" className={s.refLabel} x={rx} y={ly} textAnchor="middle" fontSize={fontPx.xs} fill={color.foreground}>
                {corr ? `✓ ${formatUnit(r.value, axis.unit)}` : `${r.code} ${formatUnit(r.value, axis.unit)}`}
              </text>
            </g>
          );
        })}
        <line x1={PAD_X} x2={w - PAD_X} y1={base} y2={base} stroke={color.foreground} strokeWidth={1.5} />
        {tks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={base} y2={base + 5} stroke={chart.axis} />
            <text className={s.tick} x={x(t)} y={base + 18} textAnchor="middle" fontSize={fontPx.xs}>
              {formatAxis(t, axis.unit)}
            </text>
          </g>
        ))}
        {axis.scale === 'log' && (
          <text className={s.tick} x={w - PAD_X} y={base + 34} textAnchor="end" fontSize={fontPx.xs}>
            log scale
          </text>
        )}
        <g className={s.dots}>
        {useHist
          ? bins.map((b, i) => {
              const bh = (b.n / maxBin) * (plotH - 6);
              const x0 = x(b.x0);
              const x1 = x(b.x1);
              return b.n ? <rect key={i} x={x0 + 1} y={base - bh} width={Math.max(1, x1 - x0 - 2)} height={bh} rx={2} fill={chart.axis} /> : null;
            })
          : vals.map((r, i) => {
              const c = cls(codesOf(r, rc));
              const cx = xs[i];
              const cy = mid + ys[i];
              return c === 'wrong' ? (
                <path key={r.answer_id} d={`M ${cx} ${cy - R - 1} L ${cx + R + 1} ${cy} L ${cx} ${cy + R + 1} L ${cx - R - 1} ${cy} Z`} fill={FILL[c]} stroke={color.card} strokeWidth={1} />
              ) : c === 'unk' ? (
                <circle key={r.answer_id} cx={cx} cy={cy} r={R - 0.5} fill={color.card} stroke={color.mutedStrong} strokeWidth={1.8} />
              ) : (
                <circle key={r.answer_id} cx={cx} cy={cy} r={R} fill={FILL[c]} stroke={color.card} strokeWidth={1} />
              );
            })}
        </g>
        {below > 0 && (
          <text className={s.refLabel} x={PAD_X} y={base - 6} fontSize={fontPx.xs} fill={color.foreground}>
            ◂ {below} below
          </text>
        )}
        {above > 0 && (
          <text className={s.refLabel} x={w - PAD_X} y={base - 6} textAnchor="end" fontSize={fontPx.xs} fill={color.foreground}>
            {above} above ▸
          </text>
        )}
      </svg>
      <p className={s.note}>
        n = {vals.length}
        {blank ? `, ${blank} blank` : ''}
        {useHist ? ` · histogram of all answers (n > ${HISTOGRAM_N}); reference lines still mark each pattern` : ' · one dot per student'}
        {onSelect ? ' · click a band to list student codes' : ''}
      </p>
    </div>
  );
}
