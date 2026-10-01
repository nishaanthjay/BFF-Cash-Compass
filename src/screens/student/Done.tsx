import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, Check, CloudCheck, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CoinGraphic } from '../../components/Decor';
import { IconBadge } from '../../components/IconBadge';
import { truthOf } from '../../items';
import type { Item } from '../../items/types';
import { verdictFor } from '../../lib/verdict';
import { syncNow, useOnline, useQueue } from '../../lib/sync';
import { motion as m } from '../../styles/tokens';
import s from './Done.module.css';

type Props = { items: Item[]; answers: Record<string, number>; onFinish: () => void };

export function Done({ items, answers, onFinish }: Props) {
  const reduce = useReducedMotion();
  const q = useQueue();
  const online = useOnline();
  const kinds = items.map((it) => verdictFor(answers[it.id] ?? 0, truthOf(it)).kind);
  const tally = { spot: kinds.filter((k) => k === 'spot-on').length, under: kinds.filter((k) => k === 'under').length, over: kinds.filter((k) => k === 'over').length };
  const pending = q.answers.length + q.attempts.length;

  return (
    <div className={s.stack}>
      <div className={s.hero}>
        <div className={s.pile} aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              initial={reduce ? false : { y: -120, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.08, duration: 0.45, ease: m.springCurve }}
              style={{ marginBottom: i % 2 ? 18 : 0 }}
            >
              <CoinGraphic size={i === 2 ? 96 : 72} />
            </motion.div>
          ))}
        </div>
        <h1 className={s.title}>You did it!</h1>
        <p>Thanks for taking Money Check. Your estimates help BFF of America teach money skills that stick.</p>
      </div>

      <div className={s.scoreRow}>
        <div className={s.score}>
          <IconBadge icon={Check} tone="mint" size="sm" />
          <span className={s.scoreNum}>{tally.spot}</span>
          <span className="eyebrow">Spot on</span>
        </div>
        <div className={s.score}>
          <IconBadge icon={ArrowDown} tone="pink" size="sm" />
          <span className={s.scoreNum}>{tally.under}</span>
          <span className="eyebrow">Too low</span>
        </div>
        <div className={s.score}>
          <IconBadge icon={ArrowUp} tone="blue" size="sm" />
          <span className={s.scoreNum}>{tally.over}</span>
          <span className="eyebrow">Too high</span>
        </div>
      </div>

      <Card tight className={s.status} aria-live="polite">
        {pending === 0 ? (
          <>
            <IconBadge icon={CloudCheck} tone="mint" />
            <div>
              <strong>All answers saved</strong>
              <span>You can close this tab.</span>
            </div>
          </>
        ) : (
          <>
            <IconBadge icon={online ? RefreshCw : CloudOff} tone="gold" />
            <div>
              <strong>{online ? 'Saving your answers…' : 'Waiting for wifi'}</strong>
              <span>
                {q.answers.length} {q.answers.length === 1 ? 'answer' : 'answers'} stored on this device. Keep this tab open until they sync.
              </span>
            </div>
          </>
        )}
      </Card>
      {q.lost > 0 && (
        <Card tight className={s.status}>
          <IconBadge icon={TriangleAlert} tone="danger" />
          <div>
            <strong>Some answers arrived after the session closed.</strong>
            <span>Let your facilitator know. Nothing else to do.</span>
          </div>
        </Card>
      )}
      {pending > 0 && online && (
        <Button variant="secondary" block onClick={() => void syncNow()}>
          Try saving again
        </Button>
      )}
      <Button size="lg" block variant="gold" onClick={onFinish} disabled={pending > 0}>
        Finish
      </Button>
    </div>
  );
}
