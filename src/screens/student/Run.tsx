import { useCallback, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Screen';
import { StudentShell } from '../../components/StudentShell';
import { getItem, truthOf } from '../../items';
import { clearRun, loadRun, saveRun, type RunState } from '../../lib/run';
import { browserKV } from '../../lib/storage';
import { queue, syncNow, useOnline } from '../../lib/sync';
import { uuid } from '../../lib/uuid';
import { Done } from './Done';
import { ItemView } from './ItemView';
import { RevealView } from './RevealView';

const kv = browserKV();

/** Student run: items → reveal → done. All state persists locally and survives reloads. */
export function Run() {
  const navigate = useNavigate();
  const online = useOnline();
  const [run, setRun] = useState<RunState | null>(() => loadRun(kv));

  const update = useCallback((next: RunState) => {
    saveRun(kv, next);
    setRun(next);
    window.scrollTo({ top: 0 });
  }, []);

  const items = (run?.item_ids ?? []).map((id) => getItem(id)).filter((x) => x !== undefined);

  const onSubmit = useCallback(
    (estimate: number) => {
      if (!run) return;
      const item = items[run.index];
      queue.addAnswer({
        answer_id: uuid(),
        attempt_id: run.attempt_id,
        session_id: run.session_id,
        item_id: item.id,
        item_version: item.version,
        estimate,
        truth: truthOf(item),
        answered_at: new Date().toISOString(),
      });
      void syncNow();
      const last = run.index + 1 >= items.length;
      update({ ...run, answers: { ...run.answers, [item.id]: estimate }, index: run.index + 1, phase: last ? 'reveal' : 'items' });
    },
    [run, items, update],
  );

  if (!run || items.length === 0) return <Navigate to="/" replace />;

  const shell = (children: React.ReactNode, decor: 'quiet' | 'reveal' | 'landing' = 'quiet', wide = false) => (
    <StudentShell chapter={run.chapter_code} online={online} decor={decor} wiggle={decor === 'landing'}>
      <Screen width={wide ? 'wide' : 'student'} key={`${run.phase}-${run.phase === 'reveal' ? run.revealIndex : 0}`}>
        {children}
      </Screen>
    </StudentShell>
  );

  if (run.phase === 'items') {
    const i = Math.min(run.index, items.length - 1);
    return shell(<ItemView item={items[i]} index={i} total={items.length} onSubmit={onSubmit} />);
  }

  if (run.phase === 'reveal') {
    const i = Math.min(run.revealIndex, items.length - 1);
    return shell(
      <RevealView
        item={items[i]}
        guess={run.answers[items[i].id] ?? 0}
        index={i}
        total={items.length}
        onNext={() => update(i + 1 >= items.length ? { ...run, phase: 'done' } : { ...run, revealIndex: i + 1 })}
      />,
      'reveal',
      true,
    );
  }

  return shell(
    <Done
      items={items}
      answers={run.answers}
      onFinish={() => {
        clearRun(kv);
        navigate('/');
      }}
    />,
    'landing',
  );
}
