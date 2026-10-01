import type { OnValue, StepValue } from './types';
import s from './Choice.module.css';

type Props = { options: { id: string; label: string }[]; multi?: boolean; value: StepValue; onChange: OnValue; label: string };

/** Tap cards: single choice (radio) or multi-select (checkbox). Nothing preselected. */
export function TapChoice({ options, multi, value, onChange, label }: Props) {
  const chosen = value.choice ?? [];
  const toggle = (id: string) => {
    const next = multi ? (chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id]) : [id];
    onChange({ raw: null, choice: next }, 'tapped');
  };
  return (
    <div className={s.list} role={multi ? 'group' : 'radiogroup'} aria-label={label}>
      {options.map((o) => {
        const on = chosen.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            className={s.opt}
            role={multi ? undefined : 'radio'}
            aria-checked={multi ? undefined : on}
            aria-pressed={multi ? on : undefined}
            onClick={() => toggle(o.id)}
          >
            <span className={[s.box, !multi && s.radio, on && s.on].filter(Boolean).join(' ')} aria-hidden>
              {on ? (multi ? '✓' : '•') : ''}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const MAX = 400;

/** Removes things that could identify someone (emails, phone numbers, @handles). */
export function redact(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[removed]')
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, '[removed]')
    .replace(/@\w{2,}/g, '[removed]')
    .slice(0, MAX);
}

export function FreeText({ value, onChange, label, placeholder }: { value: StepValue; onChange: OnValue; label: string; placeholder?: string }) {
  const text = value.text ?? '';
  return (
    <div className={s.list}>
      <textarea
        className={s.text}
        aria-label={label}
        maxLength={MAX}
        placeholder={placeholder}
        value={text}
        onChange={(e) => onChange({ raw: null, text: e.target.value }, 'typed')}
      />
      <p className={s.hint}>Please don’t write any names. Emails, phone numbers and @handles are removed automatically.</p>
      <p className={s.count} aria-hidden>
        {text.length}/{MAX}
      </p>
    </div>
  );
}
