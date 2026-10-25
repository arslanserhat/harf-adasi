const fs = require('node:fs');
const path = require('node:path');
const { assert, getPlaywright, startServer, open, touch, match, fill, next, assertClean } = require('./helpers.cjs');

const cases = [];
const scenario = (name, run, options = {}) => cases.push({ name, run, ...options });
const artifactDir = process.env.TEST_ARTIFACT_DIR || path.resolve(__dirname, '..', '..', 'island-test-results');
const initialLetters = new Set(['a', 'n', 'e', 't', 'i', 'l']);

async function press(app, selector) {
  const control = typeof selector === 'string' ? app.page.locator(selector).first() : selector;
  await control.waitFor({ state: 'visible' });
  assert.equal(await control.isEnabled(), true, 'the child can activate the requested control');
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  assert.ok(box && box.width >= 24 && box.height >= 24, 'touch control has a reachable hit area');
  await touch(app.cdp, 'touchStart', [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }]);
  await app.page.waitForTimeout(80);
  await touch(app.cdp, 'touchEnd', []);
}

async function enter(app) {
  await press(app, '[data-do="island"]');
  await app.page.locator('#island[data-island-scene="map"]').waitFor();
}

async function start(app, zone) {
  await press(app, `[data-island="start"][data-zone="${zone}"]`);
  await app.page.locator(`#island[data-island-scene="${zone}"]`).waitFor();
}

async function map(app) {
  await press(app, '[data-island="map"]');
  await app.page.locator('#island[data-island-scene="map"]').waitFor();
}

async function showTarget(app) {
  const target = app.page.locator('#islandTarget');
  if (!await target.isVisible()) await press(app, '[data-island="hint"]');
  await target.waitFor({ state: 'visible' });
  const text = (await target.innerText()).trim();
  assert.ok(text.length, 'a visible example supports the learning task');
  return text;
}

function assertKnown(text, known = initialLetters) {
  assert.ok(text.length > 0, 'learning material is not empty');
  assert.ok([...text.toLocaleLowerCase('tr-TR')].every(character => known.has(character)), `${text} uses only the teacher-selected letters`);
}

async function numericText(page, selector) {
  const text = await page.locator(selector).innerText();
  const number = text.match(/\d+/u);
  assert.ok(number, `${selector} exposes a readable progress count`);
  return Number(number[0]);
}

async function world(page) {
  return {
    care: await numericText(page, '[data-world-care]'),
    train: await numericText(page, '[data-world-train]'),
    treasure: await numericText(page, '[data-world-treasure]'),
    total: await numericText(page, '#islandWorldTotal'),
  };
}

async function celebrate(app) {
  const dialog = app.page.locator('#celebrationDialog');
  await app.page.locator('#celebrationDialog[open]').waitFor({ timeout: 5000 });
  assert.match(await app.page.locator('#celebrationTitle').innerText(), /Tebrikler/u);
  await app.page.waitForTimeout(350);
  assert.equal(await dialog.evaluate(element => element.open), true, 'the world waits for an explicit continuation');
  await press(app, '#celebrationContinue');
  await dialog.waitFor({ state: 'hidden' });
  await app.page.locator('#island[data-island-scene="map"]').waitFor();
}

async function reloadMap(app) {
  await app.page.reload();
  await app.page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
  await enter(app);
}

async function chooseLetters(app, wanted) {
  await press(app, '[data-do="settings"]');
  const selected = await app.page.locator('.settings [aria-pressed="true"]').evaluateAll(buttons => buttons.map(button => button.dataset.letter));
  for (const letter of wanted.filter(value => !selected.includes(value))) {
    await press(app, `[data-do="select-letter"][data-letter="${letter}"]`);
  }
  for (const letter of selected.filter(value => !wanted.includes(value))) {
    await press(app, `[data-do="select-letter"][data-letter="${letter}"]`);
  }
  await press(app, app.page.getByRole('button', { name: 'Kapat', exact: true }));
  await app.page.locator('#dialog').waitFor({ state: 'hidden' });
  await app.page.waitForFunction(expected => {
    const shown = [...document.querySelectorAll('.mini [data-letter]')].map(button => button.dataset.letter).sort();
    return JSON.stringify(shown) === JSON.stringify([...expected].sort());
  }, wanted.slice(0, 8));
}

async function assemble(app, action, known = initialLetters) {
  let remaining = await showTarget(app);
  assertKnown(remaining, known);
  const ids = [];
  while (remaining.length) {
    const buttons = app.page.locator(`[data-island="${action}"]:not([disabled])`);
    const cards = await buttons.evaluateAll(elements => elements.map(element => ({
      text: element.textContent.trim(), id: element.dataset.tokenId,
    })));
    for (const card of cards) assertKnown(card.text, known);
    const card = cards.find(candidate => remaining.startsWith(candidate.text));
    assert.ok(card, `visible cards can assemble the remaining example ${remaining}`);
    assert.ok(card.id, 'every physical card has its own identity');
    ids.push(card.id);
    await press(app, `[data-island="${action}"][data-token-id="${card.id}"]`);
    remaining = remaining.slice(card.text.length);
  }
  assert.equal(new Set(ids).size, ids.length, 'repeated letters or syllables use distinct physical cards');
  return ids;
}

async function walkPath(app, known = initialLetters) {
  const { page } = app;
  for (let step = 0; step < 3; step++) {
    assert.equal(await page.locator('#island').getAttribute('data-path-step'), String(step));
    const target = await showTarget(app);
    assertKnown(target, known);
    const stones = page.locator('[data-island="stone"]');
    for (const text of await stones.allTextContents()) assertKnown(text.trim(), known);
    const wrong = stones.filter({ hasNotText: new RegExp(`^${target}$`, 'u') }).first();
    if (await wrong.count()) {
      await press(app, wrong);
      assert.equal(await page.locator('[data-island="walk"]').isEnabled(), false);
    }
    await press(app, `[data-island="stone"][data-value="${target}"]`);
    assert.equal(await page.locator('#island').getAttribute('data-path-step'), String(step), 'finding a stone waits for the child to walk');
    await press(app, '[data-island="walk"]');
  }
  await page.locator('#island[data-island-phase="code"]').waitFor();
}

scenario('care: choose a parcel, feed a companion, and keep the happier island after reload', async app => {
  const { page } = app;
  await enter(app);
  assert.deepEqual(await world(page), { care: 0, train: 0, treasure: 0, total: 0 });
  await start(app, 'care');
  await press(app, '[data-island="companion"][data-companion="cat"]');
  const target = await showTarget(app);
  assertKnown(target);
  const parcels = page.locator('[data-island="parcel"]');
  for (const value of await parcels.evaluateAll(buttons => buttons.map(button => button.dataset.value))) assertKnown(value);
  const wrong = page.locator(`[data-island="parcel"]:not([data-value="${target}"])`).first();
  assert.ok(await wrong.count(), 'default care mission provides a known-letter distractor');
  await press(app, wrong);
  assert.equal(await page.locator('[data-island="feed"]').isEnabled(), false, 'a wrong parcel cannot feed the companion');
  assert.equal(await page.locator('#celebrationDialog[open]').count(), 0);
  await press(app, `[data-island="parcel"][data-value="${target}"]`);
  assert.equal(await page.locator('[data-island="feed"]').isEnabled(), true);
  assert.equal(await page.locator('#celebrationDialog[open]').count(), 0, 'recognition alone does not finish the world action');
  await press(app, '[data-island="feed"]');
  assert.equal(await page.locator('#islandHappiness').getAttribute('aria-valuenow'), '60', 'food makes the companion happier');
  assert.equal(await page.locator('#celebrationDialog[open]').count(), 0, 'care still needs play after feeding');
  await press(app, '[data-island="play"]');
  assert.equal(await page.locator('#islandHappiness').getAttribute('aria-valuenow'), '100', 'playing completes the care consequence');
  await celebrate(app);
  assert.deepEqual(await world(page), { care: 1, train: 0, treasure: 0, total: 1 });
  assert.equal(await page.locator('[data-world-companion="cat"]').count(), 1, 'the chosen cat appears on the map');
  await reloadMap(app);
  assert.deepEqual(await world(page), { care: 1, train: 0, treasure: 0, total: 1 }, 'a fed companion remains part of the island');
  assert.equal(await page.locator('[data-world-companion="cat"]').count(), 1, 'the same companion returns after reload');
});

scenario('train: wrong order is rejected, duplicate cards stay distinct, and arriving trains add stations', async app => {
  const { page } = app;
  await enter(app);
  await start(app, 'train');
  const target = await showTarget(app);
  assert.equal(target, 'anne');
  const send = page.locator('[data-island="send"]');
  assert.equal(await send.isEnabled(), false);
  const wrong = page.locator('[data-island="wagon"]').filter({ hasText: /^e$/u }).first();
  await press(app, wrong);
  assert.equal(await page.locator('.island-wagon.filled').count(), 0, 'an out-of-order wagon stays outside the train');
  const a = page.locator('[data-island="wagon"]').filter({ hasText: /^a$/u }).first();
  await press(app, a);
  assert.equal(await send.isEnabled(), false, 'a partially built train cannot depart');
  const nCards = page.locator('[data-island="wagon"]:not([disabled])').filter({ hasText: /^n$/u });
  assert.equal(await nCards.count(), 2, 'anne supplies two separate n wagons');
  const firstN = await nCards.first().getAttribute('data-token-id');
  await press(app, nCards.first());
  const secondN = await page.locator('[data-island="wagon"]:not([disabled])').filter({ hasText: /^n$/u }).first().getAttribute('data-token-id');
  assert.notEqual(secondN, firstN);
  await press(app, `[data-island="wagon"][data-token-id="${secondN}"]`);
  assert.equal(await send.isEnabled(), false);
  await press(app, page.locator('[data-island="wagon"]:not([disabled])').filter({ hasText: /^e$/u }).first());
  assert.equal(await send.isEnabled(), true);
  assert.equal(await page.locator('#celebrationDialog[open]').count(), 0, 'correct ordering waits for a real departure');
  await press(app, send);
  await page.locator('#islandTrainRunning').waitFor({ state: 'visible' });
  await page.locator('#islandNewStation').waitFor({ state: 'visible' });
  await celebrate(app);
  assert.deepEqual(await world(page), { care: 0, train: 1, treasure: 0, total: 1 });
  assert.equal(await page.locator('.island-world-station.is-built').count(), 1, 'the arrival builds a visible station on the map');
  await start(app, 'train');
  const syllables = await page.locator('[data-island="wagon"]').allTextContents();
  assert.ok(syllables.some(text => text.trim().length > 1), 'the next trip also supports real syllable wagons');
  await assemble(app, 'wagon');
  await press(app, '[data-island="send"]');
  await map(app);
  await page.waitForTimeout(2000);
  assert.equal(await page.locator('#celebrationDialog[open]').count(), 0, 'returning to the map cancels delayed train effects');
  await reloadMap(app);
  assert.deepEqual(await world(page), { care: 0, train: 2, treasure: 0, total: 2 }, 'both destinations remain on the island');
  assert.equal(await page.locator('.island-world-station.is-built').count(), 1);
});

scenario('treasure: walk the sound path, open the code chest, place the prize, and reset the island', async app => {
  const { page } = app;
  await enter(app);
  await start(app, 'treasure');
  await walkPath(app);
  assert.equal(await page.locator('[data-island="open"]').isEnabled(), false);
  await assemble(app, 'code');
  assert.equal(await page.locator('[data-island="open"]').isEnabled(), true);
  await press(app, '[data-island="open"]');
  await page.locator('#island[data-island-phase="placement"]').waitFor();
  assert.equal(await page.locator('#celebrationDialog[open]').count(), 0, 'the chest prize still needs a place on the island');
  await press(app, '[data-island="place"][data-placement="garden"]');
  await celebrate(app);
  assert.deepEqual(await world(page), { care: 0, train: 0, treasure: 1, total: 1 });
  await reloadMap(app);
  assert.deepEqual(await world(page), { care: 0, train: 0, treasure: 1, total: 1 }, 'placed treasure survives reload');
  assert.equal(await page.locator('[data-world-placement="garden"]').count(), 1, 'the prize is placed in the chosen garden');
  assert.equal(await page.locator('[data-world-placement="beach"]').count(), 0);
  await press(app, '[data-island="exit"]');
  await page.locator('.games').waitFor();
  await press(app, '[data-do="settings"]');
  await press(app, '[data-do="reset"]');
  await press(app, '[data-do="confirm-reset"]');
  await page.locator('.games').waitFor();
  await enter(app);
  assert.deepEqual(await world(page), { care: 0, train: 0, treasure: 0, total: 0 }, 'reset removes the world consequences with the progress');
  assert.equal(await page.locator('[data-world-placement], [data-world-companion]').count(), 0, 'the reset also clears visible world items');
  await reloadMap(app);
  assert.deepEqual(await world(page), { care: 0, train: 0, treasure: 0, total: 0 }, 'reset remains effective after reload');
});

scenario('teacher letters and navigation: a single known letter keeps all zones playable and leaving cancels delayed celebration', async app => {
  const { page } = app;
  await chooseLetters(app, ['a']);
  await enter(app);
  const onlyA = new Set(['a']);
  for (const zone of ['care', 'train', 'treasure']) {
    await start(app, zone);
    if (zone === 'care') await press(app, '[data-island="companion"][data-companion="cat"]');
    assertKnown(await showTarget(app), onlyA);
    const action = zone === 'care' ? 'parcel' : zone === 'train' ? 'wagon' : 'stone';
    const material = await page.locator(`[data-island="${action}"]`).evaluateAll(buttons => buttons.map(button => button.dataset.value || button.textContent.trim()));
    for (const text of material) assertKnown(text, onlyA);
    if (zone === 'care') {
      await press(app, '[data-island="parcel"][data-value="a"]');
      await press(app, '[data-island="feed"]');
      await press(app, '[data-island="play"]');
      await map(app);
      await press(app, '[data-island="exit"]');
      await page.locator('.games').waitFor();
      const lateAudio = [];
      const onRequest = request => { if (/\/audio\/[^/]+\.(?:mp3|wav)(?:\?|$)/u.test(request.url())) lateAudio.push(request.url()); };
      page.on('request', onRequest);
      await page.waitForTimeout(1600);
      page.off('request', onRequest);
      assert.equal(await page.locator('#celebrationDialog[open]').count(), 0, 'leaving cancels the delayed celebration');
      assert.deepEqual(lateAudio, [], 'no delayed world narration starts on the home screen');
      await enter(app);
    } else if (zone === 'train') {
      await assemble(app, 'wagon', onlyA);
      await press(app, '[data-island="send"]');
      await celebrate(app);
    } else {
      await walkPath(app, onlyA);
      await assemble(app, 'code', onlyA);
      await press(app, '[data-island="open"]');
      await press(app, '[data-island="place"][data-placement="beach"]');
      await celebrate(app);
    }
  }
  assert.deepEqual(await world(page), { care: 1, train: 1, treasure: 1, total: 3 }, 'all three worlds remain playable with one known letter');
  await assertClean(page, app.errors);
});

scenario('story continuation: a completed first-grade story leads directly into a world activity', async app => {
  const { page } = app;
  await press(app, '[data-do="adventure"]');
  await page.locator('.lesson.adventure').waitFor();
  for (let step = 0; step < 3; step++) {
    if (await page.locator('.options [data-do="match"]').count()) await match(page);
    else {
      const tokens = await page.locator('#buildPrompt > span').allTextContents();
      assert.ok(tokens.length, 'the story provides a visible example');
      await fill(page, tokens);
    }
    await next(page);
  }
  await page.locator('.party').waitFor();
  for (const zone of ['care', 'train', 'treasure']) {
    assert.equal(await page.locator(`[data-do="island-zone"][data-zone="${zone}"]`).count(), 1);
  }
  await press(app, '[data-do="island-zone"][data-zone="care"]');
  await page.locator('#island[data-island-scene="care"]').waitFor();
});

scenario('Laravel restore race: a delayed old snapshot cannot move a freshly placed treasure', async app => {
  const { page } = app;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const fixture = {
    completed_items: [
      { mode: 'island', item_key: 'island:treasure-an:beach' },
      { mode: 'island', item_key: 'island:care-e' },
    ],
  };
  await page.route('**/api/progress', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    await gate;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) });
  });
  try {
    await Promise.all([
      page.waitForRequest(request => new URL(request.url()).pathname === '/api/progress' && request.method() === 'GET'),
      page.reload(),
    ]);
    await page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
    await enter(app);
    await start(app, 'treasure');
    await walkPath(app);
    await assemble(app, 'code');
    await press(app, '[data-island="open"]');
    await press(app, '[data-island="place"][data-placement="garden"]');
    await celebrate(app);
    assert.deepEqual(await world(page), { care: 0, train: 0, treasure: 1, total: 1 }, 'local action finished while restoration is pending');
    release();
    await page.waitForFunction(() => /1/u.test(document.querySelector('[data-world-care]')?.textContent || ''));
    assert.deepEqual(await world(page), { care: 1, train: 0, treasure: 1, total: 2 }, 'old server progress is restored without duplicating the treasure');
    const done = await page.evaluate(() => JSON.parse(localStorage.getItem('harf-adasi-github-v3')).done);
    assert.ok(done.includes('island:treasure-an:garden'), 'the child’s new garden placement is kept');
    assert.equal(done.includes('island:treasure-an:beach'), false, 'the stale beach placement cannot replace it');
    assert.equal(await page.locator('[data-world-placement="garden"]').count(), 1);
    assert.equal(await page.locator('[data-world-placement="beach"]').count(), 0);
    await start(app, 'treasure');
    assert.equal(await page.locator('.island-mission-heading .island-kicker').innerText(), 'Renkli bahçe sandığı', 'the next mission still follows the completed local trip');
    assert.equal(await showTarget(app), 'e', 'the new el path begins with its first sound');
  } finally {
    release();
  }
}, { backendOnly: true });

scenario('Laravel reset failure: an unsuccessful DELETE preserves the completed world', async app => {
  const { page } = app;
  await enter(app);
  await start(app, 'care');
  await press(app, '[data-island="companion"][data-companion="cat"]');
  const target = await showTarget(app);
  await press(app, `[data-island="parcel"][data-value="${target}"]`);
  await press(app, '[data-island="feed"]');
  const saved = page.waitForResponse(response => new URL(response.url()).pathname === '/api/sessions' && response.request().method() === 'POST' && response.ok());
  await press(app, '[data-island="play"]');
  await celebrate(app);
  assert.equal((await (await saved).json()).saved, true, 'this isolated session has saved real progress before the failure');
  const before = await world(page);
  await press(app, '[data-island="exit"]');
  await page.locator('.games').waitFor();
  let deleteRequests = 0;
  await page.route('**/api/progress', route => {
    if (route.request().method() !== 'DELETE') return route.continue();
    deleteRequests++;
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Test: temporarily unavailable' }) });
  });
  await press(app, '[data-do="settings"]');
  await press(app, '[data-do="reset"]');
  await press(app, '[data-do="confirm-reset"]');
  await page.locator('#toast').filter({ hasText: 'Kayıt silinemedi' }).waitFor();
  assert.equal(deleteRequests, 1, 'the failed reset is attempted once');
  if (await page.locator('#dialog[open]').count()) await press(app, page.getByRole('button', { name: 'Kapat', exact: true }));
  await page.locator('.games').waitFor();
  // Native dialog close queues the home refresh; let that refresh paint before
  // targeting its hero so the real touch is not sent to a replaced element.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await enter(app);
  assert.deepEqual(await world(page), before, 'failed deletion retains the current world');
  await reloadMap(app);
  assert.deepEqual(await world(page), before, 'failed deletion retains the saved world after reload');
}, { backendOnly: true, expectedConsoleError: /^Failed to load resource: the server responded with a status of 503\b/u });

(async () => {
  const { server, url: localUrl } = await startServer();
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  let browser;
  let failures = 0;
  let runs = 0;
  let skipped = 0;
  try {
    browser = await getPlaywright().chromium.launch({
      headless: true, executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'],
      ...(process.env.TEST_PROXY_SERVER ? { proxy: { server: process.env.TEST_PROXY_SERVER } } : {}),
    });
    const viewports = [{ width: 768, height: 1024 }, { width: 1024, height: 768 }];
    for (const viewport of viewports.filter(value => !process.env.TEST_VIEWPORT || process.env.TEST_VIEWPORT === `${value.width}x${value.height}`)) {
      for (const item of cases.filter(value => !process.env.TEST_FILTER || value.name.includes(process.env.TEST_FILTER))) {
        const app = await open(browser, process.env.TEST_BASE_URL || localUrl, viewport);
        app.page.setDefaultTimeout(10000);
        const backend = await app.page.evaluate(() => document.querySelector('meta[name="harf-backend"]')?.content === 'laravel');
        if (item.backendOnly && !backend) {
          skipped++;
          console.log(`SKIP ${viewport.width}x${viewport.height} ${item.name}: Laravel backend required`);
          await app.context.close();
          continue;
        }
        if (backend) await app.page.waitForLoadState('networkidle');
        runs++;
        try {
          await item.run(app);
          await assertClean(app.page, app.errors.filter(message => !item.expectedConsoleError?.test(message)));
          console.log(`PASS ${viewport.width}x${viewport.height} ${item.name}`);
        } catch (error) {
          failures++;
          console.error(`FAIL ${viewport.width}x${viewport.height} ${item.name}\n${error.stack}`);
          fs.mkdirSync(artifactDir, { recursive: true });
          await app.page.screenshot({ path: path.join(artifactDir, `${viewport.width}-${runs}-failure.png`), fullPage: true });
        } finally {
          await app.context.close();
        }
      }
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
  console.log(`${runs - failures}/${runs} island scenarios passed; ${skipped} backend-only scenarios skipped. Chromium touch emulation; physical iPad, WebKit and audible speech unverified.`);
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
