import { useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Lightbulb, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ChartCard } from '../../components/ChartCard';
import { IconBadge } from '../../components/IconBadge';
import { CodeBar, CountBars, Funnel, ShareBar } from '../../charts/Bars';
import { DotPlot, type Selection } from '../../charts/DotPlot';
import { Calibration, Dumbbell } from '../../charts/Ratings';
import { CardHeat, Donut, PairedPlot, QuadGrid, SplitBars, TileGrid, Waterfall } from '../../charts/Misc';
import { Scatter } from '../../charts/Scatter';
import { CalendarHeat, PairTiles, Ridgeline, Sankey, Slope, SplitShare, TwoByTwo } from '../../charts/Stage3';
import { Spaghetti } from '../../charts/Spaghetti';
import { correctOf, getProblem } from '../../items';
import { FAMILY_LABELS } from '../../items/families';
import type { ChartSpec, Problem } from '../../items/types';
import { averageRanks, bucketCounts, calendarIntensity, choiceOf, confidencePoints, correct2x2, correctByGroup, firstLastShares, pairPattern, ratioRows, sankey, spearman, valuesByForm, cardFrequency, choiceSplit, curvePoints, curveShape, joinSteps, pairedValues, quadrantCounts, ratingPairs, reached, receiptMismatch, shadeMismatch, stepRows, vsReference, waterfall } from '../../lib/analysis';
import { median } from '../../lib/logError';
import { formatCode } from '../../lib/studentCode';
import { formatUnit } from '../../lib/format';
import { PasscodeGate } from '../facilitator/PasscodeGate';
import { DashboardShell } from './DashboardShell';
import { useDashboard, type Dashboard } from './useDashboard';
import s from './Dashboard.module.css';

export function ItemPage() {
  return <PasscodeGate>{(pass, lock) => <ItemView pass={pass} lock={lock} />}</PasscodeGate>;
}

const today = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function ItemView({ pass, lock }: { pass: string; lock: () => void }) {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const d = useDashboard(pass, lock);
  const [sel, setSel] = useState<Selection | null>(null);
  const p = getProblem(id);
  if (!p) return <Navigate to="/analysis" replace />;
  const back = `/analysis${params.toString() ? `?${params}` : ''}`;
  const scope = d.session ? `${d.session.chapter_code} · ${today.format(new Date(d.session.created_at))}` : `All workshops · ${today.format(new Date())}`;

  return (
    <DashboardShell
      d={d}
      lock={lock}
      title={
        <>
          {p.id} · {p.title}
          {p.draft && <span className={`${s.tag} ${s.draft}`}>Draft wording</span>}
        </>
      }
      sub={
        <>
          <Link className={s.back} to={back}>
            ← All problems
          </Link>{' '}
          · {p.families.map((f) => FAMILY_LABELS[f]).join(' · ')}
        </>
      }
    >
      {d.scoped && (
        <>
          <div className={s.decision}>
            <IconBadge icon={Lightbulb} tone="gold" />
            <p>
              <strong>Facilitator decision.</strong> {p.decision}
            </p>
          </div>
          {reached(d.scoped, p.id) < d.minCell ? (
            <Card>Fewer than 5 students reached this problem, so it is hidden in projector mode.</Card>
          ) : (
            <div className={s.grid2}>
              {p.admin.map((c, i) => (
                <ItemChart key={i} p={p} c={c} d={d} scope={scope} onSelect={d.projector ? undefined : setSel} />
              ))}
            </div>
          )}
          {p.notes?.map((n) => (
            <p key={n} className={s.notes}>
              {n}
            </p>
          ))}
          {sel && !d.projector && (
            <Card tone="featured" className={s.panel} role="dialog" aria-label={`Students: ${sel.label}`}>
              <div className={s.head}>
                <strong>{sel.label}</strong>
                <Button variant="ghost" size="sm" onClick={() => setSel(null)} aria-label="Close list">
                  <IconBadge icon={X} tone="muted" size="sm" />
                </Button>
              </div>
              <p className={s.muted}>
                {sel.rows.length} {sel.rows.length === 1 ? 'student' : 'students'}. Anonymous codes, for small-group follow-up during teaching.
              </p>
              <div className={s.codes}>
                {[...new Set(sel.rows.map((r) => r.student_code))].sort().map((c) => (
                  <span key={c} className="num">
                    {formatCode(c)}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </DashboardShell>
  );
}

function ItemChart({ p, c, d, scope, onSelect }: { p: Problem; c: ChartSpec; d: Dashboard; scope: string; onSelect?: (s: Selection) => void }) {
  const data = d.scoped!;
  const rc = d.rc;
  const total = reached(data, p.id);
  const stepOf = (id: string) => p.steps.find((x) => x.id === id)!;
  switch (c.type) {
    case 'dots': {
      const st = stepOf(c.step);
      const axis = c.axis ?? (st.input.type === 'numberLine' || st.input.type === 'jar' ? st.input : null);
      const rows = stepRows(data, p.id, c.step);
      const vals = rows.filter((r) => r.raw_value !== null).map((r) => r.raw_value as number);
      const fallback = axis ?? { min: 0, max: Math.max(1, ...vals, correctOf(st) ?? 0) * 1.15, scale: 'linear' as const, unit: 'number' in st.input ? 'count' : 'usd' };
      const ax = axis ?? { ...fallback, unit: st.input.type === 'number' ? st.input.unit : 'usd' };
      return (
        <ChartCard title={c.title} subtitle={st.prompt} n={rows.length} date={scope} tone={c.primary ? 'featured' : 'default'}>
          <DotPlot rows={rows} blank={Math.max(0, total - rows.length)} axis={ax} correct={typeof st.correct === 'number' ? st.correct : null} codes={st.codes ?? []} rc={rc} onSelect={onSelect} />
        </ChartCard>
      );
    }
    case 'codeBar': {
      const steps = c.steps.map((id) => ({ label: stepOf(id).label, rows: stepRows(data, p.id, id) }));
      return (
        <ChartCard title={c.title} n={total} date={scope}>
          <CodeBar steps={steps} rc={rc} onSelect={onSelect} />
        </ChartCard>
      );
    }
    case 'funnel': {
      const steps = c.steps.map((id) => ({ label: stepOf(id).label, rows: stepRows(data, p.id, id) }));
      return (
        <ChartCard title={c.title} n={total} date={scope}>
          <Funnel steps={steps} rc={rc} />
        </ChartCard>
      );
    }
    case 'shareBar': {
      const rows = stepRows(data, p.id, c.step);
      return (
        <ChartCard title={c.title} n={rows.length} date={scope} tone="featured">
          <ShareBar rows={rows} buckets={c.buckets} rc={rc} onSelect={onSelect} />
        </ChartCard>
      );
    }
    case 'dumbbell': {
      const pairs = ratingPairs(data, p.id, c.gut, c.post);
      return (
        <ChartCard title={c.title} n={pairs.length} date={scope}>
          <Dumbbell pairs={pairs} showCodes={!d.projector} />
        </ChartCard>
      );
    }
    case 'calibration': {
      const pairs = ratingPairs(data, p.id, c.gut, c.post);
      return (
        <ChartCard title={c.title} n={pairs.length} date={scope}>
          <Calibration pairs={pairs} suppressBelow={d.minCell} />
        </ChartCard>
      );
    }
    case 'spaghetti': {
      const rows = stepRows(data, p.id, c.step);
      return (
        <ChartCard title={c.title} n={rows.length} date={scope} tone="featured">
          <Spaghetti curves={curvePoints(rows)} start={c.start} xMax={c.xMax} yMax={c.yMax} midX={c.midX} linear={c.linear} truth={c.truth} unit={c.unit} blank={Math.max(0, total - rows.length)} />
        </ChartCard>
      );
    }
    case 'curveShapes': {
      const pts = curvePoints(stepRows(data, p.id, c.step));
      const count = { straight: 0, convex: 0, concave: 0, 'no midpoint': 0 };
      for (const q of pts) count[curveShape(c.start, q.y5, q.y10)]++;
      return (
        <ChartCard title={c.title} subtitle={`Decided by the year-${c.midX} point against a straight line.`} n={pts.length} date={scope}>
          <Donut
            slices={[
              { label: 'Straight (linear thinking)', n: count.straight, tone: 'wrong' },
              { label: 'Curves up (compounding-like)', n: count.convex, tone: 'corr' },
              { label: 'Curves down (levels off)', n: count.concave, tone: 'unk' },
              { label: `No year-${c.midX} point`, n: count['no midpoint'], tone: 'neutral' },
            ]}
          />
        </ChartCard>
      );
    }
    case 'scatter': {
      const ys = stepOf(c.y.step);
      const yAxis = c.y.axis ?? (ys.input.type === 'numberLine' || ys.input.type === 'jar' ? ys.input : { min: 0, max: 100, scale: 'linear' as const, unit: 'usd' as const });
      const xs = stepOf(c.x.step);
      const xAxis = c.x.axis ?? (xs.input.type === 'numberLine' || xs.input.type === 'jar' ? xs.input : yAxis);
      const pts = joinSteps(data, p.id, c.x.step, c.y.step, rc, c.belief);
      return (
        <ChartCard title={c.title} subtitle={c.note} n={pts.length} date={scope}>
          <Scatter
            points={pts}
            x={c.x.mode === 'correct' ? { kind: 'cat', labels: ['Step wrong', 'Step right'] } : { kind: 'num', axis: xAxis }}
            y={yAxis}
            diagonal={c.diagonal}
            refX={c.refX}
            refY={c.refY}
            showBelief={!!c.belief}
            xLabel={`${xs.label}${c.x.mode === 'correct' ? ' (right or wrong)' : ''}`}
            yLabel={ys.label}
            showCodes={!d.projector}
          />
        </ChartCard>
      );
    }
    case 'tileGrid': {
      const rows = stepRows(data, p.id, c.step);
      return (
        <ChartCard title={c.title} n={rows.length} date={scope}>
          <TileGrid rows={rows} rc={rc} showCodes={!d.projector} minCell={d.minCell} note={c.note} />
        </ChartCard>
      );
    }
    case 'vsRef': {
      const rows = stepRows(data, p.id, c.step);
      const r = vsReference(rows, c.ref, c.tolPct);
      return (
        <ChartCard title={c.title} n={rows.length} date={scope}>
          <CountBars
            items={[
              { label: c.labels[0], n: r.below, tone: 'wrong' },
              { label: `${c.labels[1]} (${formatUnit(c.ref, c.unit)})`, n: r.exact, tone: 'corr' },
              { label: c.labels[2], n: r.above, tone: 'unk' },
            ]}
            total={r.below + r.exact + r.above}
          />
        </ChartCard>
      );
    }
    case 'paired': {
      const pairs = pairedValues(data, p.id, c.a, c.b);
      return (
        <ChartCard title={c.title} n={pairs.length} date={scope}>
          <PairedPlot pairs={pairs} axis={c.axis} showCodes={!d.projector} note={c.note} />
        </ChartCard>
      );
    }
    case 'choiceSplit': {
      const st = stepOf(c.step);
      const opts = st.input.type === 'choice' ? st.input.options : [];
      const g = choiceSplit(data, p.id, c.step, c.by);
      return (
        <ChartCard title={c.title} n={stepRows(data, p.id, c.step).length} date={scope}>
          <SplitBars groups={g} options={opts} labels={{ yes: c.by.yes, no: c.by.no }} total={stepRows(data, p.id, c.step).length} />
        </ChartCard>
      );
    }
    case 'cardHeat': {
      const st = stepOf(c.step);
      const cards = st.input.type === 'stack' ? st.input.cards : [];
      const rows = stepRows(data, p.id, c.step);
      return (
        <ChartCard title={c.title} n={rows.length} date={scope} tone="featured">
          <CardHeat stats={cardFrequency(rows, cards.map((x) => x.id))} cards={cards} total={rows.length} />
        </ChartCard>
      );
    }
    case 'waterfall': {
      const rows = stepRows(data, p.id, c.stack);
      const w = waterfall(rows, c.cards);
      const typed = median(stepRows(data, p.id, c.profit).map((r) => r.raw_value).filter((v): v is number => v !== null));
      return (
        <ChartCard title={c.title} n={rows.length} date={scope} tone="featured">
          <Waterfall steps={w.steps} cards={c.cards} implied={w.implied} correct={c.correct} typedMedian={typed} n={rows.length} />
        </ChartCard>
      );
    }
    case 'quadrants': {
      const q = quadrantCounts(data, p.id, c.x, c.belief);
      const n = q.goodBelieves + q.goodDoubts + q.badBelieves + q.badDoubts;
      return (
        <ChartCard title={c.title} subtitle={`“Compounds well” = Step 1 balance within ${c.x.withinPct}% of the true value.`} n={n} date={scope}>
          <QuadGrid q={q} labels={{ good: c.x.good, bad: c.x.bad, yes: c.belief.yes, no: c.belief.no }} suppressBelow={d.minCell} />
        </ChartCard>
      );
    }
    case 'sankey': {
      const sd = sankey(data, p.id, c.columns, rc);
      return (
        <ChartCard title={c.title} n={sd.n} date={scope} tone="featured">
          <Sankey data={sd} />
        </ChartCard>
      );
    }
    case 'pairTiles': {
      const pp = pairPattern(data, c.a, c.b);
      return (
        <ChartCard title={c.title} subtitle={c.note} n={pp.n} date={scope} tone="featured">
          <PairTiles p={pp} a={c.a.word} b={c.b.word} suppressBelow={d.minCell} />
        </ChartCard>
      );
    }
    case 'correctSplit': {
      const g = correctByGroup(data, rc, { item: p.id, step: c.step }, c.group);
      return (
        <ChartCard title={c.title} n={g.yes.n + g.no.n} date={scope}>
          <SplitShare groups={[{ label: c.group.yes, ...g.yes }, { label: c.group.no, ...g.no }]} />
        </ChartCard>
      );
    }
    case 'ridgeline': {
      const rows = stepRows(data, p.id, c.step);
      const by = valuesByForm(rows);
      return (
        <ChartCard title={c.title} subtitle="Raw dots per student with the median. Dots only below 30 per group; a density curve is added above that." n={rows.length} date={scope}>
          <Ridgeline byForm={by} labels={c.labels} anchors={c.anchors} axis={c.axis} unit="usd" minForN={30} />
        </ChartCard>
      );
    }
    case 'logRatio': {
      const rows = stepRows(data, p.id, c.step);
      const ratios = ratioRows(rows, c.truth);
      const under = ratios.filter((r) => (r.raw_value as number) < 0.95).length;
      const over = ratios.filter((r) => (r.raw_value as number) > 1.05).length;
      return (
        <ChartCard title={c.title} subtitle={`Each dot is guess ÷ true value (${formatUnit(c.truth, c.unit)}), on a log scale. Left of 1× = too low, right = too high.`} n={ratios.length} date={scope} tone="featured" footnote={`${under} guessed more than 5% too low · ${over} more than 5% too high · the shaded band is ±5%`}>
          <DotPlot
            rows={ratios}
            blank={Math.max(0, total - rows.length)}
            axis={{ min: 0.01, max: 100, scale: 'log', unit: 'times' }}
            correct={1}
            codes={[]}
            rc={rc}
            bandPct={5}
            extraRefs={(c.marks ?? []).map((m) => ({ value: m.value / c.truth, label: `${m.label} (${(m.value / c.truth).toPrecision(2)}×)` }))}
            plain
            ends={['guessed too low', 'guessed too high']}
          />
        </ChartCard>
      );
    }
    case 'confError': {
      const pts = confidencePoints(data, p.id, c.gut, c.step, c.truth);
      return (
        <ChartCard title={c.title} subtitle="Top right = confident (gut rating 4–5) and far off. Height is how many powers of ten away the guess was." n={pts.length} date={scope}>
          <Scatter
            points={pts}
            x={{ kind: 'num', axis: { min: 0.5, max: 5.5, scale: 'linear', unit: 'count' } }}
            y={{ min: 0, max: 2.5, scale: 'linear', unit: 'count' }}
            xLabel="Gut rating (1 = almost certainly false, 5 = almost certainly true)"
            yLabel="Powers of ten off"
            showCodes={!d.projector}
          />
        </ChartCard>
      );
    }
    case 'slope': {
      const r1 = stepRows(data, p.id, c.first);
      const r2 = stepRows(data, p.id, c.second);
      return (
        <ChartCard title={c.title} n={r2.length} date={scope} tone="featured">
          <Slope first={averageRanks(r1, c.order)} second={averageRanks(r2, c.order)} order={c.order} labels={c.labels} n={r2.length} />
        </ChartCard>
      );
    }
    case 'rankCorr': {
      const mk = (step: string) =>
        stepRows(data, p.id, step)
          .map((r) => ({ ...r, raw_value: spearman(choiceOf(r), c.order) }))
          .filter((r) => r.raw_value !== null);
      const r1 = mk(c.first);
      const r2 = mk(c.second);
      const axis = { min: -1, max: 1, scale: 'linear' as const, unit: 'count' as const };
      return (
        <ChartCard title={c.title} subtitle="Rank correlation with the computed order: 1 = identical, −1 = reversed." n={r2.length} date={scope}>
          <p className="eyebrow">First ranking · median {r1.length ? (r1.map((r) => r.raw_value as number).sort((a, b) => a - b)[r1.length >> 1]).toFixed(2) : '—'}</p>
          <DotPlot rows={r1} blank={0} axis={axis} correct={1} codes={[]} rc={rc} plain />
          <p className="eyebrow">Second ranking · median {r2.length ? (r2.map((r) => r.raw_value as number).sort((a, b) => a - b)[r2.length >> 1]).toFixed(2) : '—'}</p>
          <DotPlot rows={r2} blank={0} axis={axis} correct={1} codes={[]} rc={rc} plain />
        </ChartCard>
      );
    }
    case 'firstLast': {
      const rows = stepRows(data, p.id, c.step);
      const sh = firstLastShares(rows, Object.keys(c.labels));
      return (
        <ChartCard title={c.title} n={rows.length} date={scope}>
          <p className="eyebrow">Ranked first (most believable)</p>
          <CountBars items={sh.map((x) => ({ label: c.labels[x.id], n: x.first, tone: 'neutral' as const }))} total={rows.length} />
          <p className="eyebrow">Ranked last (least believable)</p>
          <CountBars items={sh.map((x) => ({ label: c.labels[x.id], n: x.last, tone: 'neutral' as const }))} total={rows.length} />
        </ChartCard>
      );
    }
    case 'calendarHeat': {
      const rows = stepRows(data, p.id, c.step);
      const st = stepOf(c.step);
      const avg = st.input.type === 'calendar' && st.input.mode === 'count';
      return (
        <ChartCard title={c.title} n={rows.length} date={scope}>
          <CalendarHeat cells={c.cells} columns={c.columns} cellWord={c.cellWord} values={calendarIntensity(rows, c.cells)} unit={avg ? 'avg' : 'share'} n={rows.length} />
        </ChartCard>
      );
    }
    case 'valueBuckets': {
      const rows = stepRows(data, p.id, c.step);
      const counts = bucketCounts(rows, c.buckets);
      return (
        <ChartCard title={c.title} n={rows.length} date={scope} footnote={c.note}>
          <CountBars items={c.buckets.map((b, i) => ({ label: b.label, n: counts[i], tone: b.tone }))} total={rows.length} />
        </ChartCard>
      );
    }
    case 'twoByTwo': {
      const q = correct2x2(data, p.id, c.x.step, c.y.step, rc);
      return (
        <ChartCard title={c.title} subtitle={c.note} n={q.n} date={scope}>
          <TwoByTwo q={q} x={c.x.label} y={c.y.label} suppressBelow={d.minCell} />
        </ChartCard>
      );
    }
    case 'choiceBar': {
      const rows = stepRows(data, p.id, c.step);
      const st = stepOf(c.step);
      const opts = st.input.type === 'choice' ? st.input.options : [];
      return (
        <ChartCard title={c.title} n={rows.length} date={scope}>
          <CountBars
            items={opts.map((o) => ({ label: o.label, n: rows.filter((r) => (r.value?.choice as string[] | undefined)?.includes(o.id)).length, tone: st.correctChoice?.includes(o.id) ? ('corr' as const) : ('neutral' as const) }))}
            total={rows.length}
          />
        </ChartCard>
      );
    }
    case 'textTags': {
      const rows = stepRows(data, p.id, c.step).filter((r) => r.free_text);
      const tagOf = (id: string) => rc.get(id)?.tag ?? null;
      const items = c.tags.map((t) => ({ label: t[0].toUpperCase() + t.slice(1), n: rows.filter((r) => tagOf(r.answer_id) === t).length, tone: (t === 'present' ? 'corr' : t === 'absent' ? 'wrong' : 'unk') as 'corr' | 'wrong' | 'unk' }));
      const uncoded = rows.filter((r) => !tagOf(r.answer_id)).length;
      return (
        <ChartCard title={c.title} n={rows.length} date={scope} footnote="Free-text answers are coded by a person (Stage 4 adds the coding tool). Never auto-scored.">
          <CountBars items={[...items, { label: 'Not coded yet', n: uncoded, tone: 'none' }]} total={rows.length} />
        </ChartCard>
      );
    }
    case 'consistency': {
      if (c.check === 'receiptTotal') {
        const r = receiptMismatch(data, p.id, 80, c.steps[0], c.steps[1]);
        return (
          <ChartCard title={c.title} n={r.checked} date={scope} footnote={c.note}>
            <CountBars
              items={[
                { label: 'Total = $80 + their tax', n: r.checked - r.mismatched.length, tone: 'corr' },
                { label: 'Doesn’t add up', n: r.mismatched.length, tone: 'wrong' },
              ]}
              total={r.checked}
            />
            {onSelect && r.mismatched.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => onSelect({ label: 'Receipt doesn’t add up', rows: r.mismatched })}>
                List student codes
              </Button>
            )}
          </ChartCard>
        );
      }
      const st = stepOf(c.steps[0]);
      const whole = st.input.type === 'shade' ? st.input.whole : 1;
      const rows = stepRows(data, p.id, c.steps[0]);
      const shaded = rows.filter((r) => typeof r.value?.fraction === 'number');
      const mism = shadeMismatch(shaded, whole);
      return (
        <ChartCard title={c.title} n={rows.length} date={scope} footnote={c.note}>
          <CountBars
            items={[
              { label: 'Shading matches typed answer', n: shaded.length - mism.length, tone: 'corr' },
              { label: 'Shading disagrees', n: mism.length, tone: 'wrong' },
              { label: 'Didn’t shade', n: rows.length - shaded.length, tone: 'none' },
            ]}
            total={rows.length}
          />
          {onSelect && mism.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => onSelect({ label: 'Shading disagrees with typed answer', rows: mism })}>
              List student codes
            </Button>
          )}
        </ChartCard>
      );
    }
  }
}
