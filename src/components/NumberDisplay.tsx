import { forwardRef, useId } from 'react';
import type { Unit } from '../items/types';
import { formatEntry, UNIT_AFFIX } from '../lib/format';
import { sanitizeEntry } from '../lib/entry';
import s from './NumberDisplay.module.css';

type Props = {
  raw: string;
  unit: Unit;
  onChange: (raw: string) => void;
  onEnter?: () => void;
  label?: string;
};

/** Huge live-formatted estimate. A transparent native input sits on top for keyboards & a11y. */
export const NumberDisplay = forwardRef<HTMLInputElement, Props>(function NumberDisplay(
  { raw, unit, onChange, onEnter, label = 'Your estimate' },
  ref,
) {
  const id = useId();
  const affix = UNIT_AFFIX[unit];
  const shown = formatEntry(raw);
  const len = shown.length > 11 ? 'xlong' : shown.length > 8 ? 'long' : 'normal';
  const empty = raw === '';
  return (
    <div className={s.wrap}>
      <label htmlFor={id} className={`eyebrow ${s.label}`}>
        {label}
        {affix.word ? ` (${affix.word})` : ''}
      </label>
      <div className={s.value} data-len={len} aria-hidden="true">
        {affix.prefix && <span className={s.affix}>{affix.prefix}</span>}
        <span className={empty ? s.placeholder : undefined}>{shown}</span>
        <span className={s.caret} />
        {affix.suffix && <span className={s.affix}>{affix.suffix}</span>}
      </div>
      <input
        ref={ref}
        id={id}
        className={s.native}
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        value={raw}
        onChange={(e) => onChange(sanitizeEntry(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnter?.();
          }
        }}
      />
    </div>
  );
});
