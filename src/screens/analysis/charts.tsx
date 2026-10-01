import { useLayoutEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TriangleAlert } from 'lucide-react';
import { chart, color, font, fontPx } from '../../styles/tokens';
import { multiplier } from '../../lib/logError';
import type { ChapterStat } from '../../lib/analysis';
import s from './charts.module.css';

export interface ErrorRow {
  key: string;
  label: string;
  n: number;
  excluded?: number;
  median: number | null;
}

/** "2.1× low" / "1.4× high" / "on target" for a median log error. */
export function describeLogError(le: number | null): string {
  if (le === null) return 'no data';
  const m = multiplier(le);
  if (m < 1.05) return 'on target';
  return `${m < 10 ? m.toFixed(1) : Math.round(m)}× ${le < 0 ? 'low' : 'high'}`;
}

const TICKS = [-Math.log(8), -Math.log(4), -Math.log(2), 0, Math.log(2), Math.log(4), Math.log(8)];
const tickLabel = (v: number) => (Math.abs(v) < 1e-9 ? 'exact' : `${Math.round(Math.exp(Math.abs(v)))}× ${v < 0 ? 'low' : 'high'}`);

function ErrorTip({ active, payload }: { active?: boolean; payload?: { payload: ErrorRow }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className={s.tooltip}>
      <strong>{r.label}</strong>
      Median guess: {describeLogError(r.median)}
      <br />
      Median ln error: {r.median === null ? '—' : r.median.toFixed(3)}
      <br />n = {r.n}
      {r.excluded ? ` (${r.excluded} zero guesses excluded)` : ''}
    </div>
  );
}

/** Horizontal diverging bars of median log error, zero = exact. Scales to any number of rows. */
export function LogErrorChart({ rows, labelWidth = 220 }: { rows: ErrorRow[]; labelWidth?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  /** Narrow screens: item names move above each bar instead of a y-axis column. */
  const narrow = w < 560;
  const data = rows.filter((r) => r.median !== null).map((r) => ({ ...r, value: r.median as number }));
  if (data.length === 0) return <p className={s.empty}>No responses match these filters.</p>;
  const maxAbs = Math.max(Math.log(2), ...data.map((d) => Math.abs(d.value)));
  const lim = Math.min(Math.log(8), maxAbs * 1.35);
  const ticks = TICKS.filter((t) => Math.abs(t) <= lim + 1e-9);
  const height = Math.max(140, data.length * (narrow ? 60 : 44) + 48);
  const axisStyle = { fontSize: fontPx.xs, fontFamily: font.body, fill: chart.axis };

  return (
    <>
      <div className={s.legend} aria-hidden>
        <span className={s.key}>
          <span className={`${s.swatch} ${s.under}`} /> Guesses too low
        </span>
        <span className={s.key}>
          <span className={`${s.swatch} ${s.over}`} /> Guesses too high
        </span>
      </div>
      <div ref={box} style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: narrow ? 18 : 4, right: 16, bottom: 4, left: 4 }} barCategoryGap={narrow ? 22 : 10}>
            <CartesianGrid horizontal={false} stroke={chart.grid} strokeWidth={1} />
            <XAxis
              type="number"
              domain={[-lim, lim]}
              ticks={ticks}
              tickFormatter={tickLabel}
              tick={axisStyle}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={narrow ? 0 : labelWidth}
              hide={narrow}
              tick={{ ...axisStyle, fill: color.foreground, fontSize: fontPx.sm }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine x={0} stroke={color.foreground} strokeWidth={2} />
            <Tooltip content={<ErrorTip />} cursor={{ fill: color.muted }} />
            <Bar dataKey="value" maxBarSize={24} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.key} fill={d.value < 0 ? chart.under : chart.over} radius={(d.value < 0 ? [4, 0, 0, 4] : [0, 4, 4, 0]) as unknown as number} />
              ))}
              <LabelList
                dataKey="value"
                content={(props) => {
                  const { x = 0, y = 0, width = 0, height: h = 0, value } = props as { x?: number; y?: number; width?: number; height?: number; value?: number };
                  const v = Number(value);
                  // Right edge of the bar: the tip for "high" bars, the zero line for "low" bars.
                  const right = Math.max(Number(x), Number(x) + Number(width));
                  return (
                    <text x={right + 6} y={Number(y) + Number(h) / 2} dy={4} textAnchor="start" fontSize={fontPx.xs} fontFamily={font.body} fontWeight={700} fill={color.foreground}>
                      {describeLogError(v)}
                    </text>
                  );
                }}
              />
              {narrow && (
                <LabelList
                  dataKey="label"
                  content={(props) => {
                    const { y = 0, value } = props as { y?: number; value?: string };
                    return (
                      <text x={8} y={Number(y) - 6} fontSize={fontPx.sm} fontFamily={font.body} fontWeight={600} fill={color.foreground}>
                        {value}
                      </text>
                    );
                  }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export interface DirectionRow {
  key: string;
  label: string;
  n: number;
  under: number;
  exact: number;
  over: number;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Error direction per item: table with a gap-separated 100% bar (table view = accessible view). */
export function DirectionTable({ rows }: { rows: DirectionRow[] }) {
  if (rows.length === 0) return <p className={s.empty}>No responses match these filters.</p>;
  return (
    <>
      <div className={s.legend} aria-hidden>
        <span className={s.key}>
          <span className={`${s.swatch} ${s.under}`} /> Under
        </span>
        <span className={s.key}>
          <span className={`${s.swatch} ${s.exact}`} /> Within 1%
        </span>
        <span className={s.key}>
          <span className={`${s.swatch} ${s.over}`} /> Over
        </span>
      </div>
      <div className={s.scroll}>
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col" className={s.hideSm}>
                Split
              </th>
              <th scope="col" className={s.num}>
                Under
              </th>
              <th scope="col" className={s.num}>
                Over
              </th>
              <th scope="col" className={s.num}>
                n
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className={s.itemName}>{r.label}</td>
                <td className={s.hideSm}>
                  <div className={s.stack} aria-hidden>
                    {r.under > 0 && <span className={s.under} style={{ flex: r.under }} />}
                    {r.exact > 0 && <span className={s.exact} style={{ flex: r.exact }} />}
                    {r.over > 0 && <span className={s.over} style={{ flex: r.over }} />}
                  </div>
                </td>
                <td className={s.num}>{pct(r.under)}</td>
                <td className={s.num}>{pct(r.over)}</td>
                <td className={s.num}>{r.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Responses per chapter with a low-n flag (icon + text, never colour alone). */
export function ChapterTable({ rows, lowN }: { rows: ChapterStat[]; lowN: number }) {
  if (rows.length === 0) return <p className={s.empty}>No responses match these filters.</p>;
  const max = Math.max(...rows.map((r) => r.responses), 1);
  return (
    <div className={s.scroll}>
      <table className={s.table}>
        <thead>
          <tr>
            <th scope="col">Chapter</th>
            <th scope="col" className={s.hideSm}>
              <span className="sr-only">Bar</span>
            </th>
            <th scope="col" className={s.num}>
              Responses
            </th>
            <th scope="col" className={s.num}>
              Students
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.chapter}>
              <td>
                <span className={s.chapterCell}>
                  <span className={s.itemName}>{r.chapter}</span>
                  {r.lowN && (
                    <span className={s.low} title={`Fewer than ${lowN} responses: interpret with caution`}>
                      <TriangleAlert size={14} strokeWidth={2.5} aria-hidden /> Low n
                    </span>
                  )}
                </span>
              </td>
              <td className={`${s.barCell} ${s.hideSm}`}>
                <div className={s.chapterBar} style={{ width: `${(r.responses / max) * 100}%` }} aria-hidden />
              </td>
              <td className={s.num}>{r.responses}</td>
              <td className={s.num}>{r.attempts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
