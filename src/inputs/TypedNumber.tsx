import { NumberDisplay } from '../components/NumberDisplay';
import { Keypad } from '../components/Keypad';
import { entryValue, pressKey } from '../lib/entry';
import type { Unit } from '../items/types';
import type { OnValue, StepValue } from './types';

/** Typed-only input: big live display + on-screen keypad (native input layered for keyboards). */
export function TypedNumber({ unit, value, onChange, onEnter }: { unit: Unit; value: StepValue; onChange: OnValue; onEnter: () => void }) {
  const raw = (value.extra?.entry as string | undefined) ?? (value.raw === null ? '' : String(value.raw));
  const set = (next: string) => onChange({ raw: entryValue(next), extra: { entry: next } }, 'typed');
  return (
    <>
      <NumberDisplay raw={raw} unit={unit} onChange={set} onEnter={onEnter} label="Your answer" />
      <Keypad onKey={(k) => set(pressKey(raw, k))} />
    </>
  );
}
