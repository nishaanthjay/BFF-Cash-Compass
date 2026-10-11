import s from './ProblemDots.module.css';

/** One dot per problem: filled = finished, ringed = the one you're on. Words are in the label, not just colour. */
export function ProblemDots({ current, total }: { current: number; total: number }) {
  if (total < 2 || total > 12) return null;
  return (
    <ol className={s.dots} aria-label={`Problem ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <li key={i} className={[s.dot, i < current && s.done, i === current && s.now].filter(Boolean).join(' ')} aria-current={i === current ? 'step' : undefined}>
          <span className="sr-only">{i < current ? 'finished' : i === current ? 'current' : 'to come'}</span>
        </li>
      ))}
    </ol>
  );
}
