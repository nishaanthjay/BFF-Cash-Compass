import s from './Wordmark.module.css';

/**
 * Placeholder BFF of America wordmark. Swap for the official logo asset
 * (see README → "Logo") without touching callers.
 */
export function Wordmark({ size = 'md', sub = true }: { size?: 'md' | 'lg'; sub?: boolean }) {
  return (
    <span className={[s.mark, size === 'lg' && s.lg].filter(Boolean).join(' ')} aria-label="BFF of America Cash Compass">
      <span className={s.bff} aria-hidden>
        BFF
      </span>
      <span aria-hidden>
        <span className={s.name}>Cash Compass</span>
        {sub && <span className={s.small}>BFF of America</span>}
      </span>
    </span>
  );
}
