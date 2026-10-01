import type { CSSProperties, ReactNode } from 'react';
import { color, fontPx } from '../styles/tokens';
import s from './Decor.module.css';

type Variant = 'landing' | 'quiet' | 'reveal';

const INK = color.foreground;

function Circle({ fill, size }: { fill: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="46" fill={fill} stroke={INK} strokeWidth="4" />
    </svg>
  );
}
function Triangle({ fill, size }: { fill: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path d="M50 6 L94 90 L6 90 Z" fill={fill} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}
function Squiggle({ stroke, size }: { stroke: string; size: number }) {
  return (
    <svg width={size} height={size / 3} viewBox="0 0 150 50">
      <path d="M5 25 Q 22 2 40 25 T 75 25 T 110 25 T 145 25" fill="none" stroke={stroke} strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}
function Dots({ fill, size }: { fill: string; size: number }) {
  const id = `dots-${fill.slice(1)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="7" r="3" fill={fill} />
        </pattern>
      </defs>
      <rect width="100" height="100" rx="18" fill={`url(#${id})`} />
    </svg>
  );
}
function Stripes({ fill, w, h }: { fill: string; w: number; h: number }) {
  const id = `stripes-${fill.slice(1)}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="12" fill={fill} />
        </pattern>
      </defs>
      <rect x="2" y="2" width={w - 4} height={h - 4} rx={(h - 4) / 2} fill={`url(#${id})`} stroke={INK} strokeWidth="3" />
    </svg>
  );
}
function Coin({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="45" fill={color.tertiary} stroke={INK} strokeWidth="4" />
      <circle cx="50" cy="50" r="32" fill="none" stroke={INK} strokeWidth="3" strokeDasharray="5 6" />
      <text x="50" y="64" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight="800" fontSize={fontPx.coinGlyph} fill={INK}>
        $
      </text>
    </svg>
  );
}

type Placed = { el: ReactNode; style: CSSProperties };

const LAYOUTS: Record<Variant, Placed[]> = {
  landing: [
    { el: <Circle fill={color.secondary} size={120} />, style: { top: '8%', left: '4%' } },
    { el: <Triangle fill={color.quaternary} size={90} />, style: { top: '58%', left: '7%' } },
    { el: <Dots fill={color.primary} size={150} />, style: { bottom: '6%', left: '14%' } },
    { el: <Squiggle stroke={color.primary} size={170} />, style: { top: '20%', right: '6%' } },
    { el: <Coin size={110} />, style: { top: '44%', right: '5%' } },
    { el: <Stripes fill={color.secondary} w={180} h={56} />, style: { bottom: '10%', right: '9%' } },
  ],
  quiet: [
    { el: <Dots fill={color.primary} size={140} />, style: { top: '18%', left: '3%' } },
    { el: <Circle fill={color.secondary} size={70} />, style: { bottom: '14%', left: '8%' } },
    { el: <Triangle fill={color.quaternary} size={70} />, style: { top: '20%', right: '7%' } },
    { el: <Stripes fill={color.tertiary} w={150} h={48} />, style: { bottom: '10%', right: '5%' } },
  ],
  reveal: [
    { el: <Coin size={96} />, style: { top: '24%', left: '5%' } },
    { el: <Squiggle stroke={color.secondary} size={150} />, style: { bottom: '16%', left: '4%' } },
    { el: <Dots fill={color.quaternary} size={140} />, style: { top: '20%', right: '4%' } },
    { el: <Triangle fill={color.tertiary} size={80} />, style: { bottom: '12%', right: '9%' } },
  ],
};

/** Margin-only decoration (DESIGN.md: "stable grid, wild decoration"). Never behind number zones. */
export function Decor({ variant = 'quiet', wiggle = false }: { variant?: Variant; wiggle?: boolean }) {
  return (
    <div className={s.layer} aria-hidden>
      {LAYOUTS[variant].map((p, i) => (
        <div key={i} className={[s.shape, wiggle && s.wiggle].filter(Boolean).join(' ')} style={p.style}>
          {p.el}
        </div>
      ))}
    </div>
  );
}

export { Coin as CoinGraphic };
