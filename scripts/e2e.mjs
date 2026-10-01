// Demo-mode end-to-end walk-through + screenshots.
// Usage: node scripts/e2e.mjs <baseUrl> <outDir>
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'screenshots';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const errors = [];
const checks = [];
const ok = (name, cond) => checks.push(`${cond ? 'PASS' : 'FAIL'} ${name}`);

async function ctxPage(vp, reduced = false) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, p };
}
const noHScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const M = { width: 375, height: 812 };
const D = { width: 1366, height: 860 };

// 1. Facilitator (desktop): unlock, start session TX999
const { ctx: fctx, p: f } = await ctxPage(D);
await f.goto(`${base}/facilitator`);
await f.getByLabel('Passcode').fill('demo');
await f.getByRole('button', { name: 'Unlock' }).click();
await f.getByLabel('Chapter code').fill('TX999');
await f.getByRole('button', { name: 'Start session' }).click();
await f.getByText('Students: join now').waitFor();
await f.waitForTimeout(1200);
await f.screenshot({ path: `${out}/facilitator-live-1366.png` });

// Student shares the same browser storage (demo mock lives in localStorage)
const s = await fctx.newPage();
await s.setViewportSize(M);
s.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
s.on('pageerror', (e) => errors.push(String(e)));
s.on('requestfailed', (r) => console.log('requestfailed', r.url()));
await s.goto(`${base}/?c=TX999`);
await s.waitForTimeout(700);
await s.screenshot({ path: `${out}/join-375.png`, fullPage: true });
ok('join 375 no horizontal scroll', await noHScroll(s));
await s.getByRole('button', { name: 'Let’s go' }).click();
await s.getByText('Question 1').first().waitFor();
const typeAndLock = async (g) => {
  for (const ch of g) await s.getByRole('button', { name: ch, exact: true }).click();
  ok('item 375 no horizontal scroll', await noHScroll(s));
  await s.getByRole('button', { name: /Lock/ }).click();
  await s.waitForTimeout(450);
};
await typeAndLock('2500');
// Reload mid-run: resumes on question 2
await s.reload();
await s.getByText('Question 2').first().waitFor();
ok('run resumes after reload', true);
// Offline for the rest: answers must queue locally
await s.context().setOffline(true);
await typeAndLock('950');
await typeAndLock('1200');
const queued = await s.evaluate(() => JSON.parse(localStorage.getItem('mc.queue') || '{}').answers?.length ?? 0);
ok(`offline answers queued locally (${queued})`, queued === 2);
await s.getByText('The reveal').waitFor();
await s.waitForTimeout(2600);
await s.screenshot({ path: `${out}/reveal-flow-375.png`, fullPage: true });
for (let i = 0; i < 2; i++) {
  await s.getByRole('button', { name: 'Next reveal' }).click();
  await s.waitForTimeout(400);
}
await s.getByRole('button', { name: 'Finish' }).click();
await s.getByText('You did it!').waitFor();
await s.waitForTimeout(600);
await s.screenshot({ path: `${out}/done-offline-375.png`, fullPage: true });
await s.context().setOffline(false);
await s.evaluate(() => window.dispatchEvent(new Event('online')));
await s.getByText('All answers saved').waitFor({ timeout: 15000 });
ok('queue synced after reconnect', true);
await s.screenshot({ path: `${out}/done-synced-375.png`, fullPage: true });

// Facilitator live count picks the student up
await f.waitForTimeout(5500);
const finished = await f.locator('text=Finished').locator('..').locator('..').innerText();
ok(`facilitator sees finished student (${finished.replace(/\s+/g, ' ')})`, /1/.test(finished));
await f.screenshot({ path: `${out}/facilitator-count-1366.png` });
// Session recovery after reload
await f.reload();
await f.getByText('Students: join now').waitFor();
ok('facilitator session resumes after reload', true);
await f.getByRole('button', { name: 'Close session' }).click();
await f.getByRole('button', { name: 'Tap again to close session' }).click();
await f.getByText('Session closed').first().waitFor();
ok('session closes', true);

// Joining a closed session fails
await s.goto(`${base}/?c=TX999`);
await s.getByRole('button', { name: 'Let’s go' }).click();
await s.getByText('No open session').waitFor();
ok('closed session rejects join', true);

// 2. Analysis desktop + mobile
await f.goto(`${base}/analysis`);
await f.getByText('Median log error by item').waitFor();
await f.waitForTimeout(1500);
await f.screenshot({ path: `${out}/analysis-1366.png`, fullPage: true });
const dl = f.waitForEvent('download');
await f.getByRole('button', { name: /Export CSV/ }).click();
const file = await dl;
const csvPath = `${out}/export.csv`;
await file.saveAs(csvPath);
ok('CSV downloaded', true);
await f.getByLabel('Chapter', { exact: true }).selectOption('WA401');
await f.waitForTimeout(800);
ok('low-n flag visible for WA401', await f.getByText('Low n').first().isVisible());

const { p: am } = await ctxPage(M);
await am.goto(`${base}/analysis`);
await am.getByLabel('Passcode').fill('demo');
await am.getByRole('button', { name: 'Unlock' }).click();
await am.getByText('Median log error by item').waitFor();
await am.waitForTimeout(1500);
await am.screenshot({ path: `${out}/analysis-375.png`, fullPage: true });
ok('analysis 375 no horizontal scroll', await noHScroll(am));

// 3. Reduced motion: count-up disabled -> final values immediately
const { p: rm } = await ctxPage(D, true);
await rm.goto(`${base}/facilitator`);
await rm.getByLabel('Passcode').fill('demo');
await rm.getByRole('button', { name: 'Unlock' }).click();
await rm.getByText('Run a Money Check').waitFor();
await rm.goto(`${base}/analysis`);
await rm.getByText('Median log error by item').waitFor();
const tileNow = await rm.locator('[aria-label^="Responses:"] span').first().innerText();
const tileLabel = await rm.locator('[aria-label^="Responses:"]').getAttribute('aria-label');
ok(`reduced motion: StatTile shows final value immediately (${tileNow} vs ${tileLabel})`, tileLabel.endsWith(tileNow));
const anim = await rm.evaluate(() => getComputedStyle(document.body).getPropertyValue('--x') || matchMedia('(prefers-reduced-motion: reduce)').matches);
ok('reduced motion media query active', anim === true);

console.log(checks.join('\n'));
console.log('console errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(checks.some((c) => c.startsWith('FAIL')) || errors.length ? 1 : 0);
