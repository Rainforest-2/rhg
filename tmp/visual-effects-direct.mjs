// Definitive effect-appearance review: spawn each brief priority effect through the
// REAL runtime spawn function, freeze the sim so it persists, verify the bundle asset
// actually loaded (frameCount > 0), and capture a tight zoom. Coordinates/scale/layer
// are already locked by the deterministic checks; this confirms the sprite renders.
// Also captures zombie corpse DOWN/REVIVE via a controlled kill of enemy 284.
import { launch, newApp, startBattle, produceLoop } from './visual-harness.mjs';

const OUT = 'tmp/visual-shots';
const log = (...a) => console.log('[fx]', ...a);

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
      if (ok) { const e = (scene.actors || []).find((a) => String(a.slotId || '').includes(String(id))); if (e && Number.isFinite(x)) { e.x = x; e.hp = 500000; e.maxHp = 500000; } }
      return { ok, slotId: def.slotId };
    }, { id: enemyId, x });
    if (!r.ok) await page.waitForTimeout(500);
  }
  return r;
}

// spawn an effect via runtime, wait for the bundle to load, freeze, return asset proof
async function spawnEffectOnEnemy(page, enemyId, kind, eventOrPhase) {
  return page.evaluate(async ({ enemyId, kind, eventOrPhase }) => {
    const scene = globalThis.__APP__?.battleScene;
    const e = (scene.actors || []).find((a) => String(a.slotId || '').includes(String(enemyId)));
    if (!e) return { ok: false, reason: 'no-enemy' };
    let effect = null;
    if (kind === 'barrier' || kind === 'shield') {
      const mod = await import('/js/battle/bcu-runtime/BcuBarrierShieldEffectRuntime.js');
      effect = mod.spawnBcuBarrierShieldVisual(scene, e, eventOrPhase, { source: 'visual-review' });
    } else if (kind === 'guard') {
      const mod = await import('/js/battle/bcu-runtime/BcuCastleGuardRuntime.js');
      effect = mod.spawnCastleGuardEffect(scene, eventOrPhase);
    } else if (kind === 'delay') {
      const mod = await import('/js/battle/BcuWaveBundleEffectSpawner.js');
      effect = mod.spawnWaveBundleEffect(scene, { key: 'enemyDelay', actor: e, layer: e.currentLayer || 0, type: 'delay', source: 'visual-review', bcuSmokeYOffset: -50 });
    }
    return { ok: !!effect, effectId: effect?.id || null, type: effect?.type || null, x: Math.round(e.x) };
  }, { enemyId, kind, eventOrPhase });
}

const effectProof = (page) => page.evaluate(() => {
  const scene = globalThis.__APP__?.battleScene;
  return (scene?.effects || []).map((fx) => ({
    type: fx.type, phase: fx.phase || fx.bcuPhase || null,
    frameCount: fx.animator?.maxFrame ?? fx.animator?.frameCount ?? fx.maxFrame ?? fx.frameCount ?? null,
    hasAnimator: !!fx.animator, scale: fx.scale ?? null, layer: fx.currentLayer ?? null,
    durationMs: fx.durationMs ?? null,
  }));
});

const browser = await launch();
const results = {};

// A/B/C/D: direct-spawn brief effects on a frozen scene, zoomed
const cases = [
  { name: 'barrier-none', enemy: 362, kind: 'barrier', arg: { type: 'barrier-hit-blocked' } },
  { name: 'barrier-breaker', enemy: 362, kind: 'barrier', arg: { type: 'barrier-breaker' } },
  { name: 'shield-full', enemy: 552, kind: 'shield', arg: { type: 'shield-hit-absorbed', before: 500, after: 400, max: 500 } },
  { name: 'shield-destruction', enemy: 552, kind: 'shield', arg: { type: 'shield-broken-by-damage' } },
  { name: 'shield-regen', enemy: 552, kind: 'shield', arg: { type: 'shield-regen' } },
  { name: 'delay', enemy: 772, kind: 'delay', arg: null },
  { name: 'guard-hold', enemy: 362, kind: 'guard', arg: 'none' },
  { name: 'guard-break', enemy: 362, kind: 'guard', arg: 'breaker' },
];

for (const c of cases) {
  const { page } = await newApp(browser, {});
  await startBattle(page);
  const spawn = await spawnEnemy(page, c.enemy, 2200);
  await page.waitForTimeout(300);
  // spawn effect, retry while bundle loads
  let res = { ok: false };
  for (let i = 0; i < 25 && !res.ok; i += 1) {
    res = await spawnEffectOnEnemy(page, c.enemy, c.kind, c.arg);
    if (!res.ok) await page.waitForTimeout(400);
  }
  // let the bundle finish loading frames, then freeze
  await page.waitForTimeout(600);
  await page.evaluate(() => { globalThis.__APP__.battleScene.battleState = 'paused'; });
  await page.waitForTimeout(150);
  const proof = await effectProof(page);
  // tight zoom around mid-field where the enemy/effect is
  await page.screenshot({ path: `${OUT}/fx-${c.name}.png` });
  await page.screenshot({ path: `${OUT}/fx-${c.name}-zoom.png`, clip: { x: 330, y: 300, width: 520, height: 360 } });
  results[c.name] = { spawn: spawn.ok, res, proof: proof.filter((p) => p.type && p.type !== 'hit') };
  log(c.name, 'effect', res.ok, 'proof', JSON.stringify(results[c.name].proof));
  await page.close();
}

// E: zombie corpse DOWN/REVIVE via controlled kill of 284
{
  const { page } = await newApp(browser, {});
  await startBattle(page);
  const spawn = await spawnEnemy(page, 284, 2000);
  // make it killable and drop a strong attacker
  await page.evaluate(() => {
    const scene = globalThis.__APP__?.battleScene;
    const z = (scene.actors || []).find((a) => String(a.slotId || '').includes('284'));
    if (z) { z.hp = 200; z.maxHp = 200; }
  });
  const seen = new Set();
  const end = Date.now() + 60000;
  let struck = false;
  while (Date.now() < end) {
    await produceLoop(page, 1, 250);
    const p = await page.evaluate(() => {
      const scene = globalThis.__APP__?.battleScene;
      const z = (scene?.actors || []).find((a) => String(a.slotId || '').includes('284'));
      return {
        gone: !z, state: scene?.battleState,
        z: z ? {
          hp: Math.round(z.hp), st: z.state, x: Math.round(z.x),
          corpse: z.bcuZombieCorpseVisual?.active ? z.bcuZombieCorpseVisual.phase : null,
          revivePending: z.bcuZombieRevivePending === true,
          revived: z.lastBcuZombieReviveDebug?.revived === true,
        } : null,
      };
    });
    if (!struck && p.z && p.z.hp > 50) {
      // force lethal so the revive lifecycle starts deterministically
      struck = await page.evaluate(() => { const z = (globalThis.__APP__.battleScene.actors || []).find((a) => String(a.slotId || '').includes('284')); if (z) { z.hp = 1; return true; } return false; });
    }
    if (p.z?.corpse && !seen.has('corpse-' + p.z.corpse)) { seen.add('corpse-' + p.z.corpse); await page.screenshot({ path: `${OUT}/fx-zombie-corpse-${p.z.corpse}.png` }); await page.screenshot({ path: `${OUT}/fx-zombie-corpse-${p.z.corpse}-zoom.png`, clip: { x: 280, y: 320, width: 560, height: 360 } }); log('corpse', p.z.corpse, '@x' + p.z.x); }
    if (p.z?.revivePending && !seen.has('pending')) { seen.add('pending'); await page.screenshot({ path: `${OUT}/fx-zombie-revive-pending-zoom.png`, clip: { x: 280, y: 320, width: 560, height: 360 } }); log('revive pending'); }
    if (p.z?.revived && !seen.has('revived')) { seen.add('revived'); await page.screenshot({ path: `${OUT}/fx-zombie-revived-zoom.png`, clip: { x: 280, y: 320, width: 560, height: 360 } }); log('REVIVED @x' + p.z.x); }
    if (p.gone || (p.state && p.state !== 'running')) break;
  }
  results.zombie = { spawn: spawn.ok, captures: [...seen] };
  log('zombie corpse/revive captures', [...seen].join(',') || '(none)');
  await page.close();
}

console.log('\n===== FX RESULTS =====');
console.log(JSON.stringify(results, null, 1));
await browser.close();
