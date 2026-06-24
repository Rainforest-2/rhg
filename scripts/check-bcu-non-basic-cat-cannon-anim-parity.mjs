import assert from 'node:assert/strict';
import {
  getBcuCatCannonAnimFiles,
  getBcuCatCannonAnimSources,
  initializeBcuCatCannon,
  requestBcuCatCannonFire,
  tickBcuCatCannonAttack,
  tickBcuCatCannonCharge
} from '../js/battle/bcu-runtime/BcuCatCannonRuntime.js';

// BCU evidence (this checkout):
//   util/pack/NyCastle.java: cannon part t loads aux.atks[t] from nyankoCastle_001_0<t>_*.
//     BASE eanim (firing at base) = _0<t>_01.mamodel/.maanim ; ATK eanim (effect / ContExtend EXT
//     sweep) = _0<t>_00.mamodel/.maanim ; both share the _0<t>_00.imgcut/.png sprite.
//   battle/entity/Cannon.java update(): each non-basic cannon draws atks[id].getEAnim(ATK) for its
//     localized AOE (freeze/water/blast) or ContExtend sweep (slow/curse).
// The bundle public/assets/bundles/castle/nyanko/001.zip physically ships _0<t>_00 and _0<t>_01 for
// every cannon id 0..7, so the per-cannon mapping is a faithful generalization of the proven id-0 path.

// 1. Per-cannon-id filename + source mapping for all 8 ids.
for (let id = 0; id <= 7; id++) {
  const t = String(id).padStart(2, '0');
  const files = getBcuCatCannonAnimFiles(id);
  assert.equal(files.part, t, `part id=${id}`);
  assert.equal(files.model, `nyankoCastle_001_${t}_01.mamodel`, `BASE model id=${id}`);
  assert.equal(files.anim, `nyankoCastle_001_${t}_01.maanim`, `BASE anim id=${id}`);
  assert.equal(files.atkModel, `nyankoCastle_001_${t}_00.mamodel`, `ATK model id=${id}`);
  assert.equal(files.atkAnim, `nyankoCastle_001_${t}_00.maanim`, `ATK anim id=${id}`);
  assert.equal(files.imgcut, `nyankoCastle_001_${t}_00.imgcut`, `imgcut id=${id}`);
  assert.equal(files.png, `nyankoCastle_001_${t}_00.png`, `png id=${id}`);
  const sources = getBcuCatCannonAnimSources(id);
  assert.equal(sources.base, `bcu-effanim-cat-cannon-base:nyankoCastle:001/nyankoCastle_001_${t}_01`, `base source id=${id}`);
  assert.equal(sources.atk, `bcu-effanim-cat-cannon-atk:nyankoCastle:001/nyankoCastle_001_${t}_00`, `atk source id=${id}`);
}

// 2. Basic cannon (id 0) mapping is unchanged from the previously-hardcoded names (no regression).
const basic = getBcuCatCannonAnimFiles(0);
assert.equal(basic.model, 'nyankoCastle_001_00_01.mamodel');
assert.equal(basic.atkModel, 'nyankoCastle_001_00_00.mamodel');
assert.equal(basic.png, 'nyankoCastle_001_00_00.png');

// 3. Out-of-range / non-integer cannon ids clamp to the basic part (never an undefined filename).
for (const bad of [-1, 8, 99, null, undefined, NaN, 3.7]) {
  const files = getBcuCatCannonAnimFiles(bad);
  assert.ok(/^nyankoCastle_001_0[0-7]_0[01]\.maanim$/.test(files.atkAnim), `clamped atkAnim for ${bad}`);
}

// 4. A non-basic cannon spawns the real per-cannon ATK eanim through the scene hook and skips the
//    no-image trace fallback when the hook reports success.
function makeScene(spawnHook) {
  const enemy = {
    side: 'cat-enemy', instanceId: 'e1', posBcu: 3800, x: 3800, hp: 50000, maxHp: 50000, state: 'move',
    isAlive() { return true; }, isTargetable() { return true; },
    takeDamage() { return { accepted: true }; },
    applyBcuProc() { return { applied: true }; },
    getKnockbackConfig() { return {}; }, startKnockback() { return { ok: true }; }
  };
  return {
    logicFrame: 0, timeMs: 0,
    bases: [{ side: 'dog-player', getBattlePosBcu: () => 4000 }],
    stage: { runtime: { playerBasePosBcu: 4000, enemyBasePosBcu: 0 } },
    actors: [enemy], effects: [], debugEvents: [],
    pushEvent(e) { this.debugEvents.push(e); },
    spawnCatCannonNonBasicEffect: spawnHook
  };
}

function fireFreezeCannon(scene) {
  // id 3 (freeze): magnification supplies atkMagnification + stopTime so the spec resolves and fires.
  initializeBcuCatCannon(scene, {
    id: 3,
    magnification: { atkMagnification: 100, stopTime: 90 },
    maxCannonFrames: 2,
    startChargeFrames: 1
  });
  tickBcuCatCannonCharge(scene);
  requestBcuCatCannonFire(scene);
  tickBcuCatCannonCharge(scene); // activates
  for (let i = 0; i < 80 && scene.bcuCatCannon.active; i++) tickBcuCatCannonAttack(scene);
}

// The runtime-side trace fallback is the only effect the runtime itself pushes (source
// `bcu-effanim-cat-cannon-<NAME>`); the real anim path leaves it to the scene hook.
const isTraceFallback = (e) => typeof e?.source === 'string' && e.source.startsWith('bcu-effanim-cat-cannon-BASE_');

// 4a. Hook returns true -> real anim used, no trace fallback effect pushed.
const hookCalls = [];
const sceneReal = makeScene((worldX, spec) => { hookCalls.push({ worldX, spec }); return true; });
fireFreezeCannon(sceneReal);
assert.ok(hookCalls.length >= 1, 'non-basic cannon must request its real ATK eanim via spawnCatCannonNonBasicEffect');
assert.equal(hookCalls[0].spec.id, 3, 'hook receives the firing cannon spec');
assert.ok(Number.isFinite(hookCalls[0].worldX), 'hook receives a finite effect world X');
assert.equal(sceneReal.effects.filter(isTraceFallback).length, 0, 'no trace fallback when the real anim spawned');
assert.equal(sceneReal.bcuCatCannon.lastEffectDebug.animSpawned, true, 'lastEffectDebug records the real anim spawn');

// 4b. Hook returns false (asset not loaded) -> observable trace fallback is still pushed.
const sceneFallback = makeScene(() => false);
fireFreezeCannon(sceneFallback);
assert.ok(sceneFallback.effects.filter(isTraceFallback).length >= 1, 'trace fallback is pushed when the per-cannon anim is unavailable');
assert.equal(sceneFallback.bcuCatCannon.lastEffectDebug.animSpawned, false, 'lastEffectDebug records the fallback');

// 4c. No scene hook at all -> still falls back to the trace (back-compat with older scenes).
const sceneNoHook = makeScene(undefined);
delete sceneNoHook.spawnCatCannonNonBasicEffect;
fireFreezeCannon(sceneNoHook);
assert.ok(sceneNoHook.effects.filter(isTraceFallback).length >= 1, 'trace fallback when no hook is present');

console.log('OK check-bcu-non-basic-cat-cannon-anim-parity: per-cannon BASE/ATK(EXT) eanim mapping + real-anim spawn with observable trace fallback');
