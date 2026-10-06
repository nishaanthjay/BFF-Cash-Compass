import { useState } from 'react';
import { Card } from '../../components/Card';
import { browserKV } from '../../lib/storage';
import s from './Facilitator.module.css';

const KEY = 'mc.fac.howto.seen';
const kv = browserKV();

export const STEPS = [
  'Tap Quick start (or fill in the form). You get a join code.',
  'Project this screen. Students type the code, or scan the QR.',
  'Watch Finished go up. Students can stop and come back with their own code.',
  'When everyone is done, wait a minute, then tap Close session.',
  'Open the live dashboard to see what to teach first.',
];

/** Short checklist for first-time facilitators; open the first time, then stays collapsed. */
export function HowTo() {
  const [open, setOpen] = useState(() => {
    try {
      return kv.getItem(KEY) !== '1';
    } catch {
      return true;
    }
  });
  return (
    <Card as="section" aria-labelledby="howto-h">
      <details
        className={s.howto}
        open={open}
        onToggle={(e) => {
          const o = (e.currentTarget as HTMLDetailsElement).open;
          setOpen(o);
          try {
            if (!o) kv.setItem(KEY, '1');
          } catch {
            /* storage blocked: stays open each visit */
          }
        }}
      >
        <summary id="howto-h">How to run a session</summary>
        <ol className={s.steps}>
          {STEPS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </details>
    </Card>
  );
}
