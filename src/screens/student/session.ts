import type { JoinedSession } from '../../api/types';
import { problemsFor } from '../../items';
import { buildOrder } from '../../lib/order';
import type { RunState } from '../../lib/run';

/** Build a fresh (or resumed) run for a student code. Same code → same order and forms. */
export function makeRun(joined: JoinedSession, studentCode: string, locked: string[] = []): RunState {
  const problems = problemsFor(joined.modules);
  const { ids } = buildOrder(problems, studentCode);
  const lockedSet = new Set(locked);
  // Resume at the first step that isn't stored yet.
  let pi = 0;
  let si = 0;
  outer: for (pi = 0; pi < ids.length; pi++) {
    const p = problems.find((x) => x.id === ids[pi])!;
    for (si = 0; si < p.steps.length; si++) if (!lockedSet.has(`${p.id}.${p.steps[si].id}`)) break outer;
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
    forms: {},
    answers: {},
    pi: done ? ids.length - 1 : pi,
    si: done ? 0 : si,
    started_at: new Date().toISOString(),
    done,
  };
}

export function totalSteps(run: RunState, getSteps: (id: string) => number): number {
  return run.sequence.reduce((a, id) => a + getSteps(id), 0);
}
