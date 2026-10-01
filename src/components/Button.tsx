import { forwardRef, type ButtonHTMLAttributes } from 'react';
import s from './Button.module.css';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'gold' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, className, type = 'button', ...rest },
  ref,
) {
  const cls = [s.btn, s[variant], size !== 'md' && s[size], block && s.block, className].filter(Boolean).join(' ');
  return <button ref={ref} type={type} className={cls} {...rest} />;
});
