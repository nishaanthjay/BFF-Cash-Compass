import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Decor } from './Decor';
import { Wordmark } from './Wordmark';
import s from './StaffShell.module.css';

/** Facilitator / analysis frame: denser, quieter decoration. */
export function StaffShell({ children, onLock, decor = true }: { children: ReactNode; onLock?: () => void; decor?: boolean }) {
  const cls = ({ isActive }: { isActive: boolean }) => [s.link, isActive && s.active].filter(Boolean).join(' ');
  return (
    <div className={s.shell}>
      {decor && <Decor variant="quiet" />}
      <header className={s.bar}>
        <Wordmark />
        <nav className={s.nav} aria-label="Staff">
          <NavLink to="/facilitator" className={cls}>
            Session
          </NavLink>
          <NavLink to="/analysis" className={cls}>
            Analysis
          </NavLink>
          {onLock && (
            <button type="button" className={s.link} onClick={onLock}>
              Lock
            </button>
          )}
        </nav>
      </header>
      {children}
    </div>
  );
}
