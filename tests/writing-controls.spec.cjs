const fs = require('node:fs');
const path = require('node:path');
const { assert, getPlaywright, startServer, ensureChildProfile, touch, stroke, assertClean } = require('./helpers.cjs');
const chromiumPath = '/workspace/.browser-cache/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell';

async function press(app, selector) {
  const button = typeof selector === 'string' ? app.page.locator(selector).first() : selector;
  await button.waitFor({ state: 'visible' });
  await button.scrollIntoViewIfNeeded();
  assert.equal(await button.isEnabled(), true);
  const box = await button.boundingBox();
  assert.ok(box);
  await touch(app.cdp, 'touchStart', [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }]);
  await app.page.waitForTimeout(70);
  await touch(app.cdp, 'touchEnd', []);
  await app.page.waitForTimeout(180);
}
async function state(app) { return app.page.evaluate(() => JSON.parse(localStorage.getItem('harf-adasi-learning-v1'))); }
async function current(app) { const value = await state(app); return value.session.tasks[value.session.index]; }
async function next(app) {
  const id = (await current(app)).id;
  await press(app, '#learningNext');
  await app.page.waitForFunction(previous => document.querySelector('#learning')?.dataset.taskId !== previous, id);
}
const exact = value => new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'u');
async function reachWriting(app) {
  await press(app, '[data-do="learning"]');
  if (await app.page.locator('[data-learning="begin-tasks"]').count()) await press(app, '[data-learning="begin-tasks"]');
  for (let step = 0; step < 10; step++) {
    const task = await current(app);
    if (task.kind === 'write') return task;
    if (['build', 'syllables', 'recall', 'sentence'].includes(task.kind)) {
      for (const token of task.tokens) await press(app, app.page.locator('#learningBank [data-learning="tile"]:not([disabled])').filter({ hasText: exact(token) }).first());
    } else {
      if (task.kind === 'listen') {
        await press(app, '[data-learning="listen"]');
        await app.page.waitForFunction(() => document.querySelector('[data-learning="listen"]')?.getAttribute('aria-busy') !== 'true');
        if (/Türkçe sesi.*çalınamadı/u.test(await app.page.locator('#learningFeedback').innerText())) await press(app, '[data-learning="adult-read"]');
      }
      await press(app, app.page.locator(`[data-learning="choice"][data-value=${JSON.stringify(String(task.target))}]`));
    }
    assert.equal(await app.page.locator('#learningNext').isEnabled(), true);
    await next(app);
  }
  throw new Error('Actual journey did not reach writing');
}
async function inkPoints(app) {
  return app.page.locator('#learningPad').evaluate(svg => [[85, 95], [145, 165], [210, 95], [275, 165]].map(([x, y]) => {
    const point = svg.createSVGPoint(); point.x = x; point.y = y;
    const mapped = point.matrixTransform(svg.getScreenCTM());
    return { x: mapped.x, y: mapped.y, id: 1 };
  }));
}
async function center(app, selector, id) {
  const box = await app.page.locator(selector).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, id };
}

const scenarios = [
  ['secondary toolbar fingers cannot review, clear or approve an active stroke', async app => {
    await reachWriting(app);
    const points = await inkPoints(app);
    await touch(app.cdp, 'touchStart', [points[0]]);
    await touch(app.cdp, 'touchMove', [points[1]]);
    const before = await app.page.locator('#learningInk').innerHTML();
    assert.ok(before.includes('<path'));
    for (const [selector, id] of [['[data-learning="review"]', 2], ['[data-learning="clear"]', 3]]) {
      const second = await center(app, selector, id);
      await touch(app.cdp, 'touchStart', [points[1], second]);
      await touch(app.cdp, 'touchEnd', [points[1]]);
      await app.page.waitForTimeout(200);
      assert.equal(await app.page.locator('#learningReview').isVisible(), false, 'a non-primary toolbar finger never opens review');
      assert.ok((await app.page.locator('#learningInk').innerHTML()).startsWith(before), 'a non-primary clear finger preserves every existing ink path while the primary finger can continue writing');
      assert.equal(await app.page.locator('#learningNext').isEnabled(), false, 'no secondary finger approves handwriting');
    }
    await touch(app.cdp, 'touchMove', [points[2]]);
    await touch(app.cdp, 'touchEnd', []);
    await app.page.waitForTimeout(200);
    await press(app, '[data-learning="review"]');
    await app.page.locator('#learningReview:not([hidden])').waitFor();
    await app.page.waitForTimeout(850);
    assert.equal(await app.page.locator('#learningNext').isEnabled(), false, 'opening review cannot become an approval by a trailing click');
    await press(app, '[data-learning="retry-writing"]');
    await press(app, '[data-learning="clear"]');
    assert.equal(await app.page.locator('#learningInk path').count(), 0, 'a fresh primary clear tap works after the stroke ends');
  }],
  ['a missing compatibility click advances exactly one task and never auto-completes the next', async app => {
    await reachWriting(app);
    await stroke(app.cdp, await inkPoints(app));
    await press(app, '[data-learning="review"]');
    await app.page.locator('#learningReview:not([hidden])').waitFor();
    await press(app, '[data-learning="approve"]');
    assert.equal(await app.page.locator('#learningNext').isEnabled(), true);
    const previous = await state(app);
    const previousIndex = previous.session.index;
    // Only a browser compatibility click may be lost. Pointer input, the
    // fallback, app task checks and all completion recording remain untouched.
    await app.page.evaluate(() => { window.__dropNextCompatibilityClick = true; });
    await next(app);
    await app.page.waitForTimeout(850);
    const after = await state(app);
    assert.equal(after.session.index, previousIndex + 1, 'fallback releases exactly one manual continuation');
    assert.notEqual((await current(app)).id, previous.session.tasks[previousIndex].id);
    assert.equal(await app.page.locator('#learningNext').isEnabled(), false, 'the following task still requires a real child answer');
    assert.equal(await app.page.locator('body').evaluate(element => element.classList.contains('writing-focus')), false);
    const dropped = await app.page.evaluate(() => window.__droppedCompatibilityClicks || 0);
    assert.ok(dropped <= 1, 'at most one browser click was suppressed; some engines naturally omit it after writing');
  }],
];

(async () => {
  const { server, url } = await startServer();
  const browser = await getPlaywright().chromium.launch({ headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || chromiumPath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  let passed = 0;
  try {
    for (const [name, run] of scenarios) {
      const context = await browser.newContext({ viewport: { width: 390, height: 660 }, hasTouch: true, isMobile: true });
      await context.addInitScript(() => {
        window.__droppedCompatibilityClicks = 0;
        document.addEventListener('click', event => {
          if (!window.__dropNextCompatibilityClick || !event.isTrusted || event.detail === 0 || !event.target.closest?.('#learningNext')) return;
          window.__dropNextCompatibilityClick = false;
          window.__droppedCompatibilityClicks++;
          event.preventDefault(); event.stopImmediatePropagation();
        }, true);
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      const app = { context, page, errors, cdp: await context.newCDPSession(page) };
      page.setDefaultTimeout(15000);
      try {
        await page.goto(process.env.TEST_BASE_URL || url);
        await page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
        await ensureChildProfile(page);
        await run(app); await assertClean(page, errors); passed++;
        console.log(`PASS ${name}`);
      } catch (error) {
        console.error(`FAIL ${name}\n${error.stack}`);
        fs.mkdirSync(path.resolve(__dirname, '../test-results/writing-controls'), { recursive: true });
        await page.screenshot({ path: path.resolve(__dirname, `../test-results/writing-controls/failure-${passed}.png`), fullPage: true });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
  console.log(`${passed}/${scenarios.length} real-touch writing-control regressions passed; physical iOS unverified.`);
  if (passed !== scenarios.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
