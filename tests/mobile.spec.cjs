const fs = require('node:fs');
const path = require('node:path');
const { assert, getPlaywright, startServer, touch, stroke, assertClean } = require('./helpers.cjs');

const browserName = process.env.TEST_BROWSER || 'chromium';
const viewports = [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 393, height: 852 },
  { width: 430, height: 932 }, { width: 844, height: 390 }]
  .filter(viewport => !process.env.TEST_VIEWPORT || process.env.TEST_VIEWPORT === `${viewport.width}x${viewport.height}`);
const artifacts = process.env.TEST_ARTIFACT_DIR || path.resolve(__dirname, '../test-results/mobile');
const matchingChromium = '/workspace/.browser-cache/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell';

async function open(browser, url, viewport) {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url);
  assert.equal(page.url(), new URL(url).href);
  await page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  return { context, page, errors, cdp: browserName === 'chromium' ? await context.newCDPSession(page) : null };
}

async function press(app, selector) {
  const control = typeof selector === 'string' ? app.page.locator(selector).first() : selector;
  await control.waitFor({ state: 'visible' });
  assert.equal(await control.isEnabled(), true);
  await control.scrollIntoViewIfNeeded();
  const rectangle = await control.boundingBox();
  assert.ok(rectangle && rectangle.width >= 24 && rectangle.height >= 24, 'control has a reachable touch area');
  const learning = app.page.locator('#learning');
  const previous = await learning.count() ? await learning.getAttribute('data-task-id') : null;
  const advancing = await control.getAttribute('id') === 'learningNext';
  if (app.cdp) {
    await touch(app.cdp, 'touchStart', [{ x: rectangle.x + rectangle.width / 2, y: rectangle.y + rectangle.height / 2, id: 1 }]);
    await app.page.waitForTimeout(70);
    await touch(app.cdp, 'touchEnd', []);
  } else await control.tap();
  await app.page.waitForTimeout(80);
  if (advancing) await app.page.waitForFunction(taskId => {
    const learning = document.querySelector('#learning');
    return learning?.dataset.screen === 'summary' || learning?.dataset.taskId !== taskId;
  }, previous);
}

async function begin(app) {
  await press(app, '[data-do="learning"]');
  if (await app.page.locator('#learning[data-screen="home"]').count()) await press(app, '[data-learning="start"]');
  if (await app.page.locator('#learning[data-screen="intro"]').count()) await press(app, '[data-learning="begin-tasks"]');
  await app.page.locator('#learning[data-screen="task"]').waitFor();
}

async function saved(page) {
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('harf-adasi-learning-v1') || 'null'));
  assert.ok(state?.session, 'a real session is persisted');
  return state;
}
async function task(app) {
  const state = await saved(app.page);
  return state.session.tasks[state.session.index];
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'phone has no horizontal overflow');
}
async function insideViewport(page, selector) {
  assert.equal(await page.locator(selector).first().evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.left >= -1 && rect.right <= innerWidth + 1
      && rect.top >= -1 && rect.bottom <= innerHeight + 1;
  }), true, `${selector} fits the phone viewport`);
}
function exactText(value) { return new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'u'); }

async function draw(app) {
  const points = await app.page.locator('#learningPad').evaluate(svg => {
    const matrix = svg.getScreenCTM();
    return [[80, 95], [140, 160], [200, 95], [260, 160]].map(([x, y]) => {
      const point = svg.createSVGPoint(); point.x = x; point.y = y;
      const screen = point.matrixTransform(matrix);
      return { x: screen.x, y: screen.y };
    });
  });
  const before = await app.page.evaluate(() => scrollY);
  if (app.cdp) {
    await stroke(app.cdp, points);
    const rect = await app.page.locator('#learningPad').boundingBox();
    await app.cdp.send('Input.synthesizeScrollGesture', { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2,
      xDistance: 0, yDistance: -100, speed: 450, gestureSourceType: 'touch' });
  } else {
    // WebKit's Playwright API has no touch-move/CDP. Pointer drawing verifies
    // layout/coordinate handling; it is not a physical iPhone gesture test.
    await app.page.mouse.move(points[0].x, points[0].y);
    await app.page.mouse.down();
    for (const point of points.slice(1)) await app.page.mouse.move(point.x, point.y, { steps: 4 });
    await app.page.mouse.up();
    await app.page.evaluate(() => scrollBy(0, 100));
  }
  assert.equal(await app.page.evaluate(() => scrollY), before, 'writing keeps the document scroll position');
  assert.ok(await app.page.locator('#learningInk path').count(), 'the real writing surface received an ink path');
}

async function solve(app, current) {
  if (['syllables', 'build', 'recall', 'sentence'].includes(current.kind)) {
    for (const value of current.tokens) await press(app, app.page.locator('#learningBank [data-learning="tile"]:not([disabled])').filter({ hasText: exactText(value) }).first());
  } else if (current.kind === 'write') {
    await draw(app);
    await press(app, '[data-learning="review"]');
    await app.page.locator('#learningReview:not([hidden])').waitFor();
    await press(app, '[data-learning="approve"]');
  } else {
    if (current.kind === 'listen') {
      await press(app, '[data-learning="listen"]');
      await app.page.waitForFunction(() => document.querySelector('[data-learning="listen"]')?.getAttribute('aria-busy') !== 'true');
      if (/Türkçe sesi.*çalınamadı/u.test(await app.page.locator('#learningFeedback').innerText())) await press(app, '[data-learning="adult-read"]');
    }
    const value = String(current.target ?? current.word);
    const choice = app.page.locator('[data-learning="choice"]').filter({ hasText: exactText(value) });
    await press(app, await choice.count() ? choice.first() : app.page.locator(`[data-learning="choice"][data-value=${JSON.stringify(value)}]`));
  }
  assert.equal(await app.page.locator('#learningNext').isEnabled(), true, 'completion still waits for manual continuation');
}

const scenarios = [
  ['phone home, four destinations, teacher form and six legacy areas', async app => {
    const { page } = app;
    await noOverflow(page);
    const ambience = page.locator('.world-ambience-sky');
    assert.equal(await ambience.evaluate(element => element.parentElement === document.body), true, 'ambient movement belongs to the whole page outside the island picture');
    assert.equal(await ambience.evaluate(element => Number(getComputedStyle(element).zIndex) > 0 && getComputedStyle(element).pointerEvents === 'none'), true, 'visible foreground ambience never blocks taps');
    await page.locator('.home-island-art img').evaluate(image => image.decode());
    for (const selector of ['header .logo', 'header nav', '.home-primary']) {
      if (selector === '.home-primary' && page.viewportSize().height < 500) await page.locator(selector).scrollIntoViewIfNeeded();
      await insideViewport(page, selector);
    }
    assert.equal(await page.locator('.home-version').count(), 0, 'technical version stays out of the child UI');
    for (const [world, kind] of [['post', 'listen'], ['workshop', 'build'], ['bridge', 'recall'], ['garden', 'meaning']]) {
      const button = page.locator(`[data-do="learning-world"][data-world="${world}"]`);
      assert.equal(await button.evaluate(element => { const r = element.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; }), true);
      await press(app, button);
      if (await page.locator('#learning[data-screen="intro"]').count()) await press(app, '[data-learning="begin-tasks"]');
      assert.equal((await task(app)).kind, kind, `${world} opens its actual activity`);
      await noOverflow(page);
      await press(app, '[data-learning="home"]');
    }
    await press(app, '[data-do="learning-parent"]');
    for (const selector of ['#learningListSelect', '#learningListTitle', '#learningWords']) {
      assert.equal(await page.locator(selector).evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 16), true, 'iOS editor avoids focus zoom');
    }
    await noOverflow(page);
    await press(app, '[data-learning="home"]');
    for (const view of ['letters', 'syllables', 'words', 'reading', 'sentences', 'numbers']) {
      await press(app, `[data-do="catalog"][data-view="${view}"]`);
      await noOverflow(page);
      assert.ok(await page.locator('#main .grid').count(), `${view} exercises remain available`);
      await press(app, '#main [data-do="home"]');
    }
  }],
  ['phone journey, rotated notebook, scroll guard and completion card', async app => {
    await begin(app);
    let writingSeen = false;
    let count = 0;
    while (await app.page.locator('#learning[data-screen="task"]').count()) {
      assert.ok(count++ < 12);
      const current = await task(app);
      await noOverflow(app.page);
      if (current.kind === 'write') {
        writingSeen = true;
        for (const selector of ['#learningPad', '[data-learning="review"]', '#learningNext', '[data-learning="home"]']) await insideViewport(app.page, selector);
        const original = app.page.viewportSize();
        await app.page.setViewportSize({ width: original.height, height: original.width });
        await app.page.waitForTimeout(200);
        for (const selector of ['#learningPad', '[data-learning="review"]', '#learningNext']) await insideViewport(app.page, selector);
        await draw(app);
        await app.page.setViewportSize(original);
        await app.page.waitForTimeout(200);
        await insideViewport(app.page, '#learningPad');
      }
      await solve(app, current);
      await press(app, '#learningNext');
    }
    assert.equal(writingSeen, true, 'the actual journey reached writing');
    await app.page.locator('#learningSummary').waitFor();
    const celebration = app.page.locator('#celebrationDialog[open].celebration-journey');
    await celebration.waitFor();
    assert.match(await celebration.innerText(), /tebrik|başardın|tamam|harika/iu);
    assert.equal(await celebration.evaluate(element => element.scrollWidth <= element.clientWidth + 1), true, 'completion card has no sideways clipping');
    await press(app, '#celebrationReturn');
    await app.page.locator('#celebrationDialog').waitFor({ state: 'hidden' });
    assert.equal(await app.page.locator('#learningSummary').isVisible(), true);
    const state = await saved(app.page);
    assert.equal(Object.values(state.session.results).filter(result => result.correct).length, 8, 'eight real tasks generated eight completion records');
    assert.ok(state.events.some(event => event.skill === 'write' && event.writingReviewed === true));
  }],
];

(async () => {
  const { server, url } = await startServer();
  let browser;
  let count = 0;
  let failures = 0;
  try {
    browser = await getPlaywright()[browserName].launch({ headless: true,
      ...(browserName === 'chromium' ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || (fs.existsSync(matchingChromium) ? matchingChromium : undefined), args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {}),
      ...(process.env.TEST_PROXY_SERVER ? { proxy: { server: process.env.TEST_PROXY_SERVER } } : {}),
    });
    for (const viewport of viewports) for (const [name, run] of scenarios.filter(([name]) => !process.env.TEST_FILTER || name.includes(process.env.TEST_FILTER))) {
      const app = await open(browser, process.env.TEST_BASE_URL || url, viewport);
      app.page.setDefaultTimeout(15000);
      count++;
      try {
        await run(app);
        await assertClean(app.page, app.errors);
        console.log(`PASS ${browserName} ${viewport.width}x${viewport.height} ${name}`);
      } catch (error) {
        failures++;
        console.error(`FAIL ${browserName} ${viewport.width}x${viewport.height} ${name}\n${error.stack}`);
        fs.mkdirSync(artifacts, { recursive: true });
        await app.page.screenshot({ path: path.join(artifacts, `${browserName}-${viewport.width}-${count}.png`), fullPage: true });
      } finally { await app.context.close(); }
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
  console.log(`${count - failures}/${count} mobile scenarios passed. ${browserName === 'chromium' ? 'Chromium CDP touch and native scroll gestures' : 'Linux WebKit touch taps, pointer drawing and layout'}; physical iPhone/iOS Chrome unverified.`);
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
