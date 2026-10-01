import { Reorder } from 'framer-motion';
import { X } from 'lucide-react';
import { IconBadge } from '../components/IconBadge';
import type { StackCard } from '../items/types';
import type { OnValue, StepValue } from './types';
import s from './StackCards.module.css';

type Props = { cards: StackCard[]; poolLabel: string; areaLabel: string; value: StepValue; onChange: OnValue; label: string };

/**
 * C4 stack cards. Tap a card to add it to the "counts" area (works with touch,
 * mouse and keyboard); drag the grip to reorder; "Remove" takes it back. The set
 * and the order are recorded. There is no running total and no feedback.
 */
export function StackCards({ cards, poolLabel, areaLabel, value, onChange, label }: Props) {
  const chosen = value.choice ?? [];
  const byId = new Map(cards.map((c) => [c.id, c]));
  const pool = cards.filter((c) => !chosen.includes(c.id));
  const set = (ids: string[], m: Parameters<OnValue>[1]) => onChange({ raw: null, choice: ids }, m);

  return (
    <div className={s.wrap} aria-label={label} role="group">
      <div>
        <p className={`eyebrow ${s.areaLabel}`}>{poolLabel}</p>
        <ul className={s.pool} data-testid="stack-pool">
          {pool.map((c) => (
            <li key={c.id}>
              <button type="button" className={`${s.card} ${s.pick}`} onClick={() => set([...chosen, c.id], 'tapped')} aria-label={`Add to the stack: ${c.label}${c.amount ? `, ${c.amount}` : ''}`}>
                <span className={s.label}>{c.label}</span>
                {c.amount && <span className={s.amount}>{c.amount}</span>}
              </button>
            </li>
          ))}
          {pool.length === 0 && <li className={s.note}>All cards are in the stack.</li>}
        </ul>
      </div>
      <div>
        <p className={`eyebrow ${s.areaLabel}`}>{areaLabel}</p>
        <div className={s.stackBox}>
          {chosen.length === 0 ? (
            <p className={s.empty}>Tap a card above to add it here.</p>
          ) : (
            <Reorder.Group as="ul" axis="y" values={chosen} onReorder={(ids: string[]) => set(ids, 'dragged')} className={s.stack}>
              {chosen.map((id, i) => {
                const c = byId.get(id);
                if (!c) return null;
                return (
                  <Reorder.Item as="li" key={id} value={id} className={s.card} whileDrag={{ scale: 1.02 }}>
                    <span className={s.grip} aria-hidden>
                      ⋮⋮
                    </span>
                    <span className={s.order} aria-hidden>
                      {i + 1}
                    </span>
                    <span className={s.label}>{c.label}</span>
                    {c.amount && <span className={s.amount}>{c.amount}</span>}
                    <button type="button" className={s.remove} onClick={() => set(chosen.filter((x) => x !== id), 'tapped')} aria-label={`Remove from the stack: ${c.label}`}>
                      <IconBadge icon={X} tone="muted" size="sm" />
                    </button>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          )}
        </div>
      </div>
      <p className={s.note}>Drag the dots on a card to change the order.</p>
    </div>
  );
}
