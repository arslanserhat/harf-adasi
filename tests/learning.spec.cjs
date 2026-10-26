const fs = require('node:fs');
const path = require('node:path');
const { assert, getPlaywright, startServer, open, touch, stroke, assertClean } = require('./helpers.cjs');

const cases = [];
const scenario = (name, run, browserOptions = {}) => cases.push({ name, run, browserOptions });
const artifactDirectory = process.env.TEST_ARTIFACT_DIR || path.resolve(__dirname, '..', 'test-results', 'learning');
const matchingChromium = '/workspace/.browser-cache/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell';

async function press(app, selector) {
  const control = typeof selector === 'string' ? app.page.locator(selector).first() : selector;
  await control.waitFor({ state: 'visible' });
  assert.equal(await control.isEnabled(), true, 'the requested control is enabled');
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  assert.ok(box && box.width >= 24 && box.height >= 24, 'touch control has a reachable hit area');
  await touch(app.cdp, 'touchStart', [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }]);
  await app.page.waitForTimeout(80);
  await touch(app.cdp, 'touchEnd', []);
  await app.page.waitForTimeout(80);
}

async function enter(app, parent = false) {
  await press(app, parent ? '[data-do="learning-parent"]' : '[data-do="learning"]');
  await app.page.locator(`#learning[data-screen="${parent ? 'parent' : 'home'}"]`).waitFor();
}

async function begin(app) {
  await enter(app);
  await press(app, '[data-learning="start"]');
  if (await app.page.locator('#learning[data-screen="intro"]').count()) {
    assert.match(await app.page.locator('#learning h1').innerText(), /Alparslan|Mektup|mektup/u, 'the connected lesson begins with its original story');
    await press(app, '[data-learning="begin-tasks"]');
  }
  await app.page.locator('#learning[data-screen="task"]').waitFor();
}

async function snapshot(page) {
  // Read-only observation verifies the real persisted outcome. No state, task
  // result, clock or completion is injected into the application by this suite.
  const result = await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('harf-adasi') || !/learning/u.test(key)) continue;
      try {
        const value = JSON.parse(localStorage.getItem(key));
        if (value?.version === 1 && Array.isArray(value.lists)) return value;
      } catch { /* An unrelated storage entry is not a learning snapshot. */ }
    }
    return null;
  });
  assert.ok(result, 'the actual learning state is saved in this browser');
  return result;
}

async function currentTask(app) {
  const state = await snapshot(app.page);
  assert.ok(state.session, 'a real planned session exists');
  const task = state.session.tasks[state.session.index];
  assert.ok(task, 'the persisted index addresses a task');
  assert.equal(await app.page.locator('#learning').getAttribute('data-task-id'), task.id);
  return task;
}

function exactText(text) {
  return new RegExp(`^${String(text).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'u');
}

async function fillTiles(app, tokens) {
  const ids = [];
  for (const value of tokens) {
    const tile = app.page.locator('#learningBank [data-learning="tile"]:not([disabled])')
      .filter({ hasText: exactText(value) }).first();
    ids.push(await tile.getAttribute('data-id'));
    await press(app, tile);
  }
  assert.equal(new Set(ids).size, tokens.length, 'duplicate letters or syllables use separate touch cards');
}

async function drawInk(app) {
  const page = app.page;
  const before = await page.evaluate(() => window.scrollY);
  const points = await page.locator('#learningPad').evaluate(svg => {
    const matrix = svg.getScreenCTM();
    if (!matrix) throw new Error('Writing pad has no visible coordinate transform');
    return [[90, 110], [150, 170], [210, 110], [270, 170]].map(([x, y]) => {
      const point = svg.createSVGPoint(); point.x = x; point.y = y;
      const screen = point.matrixTransform(matrix);
      return { x: screen.x, y: screen.y };
    });
  });
  await stroke(app.cdp, points);
  assert.equal(await page.evaluate(() => window.scrollY), before, 'writing gestures do not scroll the page');
}

async function listen(app) {
  await press(app, '[data-learning="listen"]');
  await app.page.waitForFunction(() => document.querySelector('[data-learning="listen"]')?.getAttribute('aria-busy') !== 'true');
  await app.page.waitForTimeout(100);
}

async function solveTask(app, task, { writingChecks = false } = {}) {
  if (task.kind === 'recall') {
    assert.equal(await app.page.locator('#learningModel').isVisible(), false, 'recall starts without displaying the word model');
  }
  if (['syllables', 'build', 'recall', 'sentence'].includes(task.kind)) {
    await fillTiles(app, task.tokens);
  } else if (task.kind === 'write') {
    assert.equal(await app.page.locator('body').evaluate(body => body.classList.contains('writing-focus')), true);
    if (writingChecks) {
      await press(app, '[data-learning="review"]');
      assert.equal(await app.page.locator('#learningReview').isVisible(), false, 'empty writing is never approved');
      assert.equal(await app.page.locator('#learningNext').isEnabled(), false);
    }
    await drawInk(app);
    assert.equal(await app.page.locator('#learningNext').isEnabled(), false, 'ink alone does not approve handwriting');
    await press(app, '[data-learning="review"]');
    await app.page.locator('#learningReview').waitFor({ state: 'visible' });
    await press(app, '[data-learning="approve"]');
  } else {
    if (task.kind === 'listen') {
      await listen(app);
      if (/Türkçe sesi.*çalınamadı/u.test(await app.page.locator('#learningFeedback').innerText())) {
        await press(app, '[data-learning="adult-read"]');
      }
    }
    const target = task.target ?? task.word;
    const matching = app.page.locator('[data-learning="choice"]').filter({ hasText: exactText(target) });
    if (await matching.count()) await press(app, matching.first());
    else {
      const value = app.page.locator(`[data-learning="choice"][data-value=${JSON.stringify(String(target))}]`);
      assert.ok(await value.count(), `a visible correct choice exists for ${task.kind}`);
      await press(app, value);
    }
  }
  assert.equal(await app.page.locator('#learningNext').isEnabled(), true, `${task.kind} waits for explicit continuation`);
  const id = await app.page.locator('#learning').getAttribute('data-task-id');
  await app.page.waitForTimeout(300);
  assert.equal(await app.page.locator('#learning').getAttribute('data-task-id'), id, 'success does not automatically advance');
}

scenario('teacher lists: invalid text, custom words, taught-letter filtering and persistence', async app => {
  const { page } = app;
  await enter(app, true);
  await press(app, '[data-learning="new-list"]');
  await page.locator('#learningListTitle').fill('Öğretmenin haftalık listesi');
  await page.locator('#learningWords').fill('nane\n<script>alert(1)</script>');
  await press(app, '[data-learning="save-list"]');
  assert.ok((await page.locator('#learningErrors').innerText()).trim().length, 'invalid teacher input has an explanatory error');
  await page.locator('#learningWords').fill('NANE\nanne\ntane\nçilek\nnane');
  await press(app, '[data-learning="save-list"]');
  const state = await snapshot(page);
  const list = state.lists.find(value => value.title === 'Öğretmenin haftalık listesi');
  assert.ok(list, 'the teacher list is actually stored');
  assert.deepEqual(list.words.map(word => word.text).sort(), ['anne', 'nane', 'tane', 'çilek'].sort(), 'Turkish case normalization and duplicate removal preserve the intended words');
  assert.equal(state.activeListId, list.id, 'the saved teacher list becomes the selected study source');
  assert.match(await page.locator('#learning').innerText(), /çilek/u, 'the unstudied word remains visible to the adult');
  assert.match(await page.locator('.learn-blocked').innerText(), /eksik harfler:\s*(?:ç,\s*k|k,\s*ç)/u, 'the adult sees exactly which selected letters are missing');
  await press(app, '.learn-authoring > summary');
  const parts = page.locator('.learn-word-edit[data-word="nane"] [data-detail="parts"]');
  await parts.fill('nan-e');
  await press(app, '[data-learning="save-details"]');
  const edited = (await snapshot(page)).lists.find(value => value.id === list.id);
  assert.deepEqual(edited.words.find(word => word.text === 'nane').parts, ['nan', 'e'], 'the adult can explicitly replace the suggested syllable split');
  await page.reload();
  await page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
  const reloaded = (await snapshot(page)).lists.find(value => value.id === list.id);
  assert.deepEqual(reloaded.words.find(word => word.text === 'nane').parts, ['nan', 'e'], 'the teacher’s explicit override survives reload');
  await begin(app);
  const queue = (await snapshot(page)).session.tasks;
  assert.ok(queue.length >= 5, 'a teacher word becomes part of a connected session');
  assert.ok(queue.every(task => ['nane', 'anne', 'tane'].includes(task.word)), 'unselected letters never enter the child’s tasks');
});

scenario('connected learning: errors are assisted, repeated cards, real writing and a finite session', async app => {
  await begin(app);
  const first = await currentTask(app);
  const firstChoices = app.page.locator('[data-learning="choice"]');
  if (await firstChoices.count() > 1) {
    if (first.kind === 'listen') await listen(app);
    const target = String(first.target ?? first.word);
    const wrong = firstChoices.filter({ hasNotText: exactText(target) }).first();
    if (await wrong.count()) {
      await press(app, wrong);
      assert.equal(await app.page.locator('#learningNext').isEnabled(), false, 'a wrong choice cannot complete the task');
      assert.ok((await app.page.locator('#learningFeedback').innerText()).trim().length);
    }
  }
  const kinds = new Set();
  const wordCounts = new Map();
  let count = 0;
  let writingChecked = false;
  while (await app.page.locator('#learning[data-screen="task"]').count()) {
    assert.ok(count++ < 14, 'the connected session has a finite end');
    const task = await currentTask(app);
    kinds.add(task.kind);
    wordCounts.set(task.word, (wordCounts.get(task.word) || 0) + 1);
    await solveTask(app, task, { writingChecks: task.kind === 'write' && !writingChecked });
    if (task.kind === 'write') writingChecked = true;
    await press(app, '#learningNext');
  }
  await app.page.locator('#learningSummary').waitFor();
  assert.ok(kinds.has('listen') && kinds.has('syllables') && kinds.has('build') && kinds.has('recall') && kinds.has('write'), `multiple learning formats are used: ${[...kinds]}`);
  assert.ok([...wordCounts.values()].some(value => value >= 3), 'the same word connects several learning tasks');
  assert.ok(writingChecked, 'actual touch writing and adult review were exercised');
  assert.equal(await app.page.locator('body').evaluate(body => body.classList.contains('writing-focus')), false, 'session completion releases the tablet scroll lock');
  const saved = await snapshot(app.page);
  assert.ok(saved.events.length >= 5, 'actual completed tasks produce persisted evidence');
  const assisted = saved.events.find(event => event.id === first.id);
  assert.ok(assisted && (assisted.mistakes > 0 || assisted.hints > 0 || assisted.independent === false), 'a wrong first answer never becomes clean independent evidence');
  assert.ok(saved.events.some(event => event.skill === 'write' && event.writingReviewed === true), 'writing records adult review separately');
  assert.match(await app.page.locator('#learningSummary').innerText(), /hatır|tekrar|sonra|yarın/iu, 'the session explains a future return to learning');
  await press(app, '[data-learning="parent"]');
  const report = app.page.locator('.learn-word-report').filter({ has: app.page.locator('summary strong').filter({ hasText: exactText(first.word) }) });
  await press(app, report.locator('summary'));
  assert.ok(await report.locator('.learn-skill-grid small').count(), 'actual per-skill review times are shown to the parent');
  assert.doesNotMatch(await report.innerText(), /kesin öğrendi|kalıcı öğrendi|asla unutmaz/iu, 'a first session does not claim permanent mastery');
});

scenario('writing rotation: no scroll, empty/retry review and controls remain reachable', async app => {
  await begin(app);
  for (let index = 0; index < 12; index++) {
    const task = await currentTask(app);
    if (task.kind === 'write') break;
    await solveTask(app, task);
    await press(app, '#learningNext');
  }
  assert.equal((await currentTask(app)).kind, 'write', 'the connected session reaches its actual writing task');
  await press(app, '[data-learning="review"]');
  assert.equal(await app.page.locator('#learningReview').isVisible(), false, 'empty writing cannot open adult approval');
  const initialViewport = app.page.viewportSize();
  await app.page.setViewportSize({ width: initialViewport.height, height: initialViewport.width });
  await app.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  for (const selector of ['#learningPad', '#learningNext', '[data-learning="review"]', '[data-learning="home"]']) {
    const visible = await app.page.locator(selector).first().evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.top >= -1 && rect.left >= -1 && rect.bottom <= innerHeight + 1 && rect.right <= innerWidth + 1;
    });
    assert.equal(visible, true, `${selector} remains reachable after tablet rotation`);
  }
  await drawInk(app);
  await press(app, '[data-learning="review"]');
  await app.page.locator('#learningReview').waitFor({ state: 'visible' });
  await press(app, '[data-learning="retry-writing"]');
  assert.equal(await app.page.locator('#learningNext').isEnabled(), false, 'choosing to retry is not a writing approval');
  await press(app, '[data-learning="clear"]');
  await press(app, '[data-learning="review"]');
  assert.equal(await app.page.locator('#learningReview').isVisible(), false, 'cleared ink cannot be reviewed as completed writing');
  await drawInk(app);
  await press(app, '[data-learning="review"]');
  await press(app, '[data-learning="approve"]');
  assert.equal(await app.page.locator('#learningNext').isEnabled(), true);
  await press(app, '[data-learning="home"]');
  await app.page.locator('.games').waitFor();
  assert.equal(await app.page.locator('body').evaluate(body => body.classList.contains('writing-focus')), false, 'leaving the notebook restores ordinary page scrolling');
});

scenario('story scene: character controls do not complete tasks or reveal the listening answer', async app => {
  await begin(app);
  const task = await currentTask(app);
  assert.equal(task.kind, 'listen');
  const scene = app.page.locator('.story-scene');
  await scene.waitFor();
  const before = await scene.getAttribute('data-story-completed');
  const moving = app.page.locator('.story-drifting-letter').first();
  assert.ok(await moving.evaluate(element => element.getAnimations().some(animation => animation.playState === 'running')), 'the original scene has real running animation');
  const sceneText = await app.page.locator('.story-scene-caption').innerText();
  const escapedWord = task.word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  assert.doesNotMatch(sceneText.toLocaleLowerCase('tr-TR'), new RegExp(`(?<!\\p{L})${escapedWord}(?!\\p{L})`, 'u'), 'the scene caption does not print the answer to a listening task');
  if (await app.page.locator('#learningModel').count()) assert.equal(await app.page.locator('#learningModel').isVisible(), false);
  for (const action of ['listen', 'motion', 'help', 'dialogue']) {
    await press(app, `[data-story-action="${action}"]`);
    assert.equal((await currentTask(app)).id, task.id, `${action} is not task completion`);
    assert.equal(await scene.getAttribute('data-story-completed'), before, `${action} cannot advance the story`);
    assert.equal(await app.page.locator('#learningNext').isEnabled(), false);
  }
  assert.ok(await moving.evaluate(element => element.getAnimations().every(animation => animation.playState === 'paused')), 'the motion control pauses the scene animation');
  await app.page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await app.page.locator('[data-story-action="motion"]').isVisible(), false, 'reduced-motion preference removes the animation control');
  assert.equal(await moving.evaluate(element => element.getAnimations().length), 0, 'reduced-motion preference actually disables animation');
  await solveTask(app, task);
  assert.equal(Number(await scene.getAttribute('data-story-completed')), Number(before) + 1, 'actual correct work advances the scene success count');
  assert.equal((await currentTask(app)).id, task.id, 'a correct task still waits for the child’s explicit continuation');
  await press(app, '#learningNext');
  assert.notEqual((await currentTask(app)).id, task.id);
  assert.equal(Number(await app.page.locator('.story-scene').getAttribute('data-story-completed')), Number(before) + 1, 'a genuinely completed task advances the story');
});

scenario('unavailable Turkish audio: adult support works and cannot earn independent listening credit', async app => {
  await begin(app);
  const task = await currentTask(app);
  assert.equal(task.kind, 'listen');
  await listen(app);
  assert.match(await app.page.locator('#learningFeedback').innerText(), /Türkçe sesi.*çalınamadı/u, 'the child is told when the target cannot be heard');
  const correct = app.page.locator('[data-learning="choice"]').filter({ hasText: exactText(task.target) });
  await press(app, correct);
  assert.equal(await app.page.locator('#learningNext').isEnabled(), false, 'silently guessing a card is not a listening completion');
  await press(app, '[data-learning="adult-read"]');
  await press(app, correct);
  assert.equal(await app.page.locator('#learningNext').isEnabled(), true);
  const evidence = (await snapshot(app.page)).events.find(event => event.id === task.id);
  assert.ok(evidence?.correct && evidence.hints > 0 && evidence.independent === false, 'adult-read fallback is recorded as assisted evidence');
  assert.deepEqual(await app.page.evaluate(() => window.__testSpeechCalls), [], 'an English-only device is never used to read Turkish learning content');
  await press(app, '#learningNext');
  assert.notEqual((await currentTask(app)).id, task.id, 'learning continues safely when Turkish audio is unavailable');
}, { englishOnlyVoice: true });

scenario('delayed letter review: one slot, actual distractors and a resumable reviewed letter', async app => {
  await begin(app);
  for (let index = 0; index < 4; index++) {
    await solveTask(app, await currentTask(app));
    await press(app, '#learningNext');
  }
  // Advance the environment clock, never the application's tasks or evidence.
  // The earlier observations above were produced entirely through real UI work.
  await app.page.clock.setFixedTime(new Date(Date.now() + 12 * 60000));
  await press(app, '[data-learning="home"]');
  await enter(app, true);
  await press(app, '[data-learning="save-list"]');
  await press(app, '[data-learning="start"]');
  if (await app.page.locator('[data-learning="begin-tasks"]').count()) await press(app, '[data-learning="begin-tasks"]');
  let task = await currentTask(app);
  for (let index = 0; index < 8 && task.word.length !== 1; index++) {
    await solveTask(app, task);
    await press(app, '#learningNext');
    task = await currentTask(app);
  }
  assert.equal(task.kind, 'build');
  assert.equal(task.word.length, 1, 'a due studied letter really returns inside the story');
  assert.equal(await app.page.locator('.learn-slot').count(), 1);
  assert.ok(await app.page.locator('[data-learning="tile"]').count() >= 2, 'letter practice offers actual alternatives');
  await app.page.reload();
  await app.page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
  await begin(app);
  assert.equal((await currentTask(app)).id, task.id, 'a known single-letter task survives reload without resetting the journey');
  await listen(app);
  await press(app, app.page.locator('[data-learning="tile"]').filter({ hasText: exactText(task.word) }).first());
  assert.equal(await app.page.locator('#learningNext').isEnabled(), true, 'one correct letter completes the one-slot task');
  const saved = await snapshot(app.page);
  assert.ok((saved.progress[task.word]?.build?.independentDays.length || 0) <= 1, 'a short clock interval cannot claim next-day retention');
});

scenario('meaning assistance: the story uses a real definition and records adult help separately', async app => {
  await enter(app, true);
  await app.page.locator('#learningWords').fill('nane\nanne');
  await press(app, '[data-learning="save-list"]');
  await press(app, '.learn-authoring summary');
  for (const word of ['nane', 'anne']) await app.page.locator(`[data-word="${word}"] [data-detail="sentence"]`).fill('');
  await press(app, '[data-learning="save-details"]');
  await press(app, '[data-learning="start"]');
  await press(app, '[data-learning="begin-tasks"]');
  for (let index = 0; index < 7; index++) {
    await solveTask(app, await currentTask(app));
    await press(app, '#learningNext');
  }
  const task = await currentTask(app);
  assert.equal(task.kind, 'meaning');
  await press(app, '[data-story-action="help"]');
  assert.equal(await app.page.locator('#learningModel').innerText(), task.meaning, 'help explains the meaning rather than falsely claiming to open an absent model');
  await solveTask(app, task);
  const event = (await snapshot(app.page)).events.find(item => item.id === task.id);
  assert.ok(event.correct && event.hints > 0 && event.independent === false);
});

scenario('resume: home and browser reload preserve the exact connected task', async app => {
  await begin(app);
  const first = await currentTask(app);
  await solveTask(app, first);
  await press(app, '#learningNext');
  const second = await currentTask(app);
  assert.notEqual(second.id, first.id);
  await press(app, '[data-learning="pause"]');
  await press(app, '[data-learning="resume"]');
  assert.equal((await currentTask(app)).id, second.id, 'a break retains the same task');
  await press(app, '[data-learning="home"]');
  await app.page.locator('.games').waitFor();
  await app.page.reload();
  await app.page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
  await begin(app);
  assert.equal((await currentTask(app)).id, second.id, 'reload resumes the saved index rather than creating an unrelated lesson');
  const ids = (await snapshot(app.page)).events.map(event => event.id);
  assert.equal(new Set(ids).size, ids.length, 'navigation and resume do not duplicate learning evidence');
});

scenario('existing learning areas remain reachable after an adaptive session is paused', async app => {
  await begin(app);
  await press(app, '[data-learning="home"]');
  await app.page.locator('.games').waitFor();
  for (const view of ['letters', 'syllables', 'words', 'reading', 'sentences', 'numbers']) {
    await press(app, `[data-do="catalog"][data-view="${view}"]`);
    assert.ok(await app.page.locator('#main .grid').count(), `${view} still contains its actual exercises`);
    await press(app, '#main [data-do="home"]');
    await app.page.locator('.games').waitFor();
  }
  await enter(app);
  await press(app, '[data-learning="start"]');
  await app.page.locator('#learning[data-screen="task"]').waitFor();
});

(async () => {
  const { server, url } = await startServer();
  let browser;
  let runs = 0;
  let failures = 0;
  try {
    browser = await getPlaywright().chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || (fs.existsSync(matchingChromium) ? matchingChromium : undefined),
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
      ...(process.env.TEST_PROXY_SERVER ? { proxy: { server: process.env.TEST_PROXY_SERVER } } : {}),
    });
    for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }].filter(value => !process.env.TEST_VIEWPORT || process.env.TEST_VIEWPORT === `${value.width}x${value.height}`)) {
      for (const item of cases.filter(value => !process.env.TEST_FILTER || value.name.includes(process.env.TEST_FILTER))) {
        const app = await open(browser, process.env.TEST_BASE_URL || url, viewport, item.browserOptions);
        app.page.setDefaultTimeout(10000);
        runs++;
        try {
          await item.run(app);
          await assertClean(app.page, app.errors);
          console.log(`PASS ${viewport.width}x${viewport.height} ${item.name}`);
        } catch (error) {
          failures++;
          console.error(`FAIL ${viewport.width}x${viewport.height} ${item.name}\n${error.stack}`);
          fs.mkdirSync(artifactDirectory, { recursive: true });
          await app.page.screenshot({ path: path.join(artifactDirectory, `${viewport.width}-${runs}-failure.png`), fullPage: true });
        } finally {
          await app.context.close();
        }
      }
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
  console.log(`${runs - failures}/${runs} adaptive-learning tablet scenarios passed. Chromium touch emulation; physical iPad, WebKit and audible speech unverified.`);
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
