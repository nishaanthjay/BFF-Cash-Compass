import { useLayoutEffect, useRef, useState } from 'react';

/** Container width via ResizeObserver (charts render in real pixels so text stays legible). */
export function useWidth<T extends HTMLElement>(initial = 640) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.max(260, Math.round(el.getBoundingClientRect().width))); // measure before first paint, so a phone never flashes a 640px chart
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
