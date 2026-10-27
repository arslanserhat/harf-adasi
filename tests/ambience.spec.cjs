const fs = require('node:fs');
const path = require('node:path');
const { assert, getPlaywright, startServer, ensureChildProfile } = require('./helpers.cjs');

const species = ['lion', 'bird', 'rabbit', 'fox', 'squirrel', 'turtle'];
const cases = [];
const scenario = (name, run) => cases.push({ name, run });
const artifacts = process.env.TEST_ARTIFACT_DIR || path.resolve(__dirname, '..', 'test-results', 'ambience');
const matchingChromium = '/workspace/.browser-cache/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell';

async function press(page, selector) {
  const control = page.locator(selector).first();
  await control.waitFor({ state: 'visible' });
  await control.scrollIntoViewIfNeeded();
  await control.tap();
}

async function open(browser, url, viewport) {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, locale: 'tr-TR', reducedMotion: 'no-preference' });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url);
  assert.equal(page.url(), new URL(url).href, 'the requested published/local URL is used without a fallback');
  await page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
  await ensureChildProfile(page);
  await page.waitForFunction(() => document.querySelectorAll('.world-site-pet').length === 6
    && document.querySelectorAll('body > footer .world-site-pet').length === 4);
  return { context, page, errors };
}

async function assertOutsidePictures(page) {
  const result = await page.evaluate(() => {
    const pictures = [...document.querySelectorAll('.home-island-hero, .home-island-art, .story-scene')]
      .map(element => element.getBoundingClientRect()).filter(rect => rect.width && rect.height);
    const pets = [...document.querySelectorAll('.world-site-pet')];
    const visible = pets.filter(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0);
    const overlaps = [];
    for (const pet of visible) {
      const rect = pet.getBoundingClientRect();
      for (const picture of pictures) {
        if (rect.left < picture.right - 1 && rect.right > picture.left + 1
          && rect.top < picture.bottom - 1 && rect.bottom > picture.top + 1) overlaps.push(pet.dataset.species);
      }
    }
    return {
      nested: pets.filter(pet => pet.closest('.home-island-art, .home-island-hero, .story-scene')).map(pet => pet.dataset.species),
      overlaps,
      outsideViewport: visible.filter(pet => {
        const rect = pet.getBoundingClientRect(); return rect.left < -1 || rect.right > innerWidth + 1;
      }).map(pet => pet.dataset.species),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  assert.deepEqual(result.nested, [], 'animated animals are separate site decoration, never children of a picture');
  assert.deepEqual(result.overlaps, [], 'animal silhouettes do not visually overlap the island or story rectangle');
  assert.deepEqual(result.outsideViewport, [], 'site animals fit the available mobile/desktop width');
  assert.equal(result.overflow, false, 'animal perches do not introduce horizontal scrolling');
}

scenario('six different animals load and remain outside the illustration and controls', async ({ page }) => {
  const assets = await page.evaluate(async () => {
    const pets = [...document.querySelectorAll('.world-site-pet')];
    return Promise.all(pets.map(async pet => {
      const sprite = pet.querySelector('.world-site-pet-sprite');
      const background = sprite && getComputedStyle(sprite).backgroundImage;
      const source = background?.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
      if (!source) throw new Error(`No rendered animal image for ${pet.dataset.species}`);
      const image = new Image(); image.src = source;
      await image.decode();
      const response = await fetch(source);
      const bytes = new Uint8Array(await response.arrayBuffer());
      return {
        species: pet.dataset.species, source, width: image.naturalWidth, height: image.naturalHeight,
        status: response.status, type: response.headers.get('content-type'),
        signature: String.fromCharCode(...bytes.slice(0, 4)) + String.fromCharCode(...bytes.slice(8, 12)),
        pointerEvents: getComputedStyle(pet).pointerEvents,
        widthOnPage: pet.getBoundingClientRect().width, heightOnPage: pet.getBoundingClientRect().height,
      };
    }));
  });
  assert.deepEqual(new Set(assets.map(asset => asset.species)), new Set(species), 'lion, bird, rabbit, fox, squirrel and turtle are all present');
  assert.equal(assets.length, 6, 'returning to the home page does not duplicate the animal cast');
  assert.deepEqual(new Set(await page.locator('body > footer .world-site-pet').evaluateAll(pets => pets.map(pet => pet.dataset.species))),
    new Set(['lion', 'bird', 'squirrel', 'turtle']), 'the former greeting animals share the existing footer perch');
  assert.equal(await page.locator('.home-kicker-row, .world-pet-perch-home').count(), 0, 'there is no extra animal/greeting row above the island');
  assert.equal(new Set(assets.map(asset => asset.source)).size, 6, 'each species uses its own artwork');
  for (const asset of assets) {
    assert.equal(asset.status, 200, `${asset.species} artwork is actually published`);
    assert.match(asset.type, /^image\/webp(?:;|$)/, `${asset.species} has the expected image MIME type`);
    assert.equal(asset.signature, 'RIFFWEBP', `${asset.species} is a real WebP, not an HTML fallback`);
    assert.ok(asset.width >= 128 && asset.height >= 128 && asset.width % 2 === 0 && asset.height % 2 === 0,
      `${asset.species} decodes into an evenly divisible four-pose atlas`);
    assert.ok(asset.widthOnPage >= 35 && asset.heightOnPage >= 20, `${asset.species} is large enough to see`);
    assert.equal(asset.pointerEvents, 'none', `${asset.species} cannot capture a child's tap`);
  }
  await assertOutsidePictures(page);
  await page.waitForTimeout(950);
  await assertOutsidePictures(page);
  if (process.env.AMBIENCE_SCREENSHOTS === '1') {
    fs.mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, `home-animals-${page.viewportSize().width}.png`), fullPage: true });
  }
});

scenario('lessons and quests keep decorative animals on the home page; writing stays calm', async ({ page }) => {
  await press(page, '[data-do="learning-world"][data-world="post"]');
  await page.locator('#learning[data-screen="intro"]').waitFor();
  assert.equal(await page.locator('#learning[data-screen="intro"] .learn-nav .world-site-pet').count(), 0,
    'lesson introduction navigation gets no decorative animal');
  await press(page, '[data-learning="begin-tasks"]');
  await page.locator('#learning[data-screen="task"]').waitFor();
  assert.equal(await page.locator('#learning .world-site-pet').count(), 0, 'lesson navigation and image receive no decorative animals');
  const lesson = await page.evaluate(() => ({
    visiblePets: [...document.querySelectorAll('.world-site-pet')].filter(element => {
      const rect = element.getBoundingClientRect(); return rect.width && rect.height;
    }).length,
    foreground: getComputedStyle(document.querySelector('.world-ambience-effects')).display,
    background: getComputedStyle(document.querySelector('.world-ambience-sky')).display,
    motes: [...document.querySelectorAll('#learning .story-world-motes')].map(element => getComputedStyle(element).display),
  }));
  assert.equal(lesson.visiblePets, 0, 'the persistent footer cast also waits until the child returns home');
  assert.equal(lesson.foreground, 'none', 'site tap effects stay outside lessons');
  assert.equal(lesson.background, 'none', 'global sky effects stay outside lessons');
  assert.ok(lesson.motes.every(display => display === 'none'), 'decorative story particles are hidden');
  await assertOutsidePictures(page);

  await press(page, '#learning .learn-nav [data-learning="home"]');
  await page.locator('.games').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.world-site-pet').length === 6
    && document.body.dataset.ambienceHome === 'true');
  await press(page, '[data-do="quest-start"][data-quest-kind="syllables"]');
  await page.locator('#quest[data-screen="task"]').waitFor();
  const quest = await page.evaluate(() => ({
    animals: [...document.querySelectorAll('#quest .quest-character-route, #quest .quest-pirpir')]
      .map(element => getComputedStyle(element).display),
    train: getComputedStyle(document.querySelector('#quest .quest-train')).display,
    controls: [...document.querySelectorAll('#quest .quest-controls button')].filter(element => {
      const rect = element.getBoundingClientRect(); return rect.width && rect.height;
    }).length,
  }));
  assert.ok(quest.animals.length > 0 && quest.animals.every(display => display === 'none'), 'quest animal overlays are removed from the image');
  assert.notEqual(quest.train, 'none', 'the train still shows the pieces assembled during play');
  assert.ok(quest.controls > 0, 'quest answer controls remain available');
  await press(page, '[data-quest="home"]');
  await page.locator('.games').waitFor();
  await press(page, '[data-do="catalog"][data-view="letters"]');
  await press(page, '[data-do="letter"][data-letter="a"]');
  await press(page, '[data-do="match"][data-value="a"]');
  if (await page.locator('#celebrationDialog[open]').count()) await press(page, '#celebrationContinue');
  else await press(page, '#next');
  await page.locator('body.writing-focus #pad').waitFor();
  const writing = await page.evaluate(() => ({
    visiblePets: [...document.querySelectorAll('.world-site-pet')].filter(element => {
      const rect = element.getBoundingClientRect(); return rect.width && rect.height;
    }).length,
    foreground: getComputedStyle(document.querySelector('.world-ambience-effects')).display,
    background: getComputedStyle(document.querySelector('.world-ambience-sky')).display,
  }));
  assert.equal(writing.visiblePets, 0, 'animals are hidden while the child uses the writing surface');
  assert.equal(writing.foreground, 'none', 'tap particles cannot appear over the notebook');
  assert.equal(writing.background, 'none', 'background ambience is hidden during handwriting');
});

scenario('the motion control stops both poses and movement; system reduced motion keeps static animals', async ({ page }) => {
  const birdSprite = page.locator('body > footer .world-pet-perch-footer .world-site-pet-bird .world-site-pet-sprite');
  await page.locator('body > footer').scrollIntoViewIfNeeded();
  const firstPose = await birdSprite.evaluate(element => getComputedStyle(element).backgroundPosition);
  await page.waitForTimeout(190);
  let laterPose = await birdSprite.evaluate(element => getComputedStyle(element).backgroundPosition);
  if (laterPose === firstPose) {
    await page.waitForTimeout(190);
    laterPose = await birdSprite.evaluate(element => getComputedStyle(element).backgroundPosition);
  }
  assert.notEqual(laterPose, firstPose, 'the bird visibly changes its wing pose before pausing');
  await press(page, '[data-do="home-motion"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.world-site-pet, .world-site-pet-sprite')]
    .every(element => element.getAnimations().length > 0 && element.getAnimations().every(animation => animation.playState === 'paused')));
  const motionSnapshot = () => page.evaluate(() => [...document.querySelectorAll('.world-site-pet')].map(element => ({
    species: element.dataset.species,
    pose: getComputedStyle(element.querySelector('.world-site-pet-sprite')).backgroundPosition,
    translate: getComputedStyle(element).translate, rotate: getComputedStyle(element).rotate,
  })));
  const paused = await motionSnapshot();
  await page.waitForTimeout(750);
  assert.deepEqual(await motionSnapshot(), paused, 'neither wing frames nor animal movement continue after pause');
  await page.reload();
  await page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
  await ensureChildProfile(page);
  await page.waitForFunction(() => document.querySelector('.world-site-pet-sprite')
    && [...document.querySelectorAll('.world-site-pet, .world-site-pet-sprite')]
      .every(element => element.getAnimations().every(animation => animation.playState === 'paused')));
  assert.equal(await page.locator('[data-do="home-motion"]').getAttribute('aria-pressed'), 'true', 'the motion preference survives a page reload');
  await press(page, '[data-do="home-motion"]');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => [...document.querySelectorAll('.world-site-pet, .world-site-pet-sprite')]
    .every(element => element.getAnimations().length === 0));
  assert.equal(await page.locator('[data-do="home-motion"]').isVisible(), false, 'system reduced motion is respected without another animation switch');
  assert.equal(await page.locator('.world-site-pet').count(), 6, 'the cast remains available as static artwork');
  await assertOutsidePictures(page);
});

(async () => {
  const playwright = getPlaywright();
  const browserName = process.env.TEST_BROWSER || 'chromium';
  const type = playwright[browserName];
  if (!type) throw new Error(`Unknown TEST_BROWSER: ${browserName}`);
  const service = process.env.TEST_BASE_URL ? null : await startServer();
  const url = process.env.TEST_BASE_URL || service.url;
  const executablePath = browserName === 'chromium'
    ? process.env.CHROMIUM_EXECUTABLE_PATH || (fs.existsSync(matchingChromium) ? matchingChromium : fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)
    : undefined;
  let browser;
  let failures = 0;
  let runs = 0;
  try {
    browser = await type.launch({
      headless: true, ...(executablePath ? { executablePath } : {}),
      ...(browserName === 'chromium' ? { args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {}),
      ...(process.env.TEST_PROXY_SERVER ? { proxy: { server: process.env.TEST_PROXY_SERVER } } : {}),
    });
    for (const viewport of [{ width: 390, height: 660 }, { width: 1366, height: 768 }]
      .filter(value => !process.env.TEST_VIEWPORT || process.env.TEST_VIEWPORT === `${value.width}x${value.height}`)) {
      for (const item of cases.filter(value => !process.env.TEST_FILTER || value.name.includes(process.env.TEST_FILTER))) {
        const app = await open(browser, url, viewport);
        runs++;
        try {
          await item.run(app);
          assert.equal(await app.page.locator('#error').isVisible(), false);
          assert.deepEqual(app.errors, [], 'the visible animal interface has no browser errors');
          console.log(`PASS ${browserName} ${viewport.width}x${viewport.height} ${item.name}`);
        } catch (error) {
          failures++;
          console.error(`FAIL ${browserName} ${viewport.width}x${viewport.height} ${item.name}\n${error.stack}`);
          fs.mkdirSync(artifacts, { recursive: true });
          await app.page.screenshot({ path: path.join(artifacts, `failure-${browserName}-${viewport.width}-${runs}.png`), fullPage: true });
        } finally { await app.context.close(); }
      }
    }
  } finally {
    await browser?.close();
    if (service) await new Promise(resolve => service.server.close(resolve));
  }
  console.log(`${runs - failures}/${runs} ambience scenarios passed (${browserName}); physical-device behaviour remains separate.`);
  if (!runs || failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
