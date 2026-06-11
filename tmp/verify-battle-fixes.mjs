// Battle verification harness for the 5 reported issues.
// Drives the real app (vite dev server on :4173) with an iPad-landscape viewport.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173/';
const ZOMBIE_STAGE = 'stage:120400:CA/StageRCA/stageRCA007_00';
const OUT_DIR = '/workspaces/game/tmp/verify-shots';

function log(...args) { console.log('[verify]', ...args); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.addInitScript(([stage]) => {
  try { localStorage.setItem('bcu.selectedStageId', stage); } catch {}
}, [ZOMBIE_STAGE]);

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
log('page loaded, waiting for formation UI…');

await page.waitForFunction(() => !!globalThis.__APP__ || !!document.querySelector('.apply-battle-button'), null, { timeout: 120000 });
await page.waitForSelector('.apply-battle-button', { timeout: 120000 });
await page.waitForTimeout(1500);

// --- start battle ---
await page.click('.apply-battle-button');
log('clicked battle apply, waiting for scene…');
await page.waitForFunction(() => {
  const app = globalThis.__APP__ || globalThis.app;
  return !!(app?.sceneReady && app?.battleScene);
}, null, { timeout: 180000 });
log('battle scene ready');
await page.waitForTimeout(2500);

// --- check 5: proc patch installed ---
const procPatchState = await page.evaluate(() => {
  const proto = globalThis.__APP__?.battleScene?.actors?.[0]?.constructor?.prototype || null;
  return {
    testHook: typeof globalThis.__BCU_TEST_APPLY_STATUS__,
    immunityPatch: globalThis.__BCU_PROC_IMMUNITY_PATCH_DEBUG__?.installed === true,
    applyBcuProcOnProto: typeof proto?.applyBcuProc,
    isBcuProcStatusActive: typeof proto?.isBcuProcStatusActive
  };
});
log('proc patch state:', JSON.stringify(procPatchState));

// --- check 1: card rail centering ---
const rail = await page.evaluate(() => {
  const cards = document.querySelector('.prod-ui .cards');
  const panel = document.querySelector('.canvas-panel') || document.body;
  if (!cards) return null;
  const cb = cards.getBoundingClientRect();
  const pb = panel.getBoundingClientRect();
  const style = getComputedStyle(cards);
  return {
    cardsCenterX: cb.left + cb.width / 2,
    panelCenterX: pb.left + pb.width / 2,
    delta: (cb.left + cb.width / 2) - (pb.left + pb.width / 2),
    left: cb.left, right: cb.right, width: cb.width,
    viewport: { w: innerWidth, h: innerHeight },
    transform: style.transform,
    animationName: style.animationName
  };
});
log('card rail:', JSON.stringify(rail));

await page.screenshot({ path: `${OUT_DIR}/battle-start-ipad.png` });

// --- run the battle and produce units so combat happens ---
const produceLoop = async (seconds) => {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector('.prod-card.is-front:not(.is-disabled)');
      if (btn) { btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); btn.click(); return true; }
      return false;
    });
    await page.waitForTimeout(700);
  }
};
log('producing units / running battle for 40s…');
await produceLoop(40);

// --- collect battle events for burrow / revive / proc ---
const battleReport = await page.evaluate(() => {
  const scene = globalThis.__APP__?.battleScene;
  const events = scene?.events || scene?.eventLog || [];
  const byType = {};
  for (const e of events) byType[e.type] = (byType[e.type] || 0) + 1;
  const interesting = events.filter((e) => /burrow|Burrow|zombie|Zombie|procApplied|procResolved|ToxicEffect|bcuProc/i.test(String(e.type)));
  const actors = (scene?.actors || []).map((a) => ({
    id: a.instanceId || a.label,
    side: a.side,
    state: a.state,
    hp: a.hp,
    burrow: a.bcuBurrow ? { phase: a.bcuBurrow.phase, active: a.bcuBurrow.active } : null,
    burrowRemaining: a.bcuBurrowRemaining ?? null,
    revivePending: a.bcuZombieRevivePending === true,
    reviveRemaining: a.bcuZombieReviveRemaining ?? null,
    statuses: Object.keys(a.bcuProcStatuses || {}),
    traits: Object.keys(a.bcuCombatModel?.traits?.flags || {}).filter((k) => a.bcuCombatModel?.traits?.flags?.[k]),
    procBurrow: a.bcuCombatModel?.proc?.burrow || null,
    lastBurrowDebug: a.lastBcuBurrowDebug || null
  }));
  return {
    eventTypeCounts: byType,
    interestingTail: interesting.slice(-30),
    actors,
    effectsTypes: (scene?.effects || []).map((e) => e.type)
  };
});
console.log('[verify] event type counts:', JSON.stringify(battleReport.eventTypeCounts, null, 1));
console.log('[verify] interesting events tail:', JSON.stringify(battleReport.interestingTail.slice(-15), null, 1).slice(0, 4000));
console.log('[verify] actors:', JSON.stringify(battleReport.actors, null, 1).slice(0, 5000));
console.log('[verify] effects:', JSON.stringify(battleReport.effectsTypes));

await page.screenshot({ path: `${OUT_DIR}/battle-mid-ipad.png` });

// --- check 5/2 directly: apply each status to a live enemy via the debug hook ---
const statusResults = await page.evaluate(() => {
  const scene = globalThis.__APP__?.battleScene;
  const enemy = (scene?.actors || []).find((a) => a.side !== 'dog-player' ? a.side === 'cat-enemy' && a.isAlive?.() : false)
    || (scene?.actors || []).find((a) => a.side === 'cat-enemy');
  if (!enemy) return { error: 'no-enemy' };
  const out = { enemy: enemy.instanceId || enemy.label, results: {} };
  for (const key of ['STOP', 'SLOW', 'WEAK', 'CURSE', 'SEAL', 'POISON', 'WARP']) {
    try { out.results[key] = globalThis.__BCU_TEST_APPLY_STATUS__?.(enemy, key, 120) || { applied: false, reason: 'hook-missing' }; }
    catch (e) { out.results[key] = { applied: false, reason: String(e?.message || e) }; }
  }
  out.statusesAfter = Object.keys(enemy.bcuProcStatuses || {});
  out.toxicEffectDebug = globalThis.__BCU_TOXIC_EFFECT_DEBUG__ || null;
  return out;
});
console.log('[verify] status apply results:', JSON.stringify(statusResults, null, 1).slice(0, 4000));

await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT_DIR}/battle-status-ipad.png` });

await browser.close();
log('done');
