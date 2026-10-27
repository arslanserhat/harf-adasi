const fs = require('node:fs');
const path = require('node:path');
const { assert, getPlaywright, startServer, touch, stroke, assertClean } = require('./helpers.cjs');

const browserName = process.env.TEST_BROWSER || 'chromium';
const viewports = process.env.TEST_VIEWPORT
  ? process.env.TEST_VIEWPORT.split(',').map(value => {
    assert.match(value, /^\d+x\d+$/);
    const [width, height] = value.split('x').map(Number);
    return { width, height };
  }) : [{ width: 390, height: 660 }];
const artifacts = process.env.TEST_ARTIFACT_DIR || path.resolve(__dirname, '../test-results/content-integration');
const chromiumPath = '/workspace/.browser-cache/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell';
const LETTERS = ['a', 'n', 'e', 't', 'i', 'l'];
const UNITS = ['na', 'ne', 'ni'];
const NEW_LETTERS = ['t', 'i', 'l'];
const NEW_UNITS = ['la', 'le', 'li'];

async function press(app, value) {
  const target = typeof value === 'string' ? app.page.locator(value).first() : value;
  await target.waitFor({ state: 'visible' });
  assert.equal(await target.isEnabled(), true);
  await target.scrollIntoViewIfNeeded();
  const rect = await target.boundingBox();
  assert.ok(rect && rect.width >= 24 && rect.height >= 24);
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
  if (process.env.TEST_EXPECTED_VERSION) assert.equal(await app.page.evaluate(() => window.HARF_ADASI_VERSION), process.env.TEST_EXPECTED_VERSION);
}
async function stored(page, key) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), key);
}
async function selection(page) {
  const state = await stored(page, 'harf-adasi-content-v1');
  assert.equal(state?.version, 1, 'the real selection store is persisted');
  return state;
}
async function learning(page) {
  return stored(page, 'harf-adasi-learning-v1');
}
async function active(page, kind) {
  const history = await stored(page, 'harf-adasi-quests-v1');
  assert.equal(history?.version, 1);
  assert.equal(history.active?.kind, kind);
  assert.equal(history.active.plan.stages.length, 6);
  return history.active;
}
async function home(app) {
  if (await app.page.locator('.quest-nav [data-quest="home"]').count()) await press(app, '.quest-nav [data-quest="home"]');
  else await press(app, 'header [data-do="home"]');
  await app.page.locator('.quest-world-portal').first().waitFor();
}
async function enter(app, kind) {
  await press(app, `[data-do="quest-start"][data-quest-kind="${kind}"]`);
  await app.page.locator(`#quest[data-screen="task"][data-kind="${kind}"]`).waitFor();
  const saved = await active(app.page, kind);
  assert.equal(await app.page.locator('#questNext').isEnabled(), false, 'serving a target alone cannot complete its task');
  return saved;
}
async function edit(app, { letters, syllables, words = [] }) {
  await press(app, '[data-do="learning-parent"]');
  await app.page.locator('#learningListTitle').fill('Öğretmenimin harf ve hece çalışması');
  await app.page.locator('#learningLetters').fill(letters.join(' '));
  await app.page.locator('#learningSyllables').fill(syllables.join('\n'));
  await app.page.locator('#learningWords').fill(words.join('\n'));
  await press(app, '[data-learning="save-list"]');
  const state = await learning(app.page);
  const list = state.lists.find(list => list.id === state.activeListId);
  assert.deepEqual(list.letters, letters, 'actual independent letter input is saved');
  assert.deepEqual(list.syllables, syllables, 'actual bare syllable input is saved without invented words');
  assert.deepEqual(list.words.map(word => word.text), words);
  await press(app, '[data-learning="home"]');
  return list;
}
async function choose(app, task) {
  const choices = app.page.locator('[data-quest="choice"]');
  if (!await choices.first().isEnabled()) {
    await press(app, '[data-quest="listen"]');
    await app.page.waitForFunction(() => document.querySelector('[data-quest="listen"]')?.getAttribute('aria-busy') !== 'true');
    if (!await choices.first().isEnabled()) {
      assert.match(await app.page.locator('#questFeedback').innerText(), /Türkçe ses|Ses kapalı/u);
      await press(app, '[data-quest="hint"]');
    }
  }
  const index = (await choices.evaluateAll(choices => choices.map(choice => choice.dataset.value))).indexOf(task.target);
  assert.ok(index >= 0, 'the actual teacher target is a selectable choice');
  await press(app, choices.nth(index));
  assert.equal(await app.page.locator('#questNext').isEnabled(), true);
  await press(app, '#questNext');
  await app.page.waitForFunction(id => document.querySelector('#quest')?.dataset.stageId !== id, task.id);
}
async function drawAndReview(app) {
  const points = await app.page.locator('#questPad').evaluate(svg => [[85, 100], [150, 180], [220, 105], [280, 185]].map(([x, y]) => {
    const point = svg.createSVGPoint(); point.x = x; point.y = y;
    const actual = point.matrixTransform(svg.getScreenCTM());
    return { x: actual.x, y: actual.y, id: 1 };
  }));
  if (app.cdp) await stroke(app.cdp, points);
  else {
    await app.page.mouse.move(points[0].x, points[0].y); await app.page.mouse.down();
    for (const point of points.slice(1)) await app.page.mouse.move(point.x, point.y, { steps: 4 });
    await app.page.mouse.up();
  }
  assert.ok(await app.page.locator('#questInk path').count(), 'real input creates handwriting');
  assert.equal(await app.page.locator('#questNext').isEnabled(), false, 'unreviewed handwriting is not an awarded success');
  await press(app, '[data-quest="review"]');
  await app.page.locator('#questReview:not([hidden])').waitFor();
  await press(app, '[data-quest="approve"]');
  assert.equal(await app.page.locator('#questNext').isEnabled(), true);
  await press(app, '#questNext');
}
async function noCompletion(page, expectedEvents) {
  const history = await stored(page, 'harf-adasi-quests-v1');
  assert.equal(history.runs.length, 0, 'serving content or switching games never awards a completed tour');
  assert.deepEqual((await learning(page)).events, expectedEvents, 'selection exposure is separate from actual learning answers');
  assert.equal(await page.locator('#badge').innerText(), '0', 'partial tours do not award a sticker');
}
function checkBarePlan(plan, pool) {
  assert.deepEqual(plan.wordTexts, [], 'a bare syllable is not promoted into a vocabulary word');
  assert.ok(plan.focusTexts.length > 0 && plan.focusTexts.every(value => pool.includes(value)));
  assert.ok(plan.stages.every(stage => stage.itemType === 'syllable' && stage.word === '' && pool.includes(stage.unitText)
    && stage.options.every(option => pool.includes(option.value))), 'each real target/option stays in its own syllable pool');
}
async function photo(app, label) {
  if (process.env.CONTENT_SCREENSHOTS !== '1') return;
  fs.mkdirSync(artifacts, { recursive: true });
  await app.page.screenshot({ path: path.join(artifacts, `${browserName}-${app.page.viewportSize().width}-${label}.png`) });
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
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, locale: 'tr-TR' });
      const page = await context.newPage(), errors = [];
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      const app = { page, context, errors, cdp: browserName === 'chromium' ? await context.newCDPSession(page) : null };
      try {
        await ready(app, url);
        await edit(app, { letters: LETTERS, syllables: UNITS });
        assert.deepEqual((await learning(page)).events, []);
        assert.equal((await selection(page)).sequence, 0, 'editing a list does not serve targets or award answers');
        const first = await enter(app, 'letters');
        const firstLetter = first.plan.stages[0].target;
        assert.deepEqual([...first.plan.contentPools.letters].sort(), [...LETTERS].sort());
        assert.deepEqual(Object.keys((await selection(page)).domains.letters.items), [firstLetter], 'only the actually served first letter is exposed; the planned second letter is not');
        assert.deepEqual((await learning(page)).events, []);
        await choose(app, first.plan.stages[0]);
        await page.locator('#questPad').waitFor();
        await drawAndReview(app);
        const second = await active(page, 'letters');
        assert.equal(second.index, 2);
        const secondLetter = second.plan.stages[2].target;
        assert.notEqual(secondLetter, firstLetter);
        const observed = await selection(page), evidence = (await learning(page)).events;
        assert.ok(observed.domains.letters.items[firstLetter] && observed.domains.letters.items[secondLetter]);
        assert.ok(evidence.length >= 2, 'the actual selection and reviewed drawing have real evidence');
        await ready(app, url);
        assert.deepEqual(await selection(page), observed, 'page reload alone consumes no extra exposure');
        const resumed = await enter(app, 'letters');
        assert.equal(resumed.plan.id, second.plan.id);
        assert.equal(resumed.index, second.index);
        assert.deepEqual(await selection(page), observed, 're-rendering the same actual stage is idempotent');
        await home(app);

        const servedUnits = [];
        let lastSyllablePlan;
        for (let visit = 0; visit < UNITS.length + 1; visit++) {
          if (visit > 0) {
            const nextLetterPlan = await enter(app, 'letters');
            if (visit === 1) assert.ok(![firstLetter, secondLetter].includes(nextLetterPlan.plan.stages[0].target), 'switching back to Fener chooses an unserved letter instead of replaying the first pair');
            await home(app);
          }
          lastSyllablePlan = await enter(app, 'syllables');
          checkBarePlan(lastSyllablePlan.plan, UNITS);
          const unit = lastSyllablePlan.plan.stages[0].unitText;
          if (visit < UNITS.length) assert.ok(!servedUnits.includes(unit), 'a finite syllable pool is covered before an immediate duplicate cycle');
          else assert.notEqual(unit, servedUnits.at(-1), 'the covered finite pool starts a varied new cycle');
          servedUnits.push(unit);
          const bag = await selection(page);
          assert.ok(bag.domains.syllables.items[unit], 'an unanswered but actually served syllable enters selection metadata');
          assert.deepEqual(bag.domains.words.items, {}, 'independent syllables cannot fabricate word exposure');
          if (visit >= UNITS.length - 1) assert.deepEqual(new Set(servedUnits.slice(0, UNITS.length)), new Set(UNITS));
          await noCompletion(page, evidence);
          if (visit === UNITS.length - 1) assert.ok(bag.domains.syllables.round >= 2, 'covering the finite pool advances its selection cycle without awarding learning');
          if (visit < UNITS.length) await home(app);
        }
        await photo(app, 'independent-syllable');
        await home(app);

        // The words field remains empty: changing only the independent fields
        // must invalidate a formerly resumable plan and its old choices.
        await edit(app, { letters: NEW_LETTERS, syllables: NEW_UNITS });
        const edited = await enter(app, 'syllables');
        assert.notEqual(edited.plan.id, lastSyllablePlan.plan.id);
        assert.equal(edited.index, 0);
        checkBarePlan(edited.plan, NEW_UNITS);
        await noCompletion(page, evidence);
        await home(app);
        const editedLetters = await enter(app, 'letters');
        assert.ok(editedLetters.plan.stages.every(stage => NEW_LETTERS.includes(stage.target)
          && stage.options.every(option => NEW_LETTERS.includes(option.value))), 'removed teacher letters cannot remain in a fresh target or option');
        await noCompletion(page, evidence);
        await home(app);

        await edit(app, { letters: NEW_LETTERS, syllables: NEW_UNITS, words: ['alet', 'ilan'] });
        const syllableBeforeWords = (await selection(page)).domains.syllables;
        const wordPlan = await enter(app, 'words');
        assert.deepEqual([...wordPlan.plan.focusTexts].sort(), ['alet', 'ilan']);
        assert.ok(wordPlan.plan.stages.every(stage => ['alet', 'ilan'].includes(stage.word)
          && stage.options.every(option => ['alet', 'ilan'].includes(option.value))), 'word targets cannot fall back to bare syllables or starter vocabulary');
        const wordExposure = await selection(page);
        assert.ok(wordExposure.domains.words.items[wordPlan.plan.stages[0].word]);
        assert.deepEqual(wordExposure.domains.syllables, syllableBeforeWords, 'a word-selection stage does not silently consume a syllable target');
        await noCompletion(page, evidence);
        await home(app);
        const mixedHece = await enter(app, 'syllables');
        checkBarePlan(mixedHece.plan, [...NEW_UNITS, 'a', 'let', 'i', 'lan']);
        assert.ok(!mixedHece.plan.focusTexts.some(value => ['alet', 'ilan'].includes(value)));
        assert.deepEqual((await selection(page)).domains.words, wordExposure.domains.words, 'bare syllables do not write word exposure even when teacher words also exist');
        await noCompletion(page, evidence);
        await assertClean(page, errors);
        passed++;
        console.log(`PASS ${browserName} ${viewport.width}x${viewport.height} content integration: real bare inputs, letter response/review, served-only cross-mode coverage/cycle, idempotent resume and edited pools`);
      } catch (error) {
        console.error(`FAIL ${browserName} ${viewport.width}x${viewport.height} content integration\n${error.stack}`);
        fs.mkdirSync(artifacts, { recursive: true });
        await page.screenshot({ path: path.join(artifacts, `${browserName}-${viewport.width}-failure.png`), fullPage: true });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); if (service) await new Promise(resolve => service.server.close(resolve)); }
  console.log(`${passed}/${viewports.length} content-integration scenarios passed (${browserName}); physical iPhone unverified.`);
  if (passed !== viewports.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
