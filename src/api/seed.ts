import { ALL_PROBLEMS, correctOf, problemsFor } from '../items';
import type { Module, Prior, Problem, Step } from '../items/types';
import type { Code } from '../items/families';
import { classify } from '../lib/classify';
import { buildOrder } from '../lib/order';
import { hashString, mulberry32 } from '../lib/rng';
import { newStudentCode } from '../lib/studentCode';
import type { InputMethod, DeviceType } from '../lib/telemetry';
import type { AnswerRow, Recode, Session, StudentRow } from './types';

/**
 * DEMO DATA: deterministic synthetic students so every dashboard has something to
 * show with zero infrastructure. Generated in memory on each load (never persisted),
 * so it stays small in localStorage however big the item bank gets.
 */
export interface SeedData {
  sessions: Session[];
  students: (StudentRow & { finished_at: string | null })[];
  answers: AnswerRow[];
  recodes: Recode[];
}

const WORKSHOPS: { chapter: string; cohort: string; n: number; daysAgo: number; modules: Module[]; open?: boolean }[] = [
  { chapter: 'TX014', cohort: 'Fall · Grade 7', n: 28, daysAgo: 38, modules: ['skill', 'feasibility', 'hybrid'] },
  { chapter: 'GA203', cohort: 'Fall · Grade 6', n: 24, daysAgo: 33, modules: ['skill', 'feasibility', 'hybrid'] },
  { chapter: 'CA118', cohort: 'Fall · Grade 8', n: 22, daysAgo: 29, modules: ['skill', 'feasibility'] },
  { chapter: 'NY077', cohort: 'Fall · Mixed', n: 19, daysAgo: 24, modules: ['skill', 'feasibility', 'hybrid'] },
  { chapter: 'IL052', cohort: 'Fall · Grade 7', n: 17, daysAgo: 18, modules: ['skill'] },
  { chapter: 'FL310', cohort: 'Fall · Grade 8', n: 26, daysAgo: 12, modules: ['skill', 'feasibility', 'hybrid'] },
  { chapter: 'WA401', cohort: 'Pilot', n: 4, daysAgo: 7, modules: ['skill', 'feasibility'] },
  { chapter: 'NC027', cohort: 'Today · Grade 7', n: 21, daysAgo: 0, modules: ['skill', 'feasibility', 'hybrid'], open: true },
];

const SURVIVOR_TEXT: [string, string][] = [
  ['People who lost money don’t post about it.', 'present'],
  ['You only see the winners online.', 'present'],
  ['Maybe they got lucky.', 'partial'],
  ['They want followers.', 'partial'],
  ['Because it’s true.', 'absent'],
  ['idk', 'absent'],
];

function normal(r: () => number) {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
}

function pickWeighted<T>(r: () => number, items: [T, number][]): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [it, w] of items) if ((x -= w) <= 0) return it;
  return items[items.length - 1][0];
}

function hex(r: () => number, n: number) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(r() * 16).toString(16);
  return s;
}
const fakeUuid = (r: () => number) => `${hex(r, 8)}-${hex(r, 4)}-4${hex(r, 3)}-a${hex(r, 3)}-${hex(r, 12)}`;

/** Simulate one numeric answer: correct, one of the predicted misconceptions, or noise. */
function simulateNumber(r: () => number, step: Step, prior: Prior, skill: number, difficulty: number): number {
  const truth = correctOf(step, prior);
  const codes = step.codes ?? [];
  const base = (step.kind === 'control' ? 1.2 : step.kind === 'guided' ? 0.4 : -0.4) - difficulty;
  const pCorrect = 1 / (1 + Math.exp(-(base + 1.3 * skill)));
  const u = r();
  if (truth !== null && u < pCorrect) return Number((truth * (1 + (r() - 0.5) * 0.008)).toFixed(2));
  if (codes.length && u < pCorrect + (1 - pCorrect) * 0.62) {
    const c = pickWeighted(r, codes.map((c, i) => [c, i === 0 ? 3 : 1] as [typeof c, number]));
    return Number(c.value.toFixed(2));
  }
  const center = truth ?? codes[0]?.value ?? 10;
  return Number(Math.max(0, center * Math.exp(normal(r) * 0.45)).toPrecision(3));
}

export function buildSeed(now = Date.now(), problems: Problem[] = ALL_PROBLEMS): SeedData {
  const r = mulberry32(20261001);
  const out: SeedData = { sessions: [], students: [], answers: [], recodes: [] };
  const DAY = 86_400_000;

  for (const w of WORKSHOPS) {
    const created = now - w.daysAgo * DAY - (w.open ? 25 * 60_000 : Math.floor(r() * DAY * 0.5));
    const session: Session = {
      id: fakeUuid(r),
      chapter_code: w.chapter,
      cohort_label: w.cohort,
      modules: w.modules,
      status: w.open ? 'open' : 'closed',
      created_at: new Date(created).toISOString(),
      closed_at: w.open ? null : new Date(created + 70 * 60_000).toISOString(),
    };
    out.sessions.push(session);
    const set = problemsFor(w.modules).filter((p) => problems.includes(p));
    const expected = set.reduce((a, p) => a + p.steps.length, 0);

    for (let k = 0; k < w.n; k++) {
      const code = newStudentCode(r);
      const skill = normal(r);
      const device: DeviceType = pickWeighted(r, [['laptop', 6], ['phone', 3], ['tablet', 1]]);
      const pref: InputMethod = pickWeighted(r, [['typed', 4], ['dragged', 3.5], ['tapped', 1.5], ['dragged_then_typed', 1]]);
      const speeder = k === 3 && w.n > 10;
      const straightLiner = k === 5 && w.n > 10;
      const started = created + (2 + r() * 5) * 60_000;
      // Open (live) workshop: students are part-way through.
      const leaveAt = w.open ? Math.floor(expected * (0.3 + r() * 0.9)) : r() < 0.07 ? Math.floor(expected * r()) : expected;
      const order = buildOrder(set, code).ids;
      let t = started;
      let answered = 0;
      for (const [pos, pid] of order.entries()) {
        const p = set.find((x) => x.id === pid)!;
        const prior: Prior = {};
        const gut = Math.min(5, Math.max(1, Math.round(3.6 + normal(r) * 0.9 - (p.module === 'feasibility' ? 0 : 0.5))));
        for (const step of p.steps) {
          if (answered >= leaveAt) break;
          let raw: number | null = null;
          let choice: string[] | undefined;
          let text: string | null = null;
          let tag: string | null = null;
          const i = step.input;
          if (i.type === 'dial') raw = straightLiner ? 5 : step.kind === 'rating_post' ? Math.min(5, Math.max(1, Math.round(gut - Math.max(0, 0.8 + skill * 0.9 + normal(r) * 0.6)))) : gut;
          else if (i.type === 'choice') choice = [i.options[Math.floor(r() * i.options.length)].id];
          else if (i.type === 'text') {
            if (r() < 0.8) [text, tag] = SURVIVOR_TEXT[Math.min(SURVIVOR_TEXT.length - 1, Math.floor(r() * 3 + (skill < 0 ? 3 : 0) * r()))];
          } else raw = simulateNumber(r, step, prior, skill, ((hashString(p.id) % 100) / 100 - 0.5) * 1.6);
          const lockMs = speeder ? 1500 + r() * 1500 : (step.kind === 'cold' ? 9000 : 14000) + r() * 30000;
          const method: InputMethod | null =
            i.type === 'number' || i.type === 'text' ? 'typed' : i.type === 'dial' || i.type === 'choice' ? 'tapped' : r() < 0.6 ? pref : pickWeighted(r, [['typed', 1], ['dragged', 1], ['tapped', 1]]);
          t += lockMs + 1500;
          const extra = i.type === 'shade' && raw !== null ? { fraction: Math.min(1, Math.round((i.typed === 'separate' ? (r() < 0.8 ? raw / i.whole : r()) : raw / i.whole) * 100) / 100) } : null;
          const answer: AnswerRow = {
            answer_id: fakeUuid(r),
            session_id: session.id,
            student_code: code,
            item_id: p.id,
            item_version: p.version,
            step_id: step.id,
            form_version: null,
            raw_value: raw,
            value: choice ? { choice } : extra,
            input_method: method,
            strategy_codes: classify(step, raw, prior, choice) as Code[],
            correct_value: correctOf(step, prior),
            time_to_first_touch_ms: Math.round(lockMs * (0.15 + r() * 0.4)),
            time_to_lock_ms: Math.round(lockMs),
            n_revisions: speeder ? 0 : Math.floor(-Math.log(1 - r()) * 0.9),
            item_position: pos + 1,
            free_text: text,
            device_type: device,
            answered_at: new Date(t).toISOString(),
          };
          out.answers.push(answer);
          if (tag) out.recodes.push({ answer_id: answer.answer_id, codes: [], tag, coded_at: answer.answered_at });
          prior[step.id] = raw;
          answered++;
        }
      }
      out.students.push({
        student_code: code,
        session_id: session.id,
        forms: {},
        device_type: device,
        expected_steps: expected,
        started_at: new Date(started).toISOString(),
        finished_at: answered >= expected ? new Date(t).toISOString() : null,
      });
    }
  }
  return out;
}
