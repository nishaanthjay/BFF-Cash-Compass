import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Screen';
import { StudentShell } from '../../components/StudentShell';
import type { StepValue } from '../../inputs/types';
import { redact } from '../../inputs/Choice';
import { correctOf, getProblem } from '../../items';
import type { Prior } from '../../items/types';
import { classify } from '../../lib/classify';
import { clearRun, loadRun, saveRun, type RunState } from '../../lib/run';
import { browserKV } from '../../lib/storage';
import { queue, syncNow, useOnline } from '../../lib/sync';
import { deviceType } from '../../lib/telemetry';
import { uuid } from '../../lib/uuid';
import { Done } from './Done';
import { SavedToast, StepView, type LockedTelemetry } from './StepView';

const kv = browserKV();

/** The questionnaire: problems in the student's seeded order, one step per screen, no feedback. */
export function Run() {
  const navigate = useNavigate();
  const online = useOnline();
  const [run, setRun] = useState<RunState | null>(() => loadRun(kv));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 1200);
    return () => clearTimeout(t);
  }, [saved]);

  const problems = (run?.sequence ?? []).map((id) => getProblem(id)).filter((p) => p !== undefined);
  const total = problems.reduce((a, p) => a + p.steps.length, 0);

  const onLock = useCallback(
    (v: StepValue, t: LockedTelemetry) => {
      if (!run) return;
      const problem = problems[run.pi];
      const step = problem.steps[run.si];
      const prior: Prior = {};
      for (const st of problem.steps) prior[st.id] = run.answers[`${problem.id}.${st.id}`]?.raw ?? null;
      const text = v.text ? redact(v.text) : null;
      queue.addAnswer({
        answer_id: uuid(),
        session_id: run.session_id,
        student_code: run.student_code,
        item_id: problem.id,
        item_version: problem.version,
        step_id: step.id,
        form_version: run.forms[problem.id] ?? null,
        raw_value: v.raw,
        value: v.choice || v.extra ? { ...(v.choice ? { choice: v.choice } : {}), ...(v.extra ?? {}) } : null,
        input_method: t.input_method,
        strategy_codes: classify(step, v.raw, prior, v.choice),
        correct_value: correctOf(step, prior),
        time_to_first_touch_ms: t.time_to_first_touch_ms === null ? null : Math.round(t.time_to_first_touch_ms),
        time_to_lock_ms: Math.round(t.time_to_lock_ms),
        n_revisions: t.n_revisions,
        item_position: run.pi + 1,
        free_text: text,
        device_type: deviceType(),
        answered_at: new Date().toISOString(),
      });
      void syncNow();
      const lastStep = run.si + 1 >= problem.steps.length;
      const lastProblem = run.pi + 1 >= problems.length;
      const next: RunState = {
        ...run,
        answers: { ...run.answers, [`${problem.id}.${step.id}`]: { ...v, text: text ?? undefined } },
        pi: lastStep ? (lastProblem ? run.pi : run.pi + 1) : run.pi,
        si: lastStep ? 0 : run.si + 1,
        done: lastStep && lastProblem,
      };
      saveRun(kv, next);
      setRun(next);
      setSaved(true);
      window.scrollTo({ top: 0 });
    },
    [run, problems],
  );

  if (!run || problems.length === 0) return <Navigate to="/" replace />;

  const doneSteps = problems.slice(0, run.pi).reduce((a, p) => a + p.steps.length, 0) + run.si;

  if (run.done) {
    return (
      <StudentShell chapter={run.chapter_code} online={online} decor="landing" wiggle>
        <Screen>
          <Done
            studentCode={run.student_code}
            onFinish={() => {
              clearRun(kv);
              navigate('/');
            }}
          />
        </Screen>
      </StudentShell>
    );
  }

  const problem = problems[run.pi];
  const own: Record<string, number | null> = {};
  for (const st of problem.steps) own[st.id] = run.answers[`${problem.id}.${st.id}`]?.raw ?? null;

  return (
    <StudentShell chapter={run.chapter_code} online={online} decor="quiet">
      <Screen>
        <StepView
          problem={problem}
          step={problem.steps[run.si]}
          problemIndex={run.pi}
          problemCount={problems.length}
          done={doneSteps}
          total={total}
          own={own}
          onLock={onLock}
        />
      </Screen>
      <SavedToast show={saved} />
    </StudentShell>
  );
}
