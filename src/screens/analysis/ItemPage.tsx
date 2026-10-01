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
import { Spaghetti } from '../../charts/Spaghetti';
import { correctOf, getProblem } from '../../items';
import { FAMILY_LABELS } from '../../items/families';
import type { ChartSpec, Problem } from '../../items/types';
import { cardFrequency, choiceSplit, curvePoints, curveShape, joinSteps, pairedValues, quadrantCounts, ratingPairs, reached, receiptMismatch, shadeMismatch, stepRows, vsReference, waterfall } from '../../lib/analysis';
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
