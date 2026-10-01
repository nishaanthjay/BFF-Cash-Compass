import type { LucideIcon } from 'lucide-react';
import { useCountUp } from '../lib/useCountUp';
import { IconBadge } from './IconBadge';
import s from './StatTile.module.css';

type Props = {
  label: string;
  value: number;
  format?: (v: number) => string;
  icon?: LucideIcon;
  tone?: 'gold' | 'pink' | 'mint' | 'soft';
  sub?: string;
  highlight?: boolean;
};

const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function StatTile({ label, value, format = (v) => intFmt.format(v), icon, tone = 'soft', sub, highlight }: Props) {
  const shown = useCountUp(value);
  return (
    <div className={[s.tile, highlight && s.highlight].filter(Boolean).join(' ')}>
      <div className={s.top}>
        <span className={`eyebrow ${s.label}`}>{label}</span>
        {icon && <IconBadge icon={icon} tone={highlight ? 'mint' : tone} size="sm" />}
      </div>
      <span className={s.value} aria-label={`${label}: ${format(value)}`}>
        <span aria-hidden>{format(shown)}</span>
      </span>
      {sub && <span className={s.sub}>{sub}</span>}
    </div>
  );
}
