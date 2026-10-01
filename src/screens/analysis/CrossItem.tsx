import { useMemo, useState } from 'react';
import { api } from '../../api';
import type { ExportData } from '../../api/types';
import { ChartCard } from '../../components/ChartCard';
import { Select } from '../../components/Select';
import { applyFilters, studentKey } from '../../lib/analysis';
import { compounding, feasibility, gapMap, instrumentQuality, methodComparison, problemScores, radar, studentSteps, teachFirst, unkRows, type RadarPoint } from '../../lib/crossItem';
import { ALL_PROBLEMS } from '../../items';
import { CODES, FAMILY_LABELS, type Code } from '../../items/families';
import { color, fontPx } from '../../styles/tokens';
import type { Dashboard } from './useDashboard';
import s from './CrossItem.module.css';

export type View = 'teach' | 'students' | 'quality';
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
const today = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function CrossItem({ d, pass, view }: { d: Dashboard; pass: string; view: View }) {
  const data = d.scoped as ExportData;
  const date = today();
  const scores = useMemo(() => problemScores(data, d.rc, d.minCell), [data, d.rc, d.minCell]);
  if (view === 'students') return <Students d={d} data={data} date={date} />;
  if (view === 'quality') return <Quality d={d} data={data} pass={pass} date={date} />;
  return <Teach d={d} data={data} scores={scores} date={date} />;
}

function Teach({ d, data, scores, date }: { d: Dashboard; data: ExportData; scores: ReturnType<typeof problemScores>; date: string }) {
  const ranked = teachFirst(scores);
  const gm = gapMap(scores);
  const here = radar(scores);
  const pooled = useMemo(() => (d.data ? radar(problemScores(applyFilters(d.data, {}), d.rc, d.minCell)) : null), [d.data, d.rc, d.minCell]);
  const comp = compounding(data, d.rc, d.minCell);
  const feas = feasibility(data, d.rc, d.minCell);
  const n = new Set(data.responses.map(studentKey)).size;
  const pretty = (c: string) => (CODES[c as Code] ? CODES[c as Code].label : c);
  return (
    <div className={s.grid}>
      <div className={s.wide}>
        <ChartCard title="Teach first" subtitle="Problems where the fewest students were correct on the first question, biggest gap on top." n={n} date={date} tone="featured" footnote="Gap = share of scored answers that were not correct. Problems with fewer than 5 students are left out in projector mode.">
          <ol className={s.rank}>
            {ranked.slice(0, 10).map((r, i) => (
              <li key={r.id} className={[s.rankRow, i === 0 && s.top].filter(Boolean).join(' ')}>
                <span className={s.rankLabel}>
                  {r.id} · {r.title}
                  {r.topWrong && <span className={s.sub}> · most common wrong pattern: {pretty(r.topWrong)}</span>}
                </span>
                <span className={s.track} aria-hidden>
                  <span className={s.fill} style={{ width: `${r.gap * 100}%`, display: 'block' }} />
                </span>
                <span className={s.val}>{pct(r.gap)}</span>
              </li>
            ))}
          </ol>
        </ChartCard>
      </div>
      <ChartCard title="Class radar" subtitle="Share correct by skill family." n={n} date={date} footnote={(pooled && d.session ? 'Solid = this workshop. Dashed = all workshops pooled. ' : 'All workshops pooled. ') + 'A family with no scored problem plots at the center.'}>
        <Radar a={here} b={d.session ? pooled : null} />
      </ChartCard>
      <ChartCard title="Compounding" subtitle="Who answers growth questions as if it were a straight line?" n={comp.studentsAnswered} date={date} footnote="Linear = the answer matches the straight-line (no compounding) pattern on that problem.">
        <div className={s.bigRow}>
          <span className={s.big}>{comp.studentsLinear}</span>
          <span>of {comp.studentsAnswered} students were linear on {comp.threshold} or more compounding problems</span>
        </div>
        <Bars rows={comp.perItem.filter((r) => r.linear !== null).map((r) => ({ label: `${r.id} · ${r.title}`, v: r.linear as number }))} />
      </ChartCard>
      <ChartCard title="Believable but wrong" subtitle="Students who rated a claim 4 or 5 on the gut check and then missed the math." n={feas.n} date={date} footnote="High-confidence-wrong rate = gut rating of 4–5 and not correct on the first scored step.">
        <div className={s.bigRow}>
          <span className={s.big}>{pct(feas.rate)}</span>
          <span>overall</span>
        </div>
        <Bars rows={feas.perItem.filter((r) => r.rate !== null).map((r) => ({ label: `${r.id} · ${r.title}`, v: r.rate as number }))} />
      </ChartCard>
      <div className={s.wide}>
        <ChartCard title="Gap map" subtitle="Share correct, by problem and skill family. Darker = more correct." n={n} date={date} footnote="Gray = the problem is not tagged with that family, or too few students.">
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">Problem</th>
                  {gm.cols.map((f) => (
                    <th key={f} scope="col">
                      {FAMILY_LABELS[f]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gm.rows.map((id) => (
                  <tr key={id}>
                    <th scope="row">{id}</th>
                    {gm.cols.map((f) => {
                      const c = gm.cells.find((x) => x.id === id && x.family === f);
                      return c && c.pct !== null ? (
                        <td key={f} className={s.heat} style={{ ['--p' as string]: c.pct }} title={`${id}, ${FAMILY_LABELS[f]}: ${pct(c.pct)}, n = ${c.n}`}>
                          {pct(c.pct)}
                        </td>
                      ) : (
                        <td key={f} className={s.none}>
                          –
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function Bars({ rows }: { rows: { label: string; v: number }[] }) {
  if (!rows.length) return <p className={s.sub}>Not enough students yet.</p>;
  return (
    <ul className={s.rank}>
      {rows.map((r) => (
        <li key={r.label} className={s.rankRow}>
          <span className={s.rankLabel}>{r.label}</span>
          <span className={s.track} aria-hidden>
            <span className={`${s.fill} ${s.fillBlue}`} style={{ width: `${r.v * 100}%` }} />
          </span>
          <span className={s.val}>{pct(r.v)}</span>
        </li>
      ))}
    </ul>
  );
}

function Radar({ a, b }: { a: RadarPoint[]; b: RadarPoint[] | null }) {
  const size = 300;
  const c = size / 2;
  const r = 98;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / a.length;
  const pt = (i: number, v: number) => `${c + Math.cos(ang(i)) * r * v},${c + Math.sin(ang(i)) * r * v}`;
  const poly = (ps: RadarPoint[]) => ps.map((p, i) => pt(i, p.value ?? 0)).join(' ');
  const SHORT: Record<string, string> = { arithmetic: 'Arithmetic', percent: 'Percent', compounding: 'Compounding', time_preference: 'Waiting', credit_risk: 'Credit', feasibility: 'Feasibility' };
  return (
    <svg viewBox={`-50 0 ${size + 100} ${size}`} width="100%" role="img" aria-label={`Radar of share correct by family: ${a.map((p) => `${FAMILY_LABELS[p.family]} ${pct(p.value)}`).join(', ')}`} style={{ maxWidth: 420, display: 'block', margin: '0 auto' }}>
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <polygon key={g} points={a.map((_, i) => pt(i, g)).join(' ')} fill="none" stroke={color.border} strokeWidth={1.5} />
      ))}
      {a.map((p, i) => (
        <g key={p.family}>
          <line x1={c} y1={c} x2={c + Math.cos(ang(i)) * r} y2={c + Math.sin(ang(i)) * r} stroke={color.border} />
          <text x={c + Math.cos(ang(i)) * (r + 14)} y={c + Math.sin(ang(i)) * (r + 14) + 4} textAnchor={Math.abs(Math.cos(ang(i))) < 0.2 ? 'middle' : Math.cos(ang(i)) > 0 ? 'start' : 'end'} fontSize={fontPx.xs} fill={color.foreground}>
            {SHORT[p.family]}
          </text>
        </g>
      ))}
      {b && <polygon points={poly(b)} fill="none" stroke={color.mutedStrong} strokeWidth={2.5} strokeDasharray="6 4" />}
      <polygon points={poly(a)} fill={color.primary} fillOpacity={0.25} stroke={color.primary} strokeWidth={3} />
      {a.map((p, i) => p.value !== null && <circle key={p.family} cx={c + Math.cos(ang(i)) * r * p.value} cy={c + Math.sin(ang(i)) * r * p.value} r={4.5} fill={color.primary} stroke={color.foreground} strokeWidth={2} />)}
    </svg>
  );
}

function Students({ d, data, date }: { d: Dashboard; data: ExportData; date: string }) {
  const keys = useMemo(() => [...new Set(data.responses.map(studentKey))].sort(), [data]);
  const [key, setKey] = useState('');
  if (d.projector) return <ChartCard title="Student drilldown" n={0} date={date}><p>Hidden in projector mode: no student codes are shown on screen.</p></ChartCard>;
  const rows = key ? studentSteps(data, d.rc, key) : [];
  const label = (k: string) => `${k.split(':')[1]}${d.session ? '' : ` · ${data.sessions.find((x) => x.id === k.split(':')[0])?.chapter_code ?? ''}`}`;
  return (
    <ChartCard title="Student drilldown" subtitle="One anonymous code at a time, for follow-up during teaching. Never label a student." n={rows.length} date={date} footnote="Codes are random and tied to no name. Timing is exploratory.">
      <div className={s.pick}>
        <Select label="Student code" value={key} onChange={(e) => setKey(e.target.value)}>
          <option value="">Choose a code…</option>
          {keys.map((k) => (
            <option key={k} value={k}>
              {label(k)}
            </option>
          ))}
        </Select>
      </div>
      {rows.length > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Problem</th>
                <th scope="col">Step</th>
                <th scope="col">Answer</th>
                <th scope="col">Codes</th>
                <th scope="col">Input</th>
                <th scope="col">Seconds</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.position}</td>
                  <th scope="row">
                    {r.item} · {r.title}
                  </th>
                  <td>{r.step}</td>
                  <td>{r.raw === null ? '—' : r.raw.toLocaleString('en-US')}</td>
                  <td>{r.codes.join(', ') || '—'}</td>
                  <td>{r.method ?? '—'}</td>
                  <td>{r.seconds ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}

function Quality({ d, data, pass, date }: { d: Dashboard; data: ExportData; pass: string; date: string }) {
  const q = useMemo(() => instrumentQuality(data, d.rc), [data, d.rc]);
  const methods = methodComparison(data, d.rc);
  const unk = unkRows(data, d.rc);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const title = new Map(ALL_PROBLEMS.map((p) => [p.id, p.title]));
  const options = (Object.keys(CODES) as Code[]).filter((c) => c !== 'UNK');
  const recode = async (id: string, code: string) => {
    if (!code) return;
    setBusy(id);
    setErr('');
    try {
      await api.recode(pass, id, [code as Code]);
      await d.reload();
    } catch {
      setErr('Couldn’t save that code. Try again.');
    } finally {
      setBusy('');
    }
  };
  return (
    <div className={s.grid}>
      <div className={s.wide}>
        <ChartCard title="Instrument quality" subtitle="Is each problem doing its job?" n={q.reduce((a, x) => Math.max(a, x.n), 0)} date={date} footnote="Difficulty = share correct. Discrimination = how much getting this right goes with getting the others right (needs about 30 students to mean much). Low or negative values flag a problem to review.">
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">Problem</th>
                  <th scope="col">n</th>
                  <th scope="col">Difficulty</th>
                  <th scope="col">Discrimination</th>
                  <th scope="col">Flag</th>
                </tr>
              </thead>
              <tbody>
                {q.map((x) => (
                  <tr key={x.id}>
                    <th scope="row">
                      {x.id} · {x.title}
                    </th>
                    <td>{x.n}</td>
                    <td>{pct(x.difficulty)}</td>
                    <td>{x.discrimination === null ? '—' : x.discrimination.toFixed(2)}</td>
                    <td className={s.warn}>{x.n >= 30 && x.discrimination !== null && x.discrimination < 0.1 ? 'Review: low discrimination' : x.difficulty !== null && (x.difficulty > 0.95 || x.difficulty < 0.05) ? 'Almost everyone the same' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
      <ChartCard title="Typed vs dragged" subtitle="Exploratory: share correct by how the answer was entered." n={methods.reduce((a, m) => a + m.n, 0)} date={date} footnote="Students were not randomly assigned to an input method, so differences are not proof the input caused them.">
        <Bars rows={methods.filter((m) => m.correct !== null).map((m) => ({ label: `${m.method} (n = ${m.n})`, v: m.correct as number }))} />
      </ChartCard>
      <ChartCard title="Unmatched answers" subtitle="Answers no code matched. Assign a code, and every chart updates." n={unk.length} date={date}>
        {d.projector ? (
          <p>Hidden in projector mode.</p>
        ) : unk.length === 0 ? (
          <p>Nothing to code.</p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">Problem · step</th>
                  <th scope="col">Answer</th>
                  <th scope="col">Assign code</th>
                </tr>
              </thead>
              <tbody>
                {unk.slice(0, 25).map((r) => (
                  <tr key={r.answer_id}>
                    <th scope="row">
                      {r.item_id} · {title.get(r.item_id)} · {r.step_id}
                    </th>
                    <td>{r.raw_value === null ? '—' : r.raw_value.toLocaleString('en-US')}</td>
                    <td>
                      <select aria-label={`Assign a code to ${r.item_id} ${r.step_id} answer ${r.raw_value}`} disabled={busy === r.answer_id} defaultValue="" onChange={(e) => void recode(r.answer_id, e.target.value)}>
                        <option value="">Choose…</option>
                        {options.map((c) => (
                          <option key={c} value={c}>
                            {c} · {CODES[c].label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {unk.length > 25 && <p className={s.sub}>Showing 25 of {unk.length}.</p>}
          </div>
        )}
        {err && <p role="alert">{err}</p>}
      </ChartCard>
    </div>
  );
}
