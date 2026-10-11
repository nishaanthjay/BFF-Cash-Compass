import { color, fontPx } from '../styles/tokens';
import s from './CompassArt.module.css';

const INK = color.foreground;

/** Original hero art for the home page: a sticker-style compass with a gold coin. Decorative only. */
export function CompassArt({ className }: { className?: string }) {
  const ticks = Array.from({ length: 24 }, (_, i) => i);
  return (
    <svg className={[s.art, className].filter(Boolean).join(' ')} viewBox="0 0 380 360" role="img" aria-label="A compass with a gold coin">
      {/* background shapes in the margins */}
      <circle cx="46" cy="64" r="22" fill={color.secondary} stroke={INK} strokeWidth="4" />
      <path d="M338 36 L368 92 L308 92 Z" fill={color.quaternary} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M14 300 Q 34 270 54 300 T 94 300 T 134 300" fill="none" stroke={color.primary} strokeWidth="9" strokeLinecap="round" />

      {/* compass body with a hard offset shadow */}
      <circle cx="198" cy="190" r="140" fill={INK} />
      <circle cx="188" cy="180" r="140" fill={color.card} stroke={INK} strokeWidth="5" />
      <circle cx="188" cy="180" r="112" fill={color.primarySoft} stroke={INK} strokeWidth="4" />
      {ticks.map((i) => {
        const a = (i * 15 * Math.PI) / 180;
        const long = i % 6 === 0;
        const r1 = 112;
        const r2 = long ? 92 : 100;
        return <line key={i} x1={188 + r1 * Math.sin(a)} y1={180 - r1 * Math.cos(a)} x2={188 + r2 * Math.sin(a)} y2={180 - r2 * Math.cos(a)} stroke={INK} strokeWidth={long ? 5 : 3} strokeLinecap="round" />;
      })}
      <text x="188" y="86" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight="800" fontSize={fontPx.compassN} fill={INK}>
        N
      </text>

      {/* needle */}
      <g className={s.needle}>
        <path d="M188 52 L212 180 L164 180 Z" fill={color.tertiary} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
        <path d="M188 308 L164 180 L212 180 Z" fill={color.secondary} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
        <circle cx="188" cy="180" r="14" fill={INK} />
        <circle cx="188" cy="180" r="5" fill={color.card} />
      </g>

      {/* coin */}
      <g className={s.coin}>
        <circle cx="300" cy="290" r="58" fill={INK} transform="translate(6 6)" />
        <circle cx="300" cy="290" r="58" fill={color.tertiary} stroke={INK} strokeWidth="5" />
        <circle cx="300" cy="290" r="42" fill="none" stroke={INK} strokeWidth="3.5" strokeDasharray="6 7" />
        <text x="300" y="309" textAnchor="middle" fontFamily="Outfit, sans-serif" fontWeight="800" fontSize={fontPx.compassCoin} fill={INK}>
          $
        </text>
      </g>
    </svg>
  );
}
