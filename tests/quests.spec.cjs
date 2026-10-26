const fs = require('node:fs');
const path = require('node:path');
const { assert, getPlaywright, startServer, touch, stroke, assertClean } = require('./helpers.cjs');

const browserName = process.env.TEST_BROWSER || 'chromium';
const kinds = ['letters', 'syllables', 'words', 'reading', 'sentences', 'numbers'];
const viewports = [{ width: 390, height: 660 }, { width: 1366, height: 768 }]
  .filter(viewport => !process.env.TEST_VIEWPORT || process.env.TEST_VIEWPORT === `${viewport.width}x${viewport.height}`);
const artifacts = process.env.TEST_ARTIFACT_DIR || path.resolve(__dirname, '../test-results/quests');
const matchingChromium = '/workspace/.browser-cache/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell';

async function snapshot(page) {
  const value = await page.evaluate(() => JSON.parse(localStorage.getItem('harf-adasi-quests-v1') || 'null'));
  assert.equal(value?.version, 1, 'actual quest actions persist the current storage format');
  return value;
}
async function active(page) {
  const history = await snapshot(page);
  assert.ok(history.active?.plan?.stages?.length === 6, 'the actual UI created a six-stage plan');
  return history.active;
}
async function learning(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('harf-adasi-learning-v1') || 'null'));
}
async function ready(page, url) {
  await page.goto(url);
  await page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  if (process.env.TEST_EXPECTED_VERSION) assert.equal(await page.evaluate(() => window.HARF_ADASI_VERSION), process.env.TEST_EXPECTED_VERSION);
}
async function decoded(page, selector = '#quest img') {
  await page.locator(selector).evaluateAll(async images => {
    const visible = images.filter(image => { const box = image.getBoundingClientRect(); return box.width > 0 && box.height > 0; });
    let timer;
    try {
      await Promise.race([Promise.all(visible.map(image => image.decode())), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Visible adventure artwork did not decode')), 10000); })]);
    } finally { clearTimeout(timer); }
  });
}
async function photo(app, name, fullPage = false) {
  if (process.env.QUEST_SCREENSHOTS !== '1') return;
  await decoded(app.page);
  fs.mkdirSync(artifacts, { recursive: true });
  await app.page.screenshot({ path: path.join(artifacts, `${browserName}-${app.page.viewportSize().width}-${name}.png`), fullPage });
}
async function photographHome(app) {
  if (process.env.QUEST_SCREENSHOTS !== '1') return;
  for (const image of await app.page.locator('[data-do="quest-start"] img').all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(image => image.decode());
  }
  await app.page.evaluate(() => scrollTo(0, 0));
  await app.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await photo(app, 'home-portals', true);
}
async function press(app, value) {
  const target = typeof value === 'string' ? app.page.locator(value).first() : value;
  await target.waitFor({ state: 'visible' });
  assert.equal(await target.isEnabled(), true, 'a real enabled control is used');
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  assert.ok(box && box.width >= 24 && box.height >= 24, 'the control has a reachable contact area');
  if (app.cdp) {
    await touch(app.cdp, 'touchStart', [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }]);
    await app.page.waitForTimeout(70);
    await touch(app.cdp, 'touchEnd', []);
  } else await target.tap();
  await app.page.waitForTimeout(180);
}
async function fits(page, selectors = ['#questNext', '#quest .quest-nav']) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const documentFits = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth <= innerWidth + 1,
    y: document.documentElement.scrollHeight <= innerHeight + 2,
  }));
  assert.equal(documentFits.x, true, 'quest introduces no horizontal document scrolling');
  assert.equal(documentFits.y, true, 'active quest keeps its controls out of a scrolling document');
  for (const selector of selectors) {
    const boxes = await page.locator(selector).evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { text: element.textContent?.trim(), fits: box.width > 0 && box.height > 0 && box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1 };
    }));
    assert.ok(boxes.length > 0, `${selector} exists`);
    for (const box of boxes) assert.equal(box.fits, true, `${selector}: ${box.text} stays in the usable viewport`);
  }
}
async function enableAudioAnswers(app, task) {
  const candidates = app.page.locator('[data-quest="choice"], #questBank [data-quest="tile"]');
  if (!await candidates.count() || await candidates.first().isEnabled()) return;
  await press(app, '[data-quest="listen"]');
  await app.page.waitForFunction(() => document.querySelector('[data-quest="listen"]')?.getAttribute('aria-busy') !== 'true');
  if (!await candidates.first().isEnabled()) {
    assert.match(await app.page.locator('#questFeedback').innerText(), /Türkçe ses|Ses kapalı/u);
    await press(app, '[data-quest="hint"]');
    assert.ok((await active(app.page)).ui.hints > 0, 'adult reading is explicitly recorded as assistance');
  }
  assert.equal(await candidates.first().isEnabled(), true, `${task.mechanic} answers become available only after listening or adult help`);
}
async function draw(app) {
  const points = await app.page.locator('#questPad').evaluate(svg => [[85, 100], [150, 175], [220, 100], [280, 180]].map(([x, y]) => {
    const point = svg.createSVGPoint(); point.x = x; point.y = y;
    const actual = point.matrixTransform(svg.getScreenCTM());
    return { x: actual.x, y: actual.y, id: 1 };
  }));
  const scroll = await app.page.evaluate(() => scrollY);
  if (app.cdp) {
    await stroke(app.cdp, points);
    const box = await app.page.locator('#questPad').boundingBox();
    await app.cdp.send('Input.synthesizeScrollGesture', { x: box.x + box.width / 2, y: box.y + box.height / 2, xDistance: 0, yDistance: -100, speed: 450, gestureSourceType: 'touch' });
  } else {
    await app.page.mouse.move(points[0].x, points[0].y); await app.page.mouse.down();
    for (const point of points.slice(1)) await app.page.mouse.move(point.x, point.y, { steps: 4 });
    await app.page.mouse.up();
    await app.page.evaluate(() => scrollBy(0, 100));
  }
  await app.page.waitForTimeout(100);
  assert.equal(await app.page.evaluate(() => scrollY), scroll, 'drawing and a native scroll gesture cannot move the document');
  assert.ok(await app.page.locator('#questInk path').count(), 'the real writing surface received ink');
  assert.equal(await app.page.locator('#questNext').isEnabled(), false, 'ink alone never approves handwriting');
}
async function ownList(app) {
  await press(app, '[data-do="learning-parent"]');
  await app.page.locator('#learningListTitle').fill('Öğretmenimin haftalık kelimeleri');
  await app.page.locator('#learningWords').fill('nane\nanne');
  await press(app, '[data-learning="save-list"]');
  const saved = await learning(app.page);
  const list = saved.lists.find(item => item.id === saved.activeListId);
  assert.deepEqual(list.words.map(item => item.text), ['nane', 'anne']);
  await press(app, '[data-learning="home"]');
}
async function preserveWriting(app) {
  await draw(app);
  const before = await active(app.page);
  // Headless visibility emulation exercises the app lifecycle without creating
  // any answer, ink or completion state. All writing above came from input.
  await app.page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.hidden;
  });
  await app.page.locator('#questPad').waitFor();
  assert.deepEqual((await active(app.page)).ui.inkPaths, before.ui.inkPaths, 'returning from background preserves real ink and restores working controls');
  await press(app, '[data-quest="pause"]');
  await app.page.locator('.quest-pause[role="dialog"]').waitFor();
  assert.equal((await active(app.page)).plan.stages[before.index].id, before.plan.stages[before.index].id, 'pause does not advance a task');
  await press(app, '.quest-pause [data-quest="resume"]');
  await press(app, '.quest-nav [data-quest="home"]');
  await app.page.locator('[data-do="quest-start"][data-quest-kind="words"]').first().waitFor();
  await app.page.reload();
  await app.page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
  await press(app, '[data-do="quest-start"][data-quest-kind="words"]');
  const restored = await active(app.page);
  assert.equal(restored.index, before.index);
  assert.equal(restored.plan.id, before.plan.id, 'home and reload keep the same actual adventure');
  assert.deepEqual(restored.ui.inkPaths, before.ui.inkPaths, 'the child’s real ink survives home and browser reload');
  const painted = await app.page.locator('#questInk path').evaluateAll(paths => paths.map(item => item.getAttribute('d')));
  assert.deepEqual(painted, before.ui.inkPaths);
}
async function solve(app, task, { wrongAndHint = false, resumeWriting = false } = {}) {
  await enableAudioAnswers(app, task);
  if (wrongAndHint && ['find', 'deliver', 'route'].includes(task.mechanic)) {
    const choices = await app.page.locator('[data-quest="choice"]').evaluateAll(items => items.map(item => item.dataset.value));
    const wrongIndex = choices.findIndex(value => value !== task.target);
    assert.ok(wrongIndex >= 0, 'a real distractor exists');
    await press(app, app.page.locator('[data-quest="choice"]').nth(wrongIndex));
    assert.equal(await app.page.locator('#questNext').isEnabled(), false, 'wrong selection cannot advance');
    if (!(await active(app.page)).ui.modelShown) await press(app, '[data-quest="hint"]');
    assert.ok((await active(app.page)).ui.hints > 0 && (await active(app.page)).ui.mistakes > 0);
  }
  if (['find', 'deliver', 'route'].includes(task.mechanic)) {
    await fits(app.page, ['#questNext', '#quest .quest-nav', '[data-quest="choice"]']);
    const options = app.page.locator('[data-quest="choice"]');
    const index = (await options.evaluateAll(items => items.map(item => item.dataset.value))).indexOf(String(task.target));
    assert.ok(index >= 0, 'the visible scene contains the actual target');
    await press(app, options.nth(index));
  } else if (task.mechanic === 'assemble') {
    await fits(app.page, ['#questNext', '#quest .quest-nav', '#questBank', '#questSlots']);
    for (const token of task.tokens) {
      const live = await active(app.page);
      const tile = live.ui.bank.find(item => item.text === token && !live.ui.selected.includes(item.id));
      assert.ok(tile, `a distinct unplaced ${token} card exists`);
      await press(app, `#questBank [data-quest="tile"][data-id="${tile.id}"]`);
    }
  } else if (task.mechanic === 'write') {
    await fits(app.page, ['#questNext', '#quest .quest-nav', '#questPad', '[data-quest="review"]']);
    if (resumeWriting) await preserveWriting(app);
    const original = app.page.viewportSize();
    await app.page.setViewportSize({ width: original.height, height: original.width });
    await app.page.waitForTimeout(250);
    await fits(app.page, ['#questNext', '#questPad', '[data-quest="review"]']);
    await draw(app);
    await app.page.setViewportSize(original);
    await app.page.waitForTimeout(250);
    await fits(app.page, ['#questNext', '#questPad', '[data-quest="review"]']);
    await press(app, '[data-quest="review"]');
    await app.page.locator('#questReview:not([hidden])').waitFor();
    assert.equal(await app.page.locator('#questNext').isEnabled(), false, 'adult review must be explicitly confirmed');
    await press(app, '[data-quest="approve"]');
  } else if (task.mechanic === 'collect') {
    await fits(app.page, ['#questNext', '#quest .quest-nav', '[data-quest="collect"]']);
    const target = Number(task.target);
    for (let index = 0; index < target; index++) await press(app, `[data-quest="collect"][data-index="${index}"]`);
    assert.equal((await active(app.page)).ui.collected.length, target, 'quantity comes from unique actual object taps');
    await press(app, '[data-quest="check-count"]');
  } else if (task.mechanic === 'balance') {
    await fits(app.page);
    let quantity = (await active(app.page)).ui.quantity, moves = 0;
    while (quantity !== Number(task.target)) {
      assert.ok(moves++ < 12, 'a bounded number of physical adjustments reaches the target');
      const expected = quantity + (quantity < Number(task.target) ? 1 : -1);
      await press(app, `[data-quest="${quantity < Number(task.target) ? 'add' : 'remove'}"]`);
      quantity = (await active(app.page)).ui.quantity;
      assert.equal(quantity, expected, 'each quantity control changes exactly one physical item');
    }
    await press(app, '[data-quest="check-count"]');
  } else throw new Error(`Unrecognized actual mechanic: ${task.mechanic}`);
  assert.equal(await app.page.locator('#questNext').isEnabled(), true, 'the solved stage still requires manual continuation');
  const id = await app.page.locator('#quest').getAttribute('data-stage-id');
  await app.page.waitForTimeout(260);
  assert.equal(await app.page.locator('#quest').getAttribute('data-stage-id'), id, 'a successful action does not automatically advance');
}

(async () => {
  const service = process.env.TEST_BASE_URL ? null : await startServer();
  const url = process.env.TEST_BASE_URL || service.url;
  let browser;
  let passed = 0, total = 0;
  const photographedHomes = new Set();
  try {
    browser = await getPlaywright()[browserName].launch({ headless: true,
      ...(browserName === 'chromium' ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || matchingChromium, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {}),
      ...(process.env.TEST_PROXY_SERVER ? { proxy: { server: process.env.TEST_PROXY_SERVER } } : {}),
    });
    for (const viewport of viewports) for (const kind of kinds.filter(kind => !process.env.TEST_FILTER || kind.includes(process.env.TEST_FILTER))) {
      const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, locale: 'tr-TR' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      const app = { context, page, errors, cdp: browserName === 'chromium' ? await context.newCDPSession(page) : null };
      page.setDefaultTimeout(15000); total++;
      try {
        await ready(page, url);
        const custom = kind === 'words' && viewport.width === 390;
        if (custom) await ownList(app);
        if (!photographedHomes.has(viewport.width)) {
          await photographHome(app); photographedHomes.add(viewport.width);
        }
        await press(app, `[data-do="quest-start"][data-quest-kind="${kind}"]`);
        await page.locator(`#quest[data-screen="task"][data-kind="${kind}"]`).waitFor();
        const plan = (await active(page)).plan;
        assert.equal(plan.stages.length, 6);
        assert.equal(new Set(plan.stages.map(stage => stage.id)).size, 6);
        if (custom) assert.deepEqual(new Set(plan.wordTexts), new Set(['nane', 'anne']), 'the actual teacher list determines the new adventure');
        for (let index = 0; index < 6; index++) {
          const live = await active(page), task = live.plan.stages[live.index];
          assert.equal(live.index, index);
          assert.equal(await page.locator('#quest').getAttribute('data-stage-id'), task.id);
          assert.equal(await page.locator('#questNext').isEnabled(), false);
          await decoded(page);
          await fits(page);
          if (index === 0) await photo(app, `${kind}-first-stage`);
          if (kind === 'syllables' && index === 3 && task.model?.includes('…') && !task.guided) {
            assert.equal(live.ui.hints, 0, 'the incomplete wagon shown in the question is not an answer hint');
          }
          if (kind === 'sentences' && index === 5 && task.skill === 'sentence') {
            await press(app, '[data-quest="hint"]');
            assert.equal(await page.locator('#questModel').innerText(), task.target, 'sentence help supplies the whole teacher message');
          }
          await solve(app, task, { wrongAndHint: custom && index === 0, resumeWriting: custom && task.mechanic === 'write' });
          await press(app, '#questNext');
          await page.waitForFunction(previous => document.querySelector('#quest')?.dataset.screen === 'summary' || document.querySelector('#quest')?.dataset.stageId !== previous, task.id);
        }
        await page.locator(`#quest[data-screen="summary"][data-kind="${kind}"]`).waitFor();
        const history = await snapshot(page);
        assert.equal(history.active, null);
        assert.equal(history.runs.length, 1, 'one completed actual tour creates one run');
        const run = history.runs[0];
        assert.equal(run.kind, kind); assert.equal(run.completed, true);
        assert.equal(run.completedStages, 6); assert.equal(run.totalStages, 6);
        assert.equal(run.results.length, 6);
        assert.deepEqual(run.results.map(result => result.id), plan.stages.map(stage => stage.id));
        assert.ok(run.results.every(result => result.correct === true), 'all six persisted results have actual successful actions');
        const events = (await learning(page))?.events || [];
        const completionEvents = events.filter(event => plan.stages.some(stage => event.id === `${stage.id}:complete`));
        assert.equal(completionEvents.length, kind === 'numbers' ? 0 : 6, 'only real lexical answers create learning observations; numeracy never fabricates word mastery');
        for (let index = 0; index < plan.stages.length; index++) if (plan.stages[index].mechanic === 'write') assert.equal(run.results[index].writingReviewed, true);
        if (custom) {
          const corrected = completionEvents.find(event => event.id === `${plan.stages[0].id}:complete`);
          const firstStageEvents = events.filter(event => event.id.startsWith(`${plan.stages[0].id}:`));
          const totals = firstStageEvents.reduce((result, event) => ({ mistakes: result.mistakes + event.mistakes, hints: result.hints + event.hints }), { mistakes: 0, hints: 0 });
          assert.equal(totals.mistakes, 1, 'one actual wrong selection is recorded once across retry and completion');
          assert.equal(totals.mistakes, run.results[0].mistakes, 'stored event deltas equal the stage aggregate');
          assert.equal(totals.hints, run.results[0].hints, 'help is not counted again when completing the same stage');
          assert.ok(totals.hints >= 1);
          assert.equal(corrected.independent, false, 'wrong and assisted attempts cannot become independent success');
        }
        await assertClean(page, errors); passed++;
        console.log(`PASS ${browserName} ${viewport.width}x${viewport.height} ${kind}: six real stages, viewport fit, explicit continuation and persisted completion`);
        await photo(app, `${kind}-summary`);
      } catch (error) {
        console.error(`FAIL ${browserName} ${viewport.width}x${viewport.height} ${kind}\n${error.stack}`);
        fs.mkdirSync(artifacts, { recursive: true });
        await page.screenshot({ path: path.join(artifacts, `${browserName}-${viewport.width}-${kind}-failure.png`), fullPage: true });
      } finally { await context.close(); }
    }
    if (process.env.TEST_FILTER === 'recovery') for (const corruption of ['missing-prefix', 'unearned-correct']) {
      const viewport = viewports[0];
      assert.ok(viewport, 'recovery selects an available viewport');
      const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, locale: 'tr-TR' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      const app = { context, page, errors, cdp: browserName === 'chromium' ? await context.newCDPSession(page) : null };
      page.setDefaultTimeout(15000); total++;
      try {
        await ready(page, url);
        await press(app, '[data-do="quest-start"][data-quest-kind="words"]');
        const first = (await active(page)).plan.stages[0];
        await solve(app, first);
        await press(app, '#questNext');
        await page.waitForFunction(id => document.querySelector('#quest')?.dataset.stageId !== id, first.id);
        assert.equal((await active(page)).index, 1, 'a real completed first stage precedes the recovery fault');
        const evidence = (await learning(page))?.events || [];
        assert.ok(evidence.some(event => event.id === `${first.id}:complete` && event.correct), 'the actual completed stage produced learning evidence before corruption');
        // Negative recovery only: damage the saved envelope without creating
        // a successful answer or editing the independent learning evidence.
        await press(app, '.quest-nav [data-quest="home"]');
        await page.locator('.quest-world-portal').first().waitFor();
        await page.evaluate(corruption => {
          const key = 'harf-adasi-quests-v1', saved = JSON.parse(localStorage.getItem(key));
          if (corruption === 'missing-prefix') saved.active.answers = [];
          else saved.active.ui.correct = true;
          localStorage.setItem(key, JSON.stringify(saved));
        }, corruption);
        await ready(page, url);
        await press(app, '[data-do="quest-start"][data-quest-kind="words"]');
        await page.locator('#quest[data-screen="task"]').waitFor();
        const restored = await active(page);
        assert.equal(restored.index, 0, 'an inconsistent saved envelope restarts instead of skipping work');
        assert.equal(restored.ui.correct, false);
        assert.equal(await page.locator('#questNext').isEnabled(), false);
        assert.equal((await snapshot(page)).runs.length, 0, 'corrupt progress creates no completed adventure');
        assert.deepEqual((await learning(page))?.events || [], evidence, 'recovery adds no fabricated learning evidence');
        await assertClean(page, errors); passed++;
        console.log(`PASS ${browserName} ${viewport.width}x${viewport.height} recovery ${corruption}: restart without completion or extra evidence`);
      } catch (error) {
        console.error(`FAIL ${browserName} recovery ${corruption}\n${error.stack}`);
        fs.mkdirSync(artifacts, { recursive: true });
        await page.screenshot({ path: path.join(artifacts, `${browserName}-recovery-${corruption}-failure.png`), fullPage: true });
      } finally { await context.close(); }
    }
  } finally { await browser?.close(); if (service) await new Promise(resolve => service.server.close(resolve)); }
  assert.ok(total > 0, 'the requested viewport and mode filters select at least one real tour');
  console.log(`${passed}/${total} ${browserName} quest scenarios passed; ${browserName === 'chromium' ? 'real CDP touch/scroll input' : 'Linux WebKit touch taps/pointer drawing'}, physical iPhone unverified.`);
  if (passed !== total) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
