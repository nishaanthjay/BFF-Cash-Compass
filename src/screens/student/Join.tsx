import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, KeyRound, ShieldCheck, Target } from 'lucide-react';
import { api } from '../../api';
import { ApiError, CHAPTER_CODE, normalizeChapter, type JoinedSession } from '../../api/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { FieldError } from '../../components/FieldError';
import { Footer } from '../../components/Footer';
import { IconBadge } from '../../components/IconBadge';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { StudentShell } from '../../components/StudentShell';
import { estimateMinutes, problemsFor, stepsFor } from '../../items';
import { clearRun, loadRun, saveRun } from '../../lib/run';
import { browserKV } from '../../lib/storage';
import { formatCode, isStudentCode, newStudentCode, normalizeStudentCode } from '../../lib/studentCode';
import { queue, syncNow, useOnline } from '../../lib/sync';
import { deviceType } from '../../lib/telemetry';
import { makeRun } from './session';
import s from './Join.module.css';

const kv = browserKV();

function messageFor(e: unknown): string {
  const code = e instanceof ApiError ? e.code : 'network';
  switch (code) {
    case 'not_found':
      return 'No open session for that code. Check the screen at the front of the room.';
    case 'network':
      return 'Can’t reach Cash Compass right now. Check the wifi and try again.';
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
  const [joined, setJoined] = useState<JoinedSession | null>(null);
  const [newCode] = useState(() => newStudentCode());
  const [haveCode, setHaveCode] = useState(false);
  const [oldCode, setOldCode] = useState('');
  const [existing, setExisting] = useState(() => {
    const r = loadRun(kv);
    return r && !r.done ? r : null;
  });

  async function findSession(e: FormEvent) {
    e.preventDefault();
    const c = normalizeChapter(code);
    if (!CHAPTER_CODE.test(c)) return setError('Chapter codes are 3 to 10 letters or numbers, like TX014.');
    setBusy(true);
    setError(null);
    try {
      setJoined(await api.joinSession(c));
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function begin(studentCode: string, resume: boolean) {
    if (!joined) return;
    setBusy(true);
    setError(null);
    try {
      let locked: string[] = [];
      if (resume) {
        const r = await api.resumeStudent(joined.session_id, studentCode);
        if (!r) {
          setBusy(false);
          return setError('We couldn’t find that code in this session. Check it, or start with a new code.');
        }
        locked = r.locked;
      }
      const run = makeRun(joined, studentCode, locked);
      saveRun(kv, run);
      if (!resume) {
        const expected = problemsFor(joined.modules, joined.problem_ids).reduce((a, p) => a + stepsFor(p, run.forms).length, 0);
        queue.addStudent({ student_code: studentCode, session_id: joined.session_id, forms: run.forms, device_type: deviceType(), expected_steps: expected, started_at: run.started_at });
        void syncNow();
      }
      navigate('/run');
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  }

  const minutes = joined ? estimateMinutes(problemsFor(joined.modules, joined.problem_ids)) : null;

  return (
    <StudentShell decor="landing" wiggle>
      <Screen>
        <div className={s.hero}>
          <h1 className={s.title}>
            How good is your <mark>money sense?</mark>
          </h1>
          <p className={s.lede}>Real-life money questions. Type or tap your best estimate. There are no grades.</p>
        </div>

        <div className={s.stack}>
          {existing && !joined && (
            <Card tone="mint" className={s.resume}>
              <h2 className={s.h2}>Welcome back!</h2>
              <p>
                Your code is <strong className="num">{formatCode(existing.student_code)}</strong>. Pick up where you left off.
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

          {!joined ? (
            <Card as="section" tone="featured" aria-labelledby="join-h">
              <form className={s.form} onSubmit={findSession} noValidate>
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
                  {busy ? 'Finding your session…' : 'Next'}
                </Button>
              </form>
            </Card>
          ) : (
            <Card as="section" tone="featured" aria-labelledby="code-h" className={s.form}>
              <div className={s.row}>
                <IconBadge icon={KeyRound} tone="gold" />
                <h2 id="code-h" className={s.h2}>
                  {haveCode ? 'Enter your code' : 'Your private code'}
                </h2>
              </div>
              {!haveCode ? (
                <>
                  <p className={s.bigCode} aria-label={`Your code is ${newCode.split('').join(' ')}`}>
                    {formatCode(newCode)}
                  </p>
                  <p>Write this down. If you need to finish later, you’ll use it to come back. It isn’t linked to your name.</p>
                  {error && <FieldError>{error}</FieldError>}
                  <Button size="lg" block disabled={busy} onClick={() => void begin(newCode, false)}>
                    I wrote it down, start
                  </Button>
                  <Button variant="ghost" block onClick={() => setHaveCode(true)}>
                    I already have a code
                  </Button>
                </>
              ) : (
                <>
                  <Input label="Your code" code value={oldCode} onChange={(e) => setOldCode(normalizeStudentCode(e.target.value))} placeholder="ABC-123" autoComplete="off" />
                  {error && <FieldError>{error}</FieldError>}
                  <Button size="lg" block disabled={busy || !isStudentCode(oldCode)} onClick={() => void begin(oldCode, true)}>
                    Continue
                  </Button>
                  <Button variant="ghost" block onClick={() => setHaveCode(false)}>
                    Use a new code instead
                  </Button>
                </>
              )}
            </Card>
          )}

          <Card as="section" aria-label="How it works" tight>
            <ul className={s.steps}>
              <li>
                <IconBadge icon={Target} tone="gold" size="sm" />
                <span>One question at a time. Your best estimate is perfect.</span>
              </li>
              <li>
                <IconBadge icon={Clock} tone="soft" size="sm" />
                <span className="num">{minutes ? `About ${minutes} minutes. No timer.` : 'No timer, no points.'}</span>
              </li>
              <li>
                <IconBadge icon={KeyRound} tone="pink" size="sm" />
                <span>Answers lock when you tap “Lock answer.” You can’t go back.</span>
              </li>
            </ul>
          </Card>

          <Card as="section" tone="flat" tight className={s.privacy} aria-labelledby="privacy-h">
            <IconBadge icon={ShieldCheck} tone="mint" />
            <div>
              <h2 id="privacy-h">Your privacy</h2>
              <p className={s.small}>
                We never ask for your name, email, school or student ID. We save your chapter code, a random code, your answers, how you entered
                them, and the time.
              </p>
            </div>
          </Card>
        </div>
      </Screen>
      <Footer />
    </StudentShell>
  );
}
