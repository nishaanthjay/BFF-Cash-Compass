import { CheckCheck, CircleHelp, Timer, Users } from 'lucide-react';
import { Card } from '../../components/Card';
import { StatTile } from '../../components/StatTile';
import { CountBars } from '../../charts/Bars';
import { topBar, type RecodeMap } from '../../lib/analysis';
import type { ExportData } from '../../api/types';
import s from './Dashboard.module.css';

const METHOD_LABELS: Record<string, string> = { typed: 'Typed', dragged: 'Dragged', tapped: 'Tapped', dragged_then_typed: 'Dragged, then typed' };
const DEVICE_LABELS: Record<string, string> = { laptop: 'Laptop / Chromebook', phone: 'Phone', tablet: 'Tablet' };

/** Spec §5.2: always-visible top bar. */
export function TopBar({ data, rc, projector }: { data: ExportData; rc: RecodeMap; projector: boolean }) {
  const t = topBar(data, rc);
  const flags = [
    { label: 'Straight-lined ratings', codes: t.flags.straightLined },
    { label: 'Same answer on many items', codes: t.flags.identical },
    { label: 'Finished in under 3 minutes', codes: t.flags.tooFast },
  ];
  return (
    <>
      <div className={s.tiles}>
        <StatTile label="Started" value={t.started} icon={Users} tone="soft" />
        <StatTile label="Finished" value={t.finished} icon={CheckCheck} tone="mint" sub={t.started ? `${Math.round((t.finished / t.started) * 100)}% of started` : undefined} />
        <StatTile label="Median time" value={t.medianMinutes ?? 0} format={(v) => (t.medianMinutes === null ? '—' : `${Math.round(v)} min`)} icon={Timer} tone="gold" sub="finished students" />
        <StatTile label="Unclassified" value={t.unk} icon={CircleHelp} tone="pink" sub="answers coded UNK" />
      </div>
      <div className={s.grid3}>
        <Card tight>
          <h2 className={`eyebrow ${s.cardTitle}`}>Input method (answers)</h2>
          <CountBars items={t.methods.map((m) => ({ label: METHOD_LABELS[m.key] ?? m.key, n: m.n, tone: 'neutral' as const }))} total={t.methods.reduce((a, m) => a + m.n, 0)} />
        </Card>
        <Card tight>
          <h2 className={`eyebrow ${s.cardTitle}`}>Device (students)</h2>
          <CountBars items={t.devices.map((m) => ({ label: DEVICE_LABELS[m.key] ?? m.key, n: m.n, tone: 'neutral' as const }))} total={t.started} />
        </Card>
        <Card tight>
          <h2 className={`eyebrow ${s.cardTitle}`}>Data-quality flags</h2>
          <div className={s.flagList}>
            {flags.map((f) => (
              <div key={f.label} className={s.flag}>
                <span>{f.label}</span>
                <strong title={projector ? undefined : f.codes.join(', ')}>{f.codes.length}</strong>
              </div>
            ))}
            <p className={s.notes}>Exploratory. A flag is a reason to look, not a verdict.</p>
          </div>
        </Card>
      </div>
    </>
  );
}
