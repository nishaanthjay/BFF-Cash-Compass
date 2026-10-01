// Demo-mode walk-through + screenshots. node scripts/e2e.mjs <base> <out>
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'screenshots';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const errors = [];
const checks = [];
const ok = (n, c) => checks.push(`${c ? 'PASS' : 'FAIL'} ${n}`);
const M = { width: 375, height: 812 };
const D = { width: 1366, height: 900 };
const ctx = await browser.newContext({ viewport: D, deviceScaleFactor: 2 });
const watch = (p) => {
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push(String(e)));
};
const noHScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

// Facilitator: start TX999 with all modules
const f = await ctx.newPage();
watch(f);
await f.goto(`${base}/facilitator`);
await f.getByLabel('Passcode').fill('demo');
await f.getByRole('button', { name: 'Unlock' }).click();
await f.getByLabel('Chapter code').fill('TX999');
await f.getByLabel('Group label (optional)').fill('Grade 7 · demo');
await f.screenshot({ path: `${out}/s1-facilitator-new-1366.png` });
await f.getByRole('button', { name: 'Start session' }).click();
await f.getByText('Students: join now').waitFor();

// Student on a phone
const s = await ctx.newPage();
watch(s);
await s.setViewportSize(M);
await s.goto(`${base}/?c=TX999`);
await s.getByRole('button', { name: 'Next' }).click();
await s.getByText('Your private code').waitFor();
await s.screenshot({ path: `${out}/s1-code-375.png`, fullPage: true });
await s.getByRole('button', { name: /I wrote it down/ }).click();

const forbidden = /correct|spot on|nice job|well done|too low|too high|score/i;
let shots = new Set();
let steps = 0;
let feedbackSeen = false;
let reloaded = false;
while (steps < 40) {
  if (await s.getByText('All done!').isVisible().catch(() => false)) break;
  await s.getByRole('button', { name: /Lock answer|Skip/ }).waitFor();
  const title = await s.locator('h1').first().innerText();
  const part = await s.getByText(/Part \d+ of \d+/).innerText();
  const tag = `${title}-${part}`.replace(/[^\w]+/g, '-').toLowerCase();
  const body = await s.locator('main').innerText();
  if (forbidden.test(body.replace(/Calculator OK/, ''))) feedbackSeen = body.match(forbidden)[0];
  // Interact with whatever input is shown
  if (await s.getByRole('radiogroup').count()) {
    await s.getByRole('radio').nth(3).click();
  } else if (await s.getByRole('slider').count()) {
    const sl = s.getByRole('slider').first();
    const box = await sl.boundingBox();
    await s.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.6);
    if ((await s.getByRole('slider').getAttribute('aria-valuetext')) === 'Nothing shaded yet' || /2 of/i.test(part)) {
      await s.getByLabel(/Your answer|Or type/).last().fill('4.8');
    }
  } else if (await s.locator('textarea').count()) {
    await s.locator('textarea').fill('People who lost money don’t post. Call me at 555-123-4567');
  } else {
    for (const ch of '12') await s.getByRole('button', { name: ch, exact: true }).click();
  }
  ok(`${tag}: no horizontal scroll`, await noHScroll(s));
  const key = title.slice(0, 12);
  if (!shots.has(key) || /part 1/i.test(part)) {
    if (!shots.has(tag)) {
      await s.screenshot({ path: `${out}/s1-step-${tag}-375.png`, fullPage: true });
      shots.add(tag);
      shots.add(key);
    }
  }
  if (steps === 2 && !reloaded) {
    reloaded = true;
    await s.reload();
    await s.getByRole('button', { name: /Lock answer|Skip/ }).waitFor();
    ok('reload resumes on the same step (no going back)', /part 3 of/i.test(await s.getByText(/Part \d+ of \d+/).innerText()));
    continue;
  }
  await s.getByRole('button', { name: /Lock answer|Skip/ }).click();
  await s.waitForTimeout(350);
  steps++;
}
ok(`student never sees feedback text${feedbackSeen ? ` (saw "${feedbackSeen}")` : ''}`, !feedbackSeen);
await s.getByText('All done!').waitFor();
await s.getByText('All answers saved').waitFor({ timeout: 15000 });
await s.screenshot({ path: `${out}/s1-done-375.png`, fullPage: true });
ok(`completed ${steps} steps`, steps > 10);
const red = await s.evaluate(() => JSON.stringify(localStorage));
ok('phone number redacted from free text', !/555-123-4567/.test(red));

// Desktop step screenshot (fresh student, first item)
const s2 = await ctx.newPage();
watch(s2);
await s2.goto(`${base}/?c=TX999`);
await s2.evaluate(() => localStorage.removeItem('mc.run'));
await s2.goto(`${base}/?c=TX999`);
await s2.getByRole('button', { name: 'Next' }).click();
await s2.getByRole('button', { name: /I wrote it down/ }).click();
await s2.getByRole('button', { name: /Lock answer/ }).waitFor();
const sl = s2.getByRole('slider');
if (await sl.count()) {
  const b = await sl.first().boundingBox();
  await s2.mouse.click(b.x + b.width * 0.62, b.y + b.height * 0.6);
}
await s2.screenshot({ path: `${out}/s1-step-1366.png`, fullPage: true });

// Dashboard
const a = await ctx.newPage();
watch(a);
const unlock = async (pg) => {
  await pg.getByLabel('Passcode').fill('demo');
  await pg.getByRole('button', { name: 'Unlock' }).click();
};
await a.goto(`${base}/analysis`);
await unlock(a);
await a.getByText('Gap dashboard').waitFor();
await a.waitForTimeout(1200);
await a.screenshot({ path: `${out}/s1-dash-overview-1366.png`, fullPage: true });
for (const id of ['S1', 'S2', 'F2']) {
  await a.goto(`${base}/analysis/item/${id}`);
  await a.getByText('Facilitator decision').waitFor();
  await a.waitForTimeout(900);
  await a.screenshot({ path: `${out}/s1-dash-${id}-1366.png`, fullPage: true });
}
// Live workshop scope + click-through
const live = await a.locator('select').first().locator('option', { hasText: 'NC027' }).getAttribute('value');
await a.goto(`${base}/analysis/item/S1?session=${live}`);
await a.getByText('Facilitator decision').waitFor();
await a.waitForTimeout(900);
await a.locator('[role=button][aria-label^="List students near"]').first().click();
ok('click-through lists student codes', await a.getByRole('dialog').isVisible());
await a.screenshot({ path: `${out}/s1-dash-S1-live-click-1366.png`, fullPage: true });
await a.goto(`${base}/analysis/item/S1?session=${live}&projector=1`);
await a.getByText('Facilitator decision').waitFor();
await a.waitForTimeout(600);
ok('projector mode: no click-through bands', (await a.locator('[role=button][aria-label^="List students near"]').count()) === 0);
await a.screenshot({ path: `${out}/s1-dash-S1-projector-1366.png`, fullPage: true });
const am = await ctx.newPage();
watch(am);
await am.setViewportSize(M);
await am.goto(`${base}/analysis/item/F2`);
await unlock(am);
await am.getByText('Facilitator decision').waitFor();
await am.waitForTimeout(900);
ok('dashboard 375 no horizontal scroll', await noHScroll(am));
await am.screenshot({ path: `${out}/s1-dash-F2-375.png`, fullPage: true });

const rmCtx = await browser.newContext({ viewport: D, reducedMotion: 'reduce' });
const rm = await rmCtx.newPage();
watch(rm);
await rm.goto(`${base}/analysis`);
await unlock(rm);
await rm.getByText('Gap dashboard').waitFor();
const lbl = await rm.locator('[aria-label^="Started:"]').getAttribute('aria-label');
const shown = await rm.locator('[aria-label^="Started:"] span').first().innerText();
ok(`reduced motion: count-up skipped (${shown} vs ${lbl})`, lbl.endsWith(shown));

console.log(checks.join('\n'));
console.log('console errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(checks.some((c) => c.startsWith('FAIL')) || errors.length ? 1 : 0);
