import type { JoinedSession } from '../../api/types';
import { problemsFor, stepsFor } from '../../items';
import { assignForms, orderPairs } from '../../lib/forms';
import { buildOrder } from '../../lib/order';
import type { RunState } from '../../lib/run';

/** Build a fresh (or resumed) run for a student code. Same code → same order and forms. */
export function makeRun(joined: JoinedSession, studentCode: string, locked: string[] = []): RunState {
  const problems = problemsFor(joined.modules);
  const forms = assignForms(problems, studentCode);
  const { ids } = buildOrder(problems, studentCode, orderPairs(problems, forms));
  const lockedSet = new Set(locked);
  // Resume at the first step that isn't stored yet.
  let pi = 0;
  let si = 0;
  outer: for (pi = 0; pi < ids.length; pi++) {
    const p = problems.find((x) => x.id === ids[pi])!;
    const steps = stepsFor(p, forms);
    for (si = 0; si < steps.length; si++) if (!lockedSet.has(`${p.id}.${steps[si].id}`)) break outer;
  }
  const done = pi >= ids.length;
  return {
    v: 3,
    session_id: joined.session_id,
    chapter_code: joined.chapter_code,
    cohort_label: joined.cohort_label,
    modules: joined.modules,
    student_code: studentCode,
    sequence: ids,
    forms,
    answers: {},
    pi: done ? ids.length - 1 : pi,
    si: done ? 0 : si,
    started_at: new Date().toISOString(),
    done,
  };
}


