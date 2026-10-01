import type { ResponseRow } from '../api/types';
import { CODES, type Code } from '../items/families';
import { codeShares, codesOf, shareCorrect, type RecodeMap } from '../lib/analysis';
import type { Selection } from './DotPlot';
import s from './charts.module.css';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const segCls = (c: Code) => (c === 'CORR' ? s.corr : c === 'UNK' ? s.unk : s.wrong);

/** One row per step: a gap-separated 100% bar of codes. Segment labels only where they fit. */
export function CodeBar({ steps, rc, onSelect }: { steps: { label: string; rows: ResponseRow[] }[]; rc: RecodeMap; onSelect?: (s: Selection) => void }) {
  return (
    <div className={s.rows}>
      {steps.map((st) => {
        const shares = codeShares(st.rows, rc);
        const total = shares.reduce((a, c) => a + c.n, 0);
        return (
          <div key={st.label} className={s.row}>
            <span className={s.rowLabel}>{st.label}</span>
            <div className={s.track}>
              {shares.map((c) => (
                <button
                  type="button"
                  key={c.code}
                  className={`${s.seg} ${segCls(c.code)}`}
                  style={{ flex: c.n }}
                  title={`${c.code} · ${CODES[c.code].label}: ${c.n} (${pct(c.n / total)})`}
                  aria-label={`${CODES[c.code].label}: ${c.n} answers, ${pct(c.n / total)}${onSelect ? '. Activate to list student codes.' : ''}`}
                  onClick={() => onSelect?.({ label: `${st.label} · ${CODES[c.code].label}`, rows: st.rows.filter((r) => codesOf(r, rc).includes(c.code)) })}
                >
                  {c.n / total >= 0.25 ? `${c.code} ${pct(c.n / total)}` : ''}
                </button>
              ))}
            </div>
            <span className={s.val}>n = {st.rows.length}</span>
          </div>
        );
      })}
      <p className={s.note}>Blue = correct · pink = named wrong pattern · gray = unclassified. Labels on segments of 25% or more; hover or focus any segment for its code and count. Answers can carry more than one code.</p>
    </div>
  );
}

/** Share correct by step, to show where accuracy drops. */
export function Funnel({ steps, rc }: { steps: { label: string; rows: ResponseRow[] }[]; rc: RecodeMap }) {
  return (
    <div className={s.rows}>
      {steps.map((st) => {
        const p = shareCorrect(st.rows, rc);
        return (
          <div key={st.label} className={s.row}>
            <span className={s.rowLabel}>{st.label}</span>
            <div className={s.track}>
              <div className={`${s.bar} ${s.corr}`} style={{ width: `${(p ?? 0) * 100}%` }} />
            </div>
            <span className={s.val}>
              {p === null ? '—' : pct(p)} correct · n = {st.rows.length}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Buckets of codes (e.g. correct / tax left out / percent as dollars / other). */
export function ShareBar({ rows, buckets, rc, onSelect }: { rows: ResponseRow[]; buckets: { label: string; codes: Code[] }[]; rc: RecodeMap; onSelect?: (s: Selection) => void }) {
  const used = new Set<string>();
  const out = buckets.map((b) => {
    const hit = rows.filter((r) => !used.has(r.answer_id) && codesOf(r, rc).some((c) => b.codes.includes(c)));
    hit.forEach((r) => used.add(r.answer_id));
    return { ...b, rows: hit };
  });
  out.push({ label: 'Other', codes: [], rows: rows.filter((r) => !used.has(r.answer_id)) });
  const max = Math.max(1, ...out.map((b) => b.rows.length));
  return (
    <div className={s.rows}>
      {out.map((b) => (
        <div key={b.label} className={s.row}>
          <span className={s.rowLabel}>{b.label}</span>
          <div className={s.track}>
            <button
              type="button"
              className={`${s.bar} ${s.seg} ${b.codes.includes('CORR') ? s.corr : b.codes.length ? s.wrong : s.unk}`}
              style={{ width: `${(b.rows.length / max) * 100}%` }}
              aria-label={`${b.label}: ${b.rows.length}`}
              onClick={() => onSelect?.({ label: b.label, rows: b.rows })}
            />
          </div>
          <span className={s.val}>
            {b.rows.length} · {rows.length ? pct(b.rows.length / rows.length) : '—'}
          </span>
        </div>
      ))}
      <p className={s.note}>n = {rows.length}</p>
    </div>
  );
}

/** Plain count bars (choices, text tags). */
export function CountBars({ items, total, note }: { items: { label: string; n: number; tone?: 'corr' | 'wrong' | 'unk' | 'none' | 'neutral' }[]; total: number; note?: string }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div className={s.rows}>
      {items.map((i) => (
        <div key={i.label} className={s.row}>
          <span className={s.rowLabel}>{i.label}</span>
          <div className={s.track}>
            <div className={`${s.bar} ${s[i.tone ?? 'corr']}`} style={{ width: `${(i.n / max) * 100}%` }} />
          </div>
          <span className={s.val}>
            {i.n} · {total ? pct(i.n / total) : '—'}
          </span>
        </div>
      ))}
      {note && <p className={s.note}>{note}</p>}
    </div>
  );
}
