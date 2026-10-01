import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { motion as m } from '../styles/tokens';
import s from './Screen.module.css';

/** Page container with the spring "pop" entry. */
export function Screen({ children, width = 'student', className }: { children: ReactNode; width?: 'student' | 'page' | 'wide'; className?: string }) {
  return (
    <motion.main
      className={[s.screen, s[width], className].filter(Boolean).join(' ')}
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: m.itemTransition, ease: m.springCurve }}
    >
      {children}
    </motion.main>
  );
}
