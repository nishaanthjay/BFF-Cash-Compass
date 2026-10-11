import { motion, useReducedMotion } from 'framer-motion';
import { Check, CloudCheck, CloudOff, Copy, KeyRound, Lightbulb, RefreshCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CoinGraphic } from '../../components/Decor';
import { IconBadge } from '../../components/IconBadge';
import { getProblem } from '../../items';
import type { DecaCategory } from '../../items/types';
import { copyText } from '../../lib/clipboard';
import { formatCode } from '../../lib/studentCode';
import { syncNow, useOnline, useQueue } from '../../lib/sync';
import { tipFor } from '../../lib/tips';
import { motion as m } from '../../styles/tokens';
import s from './Done.module.css';

type Props = { studentCode: string; problemIds?: string[]; onFinish: () => void };

/** Neutral finish: no score, no correct answers. Shows the student's code, how to come back, and one money tip. */
export function Done({ studentCode, problemIds = [], onFinish }: Props) {
  const reduce = useReducedMotion();
  const q = useQueue();
  const online = useOnline();
  const pending = q.answers.length + q.students.length;
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  const categories = [...new Set(problemIds.map((id) => getProblem(id)?.deca_category).filter((c): c is DecaCategory => !!c))];
  const tip = tipFor(categories, studentCode);
  const shown = formatCode(studentCode);

  async function copy() {
    setCopied((await copyText(shown)) ? 'yes' : 'no');
    setTimeout(() => setCopied(null), 2500);
  }

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
        <h1 className={s.title}>You finished!</h1>
        <p>Thanks for taking Cash Compass. Your workshop organizer will talk through these questions with the group.</p>
      </div>

      <Card tone="featured" className={s.codeCard}>
        <span className="eyebrow">Your code</span>
        <p className={s.bigCode} aria-label={`Your code is ${studentCode.split('').join(' ')}`}>
          {shown}
        </p>
        <Button variant="secondary" block onClick={copy}>
          {copied === 'yes' ? <Check size={18} strokeWidth={2.5} aria-hidden /> : <Copy size={18} strokeWidth={2.5} aria-hidden />}
          {copied === 'yes' ? 'Copied!' : copied === 'no' ? 'Press and hold the code to copy it' : 'Copy my code'}
        </Button>
        <span className={s.sr} role="status" aria-live="polite">
          {copied === 'yes' ? 'Code copied' : ''}
        </span>
        <p className={s.resume}>
          <KeyRound size={16} strokeWidth={2.5} aria-hidden /> Write it down. If your wifi drops or you close this page, type this code on the join screen to pick up where you left off.
        </p>
      </Card>

      <Card tight className={s.status}>
        <IconBadge icon={Lightbulb} tone="mint" />
        <div>
          <strong>Money tip</strong>
          <span>{tip.text}</span>
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
            <span>Let your workshop organizer know. Nothing else to do.</span>
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
