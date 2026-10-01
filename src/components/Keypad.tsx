import { Delete } from 'lucide-react';
import type { Key } from '../lib/entry';
import s from './Keypad.module.css';

const KEYS: Key[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

/** On-screen keypad. Every key is a real <button> so it is keyboard-operable. */
export function Keypad({ onKey }: { onKey: (k: Key) => void }) {
  return (
    <div className={s.pad} role="group" aria-label="Number keypad">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          className={[s.key, (k === '.' || k === 'back') && s.util].filter(Boolean).join(' ')}
          onClick={() => onKey(k)}
          aria-label={k === 'back' ? 'Delete last digit' : k === '.' ? 'Decimal point' : k}
        >
          {k === 'back' ? <Delete size={24} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden /> : k}
        </button>
      ))}
    </div>
  );
}
