import type { Module, Problem, Prior, Step } from './types';

type Mod = { default: Problem };

/** Every file in ./bank is picked up automatically (one problem per file). */
const modules = import.meta.glob<Mod>('./bank/*.ts', { eager: true });
export const ALL_PROBLEMS: Problem[] = Object.keys(modules)
  .sort()
  .map((k) => modules[k].default);

const byId = new Map(ALL_PROBLEMS.map((p) => [p.id, p]));

export function getProblem(id: string): Problem | undefined {
  return byId.get(id);
}

export function problemsFor(modules: Module[]): Problem[] {
  return ALL_PROBLEMS.filter((p) => p.active && modules.includes(p.module));
}

export function getStep(problemId: string, stepId: string): Step | undefined {
  return byId.get(problemId)?.steps.find((s) => s.id === stepId);
}

/** Correct value for a step given the student's earlier answers on the same problem. */
export function correctOf(step: Step, prior: Prior = {}): number | null {
  if (step.correct === undefined) return null;
  return typeof step.correct === 'function' ? step.correct(prior) : step.correct;
}

/** Minutes estimate for the facilitator (≈25 s per numeric step, 12 s per rating/choice). */
export function estimateMinutes(problems: Problem[]): number {
  const secs = problems.flatMap((p) => p.steps).reduce((a, s) => a + (s.input.type === 'dial' || s.input.type === 'choice' ? 12 : s.input.type === 'text' ? 40 : 25), 0);
  return Math.max(1, Math.round(secs / 60));
}

export type { Problem, Step } from './types';
