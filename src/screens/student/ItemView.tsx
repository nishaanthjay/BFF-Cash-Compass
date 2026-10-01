import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { IconBadge } from '../../components/IconBadge';
import { Keypad } from '../../components/Keypad';
import { NumberDisplay } from '../../components/NumberDisplay';
import { ProgressCoins } from '../../components/ProgressCoins';
import { CoinGraphic } from '../../components/Decor';
import { CATEGORY_ICON, CATEGORY_TONE } from '../../items/categoryIcons';
import { promptOf } from '../../items';
import { DECA_LABELS, type Item } from '../../items/types';
import { entryValue, pressKey, type Key } from '../../lib/entry';
import { motion as m } from '../../styles/tokens';
import s from './ItemView.module.css';

type Props = {
  item: Item;
  index: number;
  total: number;
  onSubmit: (estimate: number) => void;
};

/** Signature screen 1: question bubble + plain number zone (display, keypad, coin-stamp submit). */
export function ItemView({ item, index, total, onSubmit }: Props) {
  const [raw, setRaw] = useState('');
  const [stamping, setStamping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();
  const value = entryValue(raw);
  const Icon = CATEGORY_ICON[item.deca_category];

  useEffect(() => {
    setRaw('');
    setStamping(false);
  }, [item.id]);

  const submit = useCallback(() => {
    if (value === null || stamping) return;
    if (reduce) return onSubmit(value);
    setStamping(true);
    window.setTimeout(() => onSubmit(value), 260);
  }, [value, stamping, reduce, onSubmit]);

  const onKey = (k: Key) => setRaw((r) => pressKey(r, k));

  return (
    <div className={s.stack}>
      <div className={s.top}>
        <ProgressCoins current={index} total={total} />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={item.id}
          className={s.stack}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: m.itemTransition / 2, ease: m.springCurve }}
        >
          <Card as="section" bubble className={s.question} aria-labelledby={`q-${item.id}`}>
            <div className={s.qHead}>
              <IconBadge icon={Icon} tone={CATEGORY_TONE[item.deca_category]} />
              <div className={s.qMeta}>
                <span className={`eyebrow ${s.category}`}>
                  Question {index + 1} · {DECA_LABELS[item.deca_category]}
                </span>
                {item.sample && <span className={`eyebrow ${s.sample}`}>Sample item</span>}
              </div>
            </div>
            <p id={`q-${item.id}`} className={s.prompt}>
              {promptOf(item)}
            </p>
            <p className={s.hint}>Your best estimate is perfect. No calculator needed.</p>
          </Card>

          <Card as="section" className={s.zone} aria-label="Your answer">
            <NumberDisplay ref={inputRef} raw={raw} unit={item.unit} onChange={setRaw} onEnter={submit} />
            <Keypad onKey={onKey} />
            <div className={s.submitWrap}>
              <Button size="lg" block onClick={submit} disabled={value === null || stamping}>
                {index + 1 === total ? 'Lock in & finish' : 'Lock it in'}
              </Button>
              <AnimatePresence>
                {stamping && (
                  <motion.div
                    className={s.stamp}
                    initial={{ scale: 2.4, opacity: 0, y: -40 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.24, ease: m.springCurve }}
                    aria-hidden
                  >
                    <CoinGraphic size={72} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
