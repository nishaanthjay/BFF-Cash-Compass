import { motion, useReducedMotion } from 'framer-motion';
import { CloudCheck, CloudOff, KeyRound, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CoinGraphic } from '../../components/Decor';
import { IconBadge } from '../../components/IconBadge';
import { formatCode } from '../../lib/studentCode';
import { syncNow, useOnline, useQueue } from '../../lib/sync';
import { motion as m } from '../../styles/tokens';
import s from './Done.module.css';

type Props = { studentCode: string; onFinish: () => void };

/** Neutral finish: no score, no correct answers. */
export function Done({ studentCode, onFinish }: Props) {
  const reduce = useReducedMotion();
  const q = useQueue();
  const online = useOnline();
  const pending = q.answers.length + q.students.length;

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
        <h1 className={s.title}>All done!</h1>
        <p>Thanks for taking Cash Compass. Your facilitator will talk through these questions in the workshop.</p>
      </div>

      <Card tight className={s.status}>
        <IconBadge icon={KeyRound} tone="gold" />
        <div>
          <strong>Your code: <span className="num">{formatCode(studentCode)}</span></strong>
          <span>Keep it if your facilitator asks for it later.</span>
        </div>
      </Card>

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
