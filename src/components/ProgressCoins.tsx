import { motion } from 'framer-motion';
import { motion as m } from '../styles/tokens';
import s from './ProgressCoins.module.css';

type Props = { current: number; total: number; label?: string };

/** Coin-stack progress. `current` is the 0-based index of the item on screen. */
export function ProgressCoins({ current, total, label = 'Question' }: Props) {
  const done = Math.min(current, total);
  return (
    <div className={s.wrap}>
      <div className={s.meta}>
        <span className={s.count}>
          {label} <strong>{Math.min(current + 1, total)}</strong> of {total}
        </span>
        <span className="eyebrow" aria-hidden>
          {done} done
        </span>
      </div>
      <div role="progressbar" aria-label={`${label} progress`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        {total <= 12 ? (
          <ol className={s.coins} aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <motion.li
                key={`${i}-${i < done}`}
                className={[s.coin, i < done && s.done, i === current && s.current].filter(Boolean).join(' ')}
                initial={i === done - 1 ? { scale: 0.4 } : false}
                animate={{ scale: 1 }}
                transition={{ duration: 0.35, ease: m.springCurve }}
              >
                {i < done ? '$' : ''}
              </motion.li>
            ))}
          </ol>
        ) : (
          <div className={s.track} aria-hidden>
            <motion.div
              className={s.fill}
              initial={false}
              animate={{ scaleX: total ? done / total : 0 }}
              transition={{ duration: 0.3, ease: m.springCurve }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
