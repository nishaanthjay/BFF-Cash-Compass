import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, Check, Lightbulb } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { IconBadge } from '../../components/IconBadge';
import { NumberLine } from '../../components/NumberLine';
import { CATEGORY_ICON, CATEGORY_TONE } from '../../items/categoryIcons';
import { explanationOf, promptOf, truthOf } from '../../items';
import { DECA_LABELS, type Item } from '../../items/types';
import { verdictFor } from '../../lib/verdict';
import { motion as m } from '../../styles/tokens';
import s from './RevealView.module.css';

type Props = {
  item: Item;
  guess: number;
  index: number;
  total: number;
  onNext: () => void;
};

/** Signature screen 2: the reveal, shown after the student finishes. Log number line, gap animates in, then the one-line explanation. */
export function RevealView({ item, guess, index, total, onNext }: Props) {
  const reduce = useReducedMotion();
  const truth = truthOf(item);
  const v = verdictFor(guess, truth);
  const Icon = CATEGORY_ICON[item.deca_category];
  const VerdictIcon = v.kind === 'spot-on' ? Check : v.kind === 'under' ? ArrowDown : ArrowUp;
  const timesLabel = v.kind !== 'spot-on' && Number.isFinite(v.times) && v.times >= 2 ? v.headline.split(' ')[0] : undefined;
  const late = (sec: number) => ({ delay: reduce ? 0 : sec, duration: reduce ? 0 : 0.35, ease: m.springCurve });
  const last = index + 1 === total;

  return (
    <div className={s.stack}>
      <div className={s.head}>
        <span className={`eyebrow ${s.kicker}`}>
          The reveal
        </span>
        <span className={s.count}>
          {index + 1} of {total}
        </span>
      </div>

      <Card as="section" tone="featured" className={s.card} aria-labelledby={`r-${item.id}`}>
        <div className={s.qMeta}>
          <IconBadge icon={Icon} tone={CATEGORY_TONE[item.deca_category]} size="sm" />
          <span className={`eyebrow ${s.category}`}>{DECA_LABELS[item.deca_category]}</span>
          {item.sample && <span className={`eyebrow ${s.sample}`}>Sample</span>}
        </div>
        <p id={`r-${item.id}`} className={s.prompt}>
          {promptOf(item)}
        </p>

        <div className={s.lineZone}>
          <NumberLine key={item.id} guess={guess} truth={truth} unit={item.unit} timesLabel={timesLabel} />
        </div>

        <motion.div className={s.verdict} data-kind={v.kind} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={late(1.5)} aria-live="polite">
          <IconBadge icon={VerdictIcon} tone={v.kind === 'spot-on' ? 'mint' : v.kind === 'under' ? 'pink' : 'blue'} size="lg" />
          <div>
            <h2 className={s.headline}>{v.headline}</h2>
            <p className={s.detail}>{v.detail}</p>
          </div>
        </motion.div>

        <motion.div className={s.explain} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={late(1.8)}>
          <IconBadge icon={Lightbulb} tone="gold" />
          <p className={s.explainText}>{explanationOf(item)}</p>
        </motion.div>
      </Card>

      <Button size="lg" block variant={last ? 'gold' : 'primary'} onClick={onNext}>
        {last ? 'Finish' : 'Next reveal'}
      </Button>
    </div>
  );
}
