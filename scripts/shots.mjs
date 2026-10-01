// Usage: node scripts/shots.mjs <baseUrl> <outDir>
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'screenshots';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const errors = [];
async function page(vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  p.on('console', (m) => m.type() === 'error' && errors.push(`${m.text()}`));
  p.on('pageerror', (e) => errors.push(String(e)));
  return p;
}
const mobile = { width: 375, height: 812 };
const desk = { width: 1280, height: 800 };

let p = await page(mobile);
await p.goto(`${base}/preview/item`); await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/item-375-empty.png`, fullPage: true });
for (const k of ['3', '5', '0', '0']) await p.getByRole('button', { name: k, exact: true }).click();
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/item-375-typed.png`, fullPage: true });
const sw = await p.evaluate(() => document.documentElement.scrollWidth);
console.log('item 375 scrollWidth', sw);

p = await page(desk);
await p.goto(`${base}/preview/item?i=1`); await p.waitForTimeout(800);
await p.keyboard.type('1200');
await p.locator('input[inputmode=decimal]').focus();
await p.keyboard.type('5');
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/item-1280.png`, fullPage: true });

p = await page(mobile);
await p.goto(`${base}/preview/reveal?g=1200,900,1100`); await p.waitForTimeout(2800);
await p.screenshot({ path: `${out}/reveal-375.png`, fullPage: true });
console.log('reveal 375 scrollWidth', await p.evaluate(() => document.documentElement.scrollWidth));

p = await page(desk);
await p.goto(`${base}/preview/reveal?g=1200,900,1100`); await p.waitForTimeout(2800);
await p.screenshot({ path: `${out}/reveal-1280.png`, fullPage: true });
await p.getByRole('button', { name: 'Next reveal' }).click(); await p.waitForTimeout(2800);
await p.screenshot({ path: `${out}/reveal-1280-loan.png`, fullPage: true });
await p.getByRole('button', { name: 'Next reveal' }).click(); await p.waitForTimeout(2800);
await p.screenshot({ path: `${out}/reveal-1280-budget.png`, fullPage: true });

p = await page(mobile, { reduced: true });
await p.goto(`${base}/preview/reveal?g=5000,900,1100`); await p.waitForTimeout(150);
await p.screenshot({ path: `${out}/reveal-375-reduced-motion-150ms.png`, fullPage: true });

console.log('console errors:', errors.length ? errors : 'none');
await browser.close();
