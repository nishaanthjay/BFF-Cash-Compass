import { useEffect, useId, useState } from 'react';
import type { Unit } from '../items/types';
import { entryValue, sanitizeEntry } from '../lib/entry';
import { UNIT_AFFIX } from '../lib/format';
import s from './NumberField.module.css';

type Props = {
  unit: Unit;
  value: number | null;
  onType: (v: number | null) => void;
  label?: string;
  onEnter?: () => void;
};

/** The always-available typed box that sits beside every visual input. */
export function NumberField({ unit, value, onType, label = 'Or type it', onEnter }: Props) {
  const id = useId();
  const [raw, setRaw] = useState(value === null ? '' : String(value));
  // Sync when the value changes from the visual input (not from typing).
  useEffect(() => {
    const current = entryValue(raw);
    if (value === null && current !== null) return;
    if (value !== null && current !== value) setRaw(String(Number(value.toFixed(2))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const affix = UNIT_AFFIX[unit];
  return (
    <div className={s.field}>
      <label htmlFor={id} className={`eyebrow ${s.label}`}>
        {label}
        {affix.word ? ` (${affix.word})` : ''}
      </label>
      <div className={s.box}>
        {affix.prefix && <span className={s.affix} aria-hidden>{affix.prefix}</span>}
        <input
          id={id}
          className={s.input}
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="—"
          value={raw}
          onChange={(e) => {
            const next = sanitizeEntry(e.target.value);
            setRaw(next);
            onType(entryValue(next));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEnter?.();
            }
          }}
        />
        {affix.suffix && <span className={s.affix} aria-hidden>{affix.suffix}</span>}
      </div>
    </div>
  );
}
