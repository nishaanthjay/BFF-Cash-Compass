import s from './Spinner.module.css';

export function Spinner() {
  return (
    <div className={s.wrap} role="status" aria-label="Loading">
      <div className={s.ring} />
    </div>
  );
}
