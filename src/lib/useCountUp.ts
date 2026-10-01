import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { motion as m } from '../styles/tokens';

/** Animated count-up. Jumps straight to the value under prefers-reduced-motion. */
export function useCountUp(target: number, duration: number = m.countUp): number {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? target : 0);
  useEffect(() => {
    if (reduce) {
      setV(target);
      return;
    }
    const ctrl = animate(0, target, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: setV });
    return () => ctrl.stop();
  }, [target, duration, reduce]);
  return v;
}
