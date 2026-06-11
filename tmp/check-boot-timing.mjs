import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text().slice(0, 200)}`));
await page.addInitScript(() => {
  try { localStorage.setItem('bcu.selectedStageId', 'stage:120400:CA/StageRCA/stageRCA007_00'); } catch {}
});
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.apply-battle-button', { timeout: 120000 });
await page.waitForTimeout(1500);
const before = await page.evaluate(() => ({
  immunity: globalThis.__BCU_PROC_IMMUNITY_PATCH_DEBUG__?.installed === true,
  testHook: typeof globalThis.__BCU_TEST_APPLY_STATUS__,
  bootErrors: (globalThis.__BATTLE_BOOT_PATCH_ERRORS__ || []).length
}));
console.log('before battle:', JSON.stringify(before));
await page.click('.apply-battle-button');
await page.waitForFunction(() => {
  const app = globalThis.__APP__ || globalThis.app;
  return !!(app?.sceneReady && app?.battleScene);
}, null, { timeout: 180000 });
await page.waitForTimeout(1000);
const after = await page.evaluate(() => ({
  immunity: globalThis.__BCU_PROC_IMMUNITY_PATCH_DEBUG__?.installed === true,
  testHook: typeof globalThis.__BCU_TEST_APPLY_STATUS__,
  bootErrors: globalThis.__BATTLE_BOOT_PATCH_ERRORS__ || null,
  href: location.href
}));
console.log('after battle:', JSON.stringify(after));
console.log('console tail:', JSON.stringify(logs.slice(-25), null, 1));
await browser.close();
