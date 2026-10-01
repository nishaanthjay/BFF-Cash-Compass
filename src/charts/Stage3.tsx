import type { ResponseRow } from '../api/types';
import type { AxisSpec } from '../items/types';
import { ticks, toFrac } from '../inputs/axis';
import { anchoring, kde, type Anchoring, type PairPattern, type SankeyData } from '../lib/analysis';
import { formatAxis, formatUnit } from '../lib/format';
import { chart, color, fontPx } from '../styles/tokens';
import { beeswarm } from './beeswarm';
import { CountBars } from './Bars';
import { useWidth } from './useWidth';
import s from './charts.module.css';

const pct = (x: number) => `${Math.round(x * 100)}%`;

// ───────────── Sankey (S3) ─────────────

/** Three-column flow. Node height = number of students; flows are gap-separated ribbons. */
export function Sankey({ data }: { data: SankeyData }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const H = 280;
  const T = 26;
  const NODE = 14;
  const colX = (i: number) => 8 + (i * (w - 16 - NODE)) / Math.max(1, data.columns.length - 1);
  const GAP = 8;
  const scale = (H - T - 10 - GAP * 3) / Math.max(1, data.n);
  // node tops
  const tops = data.columns.map((c) => {
    let y = T;
    return c.nodes.map((n) => {
      const top = y;
      y += n.n * scale + GAP;
      return top;
    });
  });
  const toneFill = { corr: chart.correct, wrong: chart.wrong, unk: chart.unk };
  return (
    <div ref={ref} className={s.wrap}>
      <svg className={s.svg} width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`Flow of ${data.n} students across ${data.columns.length} steps`}>
        {data.links.map((lk, ci) => {
          const outUsed = data.columns[ci].nodes.map(() => 0);
          const inUsed = data.columns[ci + 1].nodes.map(() => 0);
          return lk
            .slice()
            .sort((a, b) => a.from - b.from || a.to - b.to)
            .map((l) => {
              const y0 = tops[ci][l.from] + outUsed[l.from];
              const y1 = tops[ci + 1][l.to] + inUsed[l.to];
              outUsed[l.from] += l.n * scale;
              inUsed[l.to] += l.n * scale;
              const x0 = colX(ci) + NODE;
              const x1 = colX(ci + 1);
              const h = Math.max(1, l.n * scale - 1.5);
              const mx = (x0 + x1) / 2;
              return (
                <path
                  key={`${ci}-${l.from}-${l.to}`}
                  d={`M ${x0} ${y0} C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1} L ${x1} ${y1 + h} C ${mx} ${y1 + h}, ${mx} ${y0 + h}, ${x0} ${y0 + h} Z`}
                  fill={toneFill[data.columns[ci].nodes[l.from].tone]}
                  fillOpacity={0.28}
                  stroke="none"
                >
                  <title>{`${data.columns[ci].nodes[l.from].label} → ${data.columns[ci + 1].nodes[l.to].label}: ${l.n}`}</title>
                </path>
              );
            });
        })}
        {data.columns.map((c, ci) => (
          <g key={c.label}>
            <text className={s.refLabel} x={colX(ci)} y={14} fontSize={fontPx.xs} fill={color.foreground} textAnchor={ci === data.columns.length - 1 ? 'end' : 'start'} dx={ci === data.columns.length - 1 ? NODE : 0}>
              {c.label}
            </text>
            {c.nodes.map((n, ni) => (
              <g key={n.label}>
                <rect x={colX(ci)} y={tops[ci][ni]} width={NODE} height={Math.max(2, n.n * scale)} rx={3} fill={toneFill[n.tone]} stroke={color.foreground} strokeWidth={1.5} />
                <text className={s.tick} x={ci === data.columns.length - 1 ? colX(ci) - 6 : colX(ci) + NODE + 6} y={tops[ci][ni] + Math.max(2, n.n * scale) / 2 + 4} textAnchor={ci === data.columns.length - 1 ? 'end' : 'start'} fontSize={fontPx.xs} fill={color.foreground}>
                  {n.label} · {n.n}
                </text>
              </g>
            ))}
          </g>
        ))}
      </svg>
      <p className={s.note}>n = {data.n} students with all three answers. Blue = right; pink = the stacking pattern; gray = other. Hover a flow for its count.</p>
    </div>
  );
}

// ───────────── Pair tiles (S11) ─────────────

export function PairTiles({ p, a, b, suppressBelow }: { p: PairPattern; a: string; b: string; suppressBelow: number }) {
  const show = (n: number) => (n > 0 && n < suppressBelow ? '<5' : n);
  const cell = (label: string, n: number, hot?: boolean) => (
    <div className={[s.quad, hot && s.quadHot].filter(Boolean).join(' ')}>
      <strong>{show(n)}</strong>
      {label}
    </div>
  );
  return (
    <div>
      <div className={s.quads}>
        {cell('Took the smaller-sooner option both times (SS)', p.SS)}
        {cell('Took smaller-sooner on pair 1, larger-later on pair 2 (SL): present-bias pattern', p.SL, true)}
        {cell('Took larger-later on pair 1, smaller-sooner on pair 2 (LS)', p.LS)}
        {cell('Took the larger-later option both times (LL)', p.LL)}
      </div>
      <p className={s.note}>
        Pair 1: {a}. Pair 2: {b}. n = {p.n}.{p.net !== null && suppressBelow === 0 ? ` Net present-bias rate (SL − LS) ÷ n = ${(p.net * 100).toFixed(0)}%.` : ''}
      </p>
    </div>
  );
}

export function SplitShare({ groups }: { groups: { label: string; n: number; share: number | null }[] }) {
  return (
    <CountBars
      items={groups.map((g) => ({ label: `${g.label} (n = ${g.n})`, n: g.share === null ? 0 : Math.round(g.share * 100), tone: 'corr' as const }))}
      total={100}
      note="Bars show the percent correct on the step."
    />
  );
}

// ───────────── Ridgeline + anchoring (S12) ─────────────

const FORM_ORDER = ['H', 'N', 'L'];

export function Ridgeline({ byForm, labels, anchors, axis, unit, minForN }: { byForm: Map<string, number[]>; labels: Record<string, string>; anchors: Record<string, number>; axis: AxisSpec; unit: 'usd'; minForN: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const L = 8;
  const R = 12;
  const rowH = 74;
  const forms = FORM_ORDER.filter((f) => byForm.has(f));
  const H = forms.length * rowH + 40;
  const x = (v: number) => L + toFrac(v, axis) * (w - L - R);
  const tks = ticks(axis, Math.max(3, Math.floor(w / 80)));
  const grid = Array.from({ length: 60 }, (_, i) => axis.min + ((axis.max - axis.min) * i) / 59);
  const a = anchoring(byForm.get('H') ?? [], byForm.get('L') ?? [], anchors.H, anchors.L);
  return (
    <div ref={ref} className={s.wrap}>
      <svg className={s.svg} width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`Estimates by anchor condition: ${forms.map((f) => `${labels[f]} median ${formatUnit(medianOf(byForm.get(f)!), unit)}, n ${byForm.get(f)!.length}`).join('; ')}`}>
        {tks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={0} y2={H - 24} stroke={chart.grid} />
            <text className={s.tick} x={x(t)} y={H - 8} textAnchor="middle" fontSize={fontPx.xs}>
              {formatAxis(t, unit)}
            </text>
          </g>
        ))}
        {forms.map((f, i) => {
          const vals = byForm.get(f)!;
          const base = i * rowH + rowH - 18;
          const m = medianOf(vals);
          const xs = vals.map((v) => x(Math.min(axis.max, Math.max(axis.min, v))));
          const ys = beeswarm(xs, 3.2);
          const density = vals.length >= minForN ? kde(vals, grid) : null;
          const peak = density ? Math.max(...density) : 1;
          return (
            <g key={f}>
              <text className={s.refLabel} x={anchors[f] !== undefined && x(anchors[f]) > (L + w - R) / 2 ? L : w - R} y={i * rowH + 12} textAnchor={anchors[f] !== undefined && x(anchors[f]) > (L + w - R) / 2 ? 'start' : 'end'} fontSize={fontPx.xs} fill={color.foreground}>
                {labels[f]} · n = {vals.length}
              </text>
              <line x1={L} x2={w - R} y1={base} y2={base} stroke={color.foreground} strokeWidth={1} />
              {density && <polyline points={grid.map((g, k) => `${x(g)},${base - (density[k] / peak) * 40}`).join(' ')} fill="none" stroke={chart.axis} strokeWidth={2} />}
              {vals.map((_, k) => (
                <circle key={k} cx={xs[k]} cy={base - 9 + Math.max(-6, Math.min(6, ys[k] * 0.4))} r={3.2} fill={chart.correct} fillOpacity={0.75} />
              ))}
              {anchors[f] !== undefined && <line x1={x(anchors[f])} x2={x(anchors[f])} y1={base - 44} y2={base} stroke={chart.wrong} strokeWidth={2} strokeDasharray="5 3" />}
              {anchors[f] !== undefined && (
                <text className={s.refLabel} x={x(anchors[f]) + 4} y={base - 34} fontSize={fontPx.xs} fill={color.foreground}>
                  anchor {formatUnit(anchors[f], unit)}
                </text>
              )}
              <line x1={x(m)} x2={x(m)} y1={base - 20} y2={base + 4} stroke={color.foreground} strokeWidth={3} />
              <text className={s.refLabel} x={x(m)} y={base + 14} textAnchor="middle" fontSize={fontPx.xs} fill={color.foreground}>
                median {formatUnit(m, unit)}
              </text>
            </g>
          );
        })}
      </svg>
      <AnchoringNote a={a} />
    </div>
  );
}

const medianOf = (xs: number[]) => {
  const t = [...xs].sort((p, q) => p - q);
  const m = t.length >> 1;
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
};

export function AnchoringNote({ a }: { a: Anchoring }) {
  if (a.index === null) return <p className={s.note}>Not enough answers in both anchored groups yet.</p>;
  const fmt = (x: number | null) => (x === null ? '—' : x.toFixed(2));
  const small = a.mde !== null && a.mde > 0.25;
  return (
    <div className={s.anchorNote}>
      <p>
        <strong>Anchoring index {fmt(a.index)}</strong> (95% interval {fmt(a.lo)} to {fmt(a.hi)}). 0 = no pull toward the anchor; 1 = the median moved all the way to it. High n = {a.nHigh}, low n = {a.nLow}.
      </p>
      <p className={small ? s.warn : s.note}>
        With this sample, the smallest effect that could be reliably detected is about {fmt(a.mde)}. {small ? 'A typical anchoring effect is smaller than that, so per-workshop n is too small to see it. Use the pooled view (all workshops).' : 'This sample is large enough to see a moderate effect.'}
      </p>
    </div>
  );
}

// ───────────── Slopegraph + rank agreement (F8) ─────────────

export function Slope({ first, second, order, labels, n }: { first: Record<string, number>; second: Record<string, number>; order: string[]; labels: Record<string, string>; n: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const H = 300;
  const T = 30;
  const B = 14;
  const k = order.length;
  const y = (rank: number) => T + ((rank - 1) / (k - 1)) * (H - T - B);
  const side = Math.min(160, w * 0.36);
  const cols = [side, side + (w - 2 * side) / 2, w - side];
  return (
    <div ref={ref} className={s.wrap}>
      <div className={s.legend} aria-hidden>
        <span className={s.key}>
          <svg width="22" height="10"><line x1="0" y1="5" x2="22" y2="5" stroke={chart.correct} strokeWidth="3" /></svg> Moved toward the computed order
        </span>
        <span className={s.key}>
          <svg width="22" height="10"><line x1="0" y1="5" x2="22" y2="5" stroke={chart.wrong} strokeWidth="3" strokeDasharray="5 3" /></svg> Moved away
        </span>
      </div>
      <svg className={s.svg} width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label="Average rank of each claim: first ranking, second ranking, computed order">
        {['First guess', 'Second guess', 'Computed'].map((t, i) => (
          <text key={t} className={s.refLabel} x={cols[i]} y={14} textAnchor="middle" fontSize={fontPx.xs} fill={color.foreground}>
            {t}
          </text>
        ))}
        {order.map((id, idx) => {
          const comp = idx + 1;
          const a = first[id];
          const b = second[id];
          if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
          const better = Math.abs(b - comp) <= Math.abs(a - comp);
          const stroke = better ? chart.correct : chart.wrong;
          return (
            <g key={id}>
              <polyline points={`${cols[0]},${y(a)} ${cols[1]},${y(b)} ${cols[2]},${y(comp)}`} fill="none" stroke={stroke} strokeWidth={3} strokeDasharray={better ? undefined : '6 4'} strokeLinejoin="round" />
              {[a, b, comp].map((r, i) => (
                <circle key={i} cx={cols[i]} cy={y(r)} r={5} fill={i === 2 ? color.card : stroke} stroke={color.foreground} strokeWidth={2} />
              ))}
              <text className={s.tick} x={cols[0] - 12} y={y(a) + 4} textAnchor="end" fontSize={fontPx.xs} fill={color.foreground}>
                {labels[id]}
              </text>
              <text className={s.tick} x={cols[2] + 12} y={y(comp) + 4} fontSize={fontPx.xs} fill={color.foreground}>
                {labels[id]}
              </text>
            </g>
          );
        })}
      </svg>
      <p className={s.note}>n = {n} students. Position 1 = most believable. Where lines cross, intuition and the math disagree.</p>
    </div>
  );
}

// ───────────── Calendar heat (F6, F7) ─────────────

export function CalendarHeat({ cells, columns, cellWord, values, unit, n }: { cells: number; columns: number; cellWord: string; values: { cell: number; value: number }[]; unit: 'share' | 'avg'; n: number }) {
  const max = Math.max(0.0001, ...values.map((v) => v.value));
  return (
    <div>
      <div className={s.heat} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} role="list">
        {values.slice(0, cells).map((v) => {
          const t = v.value / max;
          return (
            <span
              key={v.cell}
              role="listitem"
              className={s.heatCell}
              style={{ background: `color-mix(in srgb, var(--chart-correct) ${Math.round(t * 100)}%, var(--color-card))`, color: t > 0.55 ? 'var(--color-primary-foreground)' : 'var(--color-foreground)' }}
              title={`${cellWord} ${v.cell}: ${unit === 'share' ? pct(v.value) : v.value.toFixed(2)}`}
            >
              <span>{v.cell}</span>
              <span className={s.heatVal}>{unit === 'share' ? pct(v.value) : v.value.toFixed(1)}</span>
            </span>
          );
        })}
      </div>
      <p className={s.note}>
        n = {n}. {unit === 'share' ? 'Percent of students who tapped each cell.' : 'Average lawns planned per student on each day.'} Darker = more.
      </p>
    </div>
  );
}

// ───────────── 2×2 of correct/incorrect (S4) ─────────────

export function TwoByTwo({ q, x, y, suppressBelow }: { q: { both: number; xOnly: number; yOnly: number; neither: number; n: number }; x: string; y: string; suppressBelow: number }) {
  const show = (n: number) => (n > 0 && n < suppressBelow ? '<5' : n);
  return (
    <div>
      <div className={s.quads}>
        <div className={s.quad}>
          <strong>{show(q.both)}</strong>
          {x} and {y}
        </div>
        <div className={[s.quad, s.quadHot].join(' ')}>
          <strong>{show(q.xOnly)}</strong>
          {x}, but not {y}
        </div>
        <div className={s.quad}>
          <strong>{show(q.yOnly)}</strong>
          {y}, but not {x}
        </div>
        <div className={s.quad}>
          <strong>{show(q.neither)}</strong>
          Neither
        </div>
      </div>
      <p className={s.note}>n = {q.n} students. Gold = the pattern to teach.</p>
    </div>
  );
}

export type { ResponseRow };
