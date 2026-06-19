// Burrow + zombie-revive visual review using enemy 284 (ゾンビワン, burrow count=1,
// revive holder). Mirrors the proven encounter flow: spawn the zombie, drop a tanky
// blocker in its path so it burrows past (down/move/up), then weaponize the blocker
// to kill it and observe corpse DOWN/REVIVE + revival.
import { launch, newApp, startBattle } from './visual-harness.mjs';

const OUT = 'tmp/visual-shots';
const log = (...a) => console.log('[bz]', ...a);
const GROUND_CROP = { x: 180, y: 360, width: 820, height: 440 };

const browser = await launch();
const { page } = await newApp(browser, {});
await startBattle(page);
await page.waitForTimeout(800);

// spawn zombie 284 (retry while template preloads)
let spawn = { ok: false };
for (let i = 0; i < 40 && !spawn.ok; i += 1) {
  spawn = await page.evaluate(async () => {
    const scene = globalThis.__APP__?.battleScene;
    const mod = await import('/js/battle/BcuStageEnemyResolver.js');
    const row = { enemyId: 284, rowIndex: 99, magnification: 100, hpMagnification: 100, attackMagnification: 100, count: 1, startFrame: 0, respawnMinFrames: 999999, respawnMaxFrames: 999999, layerMin: 5, layerMax: 9, isBoss: false };
    const def = mod.buildStageEnemyUnitDef(row);
    const ok = scene.spawnStageEnemy(def, row);
    for (const b of scene.bases || []) if (b.side === 'dog-player') b.hp = Math.max(b.hp, 9_999_999);
    return { ok, slotId: def.slotId };
  });
  if (!spawn.ok) await page.waitForTimeout(500);
}
log('zombie spawn', JSON.stringify(spawn));

// drop a tanky blocker in the zombie's path
async function dropBlocker(offsetX, tanky) {
  return page.evaluate(({ offsetX, tanky }) => {
    const scene = globalThis.__APP__?.battleScene;
    const z = (scene.actors || []).find((a) => String(a.slotId || '').includes('284'));
    if (!z) return { ok: false, reason: 'no-zombie' };
    const roster = scene.getPlayerProductionRoster?.() || [];
    const slot = roster.find((s) => s?.slotId);
    const def = slot ? scene.findPlayerProductionUnit(slot.slotId) : null;
    if (!def) return { ok: false, reason: 'no-unit' };
    const a = scene.spawnActor(def, 'dog-player', true, { x: z.x + offsetX });
    if (a && tanky) { a.hp = 999999; a.maxHp = 999999; }
    return { ok: !!a, zombieX: Math.round(z.x), blockerX: a ? Math.round(a.x) : null };
  }, { offsetX, tanky });
}

const probe = () => page.evaluate(() => {
  const scene = globalThis.__APP__?.battleScene;
  const z = (scene?.actors || []).find((a) => String(a.slotId || '').includes('284'));
  return {
    state: scene?.battleState,
    gone: !z,
    z: z ? {
      st: z.state, hp: Math.round(z.hp), x: Math.round(z.x),
      burrow: z.bcuBurrow ? z.bcuBurrow.phase : null,
      corpse: z.bcuZombieCorpseVisual?.active ? z.bcuZombieCorpseVisual.phase : null,
      revivePending: z.bcuZombieRevivePending === true,
      reviveDbg: z.lastBcuZombieReviveDebug ? { scheduled: z.lastBcuZombieReviveDebug.scheduled, revived: z.lastBcuZombieReviveDebug.revived } : null,
    } : null,
  };
});

const seen = new Set();
let blockerDropped = false;
let killed = false;
const end = Date.now() + 110000;
while (Date.now() < end) {
  const p = await probe();
  if (!blockerDropped && p.z) { const d = await dropBlocker(360, true); blockerDropped = d.ok; log('blocker drop', JSON.stringify(d)); }
  if (p.z?.burrow && !seen.has('burrow-' + p.z.burrow)) {
    seen.add('burrow-' + p.z.burrow);
    await page.screenshot({ path: `${OUT}/zombie-burrow-${p.z.burrow}.png` });
    await page.screenshot({ path: `${OUT}/zombie-burrow-${p.z.burrow}-crop.png`, clip: GROUND_CROP });
    log('BURROW', p.z.burrow, '@x', p.z.x);
  }
  if (p.z?.corpse && !seen.has('corpse-' + p.z.corpse)) {
    seen.add('corpse-' + p.z.corpse);
    await page.screenshot({ path: `${OUT}/zombie-corpse-${p.z.corpse}.png` });
    await page.screenshot({ path: `${OUT}/zombie-corpse-${p.z.corpse}-crop.png`, clip: GROUND_CROP });
    log('CORPSE', p.z.corpse);
  }
  if (p.z?.revivePending && !seen.has('revivePending')) {
    seen.add('revivePending');
    await page.screenshot({ path: `${OUT}/zombie-revive-pending-crop.png`, clip: GROUND_CROP });
    log('REVIVE pending');
  }
  if (p.z?.reviveDbg?.revived && !seen.has('revived')) {
    seen.add('revived');
    await page.screenshot({ path: `${OUT}/zombie-revived-crop.png`, clip: GROUND_CROP });
    log('REVIVED');
  }
  // after burrow up (surfaced) and not currently burrowing, weaponize blocker to kill the zombie
  if (!killed && [...seen].some((s) => s.startsWith('burrow-')) && p.z && !p.z.burrow && p.z.st !== 'dead') {
    killed = await page.evaluate(() => {
      const scene = globalThis.__APP__?.battleScene;
      const z = (scene.actors || []).find((a) => String(a.slotId || '').includes('284'));
      if (z && !z.bcuBurrow) { z.hp = 1; return true; }
      return false;
    });
    if (killed) log('zombie HP set to 1 to force death/revive');
  }
  if (p.gone) { log('zombie gone; battle', p.state); break; }
  if (p.state && p.state !== 'running') { log('battle ended', p.state); break; }
  await page.waitForTimeout(250);
}
log('captures:', [...seen].join(',') || '(none)');
await page.screenshot({ path: `${OUT}/zombie-final.png` });
await browser.close();
