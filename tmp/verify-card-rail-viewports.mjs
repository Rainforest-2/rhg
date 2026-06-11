import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const vp of [{ w: 844, h: 390, name: 'phone-landscape' }, { w: 1180, h: 820, name: 'ipad-landscape' }, { w: 1920, h: 1080, name: 'pc' }]) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.apply-battle-button', { timeout: 120000 });
  await page.waitForTimeout(1200);
  await page.click('.apply-battle-button');
  await page.waitForFunction(() => !!(globalThis.__APP__?.sceneReady && globalThis.__APP__?.battleScene), null, { timeout: 180000 });
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => {
    const cards = document.querySelector('.prod-ui .cards');
    const panel = document.querySelector('.canvas-panel') || document.body;
    const cb = cards.getBoundingClientRect();
    const pb = panel.getBoundingClientRect();
    return {
      delta: Math.round((cb.left + cb.width / 2) - (pb.left + pb.width / 2)),
      left: Math.round(cb.left),
      right: Math.round(cb.right),
      bottomGap: Math.round(innerHeight - cb.bottom),
      width: Math.round(cb.width),
      clippedLeft: cb.left < 0,
      clippedRight: cb.right > innerWidth
    };
  });
  console.log(vp.name, `${vp.w}x${vp.h}`, JSON.stringify(m));
  await page.screenshot({ path: `/workspaces/game/tmp/verify-shots/cards-${vp.name}.png` });
  await page.close();
}
await browser.close();
