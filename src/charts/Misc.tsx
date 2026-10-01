import type { ResponseRow } from '../api/types';
import type { AxisSpec, StackCard } from '../items/types';
import { toFrac, ticks } from '../inputs/axis';
import { codesOf, type CardStat, type RecodeMap, type WaterfallStep } from '../lib/analysis';
import { formatAxis, formatUnit } from '../lib/format';
import { formatCode } from '../lib/studentCode';
import { chart, color, fontPx } from '../styles/tokens';
import { CountBars } from './Bars';
import { useWidth } from './useWidth';
import s from './charts.module.css';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Donut with a labelled legend (counts and shares), for small category sets. */
export function Donut({ slices }: { slices: { label: string; n: number; tone: 'corr' | 'wrong' | 'unk' | 'neutral' }[] }) {
  const total = slices.reduce((a, b) => a + b.n, 0);
  const R = 56;
  const C = 2 * Math.PI * R;
  const fill = { corr: chart.correct, wrong: chart.wrong, unk: chart.unk, neutral: chart.axis };
  let acc = 0;
  return (
    <div className={s.donutWrap}>
      <svg viewBox="0 0 160 160" width={160} height={160} role="img" aria-label={slices.map((x) => `${x.label}: ${x.n}`).join(', ')}>
        <circle cx={80} cy={80} r={R} fill="none" stroke={color.muted} strokeWidth={26} />
        {total > 0 &&
          slices.map((sl) => {
            const len = (sl.n / total) * C;
            const el = <circle key={sl.label} cx={80} cy={80} r={R} fill="none" stroke={fill[sl.tone]} strokeWidth={26} strokeDasharray={`${Math.max(0, len - 2)} ${C - Math.max(0, len - 2)}`} strokeDashoffset={-acc} transform="rotate(-90 80 80)" />;
            acc += len;
            return el;
          })}
        <text className={s.refLabel} x={80} y={86} textAnchor="middle" fontSize={fontPx.lg} fill={color.foreground}>
          {total}
        </text>
      </svg>
      <ul className={s.donutLegend}>
        {slices.map((sl) => (
          <li key={sl.label}>
            <span className={`${s.swatch} ${s[sl.tone]}`} aria-hidden />
            <span>
              {sl.label}: <strong>{sl.n}</strong> {total ? `· ${pct(sl.n / total)}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One tile per student, shaded by whether the step was correct (✓ / ✕ so it isn't colour-only). */
export function TileGrid({ rows, rc, showCodes, minCell, note }: { rows: ResponseRow[]; rc: RecodeMap; showCodes: boolean; minCell: number; note: string }) {
  if (rows.length < Math.max(1, minCell)) return <p className={s.hidden}>Fewer than {minCell} students, hidden in projector mode.</p>;
  const sorted = [...rows].sort((a, b) => Number(codesOf(b, rc).includes('CORR')) - Number(codesOf(a, rc).includes('CORR')));
  const right = rows.filter((r) => codesOf(r, rc).includes('CORR')).length;
  return (
    <div>
      <div className={s.tiles} role="list" aria-label={`${right} of ${rows.length} students correct`}>
        {sorted.map((r) => {
          const ok = codesOf(r, rc).includes('CORR');
          return (
            <span key={r.answer_id} role="listitem" className={`${s.tile} ${ok ? s.tileOk : s.tileNo}`} title={showCodes ? formatCode(r.student_code) : 'student'}>
              {ok ? '✓' : '✕'}
              <span className="sr-only">{ok ? 'correct' : 'not correct'}</span>
            </span>
          );
        })}
      </div>
      <p className={s.note}>
        {right} of {rows.length} correct ({pct(right / rows.length)}). {note}
      </p>
    </div>
  );
}

/** One row per student: a → b on a shared axis, sorted by the size of the move. */
export function PairedPlot({ pairs, axis, showCodes, note }: { pairs: { key: string; code: string; a: number; b: number }[]; axis: AxisSpec; showCodes: boolean; note: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const sorted = [...pairs].sort((p, q) => Math.abs(p.b - p.a) - Math.abs(q.b - q.a));
  const shown = sorted.slice(0, 60);
  const left = showCodes ? 66 : 14;
  const x = (v: number) => left + toFrac(v, axis) * (w - left - 16);
  const rh = 13;
  const H = shown.length * rh + 30;
  const tiny = pairs.filter((p) => Math.abs(p.b - p.a) < 1.5).length;
  const tks = ticks(axis, Math.max(3, Math.floor(w / 80)));
  return (
    <div ref={ref} className={s.wrap}>
      <div className={s.legend} aria-hidden>
        <span className={s.key}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill={color.card} stroke={color.foreground} strokeWidth="2" /></svg> Step 1 answer
        </span>
        <span className={s.key}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill={chart.correct} /></svg> Step 3 answer
        </span>
      </div>
      <div className={s.scroll}>
        <svg className={s.svg} width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`${pairs.length} students, ${tiny} moved less than 1.5 between the two answers`}>
          {tks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={0} y2={H - 20} stroke={chart.grid} />
              <text className={s.tick} x={x(t)} y={H - 6} textAnchor="middle" fontSize={fontPx.xs}>
                {formatAxis(t, axis.unit)}
              </text>
            </g>
          ))}
          {shown.map((p, i) => {
            const y = i * rh + 8;
            return (
              <g key={p.key}>
                {showCodes && (
                  <text className={s.tick} x={4} y={y + 4} fontSize={fontPx.xs}>
                    {formatCode(p.code)}
                  </text>
                )}
                <line x1={x(p.a)} x2={x(p.b)} y1={y} y2={y} stroke={chart.axis} strokeWidth={2} />
                <circle cx={x(p.a)} cy={y} r={4.5} fill={color.card} stroke={color.foreground} strokeWidth={2} />
                <circle cx={x(p.b)} cy={y} r={5} fill={chart.correct} stroke={color.card} strokeWidth={1} />
              </g>
            );
          })}
        </svg>
      </div>
      <p className={s.note}>
        n = {pairs.length} · {tiny} ({pairs.length ? pct(tiny / pairs.length) : '—'}) moved less than 1.5 years between the two answers. {note}
        {pairs.length > shown.length ? ` Showing the ${shown.length} smallest moves.` : ''}
      </p>
    </div>
  );
}

/** Share of students who stacked each card (blue = a real cost, pink = a distractor) and their average position. */
export function CardHeat({ stats, cards, total }: { stats: CardStat[]; cards: StackCard[]; total: number }) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return (
    <div className={s.rows}>
      {stats.map((st) => {
        const c = byId.get(st.id)!;
        return (
          <div key={st.id} className={s.row}>
            <span className={s.rowLabel}>
              {c.label}
              {c.distractor ? ' (distractor)' : ''}
            </span>
            <div className={s.track}>
              <div className={`${s.bar} ${c.distractor ? s.wrong : s.corr}`} style={{ width: `${st.share * 100}%` }} />
            </div>
            <span className={s.val}>
              {pct(st.share)} · {st.n}
            </span>
          </div>
        );
      })}
      <p className={s.note}>n = {total} students. Blue = a cost that belongs in the deal. Pink = a distractor. A short blue bar is a cost students commonly miss.</p>
    </div>
  );
}

/** Floating-bar waterfall: filled = class average (card amount × share who stacked it), outline = correct breakdown. */
export function Waterfall({ steps, cards, implied, correct, typedMedian, n }: { steps: WaterfallStep[]; cards: { id: string; amount: number; sign: 1 | -1; label: string }[]; implied: number; correct: number; typedMedian: number | null; n: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const H = 280;
  const T = 18;
  const B = 56;
  const L = 52;
  const cols = steps.length + 1;
  const maxV = Math.max(...steps.map((x) => Math.max(x.classEnd, x.correctEnd)), implied, correct, typedMedian ?? 0, ...cards.map((c) => c.amount)) * 1.05;
  const y = (v: number) => T + (1 - Math.max(0, v) / maxV) * (H - T - B);
  const cw = (w - L - 12) / cols;
  const bw = Math.min(54, cw * 0.62);
  const yt = ticks({ min: 0, max: maxV, scale: 'linear', unit: 'usd' }, 6);
  let prevC = 0;
  let prevK = 0;
  return (
    <div ref={ref} className={s.wrap}>
      <div className={s.legend} aria-hidden>
        <span className={s.key}>
          <svg width="14" height="12"><rect x="1" y="1" width="12" height="10" fill={chart.correct} /></svg> Class average
        </span>
        <span className={s.key}>
          <svg width="14" height="12"><rect x="1" y="1" width="12" height="10" fill="none" stroke={color.foreground} strokeWidth="2" strokeDasharray="3 2" /></svg> Correct breakdown
        </span>
      </div>
      <svg className={s.svg} width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`Waterfall. Correct profit ${formatUnit(correct, 'usd')}. Implied by what students stacked ${formatUnit(implied, 'usd')}.`}>
        {yt.map((t) => (
          <g key={t}>
            <line x1={L} x2={w - 8} y1={y(t)} y2={y(t)} stroke={chart.grid} />
            <text className={s.tick} x={L - 6} y={y(t) + 4} textAnchor="end" fontSize={fontPx.xs}>
              {formatAxis(t, 'usd')}
            </text>
          </g>
        ))}
        {steps.map((st, i) => {
          const cx = L + cw * i + cw / 2;
          const k0 = prevK;
          const c0 = prevC;
          prevK = st.correctEnd;
          prevC = st.classEnd;
          return (
            <g key={st.id}>
              <rect x={cx - bw / 2} y={y(Math.max(k0, st.correctEnd))} width={bw} height={Math.max(1, Math.abs(y(k0) - y(st.correctEnd)))} fill="none" stroke={color.foreground} strokeWidth={2} strokeDasharray="4 3" />
              <rect x={cx - bw / 2 + 5} y={y(Math.max(c0, st.classEnd))} width={bw - 10} height={Math.max(1, Math.abs(y(c0) - y(st.classEnd)))} fill={chart.correct} />
              <text className={s.tick} x={cx} y={H - B + 16} textAnchor="middle" fontSize={fontPx.xs}>
                {st.label}
              </text>
              <text className={s.refLabel} x={cx} y={H - B + 31} textAnchor="middle" fontSize={fontPx.xs} fill={color.foreground}>
                {pct(st.share)}
              </text>
            </g>
          );
        })}
        {(() => {
          const cx = L + cw * steps.length + cw / 2;
          return (
            <g>
              <rect x={cx - bw / 2} y={y(correct)} width={bw} height={Math.max(1, y(0) - y(correct))} fill="none" stroke={color.foreground} strokeWidth={2} strokeDasharray="4 3" />
              <rect x={cx - bw / 2 + 5} y={y(implied)} width={bw - 10} height={Math.max(1, y(0) - y(implied))} fill={chart.correct} />
              {typedMedian !== null && <line x1={cx - bw / 2 - 4} x2={cx + bw / 2 + 4} y1={y(typedMedian)} y2={y(typedMedian)} stroke={chart.wrong} strokeWidth={3} />}
              <text className={s.tick} x={cx} y={H - B + 16} textAnchor="middle" fontSize={fontPx.xs}>
                Profit
              </text>
              <text className={s.refLabel} x={cx} y={H - B + 31} textAnchor="middle" fontSize={fontPx.xs} fill={color.foreground}>
                ✓ {formatUnit(correct, 'usd')}
              </text>
            </g>
          );
        })()}
      </svg>
      <p className={s.note}>
        n = {n}. Percent under each bar = share of students who stacked that card. Filled bars use each card’s amount × that share, so an unstacked cost shows as a gap.
        {typedMedian !== null ? ` Pink line = median profit students typed (${formatUnit(typedMedian, 'usd')}).` : ''}
      </p>
    </div>
  );
}

/** 2×2 counts with “<5” suppression for projector mode. */
export function QuadGrid({ q, labels, suppressBelow }: { q: { goodBelieves: number; goodDoubts: number; badBelieves: number; badDoubts: number }; labels: { good: string; bad: string; yes: string; no: string }; suppressBelow: number }) {
  const cell = (n: number, text: string, hot?: boolean) => (
    <div className={[s.quad, hot && s.quadHot].filter(Boolean).join(' ')}>
      <strong>{n > 0 && n < suppressBelow ? '<5' : n}</strong>
      {text}
    </div>
  );
  return (
    <div className={s.quads}>
      {cell(q.goodDoubts, `${labels.good}, ${labels.no}`)}
      {cell(q.goodBelieves, `${labels.good}, ${labels.yes}`)}
      {cell(q.badDoubts, `${labels.bad}, ${labels.no}`)}
      {cell(q.badBelieves, `${labels.bad}, ${labels.yes}`, true)}
    </div>
  );
}

export function SplitBars({ groups, options, labels, total }: { groups: { near: Record<string, number>; far: Record<string, number> }; options: { id: string; label: string }[]; labels: { yes: string; no: string }; total: number }) {
  return (
    <div className={s.rows}>
      {(['near', 'far'] as const).map((g) => {
        const n = options.reduce((a, o) => a + (groups[g][o.id] ?? 0), 0);
        return (
          <div key={g}>
            <p className="eyebrow">
              {g === 'near' ? labels.yes : labels.no} · n = {n}
            </p>
            <CountBars items={options.map((o) => ({ label: o.label, n: groups[g][o.id] ?? 0, tone: 'neutral' as const }))} total={n} />
          </div>
        );
      })}
      <p className={s.note}>n = {total}</p>
    </div>
  );
}
