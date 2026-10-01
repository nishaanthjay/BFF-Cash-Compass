import { color, fontPx } from '../styles/tokens';
import type { OnValue, StepValue } from './types';
import s from './ChoiceTimeline.module.css';

type Opt = { id: string; label: string; amount: string; weeks: number };

/**
 * C8 two-option choice on a timeline. The delay is shown as distance on a weeks axis; no interest
 * and no percent are shown. Nothing is preselected.
 */
export function ChoiceTimeline({ options, maxWeeks, value, onChange, label }: { options: Opt[]; maxWeeks: number; value: StepValue; onChange: OnValue; label: string }) {
  const chosen = value.choice?.[0];
  const W = 320;
  const L = 18;
  const R = 18;
  const x = (w: number) => L + (w / maxWeeks) * (W - L - R);
  const step = maxWeeks <= 8 ? 1 : maxWeeks <= 16 ? 2 : maxWeeks <= 32 ? 4 : 8;
  const ticks = Array.from({ length: Math.floor(maxWeeks / step) + 1 }, (_, i) => i * step);
  return (
    <div className={s.wrap}>
      <div className={s.cards} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={chosen === o.id} className={s.card} onClick={() => onChange({ raw: null, choice: [o.id] }, 'tapped')}>
            <span className={s.amount}>{o.amount}</span>
            <span className={s.when}>{o.label}</span>
          </button>
        ))}
      </div>
      <svg className={s.axis} viewBox={`0 0 ${W} 70`} role="img" aria-label={`Timeline in weeks: ${options.map((o) => `${o.amount} ${o.label}`).join('; ')}`}>
        <line x1={L} x2={W - R} y1={26} y2={26} stroke={color.foreground} strokeWidth={4} strokeLinecap="round" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={20} y2={32} stroke={color.foreground} strokeWidth={2} />
            <text className={s.tick} x={x(t)} y={52} textAnchor="middle" fontSize={fontPx.xs}>
              {t === 0 ? 'Today' : `${t}w`}
            </text>
          </g>
        ))}
        {options.map((o) => (
          <g key={o.id}>
            <circle cx={x(o.weeks)} cy={26} r={11} fill={chosen === o.id ? color.primary : color.tertiary} stroke={color.foreground} strokeWidth={3} />
            <text className={s.label} x={Math.min(Math.max(x(o.weeks), 22), W - 22)} y={14} textAnchor="middle" fontSize={fontPx.sm} fill={color.foreground}>
              {o.amount}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
