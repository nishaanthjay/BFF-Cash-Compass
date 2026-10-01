import { useId, type SelectHTMLAttributes } from 'react';
import s from './Input.module.css';

type Props = SelectHTMLAttributes<HTMLSelectElement> & { label: string };

export function Select({ label, id, className, children, ...rest }: Props) {
  const auto = useId();
  const sid = id ?? auto;
  return (
    <div className={s.field}>
      <label htmlFor={sid} className={`eyebrow ${s.label}`}>
        {label}
      </label>
      <select id={sid} className={[s.input, s.select, className].filter(Boolean).join(' ')} {...rest}>
        {children}
      </select>
    </div>
  );
}
