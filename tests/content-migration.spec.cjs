const fs = require('node:fs');
const path = require('node:path');
const { assert, getPlaywright, startServer, ensureChildProfile, touch, assertClean } = require('./helpers.cjs');

const browserName = process.env.TEST_BROWSER || 'chromium';
const viewports = process.env.TEST_VIEWPORT
  ? process.env.TEST_VIEWPORT.split(',').map(value => {
    assert.match(value, /^\d+x\d+$/);
    const [width, height] = value.split('x').map(Number);
    return { width, height };
  }) : [{ width: 390, height: 660 }];
const artifacts = process.env.TEST_ARTIFACT_DIR || path.resolve(__dirname, '../test-results/content-migration');
const chromiumPath = '/workspace/.browser-cache/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell';

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
  await ensureChildProfile(app.page);
  if (process.env.TEST_EXPECTED_VERSION) assert.equal(await app.page.evaluate(() => window.HARF_ADASI_VERSION), process.env.TEST_EXPECTED_VERSION);
}
async function stored(page, key) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), key);
}
async function active(page, kind) {
  const saved = await stored(page, 'harf-adasi-quests-v1');
  assert.equal(saved?.version, 1);
  assert.equal(saved.active?.kind, kind);
  return saved.active;
}
async function enter(app, kind) {
  await press(app, `[data-do="quest-start"][data-quest-kind="${kind}"]`);
  await app.page.locator(`#quest[data-screen="task"][data-kind="${kind}"]`).waitFor();
  assert.equal(await app.page.locator('#questNext').isEnabled(), false, 'a served unanswered target is not a success');
  return active(app.page, kind);
}
async function noAwards(page) {
  const history = await stored(page, 'harf-adasi-quests-v1');
  const learning = await stored(page, 'harf-adasi-learning-v1');
  assert.deepEqual(history.runs, [], 'upgrading a saved plan cannot award a completed tour');
  assert.deepEqual(learning?.events || [], [], 'exposure migration creates no learning success or attempt');
  assert.equal(await page.locator('#badge').innerText(), '0');
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
        const original = await enter(app, 'words');
        const target = original.plan.stages[0].word;
        assert.ok(target);
        assert.equal(original.index, 0);
        assert.deepEqual(original.answers, []);
        assert.equal(original.ui.correct, false);
        await noAwards(page);
        await press(app, '.quest-nav [data-quest="home"]');
        await page.locator('.quest-world-portal').first().waitFor();

        // Compatibility fixture only: downgrade the plan that the actual UI
        // just created. No answer, ink, result, progress or success is added.
        // The old application had neither contentPools nor a selection store.
        await page.evaluate(id => {
          const key = 'harf-adasi-quests-v1';
          const saved = JSON.parse(localStorage.getItem(key));
          if (saved.active?.plan?.id !== id) throw new Error('Actual saved plan changed before the migration fixture');
          delete saved.active.plan.contentPools;
          localStorage.setItem(key, JSON.stringify(saved));
          localStorage.removeItem('harf-adasi-content-v1');
        }, original.plan.id);

        await ready(app, url);
        const resumed = await enter(app, 'words');
        assert.equal(resumed.plan.id, original.plan.id, 'upgrade preserves the actual old plan id');
        assert.equal(resumed.index, original.index);
        assert.deepEqual(resumed.answers, original.answers, 'old unanswered work cannot become answered during hydration');
        assert.equal(resumed.ui.correct, false);
        assert.ok(Array.isArray(resumed.plan.contentPools?.words) && resumed.plan.contentPools.words.includes(target), 'old plans receive valid content pools while retaining their actual tasks');
        const migrated = await stored(page, 'harf-adasi-content-v1');
        assert.equal(migrated?.version, 1);
        assert.deepEqual(Object.keys(migrated.domains.words.items), [target], 'only the displayed current word is exposed; unplayed planned words are not seeded as seen');
        assert.ok(migrated.visits.includes(`words:${original.plan.stages[0].id}`), 'the stable actual stage id guards migration against duplicate exposure');
        await noAwards(page);
        if (process.env.CONTENT_SCREENSHOTS === '1') {
          fs.mkdirSync(artifacts, { recursive: true });
          await page.screenshot({ path: path.join(artifacts, `${browserName}-${viewport.width}-resumed.png`) });
        }

        await ready(app, url);
        const twice = await enter(app, 'words');
        assert.equal(twice.plan.id, original.plan.id);
        assert.deepEqual(twice.answers, original.answers);
        assert.deepEqual(await stored(page, 'harf-adasi-content-v1'), migrated, 'another reload/resume does not consume another selection visit');
        await noAwards(page);
        await press(app, '.quest-nav [data-quest="home"]');
        await page.locator('.quest-world-portal').first().waitFor();
        const other = await enter(app, 'syllables');
        assert.notEqual(other.plan.stages[0].word, target, 'switching to another eligible world retains the migrated vocabulary exposure instead of restarting the first word');
        assert.ok(other.plan.stages[0].word, 'the second world uses a real different teacher word');
        await noAwards(page);
        await assertClean(page, errors);
        passed++;
        console.log(`PASS ${browserName} ${viewport.width}x${viewport.height} old-plan migration: same unanswered plan, actual-target hydration, repeat-resume dedupe and cross-world variety without awards`);
      } catch (error) {
        console.error(`FAIL ${browserName} ${viewport.width}x${viewport.height} content migration\n${error.stack}`);
        fs.mkdirSync(artifacts, { recursive: true });
        await page.screenshot({ path: path.join(artifacts, `${browserName}-${viewport.width}-failure.png`), fullPage: true });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); if (service) await new Promise(resolve => service.server.close(resolve)); }
  console.log(`${passed}/${viewports.length} content-migration scenarios passed (${browserName}); physical iPhone unverified.`);
  if (passed !== viewports.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
