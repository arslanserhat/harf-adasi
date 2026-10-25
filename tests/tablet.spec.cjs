const fs = require('node:fs');
const path = require('node:path');
const { assert, getPlaywright, startServer, open, tap, home, catalog, letter, match, next, assertNoAdvance, touch, stroke, paths, traceAll, ink, review, fill, assertClean } = require('./helpers.cjs');

const cases = [];
const scenario = (name, fn) => cases.push({ name, fn });
const alphabet = 'a b c ç d e f g ğ h ı i j k l m n o ö p r s ş t u ü v y z'.split(' ');
const artifactDir = process.env.TEST_ARTIFACT_DIR || path.join(__dirname, '..', 'test-results');

scenario('touch: wrong/correct letter match, manual next, empty/off-path trace, valid trace, free handwriting approval', async ({ page, cdp }) => {
  await letter(page, 'a');
  await page.locator('[data-do="match"]:not([data-value="a"])').first().tap();
  assert.equal(await page.locator('#next').isEnabled(), false);
  assert.match(await page.locator('#feedback').innerText(), /Bir daha/);
  await match(page, 'a');
  await assertNoAdvance(page);
  await next(page);
  assert.equal(await page.locator('#next').isEnabled(), false, 'empty drawing rejected');
  const geometry = await paths(page);
  await stroke(cdp, [geometry[0][0], { x: geometry[0][0].x - 100, y: geometry[0][0].y + 75 }]);
  assert.equal(await page.locator('#next').isEnabled(), false, 'off-path drawing rejected');
  await tap(page, 'clear');
  await traceAll(page, cdp);
  await tap(page, 'clear');
  assert.equal(await page.locator('#next').isEnabled(), false, 'clear resets completed guide');
  await traceAll(page, cdp);
  await next(page);
  await tap(page, 'review');
  assert.equal(await page.locator('#dialog').isVisible(), false, 'empty free writing not approved');
  await ink(page, cdp);
  await tap(page, 'clear');
  await tap(page, 'review');
  assert.equal(await page.locator('#dialog').isVisible(), false, 'cleared ink not approved');
  await review(page, cdp);
  await next(page);
  assert.match(await page.locator('.party').innerText(), /tamamladın/);
});

scenario('multitouch: secondary finger cannot finish or hijack the active stroke', async ({ page, cdp }) => {
  await letter(page, 'ı');
  await match(page);
  await next(page);
  const [line] = await paths(page);
  const first = { ...line[0], id: 1 };
  const second = { x: first.x + 90, y: first.y + 50, id: 2 };
  await touch(cdp, 'touchStart', [first]);
  await touch(cdp, 'touchStart', [first, second]);
  await touch(cdp, 'touchEnd', [first]);
  for (const point of line.slice(1)) await touch(cdp, 'touchMove', [{ ...point, id: 1 }]);
  await touch(cdp, 'touchEnd', []);
  assert.equal(await page.locator('#next').isEnabled(), true, 'primary finger continues after secondary lift');
});

scenario('pointer cancellation rejects guide then permits a new valid attempt', async ({ page, cdp }) => {
  await letter(page, 'ı');
  await match(page);
  await next(page);
  const [line] = await paths(page);
  await stroke(cdp, line, { cancel: true });
  assert.equal(await page.locator('#next').isEnabled(), false);
  await traceAll(page, cdp);
});

scenario('regression slots: empty taps preserve work, filled taps undo from the tapped position', async ({ page }) => {
  await catalog(page, 'words');
  await tap(page, 'word', '[data-text="anne"]');
  await page.locator('#bank [data-do="tile"]').filter({ hasText: /^a$/ }).tap();
  await page.locator('#bank [data-do="tile"]:not([disabled])').filter({ hasText: /^n$/ }).first().tap();
  assert.equal(await page.locator('.slot.filled').count(), 2);
  await tap(page, 'slot', '[data-index="3"]');
  assert.equal(await page.locator('.slot.filled').count(), 2, 'an empty slot does not remove a chosen card');
  await page.locator('#bank [data-do="tile"]:not([disabled])').filter({ hasText: /^n$/ }).first().tap();
  await page.locator('#bank [data-do="tile"]').filter({ hasText: /^e$/ }).tap();
  assert.equal(await page.locator('#next').isEnabled(), true);
  await tap(page, 'slot', '[data-index="1"]');
  assert.equal(await page.locator('.slot.filled').count(), 1, 'tapping second filled slot undoes that card and all following cards');
  assert.equal(await page.locator('.slot.filled').innerText(), 'a');
  assert.equal(await page.locator('#next').isEnabled(), false);
  assert.equal(await page.locator('#bank .tile[disabled]').count(), 1);
});

scenario('regression settings: home and selected catalog refresh while an active lesson keeps its work', async ({ page }) => {
  await home(page);
  assert.equal(await page.locator('.mini [data-letter="b"]').count(), 0);
  await tap(page, 'settings');
  await tap(page, 'select-letter', '[data-letter="b"]');
  await page.getByRole('button', { name: 'Kapat', exact: true }).tap();
  await page.locator('.mini [data-letter="b"]').waitFor({ state: 'visible' });
  await catalog(page, 'syllables');
  await tap(page, 'tab', '[data-key="filter"][data-value="selected"]');
  assert.equal(await page.locator('[data-do="word"][data-text="an"]').count(), 1);
  await tap(page, 'settings');
  await tap(page, 'select-letter', '[data-letter="a"]');
  await page.getByRole('button', { name: 'Kapat', exact: true }).tap();
  await page.locator('[data-do="word"][data-text="an"]').waitFor({ state: 'detached' });
  await tap(page, 'word', '[data-text="ti"]');
  await page.locator('#bank [data-do="tile"]').filter({ hasText: /^t$/ }).tap();
  const step = await page.locator('.steps').getAttribute('aria-label');
  await tap(page, 'settings');
  await tap(page, 'all-letters');
  await page.getByRole('button', { name: 'Kapat', exact: true }).tap();
  assert.equal(await page.locator('.steps').getAttribute('aria-label'), step);
  assert.equal(await page.locator('.slot.filled').count(), 1, 'closing settings does not restart an active exercise');
  assert.equal(await page.locator('.slot.filled').innerText(), 't');
});

scenario('regression demo: interrupting a drawing demonstration restores its start marker', async ({ page, cdp }) => {
  await letter(page, 'ı');
  await match(page);
  await next(page);
  const before = await page.locator('#markers .start').evaluate(circle => ({ x: circle.getAttribute('cx'), y: circle.getAttribute('cy') }));
  await tap(page, 'demo');
  await page.waitForTimeout(150);
  await tap(page, 'pause');
  await page.getByRole('button', { name: 'Oyuna dön', exact: true }).tap();
  await page.locator('#markers .start').waitFor({ state: 'visible' });
  const after = await page.locator('#markers .start').evaluate(circle => ({ x: circle.getAttribute('cx'), y: circle.getAttribute('cy') }));
  assert.deepEqual(after, before, 'paused demo restores the correct yellow starting point');
  assert.equal(await page.locator('#next').isEnabled(), false, 'demo never completes the task');
  await traceAll(page, cdp);
});

scenario('all 58 Turkish uppercase/lowercase guides trace with real touch', async ({ page, cdp }) => {
  for (const value of [...alphabet, ...alphabet.map(letter => letter.toLocaleUpperCase('tr-TR'))]) {
    await letter(page, value);
    assert.equal(await page.locator('.target').innerText(), value);
    await match(page, value);
    await next(page);
    try { await traceAll(page, cdp); }
    catch (error) { throw new Error(`${value}: ${error.message}`, { cause: error }); }
  }
});

scenario('syllable, anne/etti/inat, duplicate cards, undo/restart, hints, break, settings and persistence', async ({ page, cdp }) => {
  await catalog(page, 'syllables');
  await tap(page, 'word', '[data-text="ti"]');
  await page.locator('#bank [data-do="tile"]').filter({ hasText: /^i$/ }).tap();
  assert.equal(await page.locator('.slot.filled').count(), 0, 'wrong card stays available');
  await fill(page, ['t', 'i']);
  await tap(page, 'undo');
  assert.equal(await page.locator('#next').isEnabled(), false);
  assert.equal(await page.locator('.slot.filled').count(), 1);
  await tap(page, 'restart');
  assert.equal(await page.locator('.slot.filled').count(), 0);
  await tap(page, 'hint');
  assert.equal(await page.locator('#buildPrompt').innerText(), '?');
  await tap(page, 'hint');
  await fill(page, ['t', 'i']);
  await tap(page, 'pause');
  assert.match(await page.locator('#dialog').innerText(), /Küçük bir mola/);
  await page.getByRole('button', { name: 'Oyuna dön', exact: true }).tap();
  assert.equal(await page.locator('#next').isEnabled(), true);
  await next(page);
  await review(page, cdp);
  await next(page);
  for (const word of ['anne', 'etti', 'inat']) {
    await catalog(page, 'words');
    await tap(page, 'word', `[data-text="${word}"]`);
    await fill(page, [...word]);
    await next(page);
    await review(page, cdp);
    await next(page);
    assert.equal(await page.locator('.party').isVisible(), true);
  }
  const badge = await page.locator('#badge').innerText();
  assert.equal(Number(badge), 4);
  await tap(page, 'settings');
  await tap(page, 'all-letters');
  assert.equal(await page.locator('.settings [aria-pressed="true"]').count(), 29);
  await page.locator('#hint-setting').uncheck();
  await page.locator('#sound-setting').uncheck();
  await page.getByRole('button', { name: 'Kapat', exact: true }).tap();
  await page.reload();
  await page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
  assert.equal(await page.locator('#badge').innerText(), badge);
  assert.equal(await page.locator('#sound').getAttribute('aria-label'), 'Sesi aç');
  await tap(page, 'settings');
  assert.equal(await page.locator('.settings [aria-pressed="true"]').count(), 29);
  assert.equal(await page.locator('#hint-setting').isChecked(), false);
  await page.getByRole('button', { name: 'Kapat', exact: true }).tap();
});

scenario('reading-picture wrong/correct answer and sentence order', async ({ page, cdp }) => {
  await catalog(page, 'reading');
  await tap(page, 'word', '[data-text="elma"]');
  await page.locator('[data-do="read"]:not([aria-label="elma resmi"])').first().tap();
  assert.equal(await page.locator('#next').isEnabled(), false);
  await page.getByRole('button', { name: 'elma resmi', exact: true }).tap();
  await assertNoAdvance(page);
  await next(page);
  await fill(page, [...'elma']);
  await next(page);
  assert.equal(await page.locator('.party').isVisible(), true);
  await catalog(page, 'sentences');
  await tap(page, 'sentence', '[data-index="16"]');
  await fill(page, ['İnan', 'inat', 'etti.']);
  await next(page);
  await review(page, cdp);
  await next(page);
  assert.equal(await page.locator('.party').isVisible(), true);
});

scenario('numbers: count 0/10, trace 0–9, build 100 with two distinct zero cards', async ({ page, cdp }) => {
  for (const number of [0, 10]) {
    await catalog(page, 'numbers');
    await tap(page, 'tab', '[data-key="num"][data-value="count"]');
    await tap(page, 'number', `[data-number="${number}"]`);
    assert.equal(await page.locator('[data-do="apple"]').count(), number);
    for (let i = 0; i < number; i++) await page.locator('[data-do="apple"]').nth(i).tap();
    assert.equal(await page.locator('.apple.counted').count(), number);
    await page.locator('[data-do="count"]:not([data-number="'+number+'"])').first().tap();
    assert.equal(await page.locator('#next').isEnabled(), false);
    await tap(page, 'count', `[data-number="${number}"]`);
    await assertNoAdvance(page);
    await next(page);
    if (number === 0) { await traceAll(page, cdp); await next(page); }
    assert.equal(await page.locator('.party').isVisible(), true);
  }
  for (let number = 0; number <= 9; number++) {
    await catalog(page, 'numbers');
    await tap(page, 'tab', '[data-key="num"][data-value="trace"]');
    await tap(page, 'number', `[data-number="${number}"]`);
    await match(page);
    await next(page);
    await traceAll(page, cdp);
  }
  await catalog(page, 'numbers');
  await tap(page, 'tab', '[data-key="num"][data-value="explore"]');
  assert.equal(await page.locator('.grid.numbers [data-do="number"]').count(), 101);
  await tap(page, 'number', '[data-number="100"]');
  await match(page, '100');
  await next(page);
  const ids = await fill(page, ['1', '0', '0']);
  assert.notEqual(ids[1], ids[2]);
  await next(page);
  await traceAll(page, cdp);
  await next(page);
  await traceAll(page, cdp);
  await next(page);
  await review(page, cdp);
  await next(page);
  assert.equal(await page.locator('.party').isVisible(), true);
});

scenario('blocked storage and unavailable speech keep all game controls usable', async ({ page, cdp }) => {
  await letter(page, 'i');
  await tap(page, 'speak');
  assert.match(await page.locator('#toast').innerText(), /desteklenmiyor/);
  await match(page, 'i');
  await next(page);
  await traceAll(page, cdp);
  await next(page);
  await review(page, cdp);
  await next(page);
  assert.equal(await page.locator('.party').isVisible(), true);
  assert.match(await page.locator('#toast').innerText(), /kaydedilemiyor/);
});

(async () => {
  const { chromium } = getPlaywright();
  const { server, url: localUrl } = await startServer();
  const url = process.env.TEST_BASE_URL || localUrl;
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  let browser;
  let failures = 0;
  let runs = 0;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
      ...(process.env.TEST_PROXY_SERVER ? { proxy: { server: process.env.TEST_PROXY_SERVER } } : {}),
    });
    for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
      for (const item of cases) {
        if (process.env.TEST_FILTER && !item.name.includes(process.env.TEST_FILTER)) continue;
        const app = await open(browser, url, viewport, { unavailableApis: item.name.startsWith('blocked storage') });
        app.page.setDefaultTimeout(10000);
        runs++;
        try {
          await item.fn(app);
          await assertClean(app.page, app.errors);
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
  console.log(`${runs - failures}/${runs} tablet scenarios passed. Chromium touch emulation; physical iPad, WebKit, and audible speech unverified.`);
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
