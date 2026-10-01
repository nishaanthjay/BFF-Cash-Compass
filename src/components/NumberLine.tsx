import { motion, useReducedMotion } from 'framer-motion';
import { useLayoutEffect, useRef, useState } from 'react';
import { compact, logPosition, logTicks, revealDomain } from '../lib/logScale';
import { formatUnit } from '../lib/format';
import type { Unit } from '../items/types';
import { color, fontPx, motion as m } from '../styles/tokens';
import s from './NumberLine.module.css';

type Props = { guess: number; truth: number; unit: Unit; timesLabel?: string };

const H = 210;
const AXIS_Y = 108;
const PAD = 20;
const LABEL_W = 148;
const LABEL_H = 54;
const INK = color.foreground;

/**
 * Signature screen 2 visual: log-scale number line with "your guess" vs "the real number"
 * and the gap growing in from the truth.
 */
export function NumberLine({ guess, truth, unit, timesLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const guessOk = guess > 0;
  const domain = revealDomain(guessOk ? guess : null, truth);
  const x = (v: number) => logPosition(v, domain, PAD, w - PAD);
  const xt = x(truth);
  const xg = guessOk ? x(guess) : PAD;
  const ticks = logTicks(domain, Math.max(3, Math.floor(w / 72)));
  const prefix = unit === 'usd' ? '$' : '';
  const clampLabel = (cx: number) => Math.min(Math.max(cx, LABEL_W / 2), w - LABEL_W / 2);

  const d = (sec: number) => (reduce ? 0 : sec);
  const gapLeft = Math.min(xg, xt);
  const gapW = Math.abs(xt - xg);
  const truthIsLeft = xt <= xg;

  const describe = `Number line, log scale. Real number ${formatUnit(truth, unit)}. Your guess ${guessOk ? formatUnit(guess, unit) : formatUnit(0, unit)}.`;

  return (
    <div ref={ref} className={s.wrap}>
      <svg className={s.svg} width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={describe}>
        {/* Axis */}
        <line x1={PAD} x2={w - PAD} y1={AXIS_Y} y2={AXIS_Y} stroke={INK} strokeWidth={4} strokeLinecap="round" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={AXIS_Y - 7} y2={AXIS_Y + 7} stroke={INK} strokeWidth={2} />
            {Math.abs(x(t) - xg) > 30 && (
              <text className={s.tick} x={x(t)} y={AXIS_Y + 30} textAnchor="middle" fontSize={fontPx.xs}>
                {compact(t, prefix)}
              </text>
            )}
          </g>
        ))}

        {/* Gap band grows out of the real number toward the guess */}
        {gapW > 2 && (
          <motion.rect
            x={gapLeft}
            y={AXIS_Y - 9}
            width={gapW}
            height={18}
            rx={9}
            fill={color.secondary}
            stroke={INK}
            strokeWidth={2.5}
            style={{ transformBox: 'fill-box', originX: truthIsLeft ? 0 : 1 }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: d(0.75), duration: d(0.7), ease: m.springCurve }}
          />
        )}
        {timesLabel && gapW > 72 && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d(1.35), duration: d(0.3) }}>
            <rect x={gapLeft + gapW / 2 - 34} y={AXIS_Y - 46} width={68} height={28} rx={14} fill={color.card} stroke={INK} strokeWidth={2} />
            <text className={s.times} x={gapLeft + gapW / 2} y={AXIS_Y - 26} textAnchor="middle" fontSize={fontPx.base} fill={INK}>
              {timesLabel}
            </text>
          </motion.g>
        )}

        {/* Real number: gold coin above the line */}
        <motion.g initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: d(0.15), duration: d(0.4), ease: m.springCurve }}>
          <line x1={xt} x2={xt} y1={LABEL_H + 4} y2={AXIS_Y - 14} stroke={INK} strokeWidth={2.5} />
          <rect x={clampLabel(xt) - LABEL_W / 2} y={0} width={LABEL_W} height={LABEL_H} rx={14} fill={color.tertiary} stroke={INK} strokeWidth={2.5} />
          <text className={s.labelCaption} x={clampLabel(xt)} y={19} textAnchor="middle" fontSize={fontPx.xs} fill={INK}>
            Real number
          </text>
          <text className={s.labelText} x={clampLabel(xt)} y={43} textAnchor="middle" fontSize={fontPx.xl} fill={INK}>
            {formatUnit(truth, unit)}
          </text>
          <circle cx={xt} cy={AXIS_Y} r={15} fill={color.tertiary} stroke={INK} strokeWidth={3} />
          <circle cx={xt} cy={AXIS_Y} r={8} fill="none" stroke={INK} strokeWidth={2} strokeDasharray="3 3" />
        </motion.g>

        {/* Your guess: blue pin below the line */}
        <motion.g initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: d(0.45), duration: d(0.4), ease: m.springCurve }}>
          <path d={`M ${xg} ${AXIS_Y + 4} l 11 18 h -22 Z`} fill={color.primary} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
          <line x1={xg} x2={xg} y1={AXIS_Y + 22} y2={H - LABEL_H - 4} stroke={INK} strokeWidth={2.5} />
          <rect x={clampLabel(xg) - LABEL_W / 2} y={H - LABEL_H} width={LABEL_W} height={LABEL_H - 2} rx={14} fill={color.primary} stroke={INK} strokeWidth={2.5} />
          <text className={s.labelCaption} x={clampLabel(xg)} y={H - LABEL_H + 19} textAnchor="middle" fontSize={fontPx.xs} fill={color.primaryForeground}>
            {guessOk ? 'Your guess' : 'Your guess (off scale)'}
          </text>
          <text className={s.labelText} x={clampLabel(xg)} y={H - 13} textAnchor="middle" fontSize={fontPx.xl} fill={color.primaryForeground}>
            {formatUnit(guess, unit)}
          </text>
        </motion.g>
      </svg>
    </div>
  );
}
