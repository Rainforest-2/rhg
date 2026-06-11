// Force-spawn ゾンビワン (enemy 284, burrow count=1, revive holder) into the
// default battle and observe burrow + corpse/revive lifecycle.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173/';
const OUT_DIR = '/workspaces/game/tmp/verify-shots';
const log = (...a) => console.log('[verify]', ...a);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.apply-battle-button', { timeout: 120000 });
await page.waitForTimeout(1500);
await page.click('.apply-battle-button');
await page.waitForFunction(() => !!(globalThis.__APP__?.sceneReady && globalThis.__APP__?.battleScene), null, { timeout: 180000 });
log('battle ready');
await page.waitForTimeout(1500);

let spawnResult = null;
for (let i = 0; i < 30; i += 1) {
  spawnResult = await page.evaluate(async () => {
    const scene = globalThis.__APP__?.battleScene;
    const mod = await import('/js/battle/BcuStageEnemyResolver.js');
    const row = { enemyId: 284, rowIndex: 99, magnification: 100, hpMagnification: 100, attackMagnification: 100, count: 1, startFrame: 0, respawnMinFrames: 9999, respawnMaxFrames: 9999, layerMin: 5, layerMax: 9, isBoss: false };
    const unitDef = mod.buildStageEnemyUnitDef(row);
    const ok = scene.spawnStageEnemy(unitDef, row);
    // keep player base alive for observation
    for (const b of scene.bases || []) if (b.side === 'dog-player') b.hp = Math.max(b.hp, 9999999);
    return { ok, slotId: unitDef.slotId, attempt: null };
  });
  if (spawnResult.ok) break;
  await page.waitForTimeout(700);
}
log('spawn result:', JSON.stringify(spawnResult));

const seen = { burrowPhases: [], corpse: [], reviveEvents: [], errors: [] };
let prevState = {};
const shots = { down: false, move: false, up: false, corpse: false, revived: false };
const end = Date.now() + 150000;
while (Date.now() < end) {
  const snap = await page.evaluate(() => {
    const scene = globalThis.__APP__?.battleScene;
    const cm = (a) => a?.bcuCombatModel || a?.rawStats?.bcuCombatModel || a?.stats?.bcuCombatModel || null;
    const z = (scene?.actors || []).find((a) => String(a.slotId || '').includes('284'));
    if (!z) return { state: scene?.battleState, t: Math.round((scene?.timeMs || 0) / 100) / 10, zombie: null };
    return {
      state: scene?.battleState,
      t: Math.round((scene?.timeMs || 0) / 100) / 10,
      zombie: {
        id: z.instanceId || z.label,
        st: z.state,
        hp: z.hp,
        x: Math.round(z.x),
        burrowCount: cm(z)?.proc?.burrow?.count ?? 0,
        reviveSpec: cm(z)?.proc?.revive || null,
        zombieTrait: (cm(z)?.traits?.flags || {}).zombie === true,
        burrow: z.bcuBurrow ? `${z.bcuBurrow.phase}` : null,
        burrowRem: z.bcuBurrowRemaining ?? null,
        revivePending: z.bcuZombieRevivePending === true,
        reviveRemaining: z.bcuZombieReviveRemaining ?? null,
        corpse: z.bcuZombieCorpseVisual?.active ? z.bcuZombieCorpseVisual.phase : null,
        hideBase: z.bcuRenderOverride?.hideBaseActor === true,
        burrowDbg: z.lastBcuBurrowDebug ? { phase: z.lastBcuBurrowDebug.phase, finished: z.lastBcuBurrowDebug.finished, reason: z.lastBcuBurrowDebug.reason } : null,
        reviveDbg: z.lastBcuZombieReviveDebug ? { scheduled: z.lastBcuZombieReviveDebug.scheduled, revived: z.lastBcuZombieReviveDebug.revived, zk: z.lastBcuZombieReviveDebug.zombieKillerBlocked } : null
      },
      effects: (scene?.effects || []).map((e) => e.type)
    };
  });
  const z = snap.zombie;
  if (z) {
    const sig = JSON.stringify({ st: z.st, burrow: z.burrow, corpse: z.corpse, revivePending: z.revivePending, hp: z.hp > 0 });
    if (sig !== prevState.sig) {
      console.log(`[t=${snap.t}s]`, JSON.stringify(z), 'effects:', JSON.stringify(snap.effects));
      prevState = { sig };
    }
    if (z.burrow) {
      seen.burrowPhases.push(z.burrow);
      if (!shots[z.burrow] && (z.burrow === 'down' || z.burrow === 'move' || z.burrow === 'up')) {
        shots[z.burrow] = true;
        await page.screenshot({ path: `${OUT_DIR}/zombie-burrow-${z.burrow}.png` });
      }
    }
    if (z.corpse) {
      seen.corpse.push(z.corpse);
      if (!shots.corpse) { shots.corpse = true; await page.screenshot({ path: `${OUT_DIR}/zombie-corpse.png` }); }
    }
    if (z.reviveDbg?.revived && !shots.revived) { shots.revived = true; await page.screenshot({ path: `${OUT_DIR}/zombie-revived.png` }); seen.reviveEvents.push('revived'); }
    if (z.reviveDbg?.scheduled) seen.reviveEvents.push('scheduled');
    if (z.reviveDbg?.zk) seen.reviveEvents.push('zombie-killer-blocked');
  }
  if (snap.state && snap.state !== 'running') { log('battle ended:', snap.state); break; }
  await page.evaluate(() => document.querySelector('.prod-card.is-front:not(.is-disabled)')?.click());
  await page.waitForTimeout(400);
}
log('burrow phases seen:', JSON.stringify([...new Set(seen.burrowPhases)]));
log('corpse phases seen:', JSON.stringify([...new Set(seen.corpse)]));
log('revive events:', JSON.stringify([...new Set(seen.reviveEvents)]));
await browser.close();
log('done');
