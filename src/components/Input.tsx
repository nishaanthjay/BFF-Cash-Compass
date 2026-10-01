import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import s from './Input.module.css';
import { FieldError } from './FieldError';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  code?: boolean;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input({ label, hint, error, code, className, id, ...rest }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = `${inputId}-hint`;
  const errId = `${inputId}-err`;
  return (
    <div className={s.field}>
      <label htmlFor={inputId} className={`eyebrow ${s.label}`}>
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={[s.input, code && s.code, error && s.invalid, className].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint && hintId, error && errId].filter(Boolean).join(' ') || undefined}
        {...rest}
      />
      {hint && (
        <p id={hintId} className={s.hint}>
          {hint}
        </p>
      )}
      {error && <FieldError id={errId}>{error}</FieldError>}
    </div>
  );
});
