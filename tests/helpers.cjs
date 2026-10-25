const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');

function getPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE_PATH) return require(process.env.PLAYWRIGHT_MODULE_PATH);
  try { return require('playwright'); }
  catch (error) {
    const managedPath = '/opt/codex/cua_node/lib/node_modules/playwright';
    if (fs.existsSync(managedPath)) return require(managedPath);
    throw error;
  }
}

async function startServer() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'));
  const server = http.createServer((req, res) => {
    if (!['/harf-adasi/', '/harf-adasi/index.html'].includes(req.url?.split('?')[0])) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}/harf-adasi/` };
}

async function open(browser, url, viewport = { width: 768, height: 1024 }, options = {}) {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
  if (options.unavailableApis) {
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: undefined });
    });
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url);
  await page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
  assert.equal(await page.locator('#error').isVisible(), false);
  const cdp = await context.newCDPSession(page);
  return { context, page, cdp, errors };
}

async function tap(page, action, attrs = '') {
  await page.locator(`[data-do="${action}"]${attrs}`).first().tap();
}
async function home(page) {
  const logo = page.getByRole('button', { name: 'Harf Adası ana sayfa', exact: true });
  await logo.scrollIntoViewIfNeeded();
  // Let the mobile compositor settle a programmatic scroll after a drawn gesture.
  await page.waitForTimeout(350);
  await logo.tap();
  await page.locator('.games').waitFor();
}
async function catalog(page, view) {
  await home(page);
  await tap(page, 'catalog', `[data-view="${view}"]`);
}
async function letter(page, value) {
  await catalog(page, 'letters');
  await tap(page, 'tab', `[data-key="caps"][data-value="${value === value.toLocaleUpperCase('tr-TR') ? 'upper' : 'lower'}"]`);
  await tap(page, 'letter', `[data-letter="${value}"]`);
}
async function match(page, value) {
  const target = value ?? await page.locator('.target').innerText();
  await tap(page, 'match', `[data-value="${target}"]`);
  assert.equal(await page.locator('#next').isEnabled(), true);
}
async function next(page) {
  assert.equal(await page.locator('#next').isEnabled(), true);
  await page.locator('#next').tap();
}
async function assertNoAdvance(page) {
  const label = await page.locator('.steps').getAttribute('aria-label');
  // Allow Chromium to settle injected touch gestures before the next compatibility click.
  await page.waitForTimeout(650);
  assert.equal(await page.locator('.steps').getAttribute('aria-label'), label, 'wait for explicit Devam');
}
async function touch(cdp, type, points) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((p, index) => ({ x: p.x, y: p.y, id: p.id ?? index + 1, radiusX: 1, radiusY: 1, force: 0.5 })),
  });
}
async function stroke(cdp, points, { cancel = false } = {}) {
  await touch(cdp, 'touchStart', [points[0]]);
  for (const point of points.slice(1)) await touch(cdp, 'touchMove', [point]);
  await touch(cdp, cancel ? 'touchCancel' : 'touchEnd', []);
}
async function paths(page) {
  await page.locator('#pad').scrollIntoViewIfNeeded();
  return page.locator('#pad').evaluate(svg => {
    const rect = svg.getBoundingClientRect();
    return [...svg.querySelectorAll('[data-target]')].map(path => {
      const length = path.getTotalLength();
      const count = Math.max(1, Math.ceil(length / 10));
      return Array.from({ length: count + 1 }, (_, i) => {
        const point = path.getPointAtLength(length * i / count);
        return { x: rect.left + point.x / 400 * rect.width, y: rect.top + point.y / 340 * rect.height };
      });
    });
  });
}
async function traceAll(page, cdp) {
  const geometry = await paths(page);
  const scroll = await page.evaluate(() => window.scrollY);
  assert.ok(geometry.length, 'guide contains strokes');
  for (const points of geometry) await stroke(cdp, points);
  assert.equal(await page.evaluate(() => window.scrollY), scroll, 'drawing does not scroll page');
  assert.equal(await page.locator('#next').isEnabled(), true, `valid guide accepted: ${await page.locator('#feedback').innerText()}`);
  await assertNoAdvance(page);
}
async function ink(page, cdp) {
  await page.locator('#pad').scrollIntoViewIfNeeded();
  const rect = await page.locator('#pad').boundingBox();
  await stroke(cdp, [
    { x: rect.x + rect.width * .3, y: rect.y + rect.height * .3 },
    { x: rect.x + rect.width * .5, y: rect.y + rect.height * .6 },
    { x: rect.x + rect.width * .65, y: rect.y + rect.height * .3 },
  ]);
}
async function review(page, cdp) {
  await ink(page, cdp);
  assert.equal(await page.locator('#next').isEnabled(), false, 'ink alone never approves handwriting');
  await tap(page, 'review');
  assert.equal(await page.locator('#dialog').isVisible(), true);
  await tap(page, 'approve');
  assert.equal(await page.locator('#next').isEnabled(), true);
  await assertNoAdvance(page);
}
async function fill(page, tokens) {
  const ids = [];
  for (const text of tokens) {
    const tile = page.locator('#bank [data-do="tile"]:not([disabled])').filter({ hasText: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first();
    ids.push(await tile.getAttribute('data-id'));
    await tile.tap();
  }
  assert.equal(new Set(ids).size, ids.length, 'repeated letters/digits use distinct cards');
  assert.equal(await page.locator('#next').isEnabled(), true);
  await assertNoAdvance(page);
  return ids;
}
async function assertClean(page, errors) {
  assert.equal(await page.locator('#error').isVisible(), false);
  assert.deepEqual(errors, [], 'no browser errors');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no horizontal overflow');
}

module.exports = { assert, getPlaywright, startServer, open, tap, home, catalog, letter, match, next, assertNoAdvance, touch, stroke, paths, traceAll, ink, review, fill, assertClean };
