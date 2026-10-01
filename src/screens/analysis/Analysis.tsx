import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { ALL_PROBLEMS } from '../../items';
import { MODULE_LABELS } from '../../items/types';
import { reached, shareCorrect, stepRows } from '../../lib/analysis';
import { PasscodeGate } from '../facilitator/PasscodeGate';
import { DashboardShell } from './DashboardShell';
import { TopBar } from './TopBar';
import { CrossItem, type View } from './CrossItem';
import { useDashboard } from './useDashboard';
import x from './CrossItem.module.css';
import s from './Dashboard.module.css';

export function Analysis() {
  return <PasscodeGate>{(pass, lock) => <Overview pass={pass} lock={lock} />}</PasscodeGate>;
}

function Overview({ pass, lock }: { pass: string; lock: () => void }) {
  const d = useDashboard(pass, lock);
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') ?? 'problems') as View | 'problems';
  const setView = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === 'problems') next.delete('view');
    else next.set('view', v);
    setParams(next, { replace: true });
  };
  const tabs: [string, string][] = [['problems', 'Problems'], ['teach', 'Teach first'], ['students', 'Students'], ['quality', 'Quality']];
  const qs = new URLSearchParams({ ...(d.sessionId ? { session: d.sessionId } : {}), ...(d.projector ? { projector: '1' } : {}) }).toString();
  return (
    <DashboardShell
      d={d}
      lock={lock}
      title="Gap dashboard"
      sub={d.session ? `${d.session.chapter_code}${d.session.cohort_label ? ` · ${d.session.cohort_label}` : ''} · this workshop` : 'All workshops, pooled'}
    >
      {d.scoped && (
        <>
          <TopBar data={d.scoped} rc={d.rc} projector={d.projector} />
          <div className={x.tabs} role="group" aria-label="Dashboard view">
            {tabs.map(([k, label]) => (
              <button key={k} type="button" className={x.tab} aria-pressed={view === k} onClick={() => setView(k)}>
                {label}
              </button>
            ))}
          </div>
          {view !== 'problems' && <CrossItem d={d} pass={pass} view={view} />}
          {view === 'problems' && <section aria-labelledby="items-h">
            <h2 id="items-h" className="eyebrow" style={{ marginBottom: 12 }}>
              Problems
            </h2>
            <div className={s.items}>
              {ALL_PROBLEMS.map((p) => {
                const cold = p.steps.find((st) => st.kind === 'cold') ?? p.steps[0];
                const rows = stepRows(d.scoped!, p.id, cold.id);
                const pc = shareCorrect(rows, d.rc);
                const n = reached(d.scoped!, p.id);
                return (
                  <Link key={p.id} to={`/analysis/item/${p.id}${qs ? `?${qs}` : ''}`} className={s.itemLink}>
                    <Card tight className={s.itemCard}>
                      <span className={s.itemId}>
                        {p.id}
                        {p.draft && <span className={`${s.tag} ${s.draft}`}>Draft</span>}
                      </span>
                      <strong>{p.title}</strong>
                      <span className={s.muted}>{MODULE_LABELS[p.module]}</span>
                      <span className="num">
                        {n < d.minCell ? 'Fewer than 5 students' : `${pc === null ? '—' : `${Math.round(pc * 100)}%`} correct on ${cold.label.split(' · ')[0]} · n = ${rows.length}`}
                      </span>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>}
        </>
      )}
    </DashboardShell>
  );
}
