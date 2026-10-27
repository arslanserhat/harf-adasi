const fs = require('node:fs');
const path = require('node:path');
const { assert, getPlaywright, startServer, touch, assertClean } = require('./helpers.cjs');

const browserName = process.env.TEST_BROWSER || 'chromium';
const defaults = [{ width: 360, height: 640 }, { width: 390, height: 660 },
  { width: 768, height: 1024 }, { width: 1024, height: 768 },
  { width: 844, height: 390 }, { width: 1366, height: 768 }];
const viewports = process.env.TEST_VIEWPORT
  ? process.env.TEST_VIEWPORT.split(',').map(value => {
    assert.match(value, /^\d+x\d+$/, 'use WIDTHxHEIGHT for each viewport');
    const [width, height] = value.split('x').map(Number);
    return { width, height };
  }) : defaults;
const artifacts = process.env.TEST_ARTIFACT_DIR || path.resolve(__dirname, '../test-results/header-layout');
const screenshots = process.env.HEADER_SCREENSHOTS === '1' || process.env.UI_SCREENSHOTS === '1';
const chromiumPath = '/workspace/.browser-cache/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell';
const species = ['bird', 'fox', 'lion', 'rabbit', 'squirrel', 'turtle'];

async function press(app, value) {
  const target = typeof value === 'string' ? app.page.locator(value).first() : value;
  await target.waitFor({ state: 'visible' });
  assert.equal(await target.isEnabled(), true);
  await target.scrollIntoViewIfNeeded();
  const rect = await target.boundingBox();
  assert.ok(rect && rect.width >= 24 && rect.height >= 24, 'a real reachable control is used');
  if (app.cdp) {
    await touch(app.cdp, 'touchStart', [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 1 }]);
    await app.page.waitForTimeout(70);
    await touch(app.cdp, 'touchEnd', []);
  } else await target.tap();
  await app.page.waitForTimeout(150);
}
async function ready(app, url) {
  await app.page.goto(url);
  assert.equal(app.page.url(), new URL(url).href);
  await app.page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
  await app.page.evaluate(() => document.fonts.ready);
  await app.page.waitForFunction(() => document.querySelectorAll('.world-site-pet').length === 6
    && document.querySelectorAll('body > footer .world-site-pet').length === 4);
  if (process.env.TEST_EXPECTED_VERSION) assert.equal(await app.page.evaluate(() => window.HARF_ADASI_VERSION), process.env.TEST_EXPECTED_VERSION);
}
async function checkHeaderAndHero(page, viewport) {
  assert.equal(await page.locator('.header-greeting').count(), 1, 'the greeting appears exactly once');
  assert.equal(await page.locator('body > header .header-greeting').count(), 1, 'the greeting belongs to the existing header');
  assert.equal((await page.locator('.header-greeting').innerText()).replace(/\s+/gu, ' ').trim(), 'Hoş geldin', 'a fresh browser has a neutral greeting until an adult selects a child name');
  assert.equal(await page.locator('.home-kicker-row, .home-greeting, .world-pet-perch-home').count(), 0, 'no separate greeting or animal row consumes space above the island');
  const metrics = await page.evaluate(() => {
    const bounds = element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const visible = element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; };
    const header = document.querySelector('body > header');
    const greeting = header.querySelector('.header-greeting');
    const nav = [...header.querySelectorAll('nav button')].filter(visible);
    const controls = [header.querySelector('.logo'), ...nav].filter(Boolean);
    const collisions = [];
    for (let first = 0; first < controls.length; first++) for (let second = first + 1; second < controls.length; second++) {
      const a = bounds(controls[first]), b = bounds(controls[second]);
      if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1)
        collisions.push([controls[first].getAttribute('aria-label') || controls[first].textContent.trim(), controls[second].getAttribute('aria-label') || controls[second].textContent.trim()]);
    }
    return { header: bounds(header), greeting: bounds(greeting),
      greetingFits: greeting.scrollWidth <= greeting.clientWidth + 1 && greeting.scrollHeight <= greeting.clientHeight + 1,
      nav: nav.map(element => {
        const rect = bounds(element), hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return { ...rect, action: element.dataset.do, reachable: hit?.closest('button') === element };
      }),
      collisions, hero: bounds(document.querySelector('.home-island-hero')),
      primary: bounds(document.querySelector('.home-primary')),
      documentFits: document.documentElement.scrollWidth <= innerWidth + 1,
    };
  });
  assert.ok(metrics.header.height <= 90, `the header stays compact (${metrics.header.height}px)`);
  assert.equal(metrics.greetingFits, true, 'the full greeting is readable without clipping');
  assert.ok(metrics.greeting.left >= metrics.header.left - 1 && metrics.greeting.right <= metrics.header.right + 1
    && metrics.greeting.top >= metrics.header.top - 1 && metrics.greeting.bottom <= metrics.header.bottom + 1, 'the greeting fits inside the existing header');
  assert.equal(metrics.nav.length, viewport.width <= 700 ? 3 : 4, 'phone and desktop retain their existing navigation controls');
  for (const button of metrics.nav) {
    assert.ok(button.width >= 44 && button.height >= 44, `${button.action} keeps a 44px contact area`);
    assert.ok(button.left >= -1 && button.right <= viewport.width + 1 && button.top >= -1 && button.bottom <= viewport.height + 1, `${button.action} stays on screen`);
    assert.equal(button.reachable, true, `${button.action} is not covered by another element`);
  }
  assert.deepEqual(metrics.collisions, [], 'logo/greeting and all navigation controls remain separate');
  assert.equal(metrics.documentFits, true, 'the compact header introduces no horizontal document scrolling');
  assert.ok(metrics.hero.top >= metrics.header.bottom - 1, 'the island does not cover the header');
  assert.ok(metrics.hero.top < (viewport.width <= 700 ? 130 : 145), `the island starts near the header (${metrics.hero.top}px)`);
  assert.ok(metrics.primary.left >= -1 && metrics.primary.right <= viewport.width + 1
    && metrics.primary.top >= -1 && metrics.primary.bottom <= viewport.height + 1,
  `the primary adventure action fits the first screen (${metrics.primary.top}–${metrics.primary.bottom}px)`);
  return metrics;
}
async function checkCast(page) {
  const result = await page.evaluate(() => {
    const pets = [...document.querySelectorAll('.world-site-pet')];
    const footer = [...document.querySelectorAll('body > footer .world-pet-perch-footer .world-site-pet')];
    const boxes = footer.map(pet => ({ species: pet.dataset.species, rect: pet.getBoundingClientRect() }));
    const overlaps = [];
    for (let first = 0; first < boxes.length; first++) for (let second = first + 1; second < boxes.length; second++) {
      const a = boxes[first].rect, b = boxes[second].rect;
      if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1)
        overlaps.push([boxes[first].species, boxes[second].species]);
    }
    return { species: pets.map(pet => pet.dataset.species).sort(), footer: footer.map(pet => pet.dataset.species).sort(),
      pointerEvents: pets.map(pet => getComputedStyle(pet).pointerEvents), overlaps,
      fits: boxes.every(({ rect }) => rect.width >= 35 && rect.height >= 20 && rect.left >= -1 && rect.right <= innerWidth + 1),
      inHeader: document.querySelectorAll('body > header .world-site-pet').length,
    };
  });
  assert.deepEqual(result.species, species, 'all six animal species survive the header change exactly once');
  assert.deepEqual(result.footer, ['bird', 'lion', 'squirrel', 'turtle'], 'lion and bird share the existing footer perch with squirrel and turtle');
  assert.equal(result.inHeader, 0, 'decorative animals do not need another header row');
  assert.ok(result.pointerEvents.every(value => value === 'none'), 'all animal sprites leave actual controls touchable');
  assert.deepEqual(result.overlaps, [], 'four footer animals have separate visible positions');
  assert.equal(result.fits, true, 'the footer animals fit the phone width and remain visible');
}
async function photo(page, viewport) {
  if (!screenshots) return;
  fs.mkdirSync(artifacts, { recursive: true });
  await page.locator('.home-island-art > img').evaluate(image => image.decode());
  await page.screenshot({ path: path.join(artifacts, `${browserName}-${viewport.width}x${viewport.height}-header.png`) });
  const footer = page.locator('body > footer');
  await footer.scrollIntoViewIfNeeded();
  await footer.locator('.world-site-pet-sprite').evaluateAll(sprites => Promise.all(sprites.map(async sprite => {
    const background = getComputedStyle(sprite).backgroundImage;
    const source = background.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
    if (!source) throw new Error('Footer animal artwork is missing');
    const image = new Image(); image.src = source; await image.decode();
  })));
  await footer.screenshot({ path: path.join(artifacts, `${browserName}-${viewport.width}x${viewport.height}-footer.png`) });
  await page.evaluate(() => scrollTo(0, 0));
}
async function firstQuestResponse(app) {
  await press(app, '[data-do="quest-start"][data-quest-kind="words"]');
  await app.page.locator('#quest[data-screen="task"][data-kind="words"]').waitFor();
  assert.equal(await app.page.locator('#questNext').isEnabled(), false);
  const saved = await app.page.evaluate(() => JSON.parse(localStorage.getItem('harf-adasi-quests-v1')));
  const task = saved.active.plan.stages[0];
  const choices = app.page.locator('[data-quest="choice"]');
  if (!await choices.first().isEnabled()) {
    await press(app, '[data-quest="listen"]');
    await app.page.waitForFunction(() => document.querySelector('[data-quest="listen"]')?.getAttribute('aria-busy') !== 'true');
    if (!await choices.first().isEnabled()) await press(app, '[data-quest="hint"]');
  }
  const index = (await choices.evaluateAll(choices => choices.map(choice => choice.dataset.value))).indexOf(task.target);
  assert.ok(index >= 0);
  await press(app, choices.nth(index));
  assert.equal(await app.page.locator('#questNext').isEnabled(), true, 'the header/home still opens a real playable adventure');
  await app.page.waitForTimeout(250);
  assert.equal(await app.page.locator('#quest').getAttribute('data-stage-id'), task.id, 'a real answer still requires manual continuation');
  await press(app, '#questNext');
  await app.page.waitForFunction(id => document.querySelector('#quest')?.dataset.stageId !== id, task.id);
  await press(app, '.quest-nav [data-quest="home"]');
  await app.page.locator('.header-greeting').waitFor();
  assert.equal(await app.page.locator('.header-greeting').count(), 1, 'returning from a game does not duplicate the greeting');
}

(async () => {
  const service = process.env.TEST_BASE_URL ? null : await startServer();
  const url = process.env.TEST_BASE_URL || service.url;
  const type = getPlaywright()[browserName];
  assert.ok(type, `Unknown browser ${browserName}`);
  const browser = await type.launch({ headless: true,
    ...(browserName === 'chromium' ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || chromiumPath, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {}),
    ...(process.env.TEST_PROXY_SERVER ? { proxy: { server: process.env.TEST_PROXY_SERVER } } : {}),
  });
  let passed = 0;
  try {
    for (const [index, viewport] of viewports.entries()) {
      const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, locale: 'tr-TR', reducedMotion: 'no-preference' });
      const page = await context.newPage(), errors = [];
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      const app = { page, context, errors, cdp: browserName === 'chromium' ? await context.newCDPSession(page) : null };
      try {
        await ready(app, url);
        const metrics = await checkHeaderAndHero(page, viewport);
        await checkCast(page);
        await photo(page, viewport);
        if (index === 0) await firstQuestResponse(app);
        await assertClean(page, errors);
        passed++;
        console.log(`PASS ${browserName} ${viewport.width}x${viewport.height} compact header (${metrics.header.height}px), island y=${metrics.hero.top}, visible CTA, distinct controls and six animals`);
      } catch (error) {
        console.error(`FAIL ${browserName} ${viewport.width}x${viewport.height} header layout\n${error.stack}`);
        fs.mkdirSync(artifacts, { recursive: true });
        await page.screenshot({ path: path.join(artifacts, `${browserName}-${viewport.width}x${viewport.height}-failure.png`), fullPage: true });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); if (service) await new Promise(resolve => service.server.close(resolve)); }
  console.log(`${passed}/${viewports.length} header-layout scenarios passed (${browserName}); physical iPhone and browser chrome remain unverified.`);
  if (passed !== viewports.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
