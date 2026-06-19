// Visual review for player-side UI/cannon visuals: worker (wallet) button states,
// cat cannon button + firing animation + traveling wave, and the BASE_WALL entity.
import { launch, newApp, startBattle, produceLoop } from './visual-harness.mjs';

const OUT = 'tmp/visual-shots';
const log = (...a) => console.log('[ui]', ...a);

const browser = await launch();
const { page, errors } = await newApp(browser, {});
await startBattle(page);
await page.waitForTimeout(800);

// crop helper for bottom-left wallet and bottom-right cannon button
const clipWallet = { x: 0, y: 700, width: 300, height: 120 };
const clipCannon = { x: 900, y: 690, width: 280, height: 130 };

// ---- wallet button states ----
async function setWallet(state) {
  return page.evaluate((s) => {
    const e = globalThis.__APP__?.battleScene?.economy;
    if (!e) return { error: 'no-economy' };
    if (s === 'unaffordable') { e.internalMoney = 0; e.money = 0; }
    if (s === 'affordable') { const cost = e.upgradeCost > 0 ? e.upgradeCost : 1000; e.money = cost + 2000; e.internalMoney = (cost + 2000) * 100; }
    if (s === 'lv8') { e.walletLevel = e.walletMaxLevel; e.money = e.maxMoney; e.internalMoney = e.maxMoney * 100; }
    return { state: s, money: e.money, walletLevel: e.walletLevel, max: e.walletMaxLevel, upgradeCost: e.upgradeCost };
  }, state);
}
for (const s of ['unaffordable', 'affordable', 'lv8']) {
  const info = await setWallet(s);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/ui-wallet-${s}.png` });
  await page.screenshot({ path: `${OUT}/ui-wallet-${s}-crop.png`, clip: clipWallet });
  log('wallet', s, JSON.stringify(info));
}

// ---- cat cannon button (ready) + fire ----
const cannonStatusBefore = await page.evaluate(() => {
  const scene = globalThis.__APP__?.battleScene;
  if (scene?.bcuCatCannon) { scene.bcuCatCannon.cannon = scene.bcuCatCannon.maxCannon; }
  return scene?.getCatCannonStatus?.() || null;
});
log('cannon status (forced full):', JSON.stringify(cannonStatusBefore));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/ui-cannon-ready.png`, clip: clipCannon });

// fire and capture the BASE firing animation + traveling wave over frames
const fire = await page.evaluate(() => globalThis.__APP__?.battleScene?.requestCatCannonFire?.());
log('fire result:', fire);
for (let i = 0; i < 10; i += 1) {
  await page.waitForTimeout(120);
  const st = await page.evaluate(() => {
    const scene = globalThis.__APP__?.battleScene;
    return {
      effects: [...new Set((scene?.effects || []).map((e) => e.type))],
      cannonEffects: (scene?.effects || []).filter((e) => /cannon|wave|canon/i.test(String(e.type))).length,
      baseAnim: !!scene?.lastCatCannonFireEffect,
      waveAnim: !!scene?.lastCatCannonWaveEffect,
    };
  });
  await page.screenshot({ path: `${OUT}/ui-cannon-fire-${String(i).padStart(2, '0')}.png` });
  if (i === 0 || st.cannonEffects) log('fire frame', i, JSON.stringify(st));
}

// ---- BASE_WALL entity (Form 339) ----
const wall = await page.evaluate(async () => {
  const scene = globalThis.__APP__?.battleScene;
  if (typeof scene?.spawnBcuCannonWall !== 'function') return { error: 'no-wall-method' };
  // attempt spawn; retry-less single call returns null while template loads
  const r1 = scene.spawnBcuCannonWall(2400, { aliveFrames: 600 });
  return { spawned: !!r1, lastSpawn: scene.lastCatCannonWallSpawn || null };
});
log('wall spawn attempt:', JSON.stringify(wall));
// give the template time to load, then retry
let wallShot = null;
for (let i = 0; i < 30; i += 1) {
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const scene = globalThis.__APP__?.battleScene;
    const w = (scene?.actors || []).find((a) => a.bcuCatCannonWall === true);
    if (!w) { scene.spawnBcuCannonWall?.(2400, { aliveFrames: 600 }); return { present: false, lastSpawn: scene.lastCatCannonWallSpawn || null }; }
    return { present: true, x: Math.round(w.x), hp: Math.round(w.hp), state: w.state };
  });
  if (r.present) {
    await page.waitForTimeout(400);
    wallShot = `${OUT}/ui-base-wall.png`;
    await page.screenshot({ path: wallShot });
    log('wall present:', JSON.stringify(r), '->', wallShot);
    break;
  }
}
if (!wallShot) log('wall never appeared; lastSpawn diag captured');

console.log('\n===== UI RESULTS =====');
console.log('errors:', JSON.stringify(errors.slice(0, 8)));
await browser.close();
