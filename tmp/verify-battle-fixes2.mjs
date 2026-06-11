// Precise battle verification: probes actor prototypes directly (debug globals
// are stripped by BattleDebugStripPatch during battle init).
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173/';
const ZOMBIE_STAGE = 'stage:120400:CA/StageRCA/stageRCA007_00';
const OUT_DIR = '/workspaces/game/tmp/verify-shots';
const log = (...a) => console.log('[verify]', ...a);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.addInitScript(([stage]) => {
  try { localStorage.setItem('bcu.selectedStageId', stage); } catch {}
}, [ZOMBIE_STAGE]);

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.apply-battle-button', { timeout: 120000 });
await page.waitForTimeout(1500);
await page.click('.apply-battle-button');
await page.waitForFunction(() => {
  const app = globalThis.__APP__ || globalThis.app;
  return !!(app?.sceneReady && app?.battleScene);
}, null, { timeout: 180000 });
log('battle ready');
await page.waitForTimeout(2000);

const proto = await page.evaluate(() => {
  const a = globalThis.__APP__?.battleScene?.actors?.[0];
  return a ? {
    applyBcuProc: typeof a.applyBcuProc,
    isBcuProcStatusActive: typeof a.isBcuProcStatusActive,
    getBcuMoveDistanceForDt: typeof a.getBcuMoveDistanceForDt,
    getBcuWeakenDamageMultiplier: typeof a.getBcuWeakenDamageMultiplier,
    getBcuTouchMask: typeof a.getBcuTouchMask
  } : null;
});
log('actor methods:', JSON.stringify(proto));

// run battle: produce units and watch zombies
const watch = async (seconds) => {
  const end = Date.now() + seconds * 1000;
  const seen = { burrowPhases: new Set(), reviveSeen: false, corpseSeen: false, zombies: new Set() };
  while (Date.now() < end) {
    await page.evaluate(() => {
      const btn = document.querySelector('.prod-card.is-front:not(.is-disabled)');
      btn?.click();
    });
    const snap = await page.evaluate(() => {
      const scene = globalThis.__APP__?.battleScene;
      return (scene?.actors || []).filter((a) => a.bcuCombatModel?.proc?.burrow?.count || a.bcuZombieRevivePending || a.bcuBurrow || a.bcuZombieCorpseVisual).map((a) => ({
        id: a.instanceId || a.label,
        state: a.state,
        hp: a.hp,
        burrow: a.bcuBurrow ? `${a.bcuBurrow.phase}:${a.bcuBurrow.active}` : null,
        burrowRemaining: a.bcuBurrowRemaining ?? null,
        revivePending: a.bcuZombieRevivePending === true,
        corpse: a.bcuZombieCorpseVisual ? `${a.bcuZombieCorpseVisual.phase}:${a.bcuZombieCorpseVisual.active}` : null,
        reviveRemaining: a.bcuZombieReviveRemaining ?? null,
        lastBurrowDebug: a.lastBcuBurrowDebug?.phase || null,
        animUnavailable: a.lastBcuBurrowAnimationDebug?.loaded === false
      }));
    });
    for (const z of snap) {
      seen.zombies.add(z.id);
      if (z.burrow) seen.burrowPhases.add(`${z.id}@${z.burrow}`);
      if (z.revivePending) seen.reviveSeen = true;
      if (z.corpse) { seen.corpseSeen = true; seen.lastCorpse = `${z.id}@${z.corpse}`; }
    }
    if (snap.length) console.log('[watch]', JSON.stringify(snap));
    await page.waitForTimeout(800);
  }
  return { ...seen, burrowPhases: [...seen.burrowPhases], zombies: [...seen.zombies] };
};
log('watching battle 70s…');
const seen = await watch(70);
log('watch summary:', JSON.stringify(seen));

await page.screenshot({ path: `${OUT_DIR}/battle2-mid-ipad.png` });

// direct status application probe on a live enemy (test hook is stripped; call applyBcuProc directly)
const statusResults = await page.evaluate(() => {
  const scene = globalThis.__APP__?.battleScene;
  const enemy = (scene?.actors || []).find((a) => a.side === 'cat-enemy' && a.isAlive?.());
  if (!enemy) return { error: 'no-live-enemy' };
  const meta = { nowMs: scene.timeMs, scene, tuning: {} };
  const mk = (key, payload) => { try { return enemy.applyBcuProc?.({ key, payload }, meta) || { applied: false, reason: 'applyBcuProc-missing' }; } catch (e) { return { applied: false, reason: String(e?.message || e) }; } };
  const out = { enemy: enemy.instanceId || enemy.label };
  out.freeze = mk('freeze', { time: 90, timeFrames: 90 });
  out.slow = mk('slow', { time: 90, timeFrames: 90 });
  out.weaken = mk('weaken', { time: 90, timeFrames: 90, mult: 50 });
  out.curse = mk('curse', { time: 90, timeFrames: 90 });
  out.seal = mk('seal', { time: 90, timeFrames: 90 });
  out.toxic = mk('toxic', { mult: 20 });
  out.statusesAfter = Object.keys(enemy.bcuProcStatuses || {});
  out.toxicDebug = enemy.lastBcuToxicDebug ? { damage: enemy.lastBcuToxicDebug.damage, effectId: enemy.lastBcuToxicDebug.effectId } : null;
  out.toxicEffectInScene = (scene.effects || []).some((e) => e.type === 'toxic');
  return out;
});
log('status apply:', JSON.stringify(statusResults, null, 1));

await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT_DIR}/battle2-status-ipad.png` });
await browser.close();
log('done');
