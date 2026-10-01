import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconBadge } from './IconBadge';
import s from './FieldError.module.css';

/** Error text + icon (never colour alone). */
export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className={s.err} role="alert">
      <IconBadge icon={CircleAlert} tone="danger" size="sm" />
      <span>{children}</span>
    </p>
  );
}
