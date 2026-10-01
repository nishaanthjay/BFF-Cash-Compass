import s from './DemoBanner.module.css';

export function DemoBanner() {
  return (
    <div className={s.banner} role="note">
      Demo data · runs in this browser only · nothing is sent to a server
    </div>
  );
}
