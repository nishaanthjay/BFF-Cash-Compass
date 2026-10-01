import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X } from 'lucide-react';
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
  /** Show the Expand button (opens the chart full-screen so dense charts are readable). Default true. */
  expandable?: boolean;
};

/** Sticker card around a chart. Always shows title, n and date so every screenshot stands alone. */
export function ChartCard({ title, subtitle, n, date, footnote, children, tone = 'default', expandable = true }: Props) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closer.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    const btn = opener.current;
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      btn?.focus();
    };
  }, [open]);
  const head = (
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
  );
  return (
    <Card as="section" tone={tone} className={s.card} aria-label={title}>
      {head}
      <div className={s.body}>{children}</div>
      {footnote && <p className={s.foot}>{footnote}</p>}
      {expandable && (
        <button ref={opener} type="button" className={s.expand} onClick={() => setOpen(true)} aria-label={`Expand chart: ${title}`}>
          <Maximize2 size={16} strokeWidth={2.5} aria-hidden /> Expand
        </button>
      )}
      {open &&
        createPortal(
          <div className={s.overlay} role="dialog" aria-modal="true" aria-label={`${title} (expanded)`} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div className={s.sheet}>
              <button ref={closer} type="button" className={s.close} onClick={() => setOpen(false)} aria-label="Close expanded chart">
                <X size={20} strokeWidth={2.5} aria-hidden />
              </button>
              {head}
              <div className={s.bodyBig}>{children}</div>
              {footnote && <p className={s.foot}>{footnote}</p>}
            </div>
          </div>,
          document.body,
        )}
    </Card>
  );
}
