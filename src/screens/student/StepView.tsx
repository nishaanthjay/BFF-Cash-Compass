import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ProgressCoins } from '../../components/ProgressCoins';
import { rankShown } from '../../lib/rank';
import { isAnswered, StepInput } from '../../inputs/StepInput';
import { promptFor } from '../../items';
import { EMPTY_VALUE, type StepValue } from '../../inputs/types';
import type { Problem, Step } from '../../items/types';
import { useStepTelemetry } from '../../lib/useStepTelemetry';
import { motion as m } from '../../styles/tokens';
import { ScenarioCard } from './Scenario';
import s from './StepView.module.css';

export type LockedTelemetry = ReturnType<ReturnType<typeof useStepTelemetry>['finish']>;

type Props = {
  problem: Problem;
  step: Step;
  /** The steps this student sees (form-specific steps filtered). */
  steps: Step[];
  form?: string;
  /** Student code, used for the deterministic shuffle of ranking cards. */
  seed: string;
  problemIndex: number;
  problemCount: number;
  done: number;
  total: number;
  own: Record<string, number | null>;
  onLock: (v: StepValue, t: LockedTelemetry) => void;
};

/** One step per screen. Lock = final; there is no back button and no feedback. */
export function StepView({ problem, step: rawStep, steps, form, seed, problemIndex, problemCount, done, total, own, onLock }: Props) {
  const step: Step = { ...rawStep, prompt: promptFor(rawStep, form) };
  const key = `${problem.id}.${step.id}`;
  const [state, setState] = useState<{ key: string; v: StepValue }>({ key, v: EMPTY_VALUE });
  const value = state.key === key ? state.v : EMPTY_VALUE;
  const tel = useStepTelemetry(key);
  const stepNo = steps.findIndex((x) => x.id === step.id) + 1;
  const ready = isAnswered(step, value);

  const lock = () => {
    if (!ready) return;
    // An untouched ranking is still an answer: record the shuffled order the student saw.
    const v = step.input.type === 'rank' && !value.choice ? { raw: null, choice: rankShown(step, seed), extra: { shown: rankShown(step, seed), moves: 0 } } : value;
    onLock(v, tel.finish());
  };

  return (
    <div className={s.stack}>
      <ProgressCoins current={done} total={total} label="Step" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          className={s.stack}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: m.itemTransition / 2, ease: m.springCurve }}
        >
          <div className={s.head}>
            <div className={`eyebrow ${s.meta}`}>
              <span className="num">
                Problem {problemIndex + 1} of {problemCount}
              </span>
              <span className="num">
                Part {stepNo} of {steps.length}
              </span>
            </div>
            <h1 className={s.title}>{problem.title}</h1>
          </div>
          <Card tight bubble>
            <ScenarioCard scenario={problem.scenario} own={own} activeStep={step.id} />
          </Card>
          <Card as="section" className={s.zone} aria-labelledby={`p-${key}`}>
            {step.calculator && (
              <div className={s.stepTag}>
                <span className={`eyebrow ${s.calc}`}>Calculator OK</span>
              </div>
            )}
            <p id={`p-${key}`} className={s.prompt}>
              {step.prompt}
            </p>
            <StepInput
              seed={seed}
              step={step}
              value={value}
              onEnter={lock}
              onChange={(v, method) => {
                setState({ key, v });
                if (method) tel.mark(method);
              }}
            />
            <Button size="lg" block onClick={lock} disabled={!ready}>
              {step.optional && !value.text && value.raw === null && !value.choice?.length ? 'Skip' : 'Lock answer'}
            </Button>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Neutral confirmation only: never correct/incorrect. */
export function SavedToast({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div className={s.saved} role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          Answer saved
        </motion.div>
      )}
    </AnimatePresence>
  );
}
