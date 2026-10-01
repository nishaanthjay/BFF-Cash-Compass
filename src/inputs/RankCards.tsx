import { Reorder } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { OnValue, StepValue } from './types';
import s from './RankCards.module.css';

type Props = { cards: { id: string; label: string }[]; topLabel: string; bottomLabel: string; shown: string[]; value: StepValue; onChange: OnValue; label: string };

export { rankShown } from '../lib/rank';

/**
 * Drag-to-rank. Each card also has move up / move down buttons so ranking never needs a drag.
 * The shuffled starting order is recorded so the analysis can tell what was moved.
 */
export function RankCards({ cards, topLabel, bottomLabel, shown, value, onChange, label }: Props) {
  const order = value.choice ?? shown;
  const byId = new Map(cards.map((c) => [c.id, c]));
  const emit = (ids: string[], m: Parameters<OnValue>[1]) => onChange({ raw: null, choice: ids, extra: { shown, moves: ((value.extra?.moves as number | undefined) ?? 0) + 1 } }, m);
  const move = (i: number, d: -1 | 1) => {
    const next = [...order];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    emit(next, 'tapped');
  };
  return (
    <div className={s.wrap} role="group" aria-label={label}>
      <p className={`eyebrow ${s.end}`}>
        <span>▲ {topLabel}</span>
      </p>
      <Reorder.Group as="ul" axis="y" values={order} onReorder={(ids: string[]) => emit(ids, 'dragged')} className={s.list}>
        {order.map((id, i) => (
          <Reorder.Item as="li" key={id} value={id} className={s.card} whileDrag={{ scale: 1.02 }}>
            <span className={s.grip} aria-hidden>
              ⋮⋮
            </span>
            <span className={s.rank} aria-hidden>
              {i + 1}
            </span>
            <span className={s.text}>{byId.get(id)?.label}</span>
            <span className={s.moves}>
              <button type="button" className={s.move} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move up: ${byId.get(id)?.label}`}>
                <ChevronUp size={18} strokeWidth={2.5} aria-hidden />
              </button>
              <button type="button" className={s.move} disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label={`Move down: ${byId.get(id)?.label}`}>
                <ChevronDown size={18} strokeWidth={2.5} aria-hidden />
              </button>
            </span>
          </Reorder.Item>
        ))}
      </Reorder.Group>
      <p className={`eyebrow ${s.end}`}>
        <span>▼ {bottomLabel}</span>
      </p>
      <p className={s.note}>Drag a card, or use the arrows. The order you see now is just a starting point.</p>
    </div>
  );
}
