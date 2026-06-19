// Corrective capture: barrier(364)/demon-shield(554) flash effects appear only when
// the enemy is HIT, so deploy player units and poll effects at high frequency, then
// screenshot the moment a 'barrier'/'demonShield' priority effect is present. Also
// probe enemy 774's runtime combat model and try to catch the A_E_DELAY effect.
import { launch, newApp, startBattle, produceLoop } from './visual-harness.mjs';

const OUT = 'tmp/visual-shots';
const log = (...a) => console.log('[bsd]', ...a);
const GROUND_CROP = { x: 220, y: 360, width: 740, height: 440 };

async function spawnEnemy(page, enemyId, x, { tanky = false } = {}) {
  let r = { ok: false };
  for (let i = 0; i < 40 && !r.ok; i += 1) {
    r = await page.evaluate(async ({ id, x, tanky }) => {
      const scene = globalThis.__APP__?.battleScene;
      const mod = await import('/js/battle/BcuStageEnemyResolver.js');
      const row = { enemyId: id, rowIndex: 99, magnification: 100, hpMagnification: 100, attackMagnification: 100, count: 1, startFrame: 0, respawnMinFrames: 999999, respawnMaxFrames: 999999, layerMin: 5, layerMax: 9, isBoss: false };
      const def = mod.buildStageEnemyUnitDef(row);
      const ok = scene.spawnStageEnemy(def, row);
      for (const b of scene.bases || []) if (b.side === 'dog-player') b.hp = Math.max(b.hp, 9_999_999);
      if (ok) {
        const e = (scene.actors || []).find((a) => String(a.slotId || '').includes(String(id)));
        if (e) {
          if (Number.isFinite(x)) e.x = x;
          if (tanky) { e.hp = 200000; e.maxHp = Math.max(e.maxHp || 0, 200000); }
        }
      }
      return { ok, slotId: def.slotId };
    }, { id: enemyId, x, tanky });
    if (!r.ok) await page.waitForTimeout(500);
  }
  return r;
}

const browser = await launch();
const results = {};

// barrier + demon shield : high-frequency effect capture during combat
for (const [key, id] of [['barrier', 362], ['demon-shield', 552]]) {
  const { page } = await newApp(browser, {});
  await startBattle(page);
  await produceLoop(page, 5, 250); // build up an attacking line first
  const spawn = await spawnEnemy(page, id, 2300, { tanky: true });
  log(key, 'spawn', spawn.ok);
  let caught = null;
  const end = Date.now() + 45000;
  while (Date.now() < end && !caught) {
    await page.evaluate(() => {
      const b = document.querySelector('.prod-card.is-front:not(.is-disabled)');
      if (b) { b.click(); }
    });
    const st = await page.evaluate((tgt) => {
      const scene = globalThis.__APP__?.battleScene;
      const fx = (scene?.effects || []);
      const present = fx.filter((e) => e.type === tgt).map((e) => ({ type: e.type, phase: e.phase || e.bcuPhase || null }));
      const e = (scene?.actors || []).find((a) => String(a.slotId || '').includes(String(tgt === 'barrier' ? 362 : 552)));
      return { present, allTypes: [...new Set(fx.map((x) => x.type))], enemyBarrier: e?.bcuBarrierHp ?? null, enemyShield: e?.bcuDemonShieldHp ?? null, state: scene?.battleState };
    }, key === 'barrier' ? 'barrier' : 'demonShield');
    if (st.present.length) {
      caught = st;
      await page.screenshot({ path: `${OUT}/enemy-${key}-flash.png` });
      await page.screenshot({ path: `${OUT}/enemy-${key}-flash-crop.png`, clip: GROUND_CROP });
      log(key, 'FLASH caught', JSON.stringify(st.present), 'barrierHp', st.enemyBarrier, 'shieldHp', st.enemyShield);
    }
    if (st.state !== 'running') break;
    await page.waitForTimeout(60);
  }
  if (!caught) {
    await page.screenshot({ path: `${OUT}/enemy-${key}-nocatch.png`, clip: GROUND_CROP });
    const types = await page.evaluate(() => [...new Set((globalThis.__APP__?.battleScene?.effects || []).map((e) => e.type))]);
    log(key, 'no flash caught; effect types seen recently:', JSON.stringify(types));
  }
  results[key] = { spawn, caught };
  await page.close();
}

// delay : probe runtime model + catch A_E_DELAY
{
  const { page } = await newApp(browser, {});
  await startBattle(page);
  await produceLoop(page, 5, 250);
  const spawn = await spawnEnemy(page, 772, 2300, { tanky: true });
  const model = await page.evaluate(() => {
    const scene = globalThis.__APP__?.battleScene;
    const e = (scene?.actors || []).find((a) => String(a.slotId || '').includes('772'));
    const cm = e?.bcuCombatModel || e?.rawStats?.bcuCombatModel || null;
    return { delay: cm?.proc?.delay || null, slot: e?.slotId || null, hp: e?.hp ?? null };
  });
  log('delay enemy 772 runtime model:', JSON.stringify(model));
  let caught = null;
  const end = Date.now() + 40000;
  while (Date.now() < end && !caught) {
    await page.evaluate(() => { const b = document.querySelector('.prod-card.is-front:not(.is-disabled)'); if (b) b.click(); });
    const st = await page.evaluate(() => {
      const scene = globalThis.__APP__?.battleScene;
      const fx = scene?.effects || [];
      const delayFx = fx.filter((e) => /delay/i.test(String(e.type)));
      return { delayFx: delayFx.map((e) => e.type), allTypes: [...new Set(fx.map((x) => x.type))], state: scene?.battleState };
    });
    if (st.delayFx.length) {
      caught = st;
      await page.screenshot({ path: `${OUT}/enemy-delay-flash.png` });
      await page.screenshot({ path: `${OUT}/enemy-delay-flash-crop.png`, clip: GROUND_CROP });
      log('delay FLASH caught', JSON.stringify(st.delayFx));
    }
    if (st.state !== 'running') break;
    await page.waitForTimeout(60);
  }
  if (!caught) { await page.screenshot({ path: `${OUT}/enemy-delay-nocatch.png`, clip: GROUND_CROP }); log('delay no flash caught'); }
  results.delay = { spawn, model, caught };
  await page.close();
}

console.log('\n===== BSD RESULTS =====');
console.log(JSON.stringify(results, null, 1));
await browser.close();
