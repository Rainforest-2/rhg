// Kill ゾンビワン via the real attack pipeline and observe corpse + revive.
import { chromium } from 'playwright';
const log = (...a) => console.log('[verify]', ...a);
const OUT_DIR = '/workspaces/game/tmp/verify-shots';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
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

// first blocker triggers (and exhausts) the single burrow
const firstBlocker = await page.evaluate(() => {
  const scene = globalThis.__APP__?.battleScene;
  const z = (scene.actors || []).find((a) => String(a.slotId || '').includes('284'));
  if (!z) return { ok: false };
  const rows = scene.getPlayerLineupRows?.() || [];
  const row = rows[scene.frontLineup] || rows[0] || [];
  const slot = row.find((s) => s?.slotId);
  const def = slot ? scene.findPlayerProductionUnit(slot.slotId) : null;
  if (!def) return { ok: false };
  const a = scene.spawnActor(def, 'dog-player', true, { x: z.x + 360 });
  if (a) { a.hp = 99999999; a.maxHp = 99999999; }
  return { ok: !!a };
});
log('first blocker:', JSON.stringify(firstBlocker));

// wait until the burrow has been used up and the zombie surfaced
await page.waitForFunction(() => {
  const scene = globalThis.__APP__?.battleScene;
  const z = (scene?.actors || []).find((a) => String(a.slotId || '').includes('284'));
  return !!z && z.bcuBurrowRemaining === 0 && !z.bcuBurrow;
}, null, { timeout: 60000 });
log('burrow exhausted; placing killer');

const blocker = await page.evaluate(() => {
  const scene = globalThis.__APP__?.battleScene;
  const z = (scene.actors || []).find((a) => String(a.slotId || '').includes('284'));
  if (!z) return { ok: false, reason: 'zombie-missing' };
  const rows = scene.getPlayerLineupRows?.() || [];
  const row = rows[scene.frontLineup] || rows[0] || [];
  const slot = row.find((s) => s?.slotId);
  const def = slot ? scene.findPlayerProductionUnit(slot.slotId) : null;
  if (!def) return { ok: false, reason: 'no-unit-def' };
  const actor = scene.spawnActor(def, 'dog-player', true, { x: z.x + 360 });
  if (!actor) return { ok: false, reason: 'spawn-failed' };
  actor.hp = 99999999; actor.maxHp = 99999999;
  // lower the zombie's HP so normal dog hits kill it; death still resolves
  // through takeDamage -> resolvePostDamage -> zombie revive wrapper
  z.hp = 20;
  return { ok: true, dogX: Math.round(actor.x), zombieX: Math.round(z.x), zombieHp: z.hp };
});
log('killer blocker:', JSON.stringify(blocker));

let last = '';
const seen = { corpse: [], revive: [], deaths: 0 };
const shots = {};
const end = Date.now() + 120000;
while (Date.now() < end) {
  const snap = await page.evaluate(() => {
    const scene = globalThis.__APP__?.battleScene;
    const z = (scene?.actors || []).find((a) => String(a.slotId || '').includes('284'));
    if (!z) return { gone: true, state: scene?.battleState };
    return {
      t: Math.round((scene.timeMs || 0) / 100) / 10,
      st: z.state,
      hp: z.hp,
      alive: z.isAlive?.() === true,
      revivePending: z.bcuZombieRevivePending === true,
      reviveReadyAtMs: z.bcuZombieReviveReadyAtMs ?? null,
      nowMs: scene.timeMs,
      corpse: z.bcuZombieCorpseVisual?.active ? z.bcuZombieCorpseVisual.phase : null,
      corpseRemaining: z.bcuZombieCorpseVisual?.remainingFrames ?? null,
      hideBase: z.bcuRenderOverride?.hideBaseActor === true,
      reviveDbg: z.lastBcuZombieReviveDebug || null,
      corpseEffects: (scene.effects || []).filter((e) => e.type === 'zombieCorpse').map((e) => e.id),
      renderable: z.isRenderable?.() === true
    };
  });
  if (snap.gone) { log('zombie removed; battle:', snap.state); break; }
  const sig = `${snap.st}|${snap.corpse}|${snap.revivePending}|${snap.hp}|${snap.hideBase}`;
  if (sig !== last) { console.log(JSON.stringify(snap)); last = sig; }
  if (snap.corpse) {
    seen.corpse.push(`${snap.corpse}:hideBase=${snap.hideBase}`);
    const key = `corpse-${snap.corpse}`;
    if (!shots[key]) { shots[key] = true; await page.screenshot({ path: `${OUT_DIR}/rev-${key}.png` }); }
  }
  if (snap.reviveDbg?.revived) {
    if (!shots.revived) { shots.revived = true; await page.screenshot({ path: `${OUT_DIR}/rev-revived.png` }); }
    seen.revive.push(`revived hp=${snap.hp}`);
    break;
  }
  if (snap.reviveDbg?.scheduled && !seen.revive.includes('scheduled')) seen.revive.push('scheduled');
  await page.waitForTimeout(120);
}
log('corpse states:', JSON.stringify([...new Set(seen.corpse)]));
log('revive:', JSON.stringify([...new Set(seen.revive)]));
await browser.close();
log('done');
