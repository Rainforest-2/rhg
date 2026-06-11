import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text().slice(0, 300)); });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.apply-battle-button', { timeout: 120000 });
await page.waitForTimeout(2000);
const state = await page.evaluate(() => ({
  bootErrors: globalThis.__BATTLE_BOOT_PATCH_ERRORS__ || null,
  immunity: globalThis.__BCU_PROC_IMMUNITY_PATCH_DEBUG__ || null,
  testHook: typeof globalThis.__BCU_TEST_APPLY_STATUS__
}));
console.log(JSON.stringify(state, null, 1));
console.log('console warnings/errors:', JSON.stringify(warns.slice(0, 20), null, 1));
await browser.close();
