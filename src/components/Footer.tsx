import { Link } from 'react-router-dom';
import { Wordmark } from './Wordmark';
import s from './Footer.module.css';

export function Footer({ facilitator = true }: { facilitator?: boolean }) {
  return (
    <footer className={s.foot}>
      <Wordmark />
      {facilitator && (
        <nav className={s.links} aria-label="Staff">
          <Link to="/facilitator">Facilitator</Link>
          <Link to="/analysis">Analysis</Link>
        </nav>
      )}
    </footer>
  );
}
