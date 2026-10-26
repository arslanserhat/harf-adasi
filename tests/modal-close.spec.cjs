const fs = require('node:fs');
const path = require('node:path');
const { assert, getPlaywright, startServer } = require('./helpers.cjs');

const chromiumPath = '/workspace/.browser-cache/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell';
const viewports = [{ width: 390, height: 660 }, { width: 1366, height: 768 }];

(async () => {
  const service = process.env.TEST_BASE_URL ? null : await startServer();
  const browser = await getPlaywright().chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || chromiumPath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    ...(process.env.TEST_PROXY_SERVER ? { proxy: { server: process.env.TEST_PROXY_SERVER } } : {}),
  });
  let passed = 0;
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(process.env.TEST_BASE_URL || service.url);
        await page.locator('#ready').filter({ hasText: 'Oyun hazır' }).waitFor();
        await page.evaluate(() => document.fonts.ready);
        for (let opening = 0; opening < 2; opening++) {
          await page.locator('header [data-do="settings"]').tap();
          const dialog = page.locator('#dialog[open]');
          await dialog.waitFor();
          const close = dialog.getByRole('button', { name: 'Kapat', exact: true });
          assert.equal(await close.count(), 1, 'the settings dialog has one accessible close action');
          await close.locator('svg.lucide-x').waitFor();
          const appearance = await close.evaluate(button => ({
            svgCount: button.querySelectorAll('svg').length,
            extraText: [...button.childNodes].filter(node => node.nodeType === Node.TEXT_NODE)
              .map(node => node.textContent).join('').trim(),
            width: button.getBoundingClientRect().width,
            height: button.getBoundingClientRect().height,
          }));
          assert.equal(appearance.svgCount, 1, 'only one close icon is drawn');
          assert.equal(appearance.extraText, '', 'a second textual X is not rendered beside the icon');
          assert.ok(appearance.width >= 44 && appearance.height >= 44, 'the single close button retains its touch target');
          await dialog.evaluate(element => { element.scrollTop = element.scrollHeight; });
          await close.scrollIntoViewIfNeeded();
          assert.equal(await close.evaluate(button => {
            const rect = button.getBoundingClientRect();
            return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1;
          }), true, 'the close target remains reachable after scrolling the long settings dialog');
          await close.tap();
          await page.locator('#dialog').waitFor({ state: 'hidden' });
          assert.equal(await page.locator('header .logo').isVisible(), true, 'closing returns to the underlying page');
        }
        assert.deepEqual(errors, []);
        passed++;
        console.log(`PASS ${viewport.width}x${viewport.height} one settings close icon, 44px touch target, long-dialog scroll and repeated close`);
      } catch (error) {
        console.error(`FAIL ${viewport.width}x${viewport.height}\n${error.stack}`);
        const artifacts = process.env.TEST_ARTIFACT_DIR || path.resolve(__dirname, '../test-results/modal-close');
        fs.mkdirSync(artifacts, { recursive: true });
        await page.screenshot({ path: path.join(artifacts, `failure-${viewport.width}.png`) });
      } finally { await context.close(); }
    }
  } finally {
    await browser.close();
    if (service) await new Promise(resolve => service.server.close(resolve));
  }
  console.log(`${passed}/${viewports.length} settings-close scenarios passed; physical iOS remains unverified.`);
  if (passed !== viewports.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
