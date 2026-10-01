import type { ReactNode } from 'react';
import { Card } from './Card';
import s from './ChartCard.module.css';

type Props = {
  title: string;
  subtitle?: string;
  n: number;
  date: string;
  footnote?: ReactNode;
  children: ReactNode;
  tone?: 'default' | 'featured' | 'mint';
};

/** Sticker card around a chart. Always shows title, n and date so every screenshot stands alone. */
export function ChartCard({ title, subtitle, n, date, footnote, children, tone = 'default' }: Props) {
  return (
    <Card as="section" tone={tone} className={s.card} aria-label={title}>
      <header className={s.head}>
        <div>
          <h2 className={s.title}>{title}</h2>
          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
        </div>
        <div className={s.meta}>
          <span className={`${s.chip} ${s.n}`}>n = {n.toLocaleString('en-US')}</span>
          <span className={s.chip}>{date}</span>
        </div>
      </header>
      <div className={s.body}>{children}</div>
      {footnote && <p className={s.foot}>{footnote}</p>}
    </Card>
  );
}
