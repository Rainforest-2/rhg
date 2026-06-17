import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  activateBcuCatCannon,
  initializeBcuCatCannon,
  tickBcuCatCannonAttack
} from '../js/battle/bcu-runtime/BcuCatCannonRuntime.js';
import { parseCannonCurveCsv } from '../js/battle/bcu-runtime/BcuCannonLevelCurve.js';
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

// --- Wall cannon (id 2): entity-spawn lifecycle not yet wired -> activate is rejected, not guessed. ---
{
  const scene = makeScene([]);
  initializeBcuCatCannon(scene, { id: 2, cannonCurveData: curveData });
  assert.equal(activateBcuCatCannon(scene), false, 'wall cannon activation is rejected (blocker)');
  assert.equal(scene.bcuCatCannon.lastFireDebug.reason, 'wall-cannon-entity-spawn-not-implemented');
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
