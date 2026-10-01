import { useRef, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { color } from '../styles/tokens';
import type { OnValue, StepValue } from './types';
import s from './Dial.module.css';

const LABELS = ['Almost certainly false', 'Probably false', 'Not sure', 'Probably true', 'Almost certainly true'];
const INK = color.foreground;

function arc(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy - r * Math.sin(a)}`;
  return `M ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`;
}

/** C3 believability dial, 1–5. Nothing is preselected; the needle appears on first choice. */
export function Dial({ value, onChange, label }: { value: StepValue; onChange: OnValue; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const v = value.raw;
  const pick = (n: number, m: 'tapped' | 'typed') => onChange({ raw: n }, m);
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = Math.min(5, Math.max(1, (v ?? i + 1) + d));
    pick(n, 'tapped');
    refs.current[n - 1]?.focus();
  };
  const W = 300;
  const cx = W / 2;
  const cy = 150;
  const seg = Math.PI / 5;
  const angle = v === null ? null : Math.PI - (v - 0.5) * seg;
  return (
    <div className={s.wrap}>
      <svg className={s.gauge} viewBox={`0 0 ${W} 165`} aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={arc(cx, cy, 70, 135, Math.PI - i * seg - 0.02, Math.PI - (i + 1) * seg + 0.02)}
            fill={v === i + 1 ? color.primary : i % 2 ? color.muted : color.card}
            stroke={INK}
            strokeWidth={2.5}
          />
        ))}
        {angle !== null && (
          <motion.line
            x1={cx}
            y1={cy}
            initial={false}
            animate={{ x2: cx + 118 * Math.cos(angle), y2: cy - 118 * Math.sin(angle) }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            stroke={INK}
            strokeWidth={6}
            strokeLinecap="round"
          />
        )}
        <circle cx={cx} cy={cy} r={14} fill={color.tertiary} stroke={INK} strokeWidth={3} />
      </svg>
      <div className={s.options} role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n, i) => (
          <button
            key={n}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            className={s.opt}
            aria-checked={v === n}
            aria-label={`${n}: ${LABELS[i]}`}
            tabIndex={v === null ? (i === 0 ? 0 : -1) : v === n ? 0 : -1}
            onClick={() => pick(n, 'tapped')}
            onKeyDown={(e) => onKey(e, i)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className={s.ends} aria-hidden>
        <span>1 = {LABELS[0].toLowerCase()}</span>
        <span>5 = {LABELS[4].toLowerCase()}</span>
      </div>
    </div>
  );
}
