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

export const SHORT_SESSION_SIZE = 5;

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

/** Minutes estimate for the facilitator (≈25 s per numeric step, 12 s per rating/choice). */
export function estimateMinutes(problems: Problem[]): number {
  const base = (s: Step) => (s.input.type === 'dial' || s.input.type === 'choice' ? 12 : s.input.type === 'text' ? 40 : s.input.type === 'rank' || s.input.type === 'calendar' || s.input.type === 'stack' ? 35 : 25);
  const weight = (p: Problem, s: Step) => (s.forms && p.form ? s.forms.length / p.form.options.length : 1);
  const secs = problems.reduce((a, p) => a + p.steps.reduce((b, s) => b + base(s) * weight(p, s), 0), 0);
  return Math.max(1, Math.round(secs / 60));
}

export type { Problem, Step } from './types';
