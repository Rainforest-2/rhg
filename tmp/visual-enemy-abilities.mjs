// Visual review harness for enemy-side BCU abilities. Boots a fresh battle per
// ability, force-spawns the representative enemy (retrying until its template
// preloads), pulls it toward mid-field so it engages player units quickly, and
// screenshots when the ability/effect is observed. Dumps runtime proof too.
import { launch, newApp, startBattle, produceLoop } from './visual-harness.mjs';

const OUT = 'tmp/visual-shots';
const log = (...a) => console.log('[enemy]', ...a);

const ABILITIES = [
  { key: 'delay', enemyId: 774, label: 'P_DELAY enemy attack' },
  { key: 'barrier', enemyId: 364, label: 'barrier enemy' },
  { key: 'demon-shield', enemyId: 554, label: 'demon shield enemy' },
  { key: 'burrow', enemyId: 286, label: 'burrow + zombie revive enemy 286' },
];

async function forceSpawn(page, enemyId, pullToX) {
  return page.evaluate(async ({ id, pullToX }) => {
    const scene = globalThis.__APP__?.battleScene;
    const mod = await import('/js/battle/BcuStageEnemyResolver.js');
    const row = { enemyId: id, rowIndex: 99, magnification: 100, hpMagnification: 100, attackMagnification: 100, count: 1, startFrame: 0, respawnMinFrames: 999999, respawnMaxFrames: 999999, layerMin: 5, layerMax: 9, isBoss: false };
    const unitDef = mod.buildStageEnemyUnitDef(row);
    const ok = scene.spawnStageEnemy(unitDef, row);
    for (const b of scene.bases || []) if (b.side === 'dog-player') b.hp = Math.max(b.hp, 9_999_999);
    if (ok && Number.isFinite(pullToX)) {
      const e = (scene.actors || []).find((a) => String(a.slotId || '').includes(String(id)));
      if (e) e.x = pullToX;
    }
    return { ok, slotId: unitDef.slotId };
  }, { id: enemyId, pullToX });
}

async function probe(page, enemyId) {
  return page.evaluate((id) => {
    const scene = globalThis.__APP__?.battleScene;
    const cm = (a) => a?.bcuCombatModel || a?.rawStats?.bcuCombatModel || null;
    const e = (scene?.actors || []).find((a) => String(a.slotId || '').includes(String(id)));
    return {
      state: scene?.battleState,
      effectTypes: [...new Set((scene?.effects || []).map((x) => x.type))],
      enemy: e ? {
        st: e.state, hp: Math.round(e.hp), x: Math.round(e.x),
        proc: {
          barrier: cm(e)?.proc?.barrier?.health ?? 0,
          demonShield: cm(e)?.proc?.demonShield?.hp ?? 0,
          delay: cm(e)?.proc?.delay?.prob ?? 0,
          burrow: cm(e)?.proc?.burrow?.count ?? 0,
          revive: cm(e)?.proc?.revive?.count ?? 0,
        },
        barrierCur: e.barrier ?? e.currentBarrier ?? e.bcuBarrierHealth ?? null,
        shieldCur: e.currentShield ?? e.demonShieldHp ?? e.bcuDemonShieldHp ?? null,
        burrowPhase: e.bcuBurrow?.phase ?? null,
        corpse: e.bcuZombieCorpseVisual?.active ? e.bcuZombieCorpseVisual.phase : null,
        revivePending: e.bcuZombieRevivePending === true,
      } : null,
      playerUnits: (scene?.actors || []).filter((a) => a.side === 'dog-player').length,
    };
  }, enemyId);
}

const browser = await launch();
const results = {};
const BASELINE_EFFECTS = new Set(['hit', 'deathSoul']);

for (const ab of ABILITIES) {
  const { page, errors } = await newApp(browser, {});
  await startBattle(page);
  // pump out a few player units first so they're already marching
  await produceLoop(page, 3, 350);
  // retry spawn until the enemy template preloads
  let spawn = { ok: false };
  for (let i = 0; i < 40 && !spawn.ok; i += 1) {
    spawn = await forceSpawn(page, ab.enemyId, 2600);
    if (!spawn.ok) await page.waitForTimeout(500);
  }
  log(ab.key, 'spawn:', JSON.stringify(spawn));
  const seen = new Set();
  const shots = [];
  let firstProbe = null;
  const end = Date.now() + 55000;
  while (Date.now() < end) {
    await produceLoop(page, 1, 350);
    const p = await probe(page, ab.enemyId);
    if (!firstProbe && p.enemy) firstProbe = p;
    for (const t of p.effectTypes) {
      if (!BASELINE_EFFECTS.has(t) && !seen.has('eff:' + t)) {
        seen.add('eff:' + t);
        const file = `${OUT}/enemy-${ab.key}-eff-${t}.png`;
        await page.screenshot({ path: file }); shots.push(file);
        log(ab.key, 'effect:', t, '->', file);
      }
    }
    if (p.enemy?.burrowPhase && !seen.has('burrow-' + p.enemy.burrowPhase)) {
      seen.add('burrow-' + p.enemy.burrowPhase);
      const file = `${OUT}/enemy-burrow-${p.enemy.burrowPhase}.png`;
      await page.screenshot({ path: file }); shots.push(file);
      log('burrow phase', p.enemy.burrowPhase, '->', file);
    }
    if (p.enemy?.corpse && !seen.has('corpse-' + p.enemy.corpse)) {
      seen.add('corpse-' + p.enemy.corpse);
      const file = `${OUT}/enemy-burrow-corpse-${p.enemy.corpse}.png`;
      await page.screenshot({ path: file }); shots.push(file);
      log('corpse phase', p.enemy.corpse, '->', file);
    }
    if (p.enemy?.revivePending && !seen.has('revivePending')) {
      seen.add('revivePending');
      const file = `${OUT}/enemy-burrow-revive-pending.png`;
      await page.screenshot({ path: file }); shots.push(file);
    }
    if (p.state && p.state !== 'running') { log(ab.key, 'battle ended', p.state); break; }
  }
  const steady = `${OUT}/enemy-${ab.key}-steady.png`;
  await page.screenshot({ path: steady }); shots.push(steady);
  const finalProbe = await probe(page, ab.enemyId);
  results[ab.key] = { spawn, firstProbe, finalProbe, captures: [...seen], shots, errors: errors.slice(0, 5) };
  log(ab.key, 'DONE captures:', [...seen].join(',') || '(none)', 'enemy:', JSON.stringify(finalProbe.enemy || firstProbe?.enemy));
  await page.close();
}

console.log('\n===== RESULTS =====');
console.log(JSON.stringify(results, null, 1));
await browser.close();
