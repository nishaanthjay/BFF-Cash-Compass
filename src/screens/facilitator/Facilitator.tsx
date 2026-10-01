import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCheck, ListChecks, Play, Shuffle, Users } from 'lucide-react';
import { api } from '../../api';
import { ApiError, CHAPTER_CODE, normalizeChapter, type OpenSession, type SessionStats, type SessionStatus } from '../../api/types';
import { estimateMinutes, pickUnits, problemsFor, SHORT_SESSION_SIZE, type PickUnit } from '../../items';
import { MODULE_LABELS, type Module } from '../../items/types';

const ALL_MODULES = Object.keys(MODULE_LABELS) as Module[];
type Mode = 'random' | 'pick' | 'all';
const draw = (units: PickUnit[]) =>
  [...units]
    .sort(() => Math.random() - 0.5)
    .slice(0, SHORT_SESSION_SIZE)
    .map((u) => u.key);
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { FieldError } from '../../components/FieldError';
import { IconBadge } from '../../components/IconBadge';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { StaffShell } from '../../components/StaffShell';
import { StatTile } from '../../components/StatTile';
import { browserKV } from '../../lib/storage';
import { color } from '../../styles/tokens';
import { PasscodeGate } from './PasscodeGate';
import s from './Facilitator.module.css';

const kv = browserKV();
const ACTIVE_KEY = 'mc.fac.session';

export function joinUrl(chapter: string, origin = window.location.origin) {
  return `${origin}/?c=${encodeURIComponent(chapter)}`;
}

function errText(e: unknown) {
  if (e instanceof ApiError) {
    if (e.code === 'chapter_busy') return 'That chapter already has an open session. Resume it below.';
    if (e.code === 'invalid') return 'Chapter codes are 3 to 10 letters or numbers.';
    if (e.code === 'network') return 'Can’t reach the server. Check the connection.';
  }
  return 'Something went wrong. Try again.';
}

export function Facilitator() {
  return <PasscodeGate>{(pass, lock) => <FacilitatorHome pass={pass} lock={lock} />}</PasscodeGate>;
}

function FacilitatorHome({ pass, lock }: { pass: string; lock: () => void }) {
  const [active, setActive] = useState<{ id: string; chapter: string } | null>(() => {
    try {
      return JSON.parse(kv.getItem(ACTIVE_KEY) ?? 'null');
    } catch {
      return null;
    }
  });
  const [open, setOpen] = useState<OpenSession[] | null>(null);
  const [code, setCode] = useState('');
  const units = pickUnits();
  const [mode, setMode] = useState<Mode>('random');
  const [drawn, setDrawn] = useState<string[]>(() => draw(units));
  const [picked, setPicked] = useState<string[]>([]);
  const chosen = mode === 'random' ? drawn : mode === 'pick' ? picked : [];
  const chosenIds = units.filter((u) => chosen.includes(u.key)).flatMap((u) => u.ids);
  const sessionProblems = mode === 'all' ? problemsFor(ALL_MODULES) : problemsFor(ALL_MODULES, chosenIds);
  const ready = mode === 'all' || chosen.length === SHORT_SESSION_SIZE;
  const [cohort, setCohort] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activate = (a: { id: string; chapter: string } | null) => {
    if (a) kv.setItem(ACTIVE_KEY, JSON.stringify(a));
    else kv.removeItem(ACTIVE_KEY);
    setActive(a);
  };

  const refresh = useCallback(async () => {
    try {
      setOpen(await api.openSessions(pass));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'bad_passcode') lock();
      else setError(errText(e));
    }
  }, [pass, lock]);

  useEffect(() => {
    if (!active) void refresh();
  }, [active, refresh]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const c = normalizeChapter(code);
    if (!CHAPTER_CODE.test(c)) return setError('Chapter codes are 3 to 10 letters or numbers.');
    setBusy(true);
    setError(null);
    try {
      const sess = await api.createSession(pass, c, ALL_MODULES, cohort, mode === 'all' ? [] : chosenIds);
      activate({ id: sess.id, chapter: sess.chapter_code });
    } catch (err) {
      setError(errText(err));
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <StaffShell onLock={lock} decor={!active}>
      <Screen width="page">
        {active ? (
          <LiveSession pass={pass} id={active.id} chapter={active.chapter} onLeave={() => activate(null)} onAuthFail={lock} />
        ) : (
          <div className={s.stack}>
            <div>
              <h1 className={s.h1}>Run a Money Check</h1>
              <p className={s.sub}>Start a session for your chapter, then project the code and QR for students.</p>
            </div>
            <div className={s.grid2}>
              <Card as="section" tone="featured" aria-labelledby="new-h">
                <form className={s.form} onSubmit={create} noValidate>
                  <h2 id="new-h">New session</h2>
                  <Input
                    label="Chapter code"
                    code
                    value={code}
                    onChange={(e) => setCode(normalizeChapter(e.target.value).slice(0, 10))}
                    placeholder="TX014"
                    hint="Use your chapter’s code. One open session per chapter."
                    autoComplete="off"
                  />
                  <Input label="Group label (optional)" value={cohort} maxLength={60} onChange={(e) => setCohort(e.target.value)} placeholder="Grade 7 · Tuesday" hint="Helps you find this workshop later. No student names." />
                  <fieldset className={s.modules}>
                    <legend className="eyebrow">Questions</legend>
                    {([
                      ['random', 'Random 5', 'A quick check. We pick 5 problems for the whole group.'],
                      ['pick', 'I’ll pick 5', 'Choose the 5 problems you want to teach around.'],
                      ['all', 'Everything', 'Every problem. Long: plan for a full workshop.'],
                    ] as [Mode, string, string][]).map(([m, label, hint]) => (
                      <label key={m} className={s.moduleRow}>
                        <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
                        <span>
                          {label} <span className={s.muted}>· {hint}</span>
                        </span>
                      </label>
                    ))}
                    {mode === 'random' && (
                      <div className={s.picks}>
                        <ul className={s.pickList}>
                          {units.filter((u) => drawn.includes(u.key)).map((u) => (
                            <li key={u.key}>{u.title}</li>
                          ))}
                        </ul>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setDrawn(draw(units))}>
                          <Shuffle size={16} strokeWidth={2.5} aria-hidden /> Shuffle
                        </Button>
                      </div>
                    )}
                    {mode === 'pick' && (
                      <div className={s.picks}>
                        <p className={`${s.muted} num`} aria-live="polite">
                          {picked.length} of {SHORT_SESSION_SIZE} chosen
                        </p>
                        {ALL_MODULES.map((m) => (
                          <div key={m}>
                            <p className="eyebrow">{MODULE_LABELS[m]}</p>
                            {units.filter((u) => u.module === m).map((u) => {
                              const on = picked.includes(u.key);
                              return (
                                <label key={u.key} className={s.moduleRow}>
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    disabled={!on && picked.length >= SHORT_SESSION_SIZE}
                                    onChange={(e) => setPicked(e.target.checked ? [...picked, u.key] : picked.filter((k) => k !== u.key))}
                                  />
                                  <span>{u.title}</span>
                                </label>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className={`${s.muted} num`}>
                      About {estimateMinutes(sessionProblems)} minutes per student. Students can stop and resume with their code.
                    </p>
                  </fieldset>
                  {error && <FieldError>{error}</FieldError>}
                  <Button type="submit" size="lg" block disabled={busy || code.length < 3 || !ready}>
                    {busy ? 'Starting…' : 'Start session'}
                  </Button>
                </form>
              </Card>
              <Card as="section" aria-labelledby="open-h">
                <div className={s.form}>
                  <h2 id="open-h">Open sessions</h2>
                  {open === null ? (
                    <p className={s.muted}>Loading…</p>
                  ) : open.length === 0 ? (
                    <p className={s.muted}>None right now. Start one on the left.</p>
                  ) : (
                    <ul className={s.list}>
                      {open.map((o) => (
                        <li key={o.id} className={s.listItem}>
                          <div>
                            <div className={s.code}>{o.chapter_code}</div>
                            <div className={`${s.muted} num`}>
                              {o.cohort_label ? `${o.cohort_label} · ` : ''}
                              {o.students} started · {o.finished} finished
                            </div>
                          </div>
                          <Button size="sm" variant="secondary" onClick={() => activate({ id: o.id, chapter: o.chapter_code })}>
                            Resume
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </Screen>
    </StaffShell>
  );
}

function LiveSession({ pass, id, chapter, onLeave, onAuthFail }: { pass: string; id: string; chapter: string; onLeave: () => void; onAuthFail: () => void }) {
  const [stats, setStats] = useState<(SessionStats & { status: SessionStatus }) | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = joinUrl(chapter);

  const poll = useCallback(async () => {
    try {
      setStats(await api.sessionStats(pass, id));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'bad_passcode') onAuthFail();
      else if (e instanceof ApiError && e.code === 'not_found') onLeave();
      else setError('Live count paused: can’t reach the server. Retrying…');
    }
  }, [pass, id, onAuthFail, onLeave]);

  useEffect(() => {
    void poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [poll]);

  async function close() {
    if (!confirm) return setConfirm(true);
    try {
      await api.closeSession(pass, id);
      await poll();
    } catch (e) {
      setError(errText(e));
    } finally {
      setConfirm(false);
    }
  }

  const isOpen = stats?.status !== 'closed';

  return (
    <div className={s.stack}>
      <div className={s.head}>
        <div>
          <h1 className={s.h1}>{isOpen ? 'Students: join now' : 'Session closed'}</h1>
          <p className={`${s.live} ${isOpen ? '' : s.closed}`}>
            <span className={s.dot} aria-hidden />
            {isOpen ? 'Open · accepting answers' : 'Closed · no new answers'}
          </p>
        </div>
      </div>

      <div className={s.project}>
        <Card className={s.codeCard}>
          <span className="eyebrow">Go to</span>
          <span className={s.url}>{window.location.host}</span>
          <span className="eyebrow">and type chapter code</span>
          <span className={s.bigCode} aria-label={`Chapter code ${chapter.split('').join(' ')}`}>
            {chapter}
          </span>
        </Card>
        <Card className={s.qrCard}>
          <QRCodeSVG value={url} size={260} level="M" fgColor={color.foreground} bgColor={color.card} className={s.qr} title={`QR code for ${url}`} />
          <span className="eyebrow">Or scan to join</span>
        </Card>
      </div>

      <div className={s.tiles}>
        <StatTile label="Started" value={stats?.students ?? 0} icon={Users} tone="soft" />
        <StatTile label="Finished" value={stats?.finished ?? 0} icon={CheckCheck} tone="mint" highlight={!!stats && stats.finished > 0} />
        <StatTile label="Answers" value={stats?.responses ?? 0} icon={ListChecks} tone="gold" />
      </div>
      {error && <FieldError>{error}</FieldError>}

      <div className={s.actions}>
        {isOpen ? (
          <Button variant={confirm ? 'primary' : 'secondary'} onClick={close} onBlur={() => setConfirm(false)}>
            {confirm ? 'Tap again to close session' : 'Close session'}
          </Button>
        ) : (
          <Button onClick={onLeave}>
            <IconBadge icon={Play} tone="gold" size="sm" />
            Start another session
          </Button>
        )}
        {isOpen && (
          <Button variant="ghost" onClick={onLeave}>
            Back to sessions
          </Button>
        )}
        <Link className={s.liveLink} to={`/analysis?session=${id}`}>
          Open live dashboard →
        </Link>
      </div>
    </div>
  );
}
