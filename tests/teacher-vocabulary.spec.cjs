const fs = require('node:fs');
const path = require('node:path');
const { assert, getPlaywright, startServer, ensureChildProfile, touch, stroke, assertClean } = require('./helpers.cjs');

const browserName = process.env.TEST_BROWSER || 'chromium';
const viewports = process.env.TEST_VIEWPORT
  ? process.env.TEST_VIEWPORT.split(',').map(value => {
    assert.match(value, /^\d+x\d+$/);
    const [width, height] = value.split('x').map(Number);
    return { width, height };
  })
  : [{ width: 390, height: 660 }, { width: 1024, height: 768 }];
const TEACHER_WORDS = ['alet', 'alan', 'ilan', 'inat', 'lale', 'nine', 'tane', 'ninni'];
const NARROWED_WORDS = ['tane', 'ninni'];
const artifacts = process.env.TEST_ARTIFACT_DIR || path.resolve(__dirname, '../test-results/teacher-vocabulary');
const chromiumPath = '/workspace/.browser-cache/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell';

async function press(app, value) {
  const control = typeof value === 'string' ? app.page.locator(value).first() : value;
  await control.waitFor({ state: 'visible' });
  assert.equal(await control.isEnabled(), true, 'the child uses an actual enabled control');
  await control.scrollIntoViewIfNeeded();
  const rect = await control.boundingBox();
  assert.ok(rect && rect.width >= 20 && rect.height >= 20, 'the actual control has a contact area');
  if (app.cdp) {
    await touch(app.cdp, 'touchStart', [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 1 }]);
    await app.page.waitForTimeout(70);
    await touch(app.cdp, 'touchEnd', []);
  } else await control.tap();
  await app.page.waitForTimeout(180);
}
async function ready(app, url) {
  await app.page.goto(url);
  assert.equal(app.page.url(), new URL(url).href, 'the requested publication is used without a local fallback');
  await app.page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
  await ensureChildProfile(app.page);
  await app.page.evaluate(() => document.fonts.ready);
  if (process.env.TEST_EXPECTED_VERSION) assert.equal(await app.page.evaluate(() => window.HARF_ADASI_VERSION), process.env.TEST_EXPECTED_VERSION);
}
async function savedLearning(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('harf-adasi-learning-v1') || 'null'));
}
async function savedHistory(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('harf-adasi-quests-v1') || 'null'));
}
async function active(page) {
  const saved = await savedHistory(page);
  assert.equal(saved?.version, 1);
  assert.equal(saved.active?.kind, 'words');
  assert.equal(saved.active.plan.stages.length, 6);
  return saved.active;
}
async function assertTeacherList(page, expected) {
  const state = await savedLearning(page);
  const selected = state.lists.find(list => list.id === state.activeListId);
  assert.deepEqual(selected.words.map(word => word.text), expected, 'the persisted list contains the actual editor input');
  return state;
}
async function home(app) {
  const questHome = app.page.locator('.quest-nav [data-quest="home"]');
  if (await questHome.count()) await press(app, questHome);
  else await press(app, 'header [data-do="home"]');
  await app.page.locator('.quest-world-portal').first().waitFor();
}
async function editList(app, words, { details = false } = {}) {
  await press(app, '[data-do="learning-parent"]');
  await app.page.locator('#learningListTitle').fill('Öğretmenimin değişen kelimeleri');
  await app.page.locator('#learningWords').fill(words.join('\n'));
  await press(app, '[data-learning="save-list"]');
  await assertTeacherList(app.page, words);
  if (details) {
    await press(app, '.learn-authoring > summary');
    for (const [word, meaning, sentence] of [
      ['alet', 'Bir iş yapmaya yarayan araç.', 'Ali  alet al.'],
      ['ilan', 'Bir haber ya da duyuru.', 'Ali ilan al.'],
    ]) {
      const fields = app.page.locator(`.learn-word-edit[data-word="${word}"]`);
      await fields.locator('[data-detail="meaning"]').fill(meaning);
      await fields.locator('[data-detail="sentence"]').fill(sentence);
    }
    await press(app, '[data-learning="save-details"]');
  }
  await press(app, '[data-learning="home"]');
}
async function checkCatalogs(app) {
  const rewardCount = await app.page.locator('#badge').innerText();
  for (const mode of ['words', 'syllables', 'reading', 'sentences']) {
    await press(app, `[data-do="catalog"][data-view="${mode}"]`);
    const teacher = app.page.locator(`[data-teacher-library="${mode}"]`);
    const standard = app.page.locator(`[data-standard-library="${mode}"]`);
    await teacher.waitFor();
    assert.equal(await standard.count(), 1, 'the standard library is an explicitly separate section');
    assert.equal(await teacher.evaluate((element, next) => Boolean(element.compareDocumentPosition(document.querySelector(next)) & Node.DOCUMENT_POSITION_FOLLOWING), `[data-standard-library="${mode}"]`), true, 'teacher content precedes the standard library');
    const values = await teacher.locator('[data-source="teacher"][data-text]').evaluateAll(cards => cards.map(card => card.dataset.text));
    if (mode === 'sentences') {
      assert.ok(values.includes('Ali  alet al.') && values.includes('Ali ilan al.'), 'adult-authored sentences become real selectable cards');
    } else if (mode === 'syllables') {
      for (const part of ['a', 'let', 'i', 'lan']) assert.ok(values.includes(part), `actual teacher syllable ${part} appears`);
      assert.ok(!values.includes('na'), 'a starter syllable absent from this teacher list is not silently added');
    } else assert.deepEqual([...values].sort(), [...TEACHER_WORDS].sort(), `${mode}: all eight teacher words appear, not just the starter pair`);
    assert.equal(values.includes('anne'), false);
    assert.equal(values.includes('nane'), false);
    if (mode === 'words') {
      await press(app, teacher.locator('[data-do="word"][data-text="alet"]'));
      await app.page.locator('#bank [data-do="tile"]').first().waitFor();
      assert.deepEqual((await app.page.locator('#bank [data-do="tile"]').allTextContents()).sort(), [...'alet'].sort(), 'the teacher card opens an actual game using its own word');
    } else if (mode === 'reading') {
      await press(app, teacher.locator('[data-do="word"][data-text="alet"]'));
      await app.page.locator('.read-options [data-do="read"]').first().waitFor();
      assert.equal(await app.page.locator('.exercise > .word').innerText(), 'alet', 'the actual reading target is the clicked teacher word');
      await press(app, app.page.getByRole('button', { name: 'Bir iş yapmaya yarayan araç.', exact: true }));
      assert.equal(await app.page.locator('#next').isEnabled(), true, 'the adult-authored meaning is the actual correct reading answer');
      await press(app, '#next');
      await app.page.locator('#bank [data-do="tile"]').first().waitFor();
      assert.deepEqual((await app.page.locator('#bank [data-do="tile"]').allTextContents()).sort(), [...'alet'].sort(), 'reading continues to constructing the same teacher word');
      assert.equal(await app.page.locator('#next').isEnabled(), false, 'the next reading step still needs its own actual response');
    } else if (mode === 'sentences') {
      await press(app, teacher.locator('[data-do="sentence"][data-text="Ali  alet al."]'));
      await app.page.locator('#bank [data-do="tile"]').first().waitFor();
      const tokens = ['Ali', 'alet', 'al.'];
      assert.deepEqual((await app.page.locator('#bank [data-do="tile"]').allTextContents()).sort(), [...tokens].sort(), 'the actual teacher sentence supplies three word cards even when its input has extra spacing');
      for (const token of tokens) {
        const available = await app.page.locator('#bank [data-do="tile"]').evaluateAll(tiles => tiles.map(tile => ({ id: tile.dataset.id, text: tile.textContent, disabled: tile.disabled })));
        const tile = available.find(tile => !tile.disabled && tile.text === token);
        assert.ok(tile, `a distinct actual ${token} sentence token exists`);
        await press(app, `#bank [data-do="tile"][data-id="${tile.id}"]`);
      }
      assert.deepEqual(await app.page.locator('#slots [data-do="slot"]').allTextContents(), tokens, 'real touches arrange the full teacher sentence in order');
      assert.equal(await app.page.locator('#next').isEnabled(), true, 'correctly assembling the teacher sentence enables manual continuation');
    }
    await home(app);
    assert.equal(await app.page.locator('#badge').innerText(), rewardCount, 'a catalog inspection or partial reading/sentence response cannot award a completed game');
  }
}
async function ensureAudioOrAdult(app) {
  const controls = app.page.locator('[data-quest="choice"], #questBank [data-quest="tile"]');
  if (!await controls.count() || await controls.first().isEnabled()) return;
  await press(app, '[data-quest="listen"]');
  await app.page.waitForFunction(() => document.querySelector('[data-quest="listen"]')?.getAttribute('aria-busy') !== 'true');
  if (!await controls.first().isEnabled()) {
    assert.match(await app.page.locator('#questFeedback').innerText(), /Türkçe ses|Ses kapalı/u);
    await press(app, '[data-quest="hint"]');
    assert.ok((await active(app.page)).ui.hints > 0, 'unavailable speech uses explicit adult assistance');
  }
  assert.equal(await controls.first().isEnabled(), true);
}
async function draw(app) {
  const points = await app.page.locator('#questPad').evaluate(svg => [[75, 110], [135, 185], [210, 105], [280, 190]].map(([x, y]) => {
    const point = svg.createSVGPoint(); point.x = x; point.y = y;
    const contact = point.matrixTransform(svg.getScreenCTM());
    return { x: contact.x, y: contact.y, id: 1 };
  }));
  if (app.cdp) await stroke(app.cdp, points);
  else {
    await app.page.mouse.move(points[0].x, points[0].y); await app.page.mouse.down();
    for (const point of points.slice(1)) await app.page.mouse.move(point.x, point.y, { steps: 4 });
    await app.page.mouse.up();
  }
  assert.ok(await app.page.locator('#questInk path').count(), 'real contact input creates actual ink');
  assert.equal(await app.page.locator('#questNext').isEnabled(), false, 'drawing alone cannot award a reviewed writing success');
}
async function preserveInkAndList(app, url) {
  const before = await active(app.page);
  assert.ok(before.ui.inkPaths.length > 0);
  await press(app, '[data-quest="pause"]');
  await press(app, '.quest-pause [data-quest="resume"]');
  await home(app);
  await ready(app, url);
  await assertTeacherList(app.page, TEACHER_WORDS);
  await press(app, '[data-do="quest-start"][data-quest-kind="words"]');
  await app.page.locator('#questPad').waitFor();
  const resumed = await active(app.page);
  assert.equal(resumed.plan.id, before.plan.id);
  assert.equal(resumed.index, before.index);
  assert.deepEqual(resumed.ui.inkPaths, before.ui.inkPaths, 'same-list reload and home preserve the child’s actual drawing');
  assert.deepEqual(await app.page.locator('#questInk path').evaluateAll(paths => paths.map(path => path.getAttribute('d'))), before.ui.inkPaths);
}
async function solve(app, stage, { preserveWriting = false, url } = {}) {
  await ensureAudioOrAdult(app);
  if (['find', 'deliver', 'route'].includes(stage.mechanic)) {
    const options = app.page.locator('[data-quest="choice"]');
    const index = (await options.evaluateAll(options => options.map(option => option.dataset.value))).indexOf(stage.target);
    assert.ok(index >= 0, 'the real scene offers the teacher target');
    await press(app, options.nth(index));
  } else if (stage.mechanic === 'assemble') {
    for (const token of stage.tokens) {
      const saved = await active(app.page);
      const tile = saved.ui.bank.find(tile => tile.text === token && !saved.ui.selected.includes(tile.id));
      assert.ok(tile, `a distinct actual ${token} token exists`);
      await press(app, `#questBank [data-quest="tile"][data-id="${tile.id}"]`);
    }
  } else if (stage.mechanic === 'write') {
    await draw(app);
    if (preserveWriting) await preserveInkAndList(app, url);
    await press(app, '[data-quest="review"]');
    await app.page.locator('#questReview:not([hidden])').waitFor();
    await press(app, '[data-quest="approve"]');
  } else throw new Error(`Unexpected word-world mechanic: ${stage.mechanic}`);
  assert.equal(await app.page.locator('#questNext').isEnabled(), true);
  await press(app, '#questNext');
  await app.page.waitForFunction(id => document.querySelector('#quest')?.dataset.screen === 'summary' || document.querySelector('#quest')?.dataset.stageId !== id, stage.id);
}
async function tour(app, url, { preserveWriting = false } = {}) {
  await press(app, '[data-do="quest-start"][data-quest-kind="words"]');
  await app.page.locator('#quest[data-screen="task"]').waitFor();
  const plan = (await active(app.page)).plan;
  assert.equal(plan.wordTexts.length, 2);
  assert.ok(plan.wordTexts.every(word => TEACHER_WORDS.includes(word)));
  assert.ok(plan.stages.every(stage => stage.options.every(option => TEACHER_WORDS.includes(option.value))), 'every visible distractor also belongs to the teacher list');
  for (let index = 0; index < 6; index++) {
    const current = await active(app.page);
    assert.equal(current.index, index);
    await solve(app, current.plan.stages[index], { preserveWriting: preserveWriting && current.plan.stages[index].mechanic === 'write', url });
  }
  await app.page.locator('#quest[data-screen="summary"]').waitFor();
  const history = await savedHistory(app.page);
  assert.ok(history.runs.some(run => run.id === plan.id && run.completedStages === 6 && run.results.every(result => result.correct)));
  return plan;
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
        await editList(app, TEACHER_WORDS, { details: true });
        await checkCatalogs(app);
        const first = await tour(app, url, { preserveWriting: true });
        await home(app);
        const second = await tour(app, url);
        assert.notDeepEqual([...second.wordTexts].sort(), [...first.wordTexts].sort(), 'a second actual tour cannot just swap the first teacher pair');
        assert.ok(second.wordTexts.some(word => !first.wordTexts.includes(word)), 'a later teacher word receives its own target tasks');
        await home(app);
        await press(app, '[data-do="quest-start"][data-quest-kind="words"]');
        const beforeEdit = await active(page);
        await home(app);
        await editList(app, NARROWED_WORDS);
        await press(app, '[data-do="quest-start"][data-quest-kind="words"]');
        const changed = await active(page);
        assert.notEqual(changed.plan.id, beforeEdit.plan.id, 'the old incomplete plan cannot silently survive a different teacher list');
        assert.equal(changed.index, 0);
        assert.deepEqual([...changed.plan.wordTexts].sort(), [...NARROWED_WORDS].sort());
        assert.ok(changed.plan.stages.every(stage => NARROWED_WORDS.includes(stage.word)
          && stage.options.every(option => NARROWED_WORDS.includes(option.value))), 'removed vocabulary cannot remain in targets or distractors');
        assert.equal((await savedHistory(page)).runs.length, 2, 'changing a list does not fabricate a third completion');
        await assertTeacherList(page, NARROWED_WORDS);
        await assertClean(page, errors);
        passed++;
        console.log(`PASS ${browserName} ${viewport.width}x${viewport.height} teacher vocabulary: eight-word editor/catalogs, two real tours with new targets, preserved ink/list and changed-list recovery`);
      } catch (error) {
        console.error(`FAIL ${browserName} ${viewport.width}x${viewport.height} teacher vocabulary\n${error.stack}`);
        fs.mkdirSync(artifacts, { recursive: true });
        await page.screenshot({ path: path.join(artifacts, `${browserName}-${viewport.width}-failure.png`), fullPage: true });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); if (service) await new Promise(resolve => service.server.close(resolve)); }
  console.log(`${passed}/${viewports.length} teacher-vocabulary scenarios passed; ${browserName === 'webkit' ? 'Linux WebKit is not physical iOS' : 'Chromium uses real CDP contact input'}; physical iPhone unverified.`);
  if (passed !== viewports.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
