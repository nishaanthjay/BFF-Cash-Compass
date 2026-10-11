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

/** A session's problems: the exact `ids` when given (a short session), otherwise every active problem in the modules. */
export function problemsFor(modules: Module[], ids: string[] = []): Problem[] {
  if (ids.length) return ALL_PROBLEMS.filter((p) => p.active && ids.includes(p.id));
  return ALL_PROBLEMS.filter((p) => p.active && modules.includes(p.module));
}

/** Quick check: one Skill, one Feasibility and one Hybrid problem per student. */
export const QUICK_CHECK_SIZE = 3;
/** The most problems a facilitator can hand-pick for a session. */
export const MAX_PICKS = 10;
/** Average time per problem, used for every "about N minutes" claim in the app. */
export const MINUTES_PER_PROBLEM = 2.8;

/** One pick in the facilitator's list: problems that share a form key (S11A + S11B) always travel together. */
export interface PickUnit {
  key: string;
  title: string;
  ids: string[];
  module: Module;
}

export function pickUnits(): PickUnit[] {
  const units = new Map<string, PickUnit>();
  for (const p of ALL_PROBLEMS.filter((x) => x.active)) {
    const key = p.form ? p.form.key : p.id;
    const u = units.get(key);
    if (u) u.ids.push(p.id);
    else units.set(key, { key, title: p.form && key !== p.id ? `${key} · ${p.title.split(' · ')[0]}` : `${p.id} · ${p.title}`, ids: [p.id], module: p.module });
  }
  return [...units.values()];
}

export function getStep(problemId: string, stepId: string): Step | undefined {
  return byId.get(problemId)?.steps.find((s) => s.id === stepId);
}

/** Key under which this problem's counterbalanced form is stored (shared across paired problems). */
export function formKeyOf(p: Problem): string {
  return p.form?.key ?? p.id;
}

/** The steps this student sees: steps limited to certain forms are hidden for everyone else. */
export function stepsFor(p: Problem, forms: Record<string, string> = {}): Step[] {
  const f = forms[formKeyOf(p)];
  return p.steps.filter((s) => !s.forms || (f !== undefined && s.forms.includes(f)));
}

/** Prompt text for this student's form. */
export function promptFor(step: Step, form: string | undefined): string {
  return (form && step.promptByForm?.[form]) || step.prompt;
}

/** Correct value for a step given the student's earlier answers on the same problem. */
export function correctOf(step: Step, prior: Prior = {}): number | null {
  if (step.correct === undefined) return null;
  return typeof step.correct === 'function' ? step.correct(prior) : step.correct;
}

/** Minutes a student needs for this many problems (MINUTES_PER_PROBLEM each). One number, used everywhere. */
export function minutesFor(problemCount: number): number {
  return Math.max(1, Math.round(problemCount * MINUTES_PER_PROBLEM));
}

/** Minutes estimate for a set of problems. */
export function estimateMinutes(problems: Problem[]): number {
  return minutesFor(problems.length);
}

/** "About 8 minutes" for the Quick check, as shown on the home, join and facilitator screens. */
export const QUICK_CHECK_MINUTES = minutesFor(QUICK_CHECK_SIZE);

export type { Problem, Step } from './types';
