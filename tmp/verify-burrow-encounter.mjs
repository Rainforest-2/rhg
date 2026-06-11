// Deterministic encounter: place a tanky dog unit in the burrow zombie's path,
// observe burrow lifecycle (down/move/up), then kill the zombie and observe
// corpse + revive. All damage flows through the real attack pipeline.
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

// spawn the zombie (retry while burrow animations preload)
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

// place a tanky blocker in its path once it is mid-field
const blocker = await page.evaluate(() => {
  const scene = globalThis.__APP__?.battleScene;
  const z = (scene.actors || []).find((a) => String(a.slotId || '').includes('284'));
  if (!z) return { ok: false, reason: 'zombie-missing' };
  const rows = scene.getPlayerLineupRows?.() || [];
  const row = rows[scene.frontLineup] || rows[0] || [];
  const slot = row.find((s) => s?.slotId);
  if (!slot) return { ok: false, reason: 'no-lineup-slot' };
  const def = scene.findPlayerProductionUnit(slot.slotId);
  if (!def) return { ok: false, reason: 'no-unit-def' };
  const actor = scene.spawnActor(def, 'dog-player', true, { x: z.x + 500 });
  if (!actor) return { ok: false, reason: 'spawn-failed' };
  actor.hp = 99999999; actor.maxHp = 99999999;
  return { ok: true, dogX: Math.round(actor.x), zombieX: Math.round(z.x) };
});
log('blocker:', JSON.stringify(blocker));

const seen = { burrow: [], corpse: [], revive: [], events: [] };
let last = '';
let killed = false;
const shots = {};
const end = Date.now() + 180000;
while (Date.now() < end) {
  const snap = await page.evaluate(() => {
    const scene = globalThis.__APP__?.battleScene;
    const z = (scene?.actors || []).find((a) => String(a.slotId || '').includes('284'));
    if (!z) return { gone: true, state: scene?.battleState };
    return {
      t: Math.round((scene.timeMs || 0) / 100) / 10,
      x: Math.round(z.x),
      st: z.state,
      hp: z.hp,
      burrow: z.bcuBurrow ? `${z.bcuBurrow.phase}(rem:${Math.round(z.bcuBurrow.distanceRemaining ?? -1)})` : null,
      burrowRem: z.bcuBurrowRemaining ?? null,
      targetable: z.isTargetable?.() === true,
      anim: z.lastBcuBurrowAnimationDebug ? `${z.lastBcuBurrowAnimationDebug.animId}:${z.lastBcuBurrowAnimationDebug.loaded}` : null,
      revivePending: z.bcuZombieRevivePending === true,
      corpse: z.bcuZombieCorpseVisual?.active ? z.bcuZombieCorpseVisual.phase : null,
      hideBase: z.bcuRenderOverride?.hideBaseActor === true,
      reviveDbg: z.lastBcuZombieReviveDebug || null,
      effects: (scene.effects || []).map((e) => e.type),
      state: scene.battleState
    };
  });
  if (snap.gone) { log('zombie removed, battle:', snap.state); break; }
  const sig = `${snap.st}|${snap.burrow}|${snap.corpse}|${snap.revivePending}|${snap.hp}`;
  if (sig !== last) { console.log(JSON.stringify(snap)); last = sig; }
  if (snap.burrow) {
    const phase = snap.burrow.split('(')[0];
    seen.burrow.push(phase);
    if (!shots[`burrow-${phase}`]) { shots[`burrow-${phase}`] = true; await page.screenshot({ path: `${OUT_DIR}/enc-burrow-${phase}.png` }); }
  }
  if (snap.corpse) {
    seen.corpse.push(snap.corpse);
    if (!shots[`corpse-${snap.corpse}`]) { shots[`corpse-${snap.corpse}`] = true; await page.screenshot({ path: `${OUT_DIR}/enc-corpse-${snap.corpse}.png` }); }
  }
  if (snap.reviveDbg?.revived && !shots.revived) { shots.revived = true; seen.revive.push('revived'); await page.screenshot({ path: `${OUT_DIR}/enc-revived.png` }); }
  if (snap.reviveDbg?.scheduled) seen.revive.push('scheduled');
  // after burrow finished (count exhausted) and zombie surfaced, give the blocker lethal attack power
  if (!killed && seen.burrow.length && !snap.burrow && snap.st !== 'dead') {
    killed = true;
    await page.evaluate(() => {
      const scene = globalThis.__APP__?.battleScene;
      const dog = (scene.actors || []).find((a) => a.side === 'dog-player' && a.maxHp >= 99999999);
      if (dog) {
        dog.damage = 99999; if (dog.stats) dog.stats.damage = 99999;
        if (Array.isArray(dog.stats?.attackHits)) for (const h of dog.stats.attackHits) h.damage = 99999;
        if (Array.isArray(dog.attackHits)) for (const h of dog.attackHits) h.damage = 99999;
      }
    });
    log('blocker weaponized to kill zombie');
  }
  if (snap.revivePending === false && seen.revive.includes('revived') && seen.corpse.length) break;
  await page.waitForTimeout(250);
}
log('burrow phases:', JSON.stringify([...new Set(seen.burrow)]));
log('corpse phases:', JSON.stringify([...new Set(seen.corpse)]));
log('revive:', JSON.stringify([...new Set(seen.revive)]));
await page.screenshot({ path: `${OUT_DIR}/enc-final.png` });
await browser.close();
log('done');
