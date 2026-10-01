import { contrastRatio } from '../src/lib/contrast';
import { PAIRS, color } from './contrastPairs';

let failed = 0;
console.log('| Use | FG | BG | Ratio | Min | Result |\n|---|---|---|---|---|---|');
for (const p of PAIRS) {
  const r = contrastRatio(color[p.fg], color[p.bg]);
  const ok = r >= p.min;
  if (!ok) failed++;
  console.log(`| ${p.use} | ${p.fg} | ${p.bg} | ${r.toFixed(2)}:1 | ${p.min} | ${ok ? 'PASS' : 'FAIL'} |`);
}
if (failed) {
  console.error(`${failed} pair(s) fail WCAG AA`);
  process.exit(1);
}
