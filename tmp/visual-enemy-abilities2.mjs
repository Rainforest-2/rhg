// Refined enemy-ability visual review.
//  - barrier(364)/demon-shield(554): spawn mid-field, freeze the sim, crop the enemy
//    so the barrier/shield visual is captured intact (proof: bcuBarrierHp/bcuDemonShieldHp).
//  - delay(774): spawn mid-field, deploy a tanky blocker, let the enemy attack it and
//    capture the A_E_DELAY effect (proof: effect type + player unit cooldown bump).
//  - burrow+zombie(286): deploy a blocker, observe burrow down/move/up + corpse/revive.
import { launch, newApp, startBattle, produceLoop } from './visual-harness.mjs';

const OUT = 'tmp/visual-shots';
const log = (...a) => console.log('[enemy2]', ...a);
const CENTER_CROP = { x: 250, y: 150, width: 680, height: 470 };

async function spawnEnemy(page, enemyId, x) {
  let r = { ok: false };
  for (let i = 0; i < 40 && !r.ok; i += 1) {
    r = await page.evaluate(async ({ id, x }) => {
      const scene = globalThis.__APP__?.battleScene;
      const mod = await import('/js/battle/BcuStageEnemyResolver.js');
      const row = { enemyId: id, rowIndex: 99, magnification: 100, hpMagnification: 100, attackMagnification: 100, count: 1, startFrame: 0, respawnMinFrames: 999999, respawnMaxFrames: 999999, layerMin: 5, layerMax: 9, isBoss: false };
      const def = mod.buildStageEnemyUnitDef(row);
      const ok = scene.spawnStageEnemy(def, row);
      for (const b of scene.bases || []) if (b.side === 'dog-player') b.hp = Math.max(b.hp, 9_999_999);
      if (ok) { const e = (scene.actors || []).find((a) => String(a.slotId || '').includes(String(id))); if (e && Number.isFinite(x)) e.x = x; }
      return { ok, slotId: def.slotId };
    }, { id: enemyId, x });
    if (!r.ok) await page.waitForTimeout(500);
  }
  return r;
}

const enemyProbe = (page, id) => page.evaluate((id) => {
  const scene = globalThis.__APP__?.battleScene;
  const e = (scene?.actors || []).find((a) => String(a.slotId || '').includes(String(id)));
  return e ? {
    st: e.state, hp: Math.round(e.hp), x: Math.round(e.x),
    barrierHp: e.bcuBarrierHp ?? null, barrierMax: e.bcuBarrierMaxHp ?? null,
    shieldHp: e.bcuDemonShieldHp ?? null, shieldMax: e.bcuDemonShieldMaxHp ?? null,
    burrowPhase: e.bcuBurrow?.phase ?? null,
    corpse: e.bcuZombieCorpseVisual?.active ? e.bcuZombieCorpseVisual.phase : null,
    revivePending: e.bcuZombieRevivePending === true,
  } : null;
}, id);

const browser = await launch();
const results = {};

// ---------- barrier / demon shield : freeze and crop ----------
for (const [key, id] of [['barrier', 364], ['demon-shield', 554]]) {
  const { page } = await newApp(browser, {});
  await startBattle(page);
  const spawn = await spawnEnemy(page, id, 2400);
  await page.waitForTimeout(150);
  // freeze sim so the enemy stays put with shield intact
  await page.evaluate(() => { globalThis.__APP__.battleScene.battleState = 'paused'; });
  await page.waitForTimeout(250);
  const p = await enemyProbe(page, id);
  await page.screenshot({ path: `${OUT}/enemy-${key}-fresh.png` });
  await page.screenshot({ path: `${OUT}/enemy-${key}-fresh-crop.png`, clip: CENTER_CROP });
  results[key] = { spawn, probe: p };
  log(key, 'spawn', spawn.ok, 'probe', JSON.stringify(p));
  await page.close();
}

// ---------- delay : enemy attacks a tanky blocker ----------
{
  const { page } = await newApp(browser, {});
  await startBattle(page);
  await produceLoop(page, 4, 300); // pump blockers
  const spawn = await spawnEnemy(page, 774, 2400);
  const seen = new Set();
  const shots = [];
  const end = Date.now() + 40000;
  let proof = null;
  while (Date.now() < end) {
    await produceLoop(page, 1, 300);
    const st = await page.evaluate(() => {
      const scene = globalThis.__APP__?.battleScene;
      const effs = (scene?.effects || []).map((e) => e.type);
      const delayEff = effs.filter((t) => /delay/i.test(String(t)));
      const delayedUnits = (scene?.actors || []).filter((a) => a.side === 'dog-player' && (a.bcuDelayActive || a.bcuProcStatuses?.delay || a.lastBcuDelayDebug)).length;
      return { effs: [...new Set(effs)], delayEff: [...new Set(delayEff)], delayedUnits, state: scene?.battleState };
    });
    for (const t of st.delayEff) if (!seen.has(t)) { seen.add(t); const f = `${OUT}/enemy-delay-eff-${t}.png`; await page.screenshot({ path: f }); shots.push(f); log('delay effect', t); }
    if (st.delayedUnits && !proof) proof = st;
    if (st.state !== 'running') break;
  }
  await page.screenshot({ path: `${OUT}/enemy-delay-combat.png` });
  await page.screenshot({ path: `${OUT}/enemy-delay-combat-crop.png`, clip: CENTER_CROP });
  results.delay = { spawn, effectsSeen: [...seen], proof };
  log('delay DONE effects', [...seen].join(',') || '(none)', 'proof', JSON.stringify(proof));
  await page.close();
}

// ---------- burrow + zombie revive : blocker encounter ----------
{
  const { page } = await newApp(browser, {});
  await startBattle(page);
  const spawn = await spawnEnemy(page, 286, null); // natural spawn at enemy base, let it walk
  const shots = [];
  const seen = new Set();
  const end = Date.now() + 90000;
  let killed = false;
  while (Date.now() < end) {
    // keep deploying blockers in the zombie's path
    await produceLoop(page, 1, 300);
    const p = await enemyProbe(page, 286);
    if (p?.burrowPhase && !seen.has('burrow-' + p.burrowPhase)) {
      seen.add('burrow-' + p.burrowPhase);
      const f = `${OUT}/enemy-burrow-${p.burrowPhase}.png`;
      await page.screenshot({ path: f }); shots.push(f); log('burrow phase', p.burrowPhase, '@x' + p.x);
    }
    if (p?.corpse && !seen.has('corpse-' + p.corpse)) {
      seen.add('corpse-' + p.corpse);
      const f = `${OUT}/enemy-zombie-corpse-${p.corpse}.png`;
      await page.screenshot({ path: f }); shots.push(f); log('corpse', p.corpse);
    }
    if (p?.revivePending && !seen.has('revivePending')) {
      seen.add('revivePending');
      await page.screenshot({ path: `${OUT}/enemy-zombie-revive-pending.png` });
      log('revive pending');
    }
    // once burrow phases observed, weaponize a blocker to kill the zombie and force revive
    if (!killed && [...seen].some((s) => s.startsWith('burrow-')) ) {
      killed = await page.evaluate(() => {
        const scene = globalThis.__APP__?.battleScene;
        const z = (scene.actors || []).find((a) => String(a.slotId || '').includes('286'));
        const dog = (scene.actors || []).find((a) => a.side === 'dog-player' && a.isAlive?.());
        if (z && dog && !z.bcuBurrow) { z.hp = 1; return true; }
        return false;
      });
    }
    const ended = await page.evaluate(() => globalThis.__APP__?.battleScene?.battleState !== 'running');
    if (ended) break;
  }
  await page.screenshot({ path: `${OUT}/enemy-zombie-end.png` });
  results.burrow = { spawn, captures: [...seen] };
  log('burrow/zombie DONE captures', [...seen].join(',') || '(none)');
  await page.close();
}

console.log('\n===== RESULTS2 =====');
console.log(JSON.stringify(results, null, 1));
await browser.close();
