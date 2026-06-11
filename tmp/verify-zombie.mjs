// Zombie burrow / revive observation in the real battle.
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
await page.waitForFunction(() => !!(globalThis.__APP__?.sceneReady && globalThis.__APP__?.battleScene), null, { timeout: 180000 });
log('battle ready');

const seen = { burrow: [], corpse: [], revive: [], anim: [] };
const end = Date.now() + 100000;
let shotTaken = { burrow: false, corpse: false };
while (Date.now() < end) {
  const snap = await page.evaluate(() => {
    const scene = globalThis.__APP__?.battleScene;
    const cm = (a) => a?.bcuCombatModel || a?.rawStats?.bcuCombatModel || a?.stats?.bcuCombatModel || null;
    const out = {
      state: scene?.battleState,
      t: Math.round((scene?.timeMs || 0) / 1000),
      frame: scene?.logicFrame,
      actors: (scene?.actors || []).map((a) => ({
        id: a.instanceId || a.label,
        slot: a.slotId,
        side: a.side,
        st: a.state,
        hp: a.hp,
        burrowCount: cm(a)?.proc?.burrow?.count ?? 0,
        burrow: a.bcuBurrow ? `${a.bcuBurrow.phase}` : null,
        rem: a.bcuBurrowRemaining ?? null,
        revP: a.bcuZombieRevivePending === true,
        corpse: a.bcuZombieCorpseVisual?.active ? a.bcuZombieCorpseVisual.phase : null,
        zTraits: (cm(a)?.traits?.flags || {}).zombie === true,
        burrowDbg: a.lastBcuBurrowDebug || null,
        burrowAnimDbg: a.lastBcuBurrowAnimationDebug || null
      }))
    };
    return out;
  });
  const zoms = snap.actors.filter((a) => a.burrowCount || a.zTraits || a.burrow || a.corpse || a.revP);
  if (zoms.length) console.log(`[t=${snap.t}s ${snap.state}]`, JSON.stringify(zoms));
  for (const z of zoms) {
    if (z.burrow) { seen.burrow.push(`${z.id}@${z.burrow}`); if (!shotTaken.burrow) { shotTaken.burrow = true; await page.screenshot({ path: `${OUT_DIR}/zombie-burrow.png` }); } }
    if (z.corpse) { seen.corpse.push(`${z.id}@${z.corpse}`); if (!shotTaken.corpse) { shotTaken.corpse = true; await page.screenshot({ path: `${OUT_DIR}/zombie-corpse.png` }); } }
    if (z.revP) seen.revive.push(z.id);
    if (z.burrowAnimDbg) seen.anim.push(JSON.stringify(z.burrowAnimDbg));
  }
  if (snap.state && snap.state !== 'running') { log('battle ended:', snap.state, 't=', snap.t); break; }
  // keep producing some units so combat continues but zombies can also die
  await page.evaluate(() => document.querySelector('.prod-card.is-front:not(.is-disabled)')?.click());
  await page.waitForTimeout(600);
}
log('summary burrow:', JSON.stringify([...new Set(seen.burrow)]));
log('summary corpse:', JSON.stringify([...new Set(seen.corpse)]));
log('summary revive:', JSON.stringify([...new Set(seen.revive)]));
log('anim debug sample:', seen.anim.slice(0, 3));
await page.screenshot({ path: `${OUT_DIR}/zombie-end.png` });
await browser.close();
log('done');
