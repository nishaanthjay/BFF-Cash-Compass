import type { ReactNode } from 'react';
import { Decor } from './Decor';
import { Wordmark } from './Wordmark';
import s from './StudentShell.module.css';

type Props = {
  children: ReactNode;
  chapter?: string;
  sessionLabel?: string;
  online?: boolean;
  decor?: 'landing' | 'quiet' | 'reveal' | 'none';
  wiggle?: boolean;
};

/** Student frame: compact header with chapter chip, margin decoration, centered column. */
export function StudentShell({ children, chapter, sessionLabel, online = true, decor = 'quiet', wiggle }: Props) {
  return (
    <div className={s.shell}>
      {decor !== 'none' && <Decor variant={decor} wiggle={wiggle} />}
      <header className={s.bar}>
        <Wordmark sub={false} />
        {chapter && (
          <span className={[s.chip, !online && s.offline].filter(Boolean).join(' ')} title={online ? 'Online' : 'Offline: answers are saved and will sync'}>
            <span className={s.dot} aria-hidden />
            <span>
              {chapter}
              {sessionLabel ? ` · ${sessionLabel}` : ''}
              <span className="sr-only">{online ? ' (online)' : ' (offline, answers will sync later)'}</span>
            </span>
          </span>
        )}
      </header>
      {children}
    </div>
  );
}
