const fs = require('node:fs');
const path = require('node:path');
const { assert, getPlaywright, startServer, touch, assertClean } = require('./helpers.cjs');

const browserName = process.env.TEST_BROWSER || 'chromium';
const sizes = process.env.TEST_VIEWPORT ? process.env.TEST_VIEWPORT.split(',').map(value => {
  assert.match(value, /^\d+x\d+$/); const [width, height] = value.split('x').map(Number); return { width, height };
}) : [{ width: 390, height: 660 }, { width: 1024, height: 768 }];
const artifacts = process.env.TEST_ARTIFACT_DIR || path.resolve(__dirname, '../test-results/child-profile');
const chromiumPath = '/workspace/.browser-cache/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell';
const PROFILE_KEY = 'harf-adasi-child-profiles-v1';
// Synthetic test names, never read from an existing person's profile.
const FIRST = 'Işıl İdil';
const SECOND = 'İnci Özgür';
const LONG = 'Çağrı Özgür Deniz Yağmur Güneş Umut';

async function press(app, input) {
  const control = typeof input === 'string' ? app.page.locator(input).first() : input;
  await control.waitFor({ state: 'visible' }); await control.scrollIntoViewIfNeeded();
  assert.equal(await control.isEnabled(), true);
  const box = await control.boundingBox(); assert.ok(box && box.width >= 24 && box.height >= 24);
  if (app.cdp) {
    await touch(app.cdp, 'touchStart', [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }]);
    await app.page.waitForTimeout(70); await touch(app.cdp, 'touchEnd', []);
  } else await control.tap();
  await app.page.waitForTimeout(160);
}
async function ready(page, url) {
  await page.goto(url); assert.equal(page.url(), new URL(url).href);
  await page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  if (process.env.TEST_EXPECTED_VERSION) assert.equal(await page.evaluate(() => window.HARF_ADASI_VERSION), process.env.TEST_EXPECTED_VERSION);
}
async function greeting(page, name) {
  const expected = name ? `Hoş geldin, ${name}` : 'Hoş geldin';
  await page.waitForFunction(text => document.querySelector('.header-greeting')?.textContent === text, expected);
  assert.equal(await page.locator('.header-greeting').getAttribute('title'), expected, 'the full current name remains available even in a compact header');
}
async function settings(app) {
  await press(app, 'header [data-do="settings"]');
  await app.page.locator('#dialog [data-child-profile-controls]').waitFor();
}
async function close(app) { await press(app, app.page.locator('#dialog').getByRole('button', { name: 'Kapat', exact: true })); }
async function save(app, name, newProfile = false) {
  if (newProfile) await press(app, '#dialog [data-child-profile="new"]');
  await app.page.locator('#dialog [data-child-profile-name]').fill(name);
  await press(app, '#dialog [data-child-profile="save"]');
  await greeting(app.page, name);
  assert.equal(await app.page.locator('#dialog [data-do="all-letters"]').count(), 1, 'saving a profile does not replace the surrounding settings panel');
}
async function firstVisit(app, name) {
  const dialog = app.page.locator('dialog[data-child-welcome]');
  await dialog.waitFor({ state: 'visible' });
  const input = dialog.getByLabel('Çocuğun adı', { exact: true });
  assert.equal(await input.evaluate(element => document.activeElement === element), true, 'the first name field receives focus');
  await press(app, dialog.getByRole('button', { name: 'Kaydet ve adaya gir' }));
  assert.equal(await input.getAttribute('aria-invalid'), 'true', 'an empty name has an accessible validation error');
  assert.equal(await dialog.locator('[role="alert"]').isVisible(), true);
  await input.fill('<img src=x onerror=alert(1)>');
  await input.press('Enter');
  assert.equal(await input.getAttribute('aria-invalid'), 'true');
  assert.equal(await dialog.locator('[data-child-welcome-error] img').count(), 0, 'invalid name text is never interpreted as markup');
  await input.fill(name);
  await input.press('Enter');
  await dialog.waitFor({ state: 'detached' });
  await greeting(app.page, name);
  assert.equal(await app.page.locator('#main').evaluate(element => document.activeElement === element), true, 'saving places focus in the game');
}
async function currentCopy(page, name, absent) {
  await page.waitForFunction(value => document.querySelector('.home-hero-copy')?.textContent.includes(value), name);
  const copy = await page.locator('.home-shell').innerText();
  for (const previous of absent) assert.equal(copy.includes(previous), false, 'another selected profile cannot remain in game copy');
  assert.ok((await page.locator('.home-island-art > img').getAttribute('alt')).includes(name));
}
async function fits(page) {
  const output = await page.evaluate(() => {
    const visible = [...document.querySelectorAll('body > header .logo, body > header nav button')].filter(element => element.getBoundingClientRect().width > 0);
    const bounds = visible.map(element => { const b = element.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height }; });
    const overlap = [];
    for (let a = 0; a < bounds.length; a++) for (let b = a + 1; b < bounds.length; b++) if (bounds[a].left < bounds[b].right - 1 && bounds[a].right > bounds[b].left + 1 && bounds[a].top < bounds[b].bottom - 1 && bounds[a].bottom > bounds[b].top + 1) overlap.push([a, b]);
    return { bounds, overlap, width: innerWidth, headerHeight: document.querySelector('body > header').getBoundingClientRect().height, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  assert.deepEqual(output.overlap, []);
  assert.equal(output.overflow, false);
  assert.ok(output.headerHeight <= 90, 'a long selected name keeps the header compact');
  for (const button of output.bounds) { assert.ok(button.width >= 44 && button.height >= 44); assert.ok(button.left >= -1 && button.right <= output.width + 1); }
}

(async () => {
  const service = process.env.TEST_BASE_URL ? null : await startServer();
  const url = process.env.TEST_BASE_URL || service.url;
  const browser = await getPlaywright()[browserName].launch({ headless: true,
    ...(browserName === 'chromium' ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || chromiumPath, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {}),
    ...(process.env.TEST_PROXY_SERVER ? { proxy: { server: process.env.TEST_PROXY_SERVER } } : {}),
  });
  let passed = 0;
  try {
    for (const viewport of sizes) {
      const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, locale: 'tr-TR' });
      const page = await context.newPage(), errors = [], requests = [];
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('request', request => requests.push(request.url() + '\n' + (request.postData() || '')));
      const app = { page, context, cdp: browserName === 'chromium' ? await context.newCDPSession(page) : null };
      try {
        await ready(page, url); await greeting(page, '');
        const before = await page.evaluate(key => Object.fromEntries(Object.keys(localStorage).filter(name => name !== key).map(name => [name, localStorage.getItem(name)])), PROFILE_KEY);
        await firstVisit(app, FIRST);
        await currentCopy(page, FIRST, [SECOND]);
        await ready(page, url); await greeting(page, FIRST);
        assert.equal(await page.locator('[data-child-welcome]').count(), 0, 'a saved valid profile enters without being prompted again');
        await settings(app); await save(app, SECOND, true); await close(app);
        await currentCopy(page, SECOND, [FIRST]);
        await settings(app);
        await page.locator('#dialog [data-child-profile-select]').selectOption({ label: FIRST });
        await greeting(page, FIRST);
        await save(app, LONG); await close(app); await fits(page);
        await currentCopy(page, LONG, [FIRST, SECOND]);
        await settings(app);
        await page.locator('#dialog [data-child-profile-name]').fill('<img src=x onerror=alert(1)>');
        await press(app, '#dialog [data-child-profile="save"]');
        assert.equal(await page.locator('#dialog [data-child-profile-controls] img').count(), 0);
        assert.equal(await page.locator('#dialog .child-profile-status[data-error="true"]').isVisible(), true);
        await greeting(page, LONG);
        await press(app, '#dialog [data-child-profile="sign-out"]'); await close(app);
        await greeting(page, '');
        const anonymous = await page.locator('.home-shell').innerText();
        assert.equal(anonymous.includes(SECOND) || anonymous.includes(LONG) || anonymous.includes(FIRST), false);
        await ready(page, url); await greeting(page, '');
        assert.equal(await page.locator('[data-child-welcome]').count(), 0, 'signing out of an existing profile does not turn a returning visit into a first visit');
        const after = await page.evaluate(key => Object.fromEntries(Object.keys(localStorage).filter(name => name !== key).map(name => [name, localStorage.getItem(name)])), PROFILE_KEY);
        assert.deepEqual(after, before, 'changing the display profile cannot erase or select another progress/teacher record');
        for (const value of requests) for (const name of [FIRST, SECOND, LONG]) assert.equal(value.includes(name) || value.includes(encodeURIComponent(name)), false, 'private display names never enter a request URL or body');
        await assertClean(page, errors); passed++;
        console.log(`PASS ${browserName} ${viewport.width}x${viewport.height} local profiles: first-visit form, Enter/validation/focus, saved-profile bypass, switch/reload/sign-out, Turkish/long names, safe text and no name requests`);
      } catch (error) {
        console.error(`FAIL ${browserName} ${viewport.width}x${viewport.height} local profile\n${error.stack}`);
        fs.mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, `${browserName}-${viewport.width}-failure.png`), fullPage: true });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); if (service) await new Promise(resolve => service.server.close(resolve)); }
  console.log(`${passed}/${sizes.length} local profile scenarios passed; no account login or physical iPhone was tested.`);
  if (passed !== sizes.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
