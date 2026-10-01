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
const slug = (t) => t.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
const unlock = async (pg) => {
  await pg.getByLabel('Passcode').fill('demo');
  await pg.getByRole('button', { name: 'Unlock' }).click();
};

process.on('exit', () => globalThis.__where && console.log('last student step:', globalThis.__where));
// Facilitator: start TX999 with all modules
const f = await ctx.newPage();
watch(f);
await f.goto(`${base}/facilitator`);
await unlock(f);
await f.getByLabel('Chapter code').fill('TX999');
await f.getByLabel('Group label (optional)').fill('Grade 7 · demo');
await f.screenshot({ path: `${out}/facilitator-new-1366.png` });
await f.getByRole('button', { name: 'Start session' }).click();
await f.getByText('Students: join now').waitFor();

// Student on a phone
const s = await ctx.newPage();
watch(s);
await s.setViewportSize(M);
await s.goto(`${base}/?c=TX999`);
await s.getByRole('button', { name: 'Next' }).click();
await s.getByText('Your private code').waitFor();
await s.getByRole('button', { name: /I wrote it down/ }).click();

// Screenshots wanted: problem title -> part numbers
const WANT = { 'The Backpack Price': [1], 'Rank the Claims': [1], 'The Lawn Business': [1, 3], 'The $200 Birthday Deposit': [1], '$15 a Month': [1], 'The $10K House Flip': [1, 6], 'Sneaker Resale': [4], '$500 into $50,000': [1], 'The Hoodie Sale': [1] };
const shot = new Set();
const forbidden = /correct|spot on|nice job|well done|too low|too high|score/i;
let feedbackSeen = false;
let reloaded = false;
let steps = 0;
const seen = new Set();
while (steps < 260) {
  if (await s.getByText('All done!').isVisible().catch(() => false)) break;
  await s.getByRole('button', { name: /Lock answer|Skip/ }).waitFor();
  const title = await s.locator('h1').first().innerText();
  const partTxt = await s.getByText(/Part \d+ of \d+/).innerText();
  const part = Number(partTxt.match(/Part (\d+)/i)[1]);
  const prompt = (await s.locator('main').innerText());
  if (forbidden.test(prompt.replace(/Calculator OK/g, ''))) feedbackSeen = prompt.match(forbidden)[0];

  // interact with whichever input is shown
  if (await s.getByTestId('stack-pool').count()) {
    const btns = s.getByTestId('stack-pool').getByRole('button');
    await btns.first().click();
    await btns.first().click();
    seen.add('stack');
  } else if (await s.getByRole('button', { name: /^Move up:/ }).count()) {
    await s.getByRole('button', { name: /^Move down:/ }).first().click();
    seen.add('rank');
  } else if (await s.locator('button[aria-label$="Tap to add one."]').count()) {
    const cells = s.locator('button[aria-label$="Tap to add one."]');
    await cells.nth(2).click();
    await cells.nth(2).click();
    await cells.nth(4).click();
    seen.add('calendarCount');
  } else if (await s.locator('textarea').count()) {
    await s.locator('textarea').fill('People who lost money don’t post. Call me at 555-123-4567');
    seen.add('text');
  } else if (await s.getByRole('slider').count()) {
    const sl = s.getByRole('slider').first();
    const label = (await sl.getAttribute('aria-label')) ?? '';
    await sl.scrollIntoViewIfNeeded();
    const box = await sl.boundingBox();
    const vertical = (await sl.getAttribute('aria-orientation')) === 'vertical';
    await s.mouse.click(box.x + box.width * (vertical ? 0.5 : 0.62), box.y + box.height * (vertical ? 0.45 : 0.6));
    seen.add(/Tap the .*s to fill/.test(label) ? 'dotGrid' : vertical ? (/graph/i.test(label) ? 'curve' : 'jar') : /shade/i.test(label) ? 'shade' : 'numberLine');
    const lock = s.getByRole('button', { name: /Lock answer|Skip/ });
    if (await lock.isDisabled()) await s.getByLabel(/Your answer|Or type/).last().fill('4.8');
  } else if (await s.locator('[role=group]:not([aria-label^="Choose a"]) > button[aria-pressed]').count()) {
    const cells = s.locator('[role=group]:not([aria-label^="Choose a"]) > button[aria-pressed]');
    const k = Math.min(3, (await cells.count()) - 1);
    await cells.nth(k).scrollIntoViewIfNeeded();
    await cells.nth(k).click();
    seen.add((await cells.count()) > 6 ? 'calendar' : 'multi');
  } else if (await s.getByRole('radiogroup').count()) {
    const n = await s.getByRole('radio').count();
    await s.getByRole('radio').nth(Math.min(3, n - 1)).click();
    seen.add(n === 5 ? 'dial' : (await s.locator('svg[aria-label^="Timeline"]').count()) ? 'timeline' : 'choice');
  } else if (await s.locator('button[aria-pressed]').count() ) {
    await s.locator('button[aria-pressed]').first().click();
    seen.add('multi');
  } else {
    for (const ch of '12') await s.getByRole('button', { name: ch, exact: true }).click();
    seen.add('typed');
  }
  globalThis.__where = `${title} part ${part}`;
  ok(`${slug(title)} part ${part}: no horizontal scroll`, await noHScroll(s));

  if (WANT[title]?.includes(part) && !shot.has(`${title}-${part}`)) {
    shot.add(`${title}-${part}`);
    await s.screenshot({ path: `${out}/step-${slug(title)}-p${part}-375.png`, fullPage: true });
  }
  if (steps === 2 && !reloaded) {
    reloaded = true;
    await s.reload();
    await s.getByRole('button', { name: /Lock answer|Skip/ }).waitFor();
    ok('reload resumes on the same step (no going back)', /part 3 of/i.test(await s.getByText(/Part \d+ of \d+/).innerText()));
    continue;
  }
  if (await s.getByRole('button', { name: /Lock answer|Skip/ }).isDisabled()) {
    await s.waitForTimeout(800);
    if (await s.getByRole('button', { name: /Lock answer|Skip/ }).isDisabled()) {
      console.log('STUCK', globalThis.__where, [...seen].join(','), (await s.locator('main').innerHTML()).slice(0, 2500));
      process.exit(2);
    }
  }
  await s.getByRole('button', { name: /Lock answer|Skip/ }).click();
  await s.waitForTimeout(900);
  steps++;
}
ok(`student never sees feedback text${feedbackSeen ? ` (saw "${feedbackSeen}")` : ''}`, !feedbackSeen);
await s.getByText('All done!').waitFor();
await s.getByText('All answers saved').waitFor({ timeout: 240000 });
await s.screenshot({ path: `${out}/done-375.png`, fullPage: true });
ok(`completed ${steps} steps across all problems`, steps > 100);
ok(`exercised every input type (${[...seen].sort().join(', ')})`, ['stack', 'curve', 'jar', 'numberLine', 'shade', 'dial', 'choice', 'typed', 'text', 'dotGrid', 'calendar', 'calendarCount', 'timeline', 'rank'].every((k) => seen.has(k)));
ok('phone number redacted from free text', !/555-123-4567/.test(await s.evaluate(() => JSON.stringify(localStorage))));

// Dashboards
const a = await ctx.newPage();
watch(a);
await a.goto(`${base}/analysis`);
await unlock(a);
await a.getByText('Gap dashboard').waitFor();
await a.waitForTimeout(1200);
await a.screenshot({ path: `${out}/dash-overview-1366.png`, fullPage: true });
for (const id of ['S3', 'S4', 'S10', 'S11A', 'S12', 'S13', 'S14', 'S15', 'F3', 'F4', 'F6', 'F7', 'F8', 'H2']) {
  await a.goto(`${base}/analysis/item/${id}`);
  await a.getByText('Facilitator decision').waitFor();
  await a.waitForTimeout(900);
  await a.screenshot({ path: `${out}/dash-${id}-1366.png`, fullPage: true });
}
// Live workshop + click-through + projector
const live = await a.locator('select').first().locator('option', { hasText: 'NC027' }).getAttribute('value');
await a.goto(`${base}/analysis/item/S6?session=${live}`);
await a.getByText('Facilitator decision').waitFor();
await a.waitForTimeout(900);
await a.screenshot({ path: `${out}/dash-S12-live-1366.png`, fullPage: true });
await a.goto(`${base}/analysis/item/S1?session=${live}`);
await a.getByText('Facilitator decision').waitFor();
await a.waitForTimeout(900);
await a.locator('[role=button][aria-label^="List students near"]').first().click();
ok('click-through lists student codes', await a.getByRole('dialog').isVisible());
await a.goto(`${base}/analysis/item/F1?session=${live}&projector=1`);
await a.getByText('Facilitator decision').waitFor();
await a.waitForTimeout(900);
ok('projector mode: no click-through bands', (await a.locator('[role=button][aria-label^="List students near"]').count()) === 0);
ok('projector mode: no student codes in the DOM', !/[A-HJ-KM-NP-Z2-9]{3}-[A-HJ-KM-NP-Z2-9]{3}/.test(await a.locator('main').innerText()));
await a.screenshot({ path: `${out}/dash-F1-projector-1366.png`, fullPage: true });

const am = await ctx.newPage();
watch(am);
await am.setViewportSize(M);
for (const id of ['S6', 'F1', 'F5']) {
  await am.goto(`${base}/analysis/item/${id}`);
  if (id === 'S6') await unlock(am);
  await am.getByText('Facilitator decision').waitFor();
  await am.waitForTimeout(900);
  ok(`dashboard ${id} at 375 has no horizontal scroll`, await noHScroll(am));
  await am.screenshot({ path: `${out}/dash-${id}-375.png`, fullPage: true });
}

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
