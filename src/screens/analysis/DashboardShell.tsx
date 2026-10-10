import type { ReactNode } from 'react';
import { Download } from 'lucide-react';
import { IS_DEMO } from '../../api';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { FieldError } from '../../components/FieldError';
import { IconBadge } from '../../components/IconBadge';
import { Screen } from '../../components/Screen';
import { Select } from '../../components/Select';
import { StaffShell } from '../../components/StaffShell';
import { downloadText, responsesToCsv } from '../../lib/csv';
import { realResponses, type DataMode } from '../../lib/sample';
import type { Dashboard } from './useDashboard';
import s from './Dashboard.module.css';

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/** Shared frame: title, scope toggle (this workshop / all pooled), projector mode, CSV export. */
export function DashboardShell({ d, lock, title, sub, children }: { d: Dashboard; lock: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode }) {
  const sessions = [...(d.data?.sessions ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const exportCsv = () => {
    if (!d.scoped) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`money-check-${d.session ? d.session.chapter_code : 'all'}-${stamp}.csv`, responsesToCsv(realResponses(d.scoped.responses), d.data?.recodes));
  };
  return (
    <StaffShell onLock={lock} decor={false}>
      <Screen width="page">
        <div className={s.stack}>
          <div className={s.head}>
            <div>
              <h1 className={s.h1}>
                {title}
                {IS_DEMO && <span className={s.tag}>Demo data</span>}
                {d.projector && <span className={s.tag}>Projector</span>}
              </h1>
              {sub && <p className={s.sub}>{sub}</p>}
            </div>
            {!d.projector && (
              <Button variant="gold" onClick={exportCsv} disabled={!d.scoped || !realResponses(d.scoped.responses).length}>
                <IconBadge icon={Download} tone="soft" size="sm" />
                Export CSV
              </Button>
            )}
          </div>
          <Card tight>
            <div className={s.controls}>
              <Select label="Scope" value={d.sessionId} onChange={(e) => d.setSession(e.target.value)}>
                <option value="">All workshops (pooled)</option>
                {sessions.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.status === 'open' ? '● Live · ' : ''}
                    {x.chapter_code}
                    {x.cohort_label ? ` · ${x.cohort_label}` : ''} · {dateFmt.format(new Date(x.created_at))}
                  </option>
                ))}
              </Select>
              <Select label="Data" value={d.mode} onChange={(e) => d.setMode(e.target.value as DataMode)}>
                <option value="real">Real data only</option>
                <option value="sample">Sample data only</option>
                <option value="both">Real + sample</option>
              </Select>
              <label className={s.toggle}>
                <input type="checkbox" checked={d.projector} onChange={(e) => d.setProjector(e.target.checked)} />
                Projector mode
              </label>
              {d.live ? (
                <span className={s.live} aria-live="polite">
                  <span className={s.dot} aria-hidden /> Live · updated {d.loadedAt?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                </span>
              ) : (
                <span />
              )}
            </div>
          </Card>
          {d.sampleOn && (
            <p className={s.sampleBanner} role="status">
              <strong>Sample data.</strong> {d.mode === 'sample' ? 'These are made-up students' : 'This view includes made-up students'} for showing how the dashboard works. Not real results, and never saved or exported.
            </p>
          )}
          {d.error && <FieldError>{d.error}</FieldError>}
          {!d.scoped ? <p className={s.muted}>Loading responses…</p> : children}
        </div>
      </Screen>
    </StaffShell>
  );
}
