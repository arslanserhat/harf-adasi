const fs = require('node:fs');
const path = require('node:path');
const { assert, getPlaywright, startServer, touch, stroke, assertClean } = require('./helpers.cjs');

const browserName = process.env.TEST_BROWSER || 'chromium';
const viewports = [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 390, height: 844 },
  { width: 390, height: 660 }, { width: 360, height: 640 }, { width: 844, height: 390 }]
  .filter(viewport => !process.env.TEST_VIEWPORT || process.env.TEST_VIEWPORT === `${viewport.width}x${viewport.height}`);
const artifacts = process.env.TEST_ARTIFACT_DIR || path.resolve(__dirname, '../test-results/player-fit');
const matchingChromium = '/workspace/.browser-cache/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell';

async function open(browser, url, viewport) {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  const acousticResponses = new Map();
  if (process.env.PLAYER_VERIFY_AUDIO === '1') {
    await page.addInitScript(() => {
      window.__playedVoices = [];
      window.__playedAcoustic = [];
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (...args) {
        this.addEventListener('ended', () => window.__playedVoices.push(this.currentSrc || this.src), { once: true });
        return Reflect.apply(play, this, args);
      };
      for (const Context of new Set([window.AudioContext, window.webkitAudioContext].filter(Boolean))) {
        const create = Context.prototype.createBufferSource;
        Context.prototype.createBufferSource = function (...args) {
          const source = Reflect.apply(create, this, args);
          source.addEventListener('ended', () => {
            if (source.buffer?.duration > .05) window.__playedAcoustic.push(source.buffer.duration);
          }, { once: true });
          return source;
        };
      }
    });
    page.on('response', response => {
      const name = response.url().match(/fx-(tap|correct|retry|complete)-acoustic-v3\.wav(?:\?|$)/)?.[1];
      if (name) acousticResponses.set(name, { status: response.status(), type: response.headers()['content-type'] });
    });
  }
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url);
  assert.equal(page.url(), new URL(url).href);
  await page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  if (process.env.TEST_EXPECTED_VERSION) assert.equal(await page.evaluate(() => window.HARF_ADASI_VERSION), process.env.TEST_EXPECTED_VERSION);
  assert.equal(await page.locator('.home-version').count(), 0, 'no technical version label is shown to the child');
  return { context, page, errors, acousticResponses, cdp: browserName === 'chromium' ? await context.newCDPSession(page) : null };
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
      if (process.env.PLAYER_VERIFY_AUDIO === '1' && !app.triedWrong) {
        const wrong = app.page.locator('[data-learning="choice"]').filter({ hasNotText: exactText(String(current.target ?? current.word)) }).first();
        if (await wrong.count()) {
          await press(app, wrong);
          assert.equal(await app.page.locator('#learningNext').isEnabled(), false, 'a wrong answer still needs correction');
          app.triedWrong = true;
        }
      }
    }
    const value = String(current.target ?? current.word);
    const choice = app.page.locator('[data-learning="choice"]').filter({ hasText: exactText(value) });
    await press(app, await choice.count() ? choice.first() : app.page.locator(`[data-learning="choice"][data-value=${JSON.stringify(value)}]`));
  }
  assert.equal(await app.page.locator('#learningNext').isEnabled(), true, 'completion still waits for manual continuation');
}

async function fitsPlayer(app, selectors) {
  await app.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await noOverflow(app.page);
  assert.equal(await app.page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2), true,
    'active player does not push controls below a scrolling document');
  for (const selector of selectors) await insideViewport(app.page, selector);
}
async function screenshot(app, label) {
  if (process.env.PLAYER_SCREENSHOTS !== '1') return;
  fs.mkdirSync(artifacts, { recursive: true });
  const viewport = app.page.viewportSize();
  await app.page.screenshot({ path: path.join(artifacts, `${browserName}-${viewport.width}x${viewport.height}-${label}.png`) });
}

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
    for (const viewport of viewports) {
      const app = await open(browser, process.env.TEST_BASE_URL || url, viewport);
      app.page.setDefaultTimeout(15000);
      count++;
      try {
        await press(app, '[data-do="learning"]');
        await app.page.locator('#learning[data-screen="intro"]').waitFor();
        await app.page.waitForFunction(() => document.body.dataset.playerScreen === 'intro');
        await fitsPlayer(app, ['[data-learning="begin-tasks"]', '#learning .learn-nav', '.story-world-backdrop']);
        assert.equal(await app.page.locator('.story-world-backdrop').evaluate(element => getComputedStyle(element).objectFit), 'contain', 'intro shows complete scene art rather than cropping it vertically');
        await screenshot(app, 'intro');
        await press(app, '[data-learning="begin-tasks"]');
        await app.page.waitForFunction(() => document.body.dataset.playerScreen === 'task');
        let completed = 0;
        let writingSeen = false;
        while (await app.page.locator('#learning[data-screen="task"]').count()) {
          assert.ok(completed < 10, 'a real bounded journey ends');
          const current = await task(app);
          if (current.kind === 'write') {
            writingSeen = true;
            for (const selector of ['#learningPad', '[data-learning="review"]', '#learningNext']) await insideViewport(app.page, selector);
            const original = app.page.viewportSize();
            await app.page.setViewportSize({ width: original.height, height: original.width });
            await app.page.waitForTimeout(200);
            for (const selector of ['#learningPad', '[data-learning="review"]', '#learningNext']) await insideViewport(app.page, selector);
            await draw(app);
            await app.page.setViewportSize(original);
            await app.page.waitForTimeout(200);
          } else {
            const selectors = ['#learningNext', '[data-learning="listen"]'];
            if (current.kind === 'listen' || current.kind === 'meaning') selectors.push('.learn-choices');
            else if (current.kind !== 'sentence') selectors.push('#learningBank', '#learningSlots');
            await fitsPlayer(app, selectors);
            if (viewport.width <= 700 || viewport.height <= 500) {
              assert.equal(await app.page.locator('body > header').isVisible(), false, 'phone task uses its own compact sound/navigation toolbar');
              await insideViewport(app.page, '[data-learning="toggle-sound"]');
            }
          }
          await solve(app, current);
          await screenshot(app, `task-${completed + 1}-${current.kind}`);
          await press(app, '#learningNext');
          completed++;
        }
        assert.equal(completed, 8, 'eight actual tasks were completed');
        assert.equal(writingSeen, true);
        await app.page.locator('#learningSummary').waitFor();
        const celebration = app.page.locator('#celebrationDialog[open].celebration-journey');
        await celebration.waitFor();
        assert.match(await celebration.innerText(), /tebrik|başardın|tamam|harika/iu);
        if (process.env.PLAYER_VERIFY_AUDIO === '1') {
          await app.page.waitForFunction(() => window.__playedVoices.some(url => url.includes('voice-1c35fc37462b8bebce8a.mp3')));
          assert.equal(app.triedWrong, true, 'retry feedback was triggered by an actual wrong selection');
          for (const name of ['tap', 'correct', 'retry', 'complete']) {
            const response = app.acousticResponses.get(name);
            assert.ok(response && [200, 206].includes(response.status) && /^audio\//.test(response.type), `${name} downloaded as actual published audio`);
          }
          assert.ok(await app.page.evaluate(() => window.__playedAcoustic.length > 3), 'real acoustic Web Audio sources reached their ended events');
          console.log('Browser audio: all four acoustic cues fetched; real instrument sources and recorded journey congratulations reached ended events. Human listening remains separate.');
        }
        await press(app, '#celebrationReturn');
        await app.page.locator('#celebrationDialog').waitFor({ state: 'hidden' });
        const state = await saved(app.page);
        assert.equal(Object.values(state.session.results).filter(result => result.correct).length, 8);
        assert.ok(state.events.some(event => event.skill === 'write' && event.writingReviewed));
        await assertClean(app.page, app.errors);
        console.log(`PASS ${browserName} ${viewport.width}x${viewport.height} intro CTA, viewport-fit tasks, rotated writing, eight real tasks and completion card`);
      } catch (error) {
        failures++;
        console.error(`FAIL ${browserName} ${viewport.width}x${viewport.height}\n${error.stack}`);
        console.error('viewport diagnostic', JSON.stringify(await app.page.evaluate(() => ({
          inner: [innerWidth, innerHeight], client: [document.documentElement.clientWidth, document.documentElement.clientHeight],
          visual: window.visualViewport ? [visualViewport.width, visualViewport.height, visualViewport.scale] : null,
          writing: [getComputedStyle(document.documentElement).getPropertyValue('--writing-viewport-width'), getComputedStyle(document.documentElement).getPropertyValue('--writing-viewport-height')],
          pad: document.querySelector('#learningPad')?.getBoundingClientRect().toJSON(),
        }))));
        fs.mkdirSync(artifacts, { recursive: true });
        await app.page.screenshot({ path: path.join(artifacts, `${browserName}-${viewport.width}x${viewport.height}-${count}.png`), fullPage: true });
      } finally { await app.context.close(); }
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
  console.log(`${count - failures}/${count} player-fit journeys passed. ${browserName === 'chromium' ? 'Chromium CDP touch/native scroll checks' : 'Linux WebKit touch taps/pointer drawing'}; physical iPhone and iOS Chrome unverified.`);
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
