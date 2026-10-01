import type { Step } from '../items/types';
import { TapChoice, FreeText } from './Choice';
import { Calendar } from './Calendar';
import { ChoiceTimeline } from './ChoiceTimeline';
import { CurveDraw } from './CurveDraw';
import { DotGrid } from './DotGrid';
import { Dial } from './Dial';
import { JarInput } from './JarInput';
import { NumberLineInput } from './NumberLineInput';
import { RankCards } from './RankCards';
import { rankShown } from '../lib/rank';
import { ShadeBar } from './ShadeBar';
import { StackCards } from './StackCards';
import { TypedNumber } from './TypedNumber';
import type { OnValue, StepValue } from './types';

/** Renders the component a step asks for. Adding a component = one case here. */
export function StepInput({ step, value, onChange, onEnter, seed = '' }: { step: Step; value: StepValue; onChange: OnValue; onEnter: () => void; seed?: string }) {
  const i = step.input;
  switch (i.type) {
    case 'number':
      return <TypedNumber unit={i.unit} value={value} onChange={onChange} onEnter={onEnter} />;
    case 'numberLine':
      return <NumberLineInput axis={i} value={value} onChange={onChange} label={step.prompt} />;
    case 'jar':
      return <JarInput axis={i} value={value} onChange={onChange} label={step.prompt} />;
    case 'curve':
      return <CurveDraw spec={i} value={value} onChange={onChange} label={step.prompt} />;
    case 'stack':
      return <StackCards cards={i.cards} poolLabel={i.poolLabel} areaLabel={i.areaLabel} value={value} onChange={onChange} label={step.prompt} />;
    case 'dotGrid':
      return <DotGrid total={i.total} columns={i.columns} itemWord={i.itemWord} value={value} onChange={onChange} label={step.prompt} />;
    case 'calendar':
      return <Calendar spec={i} value={value} onChange={onChange} label={step.prompt} unitPrice={i.unitPrice} />;
    case 'timeline':
      return <ChoiceTimeline options={i.options} maxWeeks={i.maxWeeks} value={value} onChange={onChange} label={step.prompt} />;
    case 'rank':
      return <RankCards cards={i.cards} topLabel={i.topLabel} bottomLabel={i.bottomLabel} shown={rankShown(step, seed)} value={value} onChange={onChange} label={step.prompt} />;
    case 'shade':
      return <ShadeBar whole={i.whole} unit={i.unit} readout={i.readout} typed={i.typed ?? 'linked'} value={value} onChange={onChange} label={step.prompt} />;
    case 'dial':
      return <Dial value={value} onChange={onChange} label={step.prompt} low={i.low} high={i.high} />;
    case 'choice':
      return <TapChoice options={i.options} multi={i.multi} value={value} onChange={onChange} label={step.prompt} />;
    case 'text':
      return <FreeText value={value} onChange={onChange} label={step.prompt} placeholder={i.placeholder} />;
  }
}

/** Can the student lock this step? (optional steps can be locked blank) */
export function isAnswered(step: Step, v: StepValue): boolean {
  if (step.optional) return true;
  switch (step.input.type) {
    case 'rank':
      return true; // the starting order is recorded, so locking an unchanged order is a valid answer
    case 'choice':
    case 'stack':
      return (v.choice?.length ?? 0) > 0;
    case 'calendar':
      return step.input.mode === 'count' ? v.raw !== null && v.raw > 0 : step.input.mode === 'multi' ? v.raw !== null && v.raw > 0 : v.raw !== null;
    case 'text':
      return (v.text ?? '').trim().length > 0;
    default:
      return v.raw !== null;
  }
}
