/**
 * Beeswarm layout: place dots at their x, nudging vertically (alternating up/down)
 * until they don't overlap a dot already placed. O(n²) — fine for workshop sizes.
 */
export function beeswarm(xs: number[], r: number): number[] {
  const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const placed: { x: number; y: number }[] = [];
  const ys = new Array<number>(xs.length).fill(0);
  const d = 2 * r + 1;
  for (const { x, i } of order) {
    const near = placed.filter((p) => Math.abs(p.x - x) < d);
    let y = 0;
    for (let k = 0; k < 400; k++) {
      y = k === 0 ? 0 : (Math.ceil(k / 2) * (k % 2 ? 1 : -1) * d) / 2;
      if (near.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 >= d * d - 0.01)) break;
    }
    placed.push({ x, y });
    ys[i] = y;
  }
  return ys;
}
