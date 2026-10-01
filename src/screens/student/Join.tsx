import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, Coins, ShieldCheck, Target } from 'lucide-react';
import { api } from '../../api';
import { ApiError, CHAPTER_CODE, normalizeChapter } from '../../api/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { FieldError } from '../../components/FieldError';
import { Footer } from '../../components/Footer';
import { IconBadge } from '../../components/IconBadge';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { StudentShell } from '../../components/StudentShell';
import { getItems, truthOf } from '../../items';
import { clearRun, loadRun, saveRun } from '../../lib/run';
import { browserKV } from '../../lib/storage';
import { queue, syncNow, useOnline } from '../../lib/sync';
import { uuid } from '../../lib/uuid';
import s from './Join.module.css';

const kv = browserKV();

function messageFor(e: unknown): string {
  const code = e instanceof ApiError ? e.code : 'network';
  switch (code) {
    case 'not_found':
      return 'No open session for that code. Check the screen at the front of the room.';
    case 'network':
      return 'Can’t reach Money Check right now. Check the wifi and try again.';
    case 'rate_limited':
      return 'Too many tries from this device. Wait a minute and try again.';
    default:
      return 'Something went wrong. Try again in a moment.';
  }
}

export function Join() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const online = useOnline();
  const [code, setCode] = useState(normalizeChapter(params.get('c') ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState(() => {
    const r = loadRun(kv);
    return r && r.phase !== 'done' ? r : null;
  });
  const count = getItems().length;
  const minutes = Math.max(3, Math.round(count * 0.9));

  async function start(e: FormEvent) {
    e.preventDefault();
    const c = normalizeChapter(code);
    if (!CHAPTER_CODE.test(c)) {
      setError('Chapter codes are 3 to 10 letters or numbers, like TX014.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const joined = await api.joinSession(c);
      const items = getItems();
      const run = {
        session_id: joined.session_id,
        chapter_code: joined.chapter_code,
        attempt_id: uuid(),
        item_ids: items.map((i) => i.id),
        answers: {},
        phase: 'items' as const,
        index: 0,
        revealIndex: 0,
        started_at: new Date().toISOString(),
      };
      saveRun(kv, run);
      queue.addAttempt({ attempt_id: run.attempt_id, session_id: run.session_id, item_count: items.length, started_at: run.started_at });
      void syncNow();
      // Warm the truth functions once so the first reveal never stalls.
      items.forEach(truthOf);
      navigate('/run');
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <StudentShell decor="landing" wiggle>
      <Screen>
        <div className={s.hero}>
          <h1 className={s.title}>
            How good is your <mark>money sense?</mark>
          </h1>
          <p className={s.lede}>Guess real-life money numbers, then see how close you got.</p>
        </div>

        <div className={s.stack}>
          {existing && (
            <Card tone="mint" className={s.resume}>
              <h2 className={s.h2}>Welcome back!</h2>
              <p>
                You were on question {Math.min(existing.index + 1, existing.item_ids.length)} of {existing.item_ids.length} for chapter{' '}
                <strong className="num">{existing.chapter_code}</strong>.
              </p>
              <div className={s.row}>
                <Button onClick={() => navigate('/run')}>Keep going</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    clearRun(kv);
                    setExisting(null);
                  }}
                >
                  Start over
                </Button>
              </div>
            </Card>
          )}

          <Card as="section" tone="featured" aria-labelledby="join-h">
            <form className={s.form} onSubmit={start} noValidate>
              <h2 id="join-h" className={s.h2}>
                Join your workshop
              </h2>
              <Input
                label="Chapter code"
                code
                value={code}
                onChange={(e) => setCode(normalizeChapter(e.target.value).slice(0, 10))}
                placeholder="TX014"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                hint="It’s on the screen at the front of the room, or scan the QR code."
              />
              {error && <FieldError>{error}</FieldError>}
              {!online && <FieldError>You’re offline. Connect to wifi to join.</FieldError>}
              <Button type="submit" size="lg" block disabled={busy || code.length < 3}>
                {busy ? 'Finding your session…' : 'Let’s go'}
              </Button>
            </form>
          </Card>

          <Card as="section" aria-label="How it works" tight>
            <ul className={s.steps}>
              <li>
                <IconBadge icon={Target} tone="gold" size="sm" />
                <span>Type your best estimate. No calculator needed.</span>
              </li>
              <li>
                <IconBadge icon={Clock} tone="soft" size="sm" />
                <span className="num">
                  {count} questions, about {minutes} minutes.
                </span>
              </li>
              <li>
                <IconBadge icon={Coins} tone="pink" size="sm" />
                <span>See the real numbers at the end.</span>
              </li>
            </ul>
          </Card>

          <Card as="section" tone="flat" tight className={s.privacy} aria-labelledby="privacy-h">
            <IconBadge icon={ShieldCheck} tone="mint" />
            <div>
              <h2 id="privacy-h">Your privacy</h2>
              <p className={s.small}>
                We never ask for your name, email, school or student ID. We only save your chapter code, the numbers you type, and the time
                you answered.
              </p>
            </div>
          </Card>
        </div>
      </Screen>
      <Footer />
    </StudentShell>
  );
}
