import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCheck, Download, Layers, ListChecks, MapPin } from 'lucide-react';
import { api, IS_DEMO } from '../../api';
import { ApiError, type ExportData, type ExportFilters } from '../../api/types';
import { resetMock } from '../../api/mock';
import { Button } from '../../components/Button';
import { ChartCard } from '../../components/ChartCard';
import { Card } from '../../components/Card';
import { FieldError } from '../../components/FieldError';
import { IconBadge } from '../../components/IconBadge';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { Select } from '../../components/Select';
import { StaffShell } from '../../components/StaffShell';
import { StatTile } from '../../components/StatTile';
import { ALL_ITEMS, getItem } from '../../items';
import { DECA_LABELS } from '../../items/types';
import { applyFilters, LOW_N, summarize } from '../../lib/analysis';
import { downloadText, responsesToCsv } from '../../lib/csv';
import { browserKV } from '../../lib/storage';
import { PasscodeGate } from '../facilitator/PasscodeGate';
import { ChapterTable, describeLogError, DirectionTable, LogErrorChart } from './charts';
import cs from './charts.module.css';
import s from './Analysis.module.css';

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDay = (iso: string) => dateFmt.format(new Date(`${iso}T12:00:00`));
const pctFmt = (v: number) => `${Math.round(v)}%`;

export function Analysis() {
  return <PasscodeGate>{(pass, lock) => <AnalysisView pass={pass} lock={lock} />}</PasscodeGate>;
}

function AnalysisView({ pass, lock }: { pass: string; lock: () => void }) {
  const [data, setData] = useState<ExportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ExportFilters>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api.exportData(pass));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'bad_passcode') lock();
      else setError('Couldn’t load responses. Check the connection and try again.');
    }
  }, [pass, lock]);

  useEffect(() => {
    void load();
  }, [load]);

  const chapters = useMemo(() => [...new Set(data?.responses.map((r) => r.chapter_code) ?? [])].sort(), [data]);
  const filtered = useMemo(() => (data ? applyFilters(data, filters) : null), [data, filters]);
  const categoryOf = (id: string) => getItem(id)?.deca_category;
  const titleOf = (id: string) => getItem(id)?.title ?? id;
  const summary = useMemo(() => (filtered ? summarize(filtered, categoryOf, ALL_ITEMS.map((i) => i.id)) : null), [filtered]);

  const asOf = dateFmt.format(new Date());
  const dateLabel =
    filters.from || filters.to
      ? `${filters.from ? fmtDay(filters.from) : 'Start'} – ${filters.to ? fmtDay(filters.to) : asOf}`
      : `All dates · as of ${asOf}`;
  const scope = filters.chapter ? `Chapter ${filters.chapter}` : 'All chapters';

  const worst = summary?.items.filter((i) => i.median !== null).sort((a, b) => Math.abs(b.median!) - Math.abs(a.median!))[0];

  function exportCsv() {
    if (!filtered) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`money-check-responses-${stamp}${filters.chapter ? `-${filters.chapter}` : ''}.csv`, responsesToCsv(filtered.responses, categoryOf));
  }

  return (
    <StaffShell onLock={lock} decor={false}>
      <Screen width="page">
        <div className={s.stack}>
          <div className={s.head}>
            <div>
              <h1 className={s.h1}>
                Money Check results
                {IS_DEMO && <span className={s.demoTag}>Demo data</span>}
              </h1>
              <p className={s.sub}>
                {scope} · {dateLabel}. Aggregate only. Log error = ln(estimate ÷ true value); 0 means exact.
              </p>
            </div>
            <div className={s.actions}>
              {IS_DEMO && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    resetMock(browserKV());
                    window.location.reload();
                  }}
                >
                  Reset demo data
                </Button>
              )}
              <Button variant="gold" onClick={exportCsv} disabled={!filtered?.responses.length}>
                <IconBadge icon={Download} tone="soft" size="sm" />
                Export CSV
              </Button>
            </div>
          </div>

          <Card tight>
            <div className={s.filters} role="group" aria-label="Filters">
              <Select label="Chapter" value={filters.chapter ?? ''} onChange={(e) => setFilters({ ...filters, chapter: e.target.value || undefined })}>
                <option value="">All chapters</option>
                {chapters.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Input label="From" type="date" value={filters.from ?? ''} max={filters.to} onChange={(e) => setFilters({ ...filters, from: e.target.value || undefined })} />
              <Input label="To" type="date" value={filters.to ?? ''} min={filters.from} onChange={(e) => setFilters({ ...filters, to: e.target.value || undefined })} />
              <Button variant="secondary" onClick={() => setFilters({})} disabled={!filters.chapter && !filters.from && !filters.to}>
                Reset
              </Button>
            </div>
          </Card>

          {error && (
            <Card tight>
              <FieldError>{error}</FieldError>
              <Button variant="secondary" onClick={() => void load()}>
                Retry
              </Button>
            </Card>
          )}

          {!summary ? (
            !error && <p className={s.note}>Loading responses…</p>
          ) : (
            <>
              <div className={s.tiles}>
                <StatTile label="Responses" value={summary.responses} icon={ListChecks} tone="gold" highlight sub={summary.excluded ? `${summary.excluded} zero guesses` : undefined} />
                <StatTile label="Chapters" value={summary.chapters} icon={MapPin} tone="pink" />
                <StatTile label="Sessions" value={summary.sessions} icon={Layers} tone="soft" />
                <StatTile
                  label="Completion"
                  value={summary.completionRate === null ? 0 : summary.completionRate * 100}
                  format={pctFmt}
                  icon={CheckCheck}
                  tone="mint"
                  sub={`${summary.completed} of ${summary.attempts} students`}
                />
              </div>

              <ChartCard
                title="Median log error by item"
                subtitle="How far the typical guess landed from the true value. Left = too low, right = too high."
                n={summary.items.reduce((a, i) => a + i.n - i.excluded, 0)}
                date={dateLabel}
                tone="featured"
                footnote={summary.excluded ? `${summary.excluded} guesses of 0 have no log error and are excluded from medians (counted as "under" in the direction table).` : undefined}
              >
                {worst && worst.median !== null && (
                  <p className={cs.headline}>
                    Biggest miss: <strong>{titleOf(worst.item_id)}</strong>, typical guess {describeLogError(worst.median)} (n = {worst.n})
                  </p>
                )}
                <LogErrorChart rows={summary.items.map((i) => ({ key: i.item_id, label: titleOf(i.item_id), n: i.n, excluded: i.excluded, median: i.median }))} />
              </ChartCard>

              <div className={s.grid2}>
                <ChartCard title="Median log error by DECA category" n={summary.categories.reduce((a, c) => a + c.n, 0)} date={dateLabel}>
                  <LogErrorChart labelWidth={140} rows={summary.categories.map((c) => ({ key: c.category, label: DECA_LABELS[c.category], n: c.n, median: c.median }))} />
                </ChartCard>
                <ChartCard title="Error direction by item" subtitle="Share of guesses below vs above the true value." n={summary.responses} date={dateLabel}>
                  <DirectionTable rows={summary.items.map((i) => ({ key: i.item_id, label: titleOf(i.item_id), n: i.n, under: i.under, exact: i.exact, over: i.over }))} />
                </ChartCard>
              </div>

              <ChartCard
                title="Responses per chapter"
                subtitle={`Chapters with fewer than ${LOW_N} responses are flagged: treat their numbers as anecdotes.`}
                n={summary.responses}
                date={dateLabel}
              >
                <ChapterTable rows={summary.perChapter} lowN={LOW_N} />
              </ChartCard>
            </>
          )}
        </div>
      </Screen>
    </StaffShell>
  );
}
