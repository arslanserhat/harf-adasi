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
  const buildDirectory = path.resolve(__dirname, '..', 'dist');
  if (!fs.existsSync(path.join(buildDirectory, 'index.html'))) {
    throw new Error('Built app is missing. Run npm run build before the tablet tests.');
  }
  const directory = fs.realpathSync(buildDirectory);
  const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.woff2': 'font/woff2',
    '.woff': 'font/woff', '.avif': 'image/avif', '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
  };
  const server = http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
    catch { res.writeHead(400).end('Bad URL'); return; }
    const prefix = '/harf-adasi/';
    if (!pathname.startsWith(prefix) || pathname.includes('\\') || pathname.includes('\0')) {
      res.writeHead(404).end('Not found');
      return;
    }
    const relative = pathname.slice(prefix.length) || 'index.html';
    const filename = path.resolve(directory, relative);
    if (!filename.startsWith(directory + path.sep)) {
      res.writeHead(404).end('Not found');
      return;
    }
    let stat;
    try {
      if (!fs.realpathSync(filename).startsWith(directory + path.sep)) {
        res.writeHead(404).end('Not found'); return;
      }
      stat = fs.statSync(filename);
    }
    catch { res.writeHead(404).end('Not found'); return; }
    if (!stat.isFile()) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': types[path.extname(filename)] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(filename).pipe(res);
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
  if (options.englishOnlyVoice) {
    await context.route(/\/audio\/manifest\.json(?:\?.*)?$/, route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ phrases: {} }),
    }));
    await context.addInitScript(() => {
      window.__testSpeechCalls = [];
      const synthesis = {
        getVoices: () => [{ lang: 'en-US', name: 'English voice', default: true, localService: true, voiceURI: 'english-test' }],
        speak: utterance => window.__testSpeechCalls.push({ text: utterance.text, lang: utterance.voice?.lang ?? utterance.lang }),
        cancel() {}, pause() {}, resume() {}, addEventListener() {}, removeEventListener() {},
      };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class {
        constructor(text) { this.text = text; }
      } });
    });
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url);
  assert.equal(page.url(), new URL(url).href, 'test loads the requested origin/path without a local fallback');
  await page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
  assert.equal(await page.locator('#error').isVisible(), false);
  const cdp = await context.newCDPSession(page);
  return { context, page, cdp, errors };
}

async function tapCelebrationControl(page, selector) {
  const control = page.locator(selector);
  await control.waitFor({ state: 'visible' });
  const box = await control.boundingBox();
  assert.ok(box, 'celebration control is visible');
  // A human contact phase emulates a real tap and verifies pointer-release
  // activation when Chromium omits the compatibility click after drawing.
  const cdp = await page.context().newCDPSession(page);
  await touch(cdp, 'touchStart', [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }]);
  await page.waitForTimeout(80);
  await touch(cdp, 'touchEnd', []);
  await cdp.detach();
  await page.locator('#celebrationDialog').waitFor({ state: 'hidden' });
}
async function dismissCelebration(page) {
  if (await page.locator('#celebrationDialog[open]').count()) {
    await tapCelebrationControl(page, '#celebrationReturn');
  }
}
async function tap(page, action, attrs = '') {
  await dismissCelebration(page);
  await page.locator(`[data-do="${action}"]${attrs}`).first().tap();
}
async function home(page) {
  await dismissCelebration(page);
  const headerLogo = page.getByRole('button', { name: 'Harf Adası ana sayfa', exact: true });
  const writing = await page.locator('body').evaluate(body => body.classList.contains('writing-focus'));
  const logo = !writing && await headerLogo.isVisible() ? headerLogo : page.locator('#main .bar [data-do="home"]').first();
  await logo.scrollIntoViewIfNeeded();
  // Let the mobile compositor settle a programmatic scroll after a drawn gesture.
  await page.waitForTimeout(350);
  // A human tap has a short contact phase; zero-duration taps immediately
  // after a long injected stroke can be suppressed by Chromium's gesture queue.
  const box = await logo.boundingBox();
  assert.ok(box, 'home control is visible');
  const cdp = await page.context().newCDPSession(page);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  await touch(cdp, 'touchStart', [point]);
  await page.waitForTimeout(80);
  await touch(cdp, 'touchEnd', []);
  await cdp.detach();
  await page.locator('.games').waitFor();
}
async function catalog(page, view) {
  await home(page);
  await tap(page, 'catalog', `[data-view="${view}"]`);
  await openStandardLibrary(page);
}
async function openStandardLibrary(page) {
  const standard = page.locator('[data-standard-library]');
  if (!await standard.count()) return null;
  assert.equal(await standard.count(), 1, 'one explicit standard library belongs to the opened catalog');
  if (!await standard.evaluate(element => element.open)) {
    await standard.locator(':scope > summary').tap();
  }
  assert.equal(await standard.evaluate(element => element.open), true, 'the legacy test explicitly opens the standard source');
  return standard;
}
async function tapStandard(page, action, attrs = '') {
  await dismissCelebration(page);
  const standard = await openStandardLibrary(page);
  assert.ok(standard, 'legacy selection stays inside the standard library');
  await standard.locator(`[data-do="${action}"]${attrs}`).first().tap();
}
async function letter(page, value) {
  await catalog(page, 'letters');
  await tap(page, 'tab', `[data-key="caps"][data-value="${value === value.toLocaleUpperCase('tr-TR') ? 'upper' : 'lower'}"]`);
  await tapStandard(page, 'letter', `[data-letter="${value}"]`);
}
async function match(page, value) {
  const target = value ?? await page.locator('.target').innerText();
  await tap(page, 'match', `[data-value="${target}"]`);
  assert.equal(await page.locator('#next').isEnabled(), true);
}
async function next(page) {
  assert.equal(await page.locator('#next').isEnabled(), true);
  const celebration = await page.locator('#celebrationDialog[open]').count();
  if (celebration) await tapCelebrationControl(page, '#celebrationContinue');
  else await page.locator('#next').tap();
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
    return [...svg.querySelectorAll('[data-target]')].map(path => {
      const matrix = path.getScreenCTM();
      if (!matrix) throw new Error('Drawing guide has no screen transform');
      const length = path.getTotalLength();
      const count = Math.max(1, Math.ceil(length / 10));
      return Array.from({ length: count + 1 }, (_, i) => {
        const point = path.getPointAtLength(length * i / count).matrixTransform(matrix);
        return { x: point.x, y: point.y };
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
  const points = await page.locator('#pad').evaluate(svg => {
    const matrix = svg.getScreenCTM();
    if (!matrix) throw new Error('Writing pad has no screen transform');
    return [[120, 102], [200, 204], [260, 102]].map(([x, y]) => {
      const point = svg.createSVGPoint(); point.x = x; point.y = y;
      const screen = point.matrixTransform(matrix);
      return { x: screen.x, y: screen.y };
    });
  });
  await stroke(cdp, points);
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

module.exports = { assert, getPlaywright, startServer, open, tap, home, catalog, openStandardLibrary, tapStandard, letter, match, next, assertNoAdvance, touch, stroke, paths, traceAll, ink, review, fill, assertClean };
