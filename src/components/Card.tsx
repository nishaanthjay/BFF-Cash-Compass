import type { HTMLAttributes, ElementType } from 'react';
import s from './Card.module.css';

type Props = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  tone?: 'default' | 'featured' | 'mint' | 'flat';
  tight?: boolean;
  bubble?: boolean;
};

export function Card({ as: Tag = 'div', tone = 'default', tight, bubble, className, ...rest }: Props) {
  const cls = [s.card, tone !== 'default' && s[tone], tight && s.tight, bubble && s.bubble, className]
    .filter(Boolean)
    .join(' ');
  return <Tag className={cls} {...rest} />;
}
