import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer as createNetServer } from 'node:net';
import { createServer as createViteServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_REQUIRE || 'playwright');
const outDir = 'screenshots';
const viewports = [
  [320, 568, null],
  [1280, 900, 'community-home-desktop.png'],
  [1024, 768, 'community-home-ipad-1024x768.png'],
  [768, 1024, 'community-home-ipad-768x1024.png'],
  [390, 844, 'community-home-phone-390x844.png'],
  [667, 320, 'community-home-landscape-667x320.png']
];

async function findPort() {
  return await new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address()?.port;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

const port = await findPort();
await mkdir(outDir, { recursive: true });
const server = await createViteServer({ root: process.cwd(), logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ headless: true });
const url = `http://127.0.0.1:${port}/`;

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const requests = [];
  const pageErrors = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('[data-community-home="phase-2"]', { state: 'visible', timeout: 90000 });
  assert.equal(await page.locator('.formation-ui').count(), 0, 'home must not construct the editor before Play');
  for (const [width, height, filename] of viewports) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(80);
    const metrics = await page.evaluate(() => {
      const button = document.querySelector('[data-community-play]')?.getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth - innerWidth, button: button && { top: button.top, bottom: button.bottom, left: button.left, right: button.right } };
    });
    assert.ok(metrics.overflow <= 1, `${filename}: no horizontal overflow`);
    assert.ok(metrics.button && metrics.button.top >= 0 && metrics.button.bottom <= height && metrics.button.left >= 0 && metrics.button.right <= width, `${filename}: Play is reachable`);
    if (filename) await page.screenshot({ path: `${outDir}/${filename}`, fullPage: false });
  }
  await page.evaluate(() => globalThis.dispatchEvent(new Event('offline')));
  await page.screenshot({ path: `${outDir}/community-home-offline.png`, fullPage: false });
  if (process.env.COMMUNITY_HOME_BROWSER_MODE === 'home-only') {
    assert.deepEqual(requests.filter((requestUrl) => /\/api\//.test(requestUrl)), [], 'Phase 2 emits no community API requests');
    assert.deepEqual(pageErrors, [], `browser errors: ${pageErrors.join('\n')}`);
    await context.close();
    console.log('check-community-home-browser: home-only OK');
  } else {
  await page.locator('[data-community-play]').click();
  await page.waitForSelector('.formation-ui', { state: 'visible', timeout: 90000 });
  await page.waitForSelector('[data-action="stage-open"]', { state: 'visible', timeout: 30000 });
  assert.equal(await page.locator('[data-community-home="phase-2"]').isHidden(), true, 'hidden home cannot block legacy play');
  assert.equal(await page.locator('canvas#preview-canvas').count(), 1, 'canvas remains singular');
  assert.equal(await page.locator('.formation-ui').count(), 1, 'rapid play cannot create a second editor');
  await page.locator('[data-action="stage-open"]').click();
  await page.waitForSelector('[data-custom-stage-category]', { state: 'visible', timeout: 30000 });
  await page.screenshot({ path: `${outDir}/community-home-to-legacy-play.png`, fullPage: false });
  assert.deepEqual(requests.filter((requestUrl) => /\/api\//.test(requestUrl)), [], 'Phase 2 emits no community API requests');
  assert.deepEqual(pageErrors, [], `browser errors: ${pageErrors.join('\n')}`);
  await context.close();

  const legacyContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await legacyContext.addInitScript(() => { globalThis.__RHG_COMMUNITY_FEATURE_FLAGS__ = { communityHome: false }; });
  const legacyPage = await legacyContext.newPage();
  await legacyPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await legacyPage.waitForSelector('.formation-ui', { state: 'visible', timeout: 90000 });
  assert.equal(await legacyPage.locator('[data-community-home="phase-2"]').count(), 0, 'explicit flag-off preserves direct legacy entry');
  await legacyContext.close();
  console.log('check-community-home-browser: OK');
  }
} finally {
  await browser.close();
  await server.close();
}
