// Probe canStartBcuBurrow's rejection reason live while the zombie advances.
import { chromium } from 'playwright';
const log = (...a) => console.log('[verify]', ...a);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.apply-battle-button', { timeout: 120000 });
await page.waitForTimeout(1500);
await page.click('.apply-battle-button');
await page.waitForFunction(() => !!(globalThis.__APP__?.sceneReady && globalThis.__APP__?.battleScene), null, { timeout: 180000 });
await page.waitForTimeout(1000);

let spawn = null;
for (let i = 0; i < 30; i += 1) {
  spawn = await page.evaluate(async () => {
    const scene = globalThis.__APP__?.battleScene;
    const mod = await import('/js/battle/BcuStageEnemyResolver.js');
    const row = { enemyId: 284, rowIndex: 99, magnification: 100, hpMagnification: 100, attackMagnification: 100 };
    const ok = scene.spawnStageEnemy(mod.buildStageEnemyUnitDef(row), row);
    for (const b of scene.bases || []) if (b.side === 'dog-player') b.hp = Math.max(b.hp, 9999999);
    return ok;
  });
  if (spawn) break;
  await page.waitForTimeout(700);
}
log('zombie spawned:', spawn);

const end = Date.now() + 90000;
let last = '';
while (Date.now() < end) {
  const probe = await page.evaluate(async () => {
    const scene = globalThis.__APP__?.battleScene;
    const z = (scene?.actors || []).find((a) => String(a.slotId || '').includes('284') && a.state !== 'dead');
    if (!z) return null;
    const mod = await import('/js/battle/bcu-runtime/BcuBurrowLifecycleRuntime.js');
    const sel = scene.findTargetForActor?.(z) || null;
    const start = mod.canStartBcuBurrow(scene, z, sel?.target || null);
    return {
      t: Math.round((scene.timeMs || 0) / 100) / 10,
      x: Math.round(z.x),
      st: z.state,
      targetType: sel?.targetType || null,
      canAttackTarget: sel ? scene.canAttack?.(z, sel.target) : null,
      burrow: z.bcuBurrow?.phase || null,
      reason: start.ok ? 'OK' : start.reason,
      missing: start.missingAnimations || null,
      base: start.base ? { distance: Math.round(start.base.distance ?? -1), touchBase: start.base.touchBase } : null,
      wrapperName: scene.startActorAttack?.name || null,
      dogCount: (scene.actors || []).filter((a) => a.side === 'dog-player' && a.isAlive?.()).length,
      dogXs: (scene.actors || []).filter((a) => a.side === 'dog-player' && a.isAlive?.()).map((a) => Math.round(a.x)).slice(0, 6),
      money: scene.economy?.money ?? null
    };
  });
  if (probe) {
    const sig = `${probe.st}|${probe.reason}|${probe.burrow}|${probe.canAttackTarget}|${probe.dogCount}`;
    if (sig !== last) { console.log(JSON.stringify(probe)); last = sig; }
    if (probe.burrow) { log('BURROW STARTED'); break; }
  }
  await page.evaluate(() => {
    const scene = globalThis.__APP__?.battleScene;
    if (!scene) return;
    if (scene.economy) { scene.economy.money = 99999; scene.economy.internalMoney = 9999900; }
    const dogs = (scene.actors || []).filter((a) => a.side === 'dog-player' && a.isAlive?.()).length;
    if (dogs < 6) {
      const rows = scene.getPlayerLineupRows?.() || [];
      const row = rows[scene.frontLineup] || rows[0] || [];
      for (const slot of row) { if (slot?.slotId) { scene.requestPlayerSpawn?.(slot.slotId); break; } }
    }
  });
  await page.waitForTimeout(300);
}
await browser.close();
log('done');
