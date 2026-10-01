import type { RatingPair } from '../lib/analysis';
import { chart, color, fontPx } from '../styles/tokens';
import { useWidth } from './useWidth';
import s from './charts.module.css';

const MAX_ROWS = 60;

/** One row per student: gut (hollow) → after the math (filled), sorted by calibration shift. */
export function Dumbbell({ pairs, showCodes }: { pairs: RatingPair[]; showCodes: boolean }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const sorted = [...pairs].sort((a, b) => a.post - a.gut - (b.post - b.gut) || b.gut - a.gut);
  const rows = sorted.slice(0, MAX_ROWS);
  const left = showCodes ? 70 : 12;
  const x = (v: number) => left + ((v - 1) / 4) * (w - left - 20);
  const rh = 14;
  const H = rows.length * rh + 30;
  const down = pairs.filter((p) => p.post < p.gut).length;
  const same = pairs.filter((p) => p.post === p.gut).length;
  return (
    <div ref={ref} className={s.wrap}>
      <div className={s.legend}>
        <span className={s.key}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill={color.card} stroke={color.foreground} strokeWidth="2" /></svg> Gut rating
        </span>
        <span className={s.key}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill={chart.correct} /></svg> After the math
        </span>
      </div>
      <div className={s.scroll}>
        <svg className={s.svg} width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`${pairs.length} students: ${down} rated lower after the math, ${same} unchanged, ${pairs.length - down - same} higher.`}>
          {[1, 2, 3, 4, 5].map((v) => (
            <g key={v}>
              <line x1={x(v)} x2={x(v)} y1={0} y2={H - 22} stroke={chart.grid} />
              <text className={s.tick} x={x(v)} y={H - 6} textAnchor="middle" fontSize={fontPx.xs}>
                {v}
              </text>
            </g>
          ))}
          {rows.map((p, i) => {
            const y = i * rh + 8;
            return (
              <g key={`${p.student}-${i}`}>
                {showCodes && (
                  <text className={s.tick} x={4} y={y + 4} fontSize={fontPx.xs}>
                    {p.student.slice(0, 3)}-{p.student.slice(3)}
                  </text>
                )}
                <line x1={x(p.gut)} x2={x(p.post)} y1={y} y2={y} stroke={color.mutedForeground} strokeWidth={2} />
                <circle cx={x(p.gut)} cy={y} r={4.5} fill={color.card} stroke={color.foreground} strokeWidth={2} />
                <circle cx={x(p.post)} cy={y} r={5} fill={chart.correct} stroke={color.card} strokeWidth={1} />
              </g>
            );
          })}
        </svg>
      </div>
      <p className={s.note}>
        n = {pairs.length} · {down} lower after the math · {same} unchanged · {pairs.length - down - same} higher
        {pairs.length > MAX_ROWS ? ` · showing ${MAX_ROWS} largest shifts` : ''} · 1 = almost certainly false, 5 = almost certainly true
      </p>
    </div>
  );
}

/** Gut (x) vs post-math (y) counts on a 5×5 grid, diagonal outlined, 4–5/4–5 highlighted. */
export function Calibration({ pairs, suppressBelow }: { pairs: RatingPair[]; suppressBelow: number }) {
  const count = (g: number, p: number) => pairs.filter((x) => x.gut === g && x.post === p).length;
  const hot = pairs.filter((x) => x.gut >= 4 && x.post >= 4).length;
  const quads = [
    { label: 'High confidence, still believes (gut 4–5, after 4–5)', n: hot, hotCls: true },
    { label: 'Believed, then doubted (gut 4–5, after 1–3)', n: pairs.filter((x) => x.gut >= 4 && x.post <= 3).length },
    { label: 'Doubted from the start (gut 1–3, after 1–3)', n: pairs.filter((x) => x.gut <= 3 && x.post <= 3).length },
    { label: 'Grew more convinced (gut 1–3, after 4–5)', n: pairs.filter((x) => x.gut <= 3 && x.post >= 4).length },
  ];
  const show = (n: number) => (n > 0 && n < suppressBelow ? '<5' : n || '');
  return (
    <div>
      <div className={s.calGrid} role="table" aria-label="Calibration grid: gut rating columns, after-the-math rating rows">
        {[5, 4, 3, 2, 1].map((p) => (
          <div key={p} role="row" style={{ display: 'contents' }}>
            <span className={s.calAxis} role="rowheader">
              {p}
            </span>
            {[1, 2, 3, 4, 5].map((g) => (
              <span key={g} role="cell" className={[s.calCell, g === p && s.calDiag, g >= 4 && p >= 4 && s.calHot].filter(Boolean).join(' ')}>
                {show(count(g, p))}
              </span>
            ))}
          </div>
        ))}
        <span />
        {[1, 2, 3, 4, 5].map((g) => (
          <span key={g} className={s.calAxis}>
            {g}
          </span>
        ))}
      </div>
      <p className={s.note}>Columns = gut rating, rows = rating after the math. Outlined = no change. Gold = high confidence, still believes.</p>
      <div className={s.quads}>
        {quads.map((q) => (
          <div key={q.label} className={[s.quad, q.hotCls && s.quadHot].filter(Boolean).join(' ')}>
            <strong>{q.n > 0 && q.n < suppressBelow ? '<5' : q.n}</strong>
            {q.label}
          </div>
        ))}
      </div>
    </div>
  );
}
