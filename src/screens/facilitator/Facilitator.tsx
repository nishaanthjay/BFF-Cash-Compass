import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCheck, Copy, ListChecks, Maximize2, Play, RotateCcw, Shuffle, Users, Zap } from 'lucide-react';
import { api } from '../../api';
import { ApiError, CHAPTER_CODE, normalizeChapter, type OpenSession, type RecentSession, type SessionStats, type SessionStatus } from '../../api/types';
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
import { newChapterCode } from '../../lib/chapterCode';
import { CodeScreen } from './CodeScreen';
import { HowTo } from './HowTo';
import { PasscodeGate } from './PasscodeGate';
import s from './Facilitator.module.css';

const kv = browserKV();
const ACTIVE_KEY = 'mc.fac.session';

export function joinUrl(chapter: string, origin = window.location.origin) {
  return `${origin}/join?c=${encodeURIComponent(chapter)}`;
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
  const [recent, setRecent] = useState<RecentSession[]>([]);
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
      setRecent(await api.recentSessions(pass).catch(() => []));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'bad_passcode') lock();
      else setError(errText(e));
    }
  }, [pass, lock]);

  useEffect(() => {
    if (!active) void refresh();
  }, [active, refresh]);

  /** Create a session, picking a fresh automatic code when none is given (retrying if one is already taken). */
  async function start(opts: { code?: string; label: string; modules: Module[]; ids: string[] }) {
    setBusy(true);
    setError(null);
    try {
      let last: unknown = null;
      for (let i = 0; i < (opts.code ? 1 : 5); i++) {
        try {
          const sess = await api.createSession(pass, opts.code || newChapterCode(), opts.modules, opts.label, opts.ids);
          return activate({ id: sess.id, chapter: sess.chapter_code });
        } catch (err) {
          last = err;
          if (!(err instanceof ApiError && err.code === 'chapter_busy' && !opts.code)) break;
        }
      }
      throw last;
    } catch (err) {
      setError(errText(err));
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    const c = normalizeChapter(code);
    if (c && !CHAPTER_CODE.test(c)) return setError('Chapter codes are 3 to 10 letters or numbers. Or leave it blank for an automatic code.');
    await start({ code: c, label: cohort, modules: ALL_MODULES, ids: mode === 'all' ? [] : chosenIds });
  }

  const quickStart = () => {
    const keys = draw(units);
    return start({ label: cohort, modules: ALL_MODULES, ids: units.filter((u) => keys.includes(u.key)).flatMap((u) => u.ids) });
  };

  async function reopen(id: string, chapter: string) {
    setBusy(true);
    setError(null);
    try {
      await api.reopenSession(pass, id);
      activate({ id, chapter });
    } catch (err) {
      setError(errText(err));
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  const duplicate = (r: RecentSession) => start({ label: r.cohort_label ?? '', modules: r.modules, ids: r.problem_ids ?? [] });

  return (
    <StaffShell onLock={lock} decor={!active}>
      <Screen width="page">
        {active ? (
          <LiveSession pass={pass} id={active.id} chapter={active.chapter} onLeave={() => activate(null)} onAuthFail={lock} />
        ) : (
          <div className={s.stack}>
            <div>
              <h1 className={s.h1}>Run a Cash Compass session</h1>
              <p className={s.sub}>Start a session for your chapter, then project the code and QR for students.</p>
            </div>
            <HowTo />
            <div className={s.grid2}>
              <Card as="section" tone="featured" aria-labelledby="new-h">
                <form className={s.form} onSubmit={create} noValidate>
                  <h2 id="new-h">New session</h2>
                  <Button type="button" size="lg" block onClick={quickStart} disabled={busy}>
                    <Zap size={20} strokeWidth={2.5} aria-hidden /> Quick start · Random 5
                  </Button>
                  <p className={s.muted}>One tap: 5 random problems and an automatic join code. Or set it up yourself below.</p>
                  <Input
                    label="Chapter code (optional)"
                    code
                    value={code}
                    onChange={(e) => setCode(normalizeChapter(e.target.value).slice(0, 10))}
                    placeholder="TX014"
                    hint="Leave blank for an automatic code, or use your chapter’s code. One open session per chapter."
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
                  <Button type="submit" size="lg" block disabled={busy || (code.length > 0 && code.length < 3) || !ready}>
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
            {recent.some((r) => r.status === 'closed') && (
              <Card as="section" aria-labelledby="recent-h">
                <div className={s.form}>
                  <h2 id="recent-h">Recent sessions</h2>
                  <ul className={s.list}>
                    {recent
                      .filter((r) => r.status === 'closed')
                      .slice(0, 6)
                      .map((r) => {
                        const taken = recent.some((x) => x.status === 'open' && x.chapter_code === r.chapter_code);
                        return (
                          <li key={r.id} className={s.listItem}>
                            <div>
                              <div className={s.code}>{r.chapter_code}</div>
                              <div className={`${s.muted} num`}>
                                {r.cohort_label ? `${r.cohort_label} · ` : ''}
                                {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {r.students} started · {r.finished} finished
                              </div>
                            </div>
                            <div className={s.row}>
                              <Button size="sm" variant="secondary" disabled={busy || taken} title={taken ? 'This chapter already has an open session' : undefined} onClick={() => reopen(r.id, r.chapter_code)}>
                                <RotateCcw size={16} strokeWidth={2.5} aria-hidden /> Reopen
                              </Button>
                              <Button size="sm" variant="ghost" disabled={busy} onClick={() => duplicate(r)}>
                                Duplicate
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                  <p className={s.muted}>Reopen lets students keep going with their codes. Duplicate starts a fresh session with the same questions.</p>
                </div>
              </Card>
            )}
            {error && <FieldError>{error}</FieldError>}
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
  const [copied, setCopied] = useState(false);
  const [full, setFull] = useState(false);
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

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const t = document.createElement('textarea');
      t.value = url;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      {isOpen && (
        <ol className={s.strip} aria-label="Steps">
          <li>Project this</li>
          <li>Students join</li>
          <li>Watch Finished</li>
          <li>Close when done</li>
        </ol>
      )}

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
        <Button variant="secondary" onClick={copyLink}>
          <Copy size={18} strokeWidth={2.5} aria-hidden /> {copied ? 'Copied!' : 'Copy link'}
        </Button>
        <span className={s.srOnly} role="status" aria-live="polite">
          {copied ? 'Link copied' : ''}
        </span>
        <Button variant="secondary" onClick={() => setFull(true)}>
          <Maximize2 size={18} strokeWidth={2.5} aria-hidden /> Full screen
        </Button>
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
      {full && <CodeScreen chapter={chapter} url={url} joined={stats?.students ?? 0} onClose={() => setFull(false)} />}
    </div>
  );
}
