import { createRequire } from 'node:module';
import { createServer as createNetServer } from 'node:net';
import { mkdir } from 'node:fs/promises';
import { createServer as createViteServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const outDir = 'docs/community-stage-phase0-baseline-2026-07-24/screenshots';

const listenPort = await new Promise((resolve, reject) => {
  const probe = createNetServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    probe.close((error) => error ? reject(error) : resolve(address.port));
  });
});

await mkdir(outDir, { recursive: true });
const server = await createViteServer({
  root: process.cwd(), logLevel: 'error',
  server: { host: '127.0.0.1', port: listenPort, strictPort: true }
});
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

async function openCustomStageBuilder() {
  await page.locator('[data-action="stage-open"]').click();
  await page.locator('[data-custom-stage-category]').click();
  await page.locator('[data-custom-builder-new]').click();
  await page.waitForSelector('.formation-custom-builder-screen', { state: 'visible' });
}

try {
  await page.goto(`http://127.0.0.1:${listenPort}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.formation-ui', { state: 'visible', timeout: 90000 });
  await page.waitForFunction(() => !!globalThis.__BCU_DB__, null, { timeout: 90000 });
  await page.screenshot({ path: `${outDir}/existing-start-screen-desktop.png`, fullPage: false });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${outDir}/existing-start-screen-ipad-1024x768.png`, fullPage: false });
  await openCustomStageBuilder();
  await page.screenshot({ path: `${outDir}/custom-stage-editor-ipad-1024x768.png`, fullPage: false });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${outDir}/custom-stage-editor-ipad-768x1024.png`, fullPage: false });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.formation-ui', { state: 'visible', timeout: 90000 });
  await page.evaluate(() => globalThis.dispatchEvent(new Event('offline')));
  await page.screenshot({ path: `${outDir}/existing-start-screen-offline-event.png`, fullPage: false });
  console.log(JSON.stringify({ ok: errors.length === 0, errors, url: page.url() }, null, 2));
} finally {
  await page.close();
  await browser.close();
  await server.close();
}
