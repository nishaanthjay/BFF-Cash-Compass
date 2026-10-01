import type { LucideIcon } from 'lucide-react';
import s from './IconBadge.module.css';

type Props = {
  icon: LucideIcon;
  tone?: 'gold' | 'pink' | 'mint' | 'blue' | 'soft' | 'muted' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
};

const ICON_PX = { sm: 16, md: 22, lg: 30 } as const;

/** DESIGN.md: Lucide icons are always inside a coloured circle, stroke 2.5, round caps. */
export function IconBadge({ icon: Icon, tone = 'gold', size = 'md', label, className }: Props) {
  return (
    <span className={[s.badge, s[tone], s[size], className].filter(Boolean).join(' ')} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <Icon size={ICON_PX[size]} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </span>
  );
}
