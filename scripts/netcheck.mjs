// Fails on any HTTP 4xx/5xx response or console error while visiting the main pages.
// Demo mode:  VITE_DEMO=1 npx vite --port 5173   then   node scripts/netcheck.mjs http://localhost:5173
// (Demo mode has no server calls, so this catches missing assets, icons and chunks. For the Supabase RPC calls
//  open the deployed site with DevTools > Network and filter by status.)
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:5173';
const passcode = process.env.PASSCODE ?? 'demo';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
const problems = [];
page.on('response', (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()} ${r.url()}`));
page.on('requestfailed', (r) => r.failure()?.errorText !== 'net::ERR_ABORTED' && problems.push(`FAILED ${r.url()} ${r.failure()?.errorText}`));
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));

const unlock = async () => {
  const field = page.getByLabel('Passcode');
  if (await field.isVisible().catch(() => false)) {
    await field.fill(passcode);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await page.waitForTimeout(800);
  }
};
for (const path of ['/', '/join', '/facilitator', '/analysis', '/analysis/item/S1']) {
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await unlock();
  await page.waitForLoadState('networkidle');
  console.log(`visited ${path}`);
}
await browser.close();
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n` + [...new Set(problems)].join('\n'));
  process.exit(1);
}
console.log('No 4xx/5xx responses and no console errors.');
