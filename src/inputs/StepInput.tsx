import type { Step } from '../items/types';
import { TapChoice, FreeText } from './Choice';
import { Dial } from './Dial';
import { NumberLineInput } from './NumberLineInput';
import { ShadeBar } from './ShadeBar';
import { TypedNumber } from './TypedNumber';
import type { OnValue, StepValue } from './types';

/** Renders the component a step asks for. Adding a component = one case here. */
export function StepInput({ step, value, onChange, onEnter }: { step: Step; value: StepValue; onChange: OnValue; onEnter: () => void }) {
  const i = step.input;
  switch (i.type) {
    case 'number':
      return <TypedNumber unit={i.unit} value={value} onChange={onChange} onEnter={onEnter} />;
    case 'numberLine':
      return <NumberLineInput axis={i} value={value} onChange={onChange} label={step.prompt} />;
    case 'shade':
      return <ShadeBar whole={i.whole} unit={i.unit} readout={i.readout} typed={i.typed ?? 'linked'} value={value} onChange={onChange} label={step.prompt} />;
    case 'dial':
      return <Dial value={value} onChange={onChange} label={step.prompt} />;
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
    case 'choice':
      return (v.choice?.length ?? 0) > 0;
    case 'text':
      return (v.text ?? '').trim().length > 0;
    default:
      return v.raw !== null;
  }
}
