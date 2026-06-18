import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  activateBcuCatCannon,
  initializeBcuCatCannon,
  tickBcuCatCannonAttack,
  BCU_CAT_CANNON_WALL_ENTER_LEN,
  BCU_CAT_CANNON_WALL_SPAWN_OFFSET,
  BCU_CAT_CANNON_WALL_FORM_ID
} from '../js/battle/bcu-runtime/BcuCatCannonRuntime.js';
import { parseCannonCurveCsv, resolveBcuCatCannonMagnification } from '../js/battle/bcu-runtime/BcuCannonLevelCurve.js';
import '../js/battle/BattleActorProcStatusPatch.js';

const text = readFileSync(new URL('../public/assets/bcu/110800/org/data/CC_AllParts_growth.csv', import.meta.url), 'utf8');
const curveData = parseCannonCurveCsv(text);

let usedUnitProc = false;

function makeActor({ id, pos, hp = 10000, traits = [] }) {
  return {
    side: 'cat-enemy', instanceId: id, posBcu: pos, x: pos, hp, maxHp: hp, traits, state: 'move',
    appliedStatuses: [], lastDamage: null, lastKnockback: null,
    isAlive() { return this.hp > 0; },
    isTargetable() { return true; },
    takeDamage(amount, meta) { this.hp -= amount; this.lastDamage = { amount, meta }; return { accepted: true }; },
    applyBcuProc(itemArg, meta) {
      // mirror the real patch contract (key + payload)
      this.appliedStatuses.push(itemArg.key);
      this[`${itemArg.key}UntilMs`] = (meta?.nowMs || 0) + 1;
      return { applied: true, status: { key: itemArg.key } };
    },
    getKnockbackConfig() { return { distancePx: 24, durationMs: 150 }; },
    startKnockback(req) { this.state = 'knockback'; this.lastKnockback = req; return { ok: true }; }
  };
}

function makeScene(actors) {
  return {
    logicFrame: 0, timeMs: 0,
    bases: [{ side: 'dog-player', getBattlePosBcu: () => 4000 }],
    stage: { runtime: { playerBasePosBcu: 4000, enemyBasePosBcu: 0 } },
    actors, effects: [], debugEvents: [],
    pushEvent(e) { this.debugEvents.push(e); },
    queueAttackDamage() { usedUnitProc = true; throw new Error('cannon must not use unit-proc queueAttackDamage'); }
  };
}

// Fire a cannon and run ticks until it resolves (or a safety cap).
function fireAndResolve(scene) {
  assert.equal(activateBcuCatCannon(scene), true, 'cannon should activate when charged');
  for (let i = 0; i < 200; i++) {
    tickBcuCatCannonAttack(scene, { tuning: {} });
    if (!scene.bcuCatCannon.active) return scene.bcuCatCannon.lastAttackDebug;
  }
  throw new Error('cannon did not resolve within cap');
}

// --- Freeze cannon (id 3): localized damage + STOP, atk = getCanonAtk * atkMag/100 (4550 * 57 / 100). ---
{
  const enemy = makeActor({ id: 'freeze-target', pos: 2750 });
  const scene = makeScene([enemy]);
  initializeBcuCatCannon(scene, { id: 3, cannonCurveData: curveData });
  assert.equal(scene.bcuCatCannon.spec.preTime, 27, 'freeze preTime = NYPRE[3] = 27');
  const dbg = fireAndResolve(scene);
  assert.equal(dbg.cannonId, 3);
  assert.equal(enemy.lastDamage.amount, Math.floor((4550 * 57) / 100), 'freeze damage = canonAtk * atkMag/100');
  assert.ok(enemy.appliedStatuses.includes('freeze'), 'freeze cannon applies STOP -> freeze status');
}

// --- Water cannon (id 4): hits ALL (no AB_ONLY); metal takes health*pct/100, non-metal ~ health/1000. ---
{
  const metal = makeActor({ id: 'water-metal', pos: 2750, hp: 10000, traits: [3] });
  const soft = makeActor({ id: 'water-soft', pos: 2750, hp: 10000, traits: [] });
  const scene = makeScene([metal, soft]);
  initializeBcuCatCannon(scene, { id: 4, cannonCurveData: curveData });
  fireAndResolve(scene);
  assert.equal(metal.lastDamage.amount, Math.floor((10000 * 45) / 100), 'water vs metal = maxHp * health% / 100 = 4500');
  assert.equal(soft.lastDamage.amount, Math.max(1, Math.floor(10000 / 1000)), 'water vs non-metal = max(1, hp/1000)');
}

// --- Slow cannon (id 1): extend status, applies SLOW, no damage. ---
{
  const enemy = makeActor({ id: 'slow-target', pos: 3500 });
  const scene = makeScene([enemy]);
  initializeBcuCatCannon(scene, { id: 1, cannonCurveData: curveData });
  fireAndResolve(scene);
  assert.ok(enemy.appliedStatuses.includes('slow'), 'slow cannon applies SLOW');
  assert.equal(enemy.lastDamage, null, 'slow cannon deals no damage');
}

// --- Curse cannon (id 7): extend status, applies CURSE, no damage. ---
{
  const enemy = makeActor({ id: 'curse-target', pos: 3500 });
  const scene = makeScene([enemy]);
  initializeBcuCatCannon(scene, { id: 7, cannonCurveData: curveData });
  fireAndResolve(scene);
  assert.ok(enemy.appliedStatuses.includes('curse'), 'curse cannon applies CURSE');
  assert.equal(enemy.lastDamage, null, 'curse cannon deals no damage');
}

// --- Ground/zombie cannon (id 5): AB_ONLY -> only zombie enemies; applies STOP, no damage. ---
{
  const zombie = makeActor({ id: 'ground-zombie', pos: 3500, traits: [6] });
  const normal = makeActor({ id: 'ground-normal', pos: 3510, traits: [] });
  const scene = makeScene([zombie, normal]);
  initializeBcuCatCannon(scene, { id: 5, cannonCurveData: curveData });
  fireAndResolve(scene);
  assert.ok(zombie.appliedStatuses.includes('freeze'), 'ground cannon STOPs zombie enemies');
  assert.deepEqual(normal.appliedStatuses, [], 'ground cannon AB_ONLY skips non-zombie enemies');
}

// --- Barrier/blast cannon (id 6): localized damage + KB (INT_KB) + BREAK meta. ---
{
  const enemy = makeActor({ id: 'barrier-target', pos: 700 });
  const scene = makeScene([enemy]);
  initializeBcuCatCannon(scene, { id: 6, cannonCurveData: curveData });
  fireAndResolve(scene);
  assert.ok(enemy.lastDamage && enemy.lastDamage.amount > 0, 'barrier cannon deals damage');
  assert.equal(enemy.lastDamage.meta.breaksBarrier, true, 'barrier cannon flags BREAK on the hit');
  assert.equal(enemy.state, 'knockback', 'barrier cannon knocks back (INT_KB)');
  assert.equal(enemy.lastKnockback.bcuDistance, 165, 'INT_KB distance = 165');
  assert.equal(enemy.lastKnockback.bcuTimeFrames, 11, 'INT_KB time = 11');
}

// --- Wall cannon (id 2): spawns Form 339 wall EUnit at pos+100, lives aliveTime+enter.len()-1
//     frames, then SELF_DESTRUCTs; re-fire while the wall lives is rejected (replacement gating). ---
function makeWallScene(actors) {
  const scene = makeScene(actors);
  scene.spawnedWalls = [];
  scene.spawnBcuCannonWall = function spawnBcuCannonWall(worldX, opts) {
    const wall = {
      side: 'dog-player', bcuCatCannonWall: true, hp: 999999, worldX, opts,
      _alive: true, deadAt: null,
      isAlive() { return this._alive; },
      enterDeadState(nowMs) { this._alive = false; this.state = 'dead'; this.deadAt = nowMs; }
    };
    this.spawnedWalls.push(wall);
    return wall;
  };
  return scene;
}

{
  // Anchor = max(800, enemyBasePos=0) extended to the rearmost enemy (pos 2750) -> wall at 2750+100.
  const enemy = makeActor({ id: 'wall-anchor', pos: 2750 });
  const scene = makeWallScene([enemy]);
  initializeBcuCatCannon(scene, { id: 2, cannonCurveData: curveData });
  assert.equal(scene.bcuCatCannon.spec.preTime, -1, 'wall preTime = NYPRE[2] = -1');
  assert.equal(scene.bcuCatCannon.spec.wallFormId, BCU_CAT_CANNON_WALL_FORM_ID, 'wall spawns Form 339');
  const wallAliveTime = Math.floor(resolveBcuCatCannonMagnification(curveData, 2, null).magnification.wallAliveTime);
  const expectedAlive = Math.max(1, wallAliveTime + BCU_CAT_CANNON_WALL_ENTER_LEN - 1);

  assert.equal(activateBcuCatCannon(scene), true, 'wall cannon activates and spawns the wall');
  assert.equal(scene.spawnedWalls.length, 1, 'one Form 339 wall is spawned');
  assert.equal(scene.spawnedWalls[0].worldX, 2750 + BCU_CAT_CANNON_WALL_SPAWN_OFFSET, 'wall spawns at anchor + 100');
  assert.equal(scene.bcuCatCannon.active.geometry, 'wall', 'wall cannon enters a wall lifecycle');
  assert.equal(scene.bcuCatCannon.active.aliveFrames, expectedAlive, 'aliveFrames = wallAliveTime + enter.len() - 1');
  assert.equal(scene.bcuCatCannon.cannon, 0, 'firing resets the cannon charge');

  // Re-fire while the wall is alive is rejected (single wall / replacement gating).
  scene.bcuCatCannon.cannon = scene.bcuCatCannon.maxCannon;
  assert.equal(activateBcuCatCannon(scene), false, 'wall cannot be re-fired while one is active');
  assert.equal(scene.bcuCatCannon.lastFireDebug.reason, 'active');
  assert.equal(scene.spawnedWalls.length, 1, 'no second wall spawns while one is active');

  // Count the lifetime down: the wall stays until the final frame, then SELF_DESTRUCTs.
  for (let i = 0; i < expectedAlive - 1; i++) {
    const r = tickBcuCatCannonAttack(scene, { tuning: {} });
    assert.equal(r.geometry, 'wall', 'wall lifecycle still running');
    assert.ok(scene.spawnedWalls[0].isAlive(), 'wall is alive until its lifetime elapses');
  }
  const final = tickBcuCatCannonAttack(scene, { tuning: {} });
  assert.equal(final.wallExpired, true, 'wall self-destructs when its lifetime elapses');
  assert.equal(scene.spawnedWalls[0].isAlive(), false, 'wall is dead after SELF_DESTRUCT');
  assert.equal(scene.bcuCatCannon.active, null, 'cannon is released after the wall expires');
}

// --- Wall cannon with no enemies: anchor falls back to max(800, ebase.pos) -> wall at 900. ---
{
  const scene = makeWallScene([]);
  initializeBcuCatCannon(scene, { id: 2, cannonCurveData: curveData });
  assert.equal(activateBcuCatCannon(scene), true, 'wall cannon activates with no enemies present');
  assert.equal(scene.spawnedWalls[0].worldX, 800 + BCU_CAT_CANNON_WALL_SPAWN_OFFSET, 'no-enemy wall spawns at 900');
}

// --- Wall cannon early death: enemies destroy the wall before its lifetime -> cannon is released. ---
{
  const scene = makeWallScene([]);
  initializeBcuCatCannon(scene, { id: 2, cannonCurveData: curveData });
  activateBcuCatCannon(scene);
  scene.spawnedWalls[0]._alive = false; // simulate the wall being killed by enemies
  const r = tickBcuCatCannonAttack(scene, { tuning: {} });
  assert.equal(r.wallDiedEarly, true, 'wall death ends the lifecycle');
  assert.equal(scene.bcuCatCannon.active, null, 'cannon is released when the wall dies early');
}

// --- Wall cannon with no scene factory hook: fail closed (never guess the spawn). ---
{
  const scene = makeScene([]); // no spawnBcuCannonWall
  initializeBcuCatCannon(scene, { id: 2, cannonCurveData: curveData });
  assert.equal(activateBcuCatCannon(scene), false, 'wall activation fails closed without a spawn hook');
  assert.equal(scene.bcuCatCannon.lastFireDebug.reason, 'wall-spawn-unavailable');
}

// --- Wall cannon with unresolved magnification (no curve): fail closed, never a 0-frame wall. ---
{
  const scene = makeWallScene([]);
  initializeBcuCatCannon(scene, { id: 2 }); // no cannonCurveData
  assert.equal(scene.bcuCatCannon.spec.magnificationResolved, false, 'wall without curve data is unresolved');
  assert.equal(activateBcuCatCannon(scene), false, 'unresolved wall fails closed at activation');
  assert.equal(scene.bcuCatCannon.lastFireDebug.reason, 'cannon-magnification-unresolved');
  assert.equal(scene.spawnedWalls.length, 0, 'no wall spawns when alive-time is unresolved');
}

// --- Unresolved magnification (id 3 with NO curve data): fail closed, never silent no-op. ---
// CC_AllParts_growth.csv is not exposed through a semantic bundle, so the browser runtime gets no
// cannonCurveData. A non-basic cannon must reject activation with the exact missing keys rather than
// fire a magnification-less no-op (null atkMagnification -> 0 damage, null stopTime -> no proc).
{
  const enemy = makeActor({ id: 'unresolved-target', pos: 2750 });
  const scene = makeScene([enemy]);
  initializeBcuCatCannon(scene, { id: 3 }); // no cannonCurveData, no magnification override
  assert.equal(scene.bcuCatCannon.spec.magnificationResolved, false, 'id3 without curve data is unresolved');
  assert.equal(activateBcuCatCannon(scene), false, 'unresolved non-basic cannon fails closed at activation');
  assert.equal(scene.bcuCatCannon.lastFireDebug.reason, 'cannon-magnification-unresolved');
  assert.ok(
    scene.bcuCatCannon.lastFireDebug.missingMagnification.includes('atkMagnification')
      && scene.bcuCatCannon.lastFireDebug.missingMagnification.includes('stopTime'),
    'fail-closed diagnostic names the exact missing magnification keys'
  );
  assert.equal(enemy.lastDamage, null, 'unresolved cannon never touches an enemy');
}

// Ownership separation: no cannon went through unit-proc queueAttackDamage.
assert.equal(usedUnitProc, false, 'non-basic cannons must stay in the dedicated cannon source, not unit proc');

console.log('check-bcu-non-basic-cat-cannon-runtime-parity: OK');
