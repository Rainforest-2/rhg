// Deterministic check: a real BCU REVIVE proc-object FILE (extra/custom
// "revive others" with a position window) drives the ZombX source/range filter.
//
// BCU facts (battle/entity/Entity.java ZombX.updateRevive):
//   d0 = em.pos + REVIVE.dis_0; d1 = em.pos + REVIVE.dis_1;
//   if ((d0 - e.pos) * (d1 - e.pos) > 0) continue;            // e outside [d0,d1]
//   if (em.kb.kbType == INT_WARP) continue;                   // warping reviver excluded
//   if (!conf.revive_non_zombie && e is zombie) continue;     // zombie needs revive_non_zombie
//   REVIVE.type.imu_zkill -> canZK() false -> Zombie Killer cannot deny the revive.
//
// Loads scripts/fixtures/bcu-custom-pack/revive-proc-object.json and feeds it to a
// reviver entity in scene.actors; the extra-revive runtime is the existing
// BattleActorZombieRevivePatch (own CSV revive carries only count/time/health).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BattleActor } from '../js/battle/BattleActor.js';
import '../js/battle/BattleActorZombieRevivePatch.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, 'fixtures', 'bcu-custom-pack', 'revive-proc-object.json'), 'utf8'));
const fileRevive = fixture.revive;
assert.equal(fileRevive.type.revive_others, true, 'fixture revive proc-object carries revive_others (extra/custom revive)');
assert.equal(fileRevive.dis_0, -200, 'fixture carries dis_0 window start');
assert.equal(fileRevive.dis_1, 200, 'fixture carries dis_1 window end');

function makeTarget(id, { posBcu = 1100, zombie = false } = {}) {
  const actor = new BattleActor({
    assetDef: { id }, side: 'cat-enemy', x: posBcu, y: 0, direction: 1,
    stats: {
      hp: 100, damage: 10, speed: 0, detectionRange: 100, range: 100, width: 40,
      bcuCombatModel: {
        kind: 'enemy',
        traits: { list: zombie ? ['zombie'] : [], flags: zombie ? { zombie: true } : {} },
        ability: { abi: 0, flags: {} },
        proc: { revive: { count: 0, time: 0, health: 0 } } // no own revive: isolate extra revive
      }
    },
    animations: {}
  });
  actor.instanceId = id; actor.maxHp = 100; actor.posBcu = posBcu;
  return actor;
}

// A reviver entity carrying the loaded REVIVE proc-object on its combat model.
function makeReviver(id, { posBcu = 1000, reviveOverride = {}, typeOverride = {}, warp = false } = {}) {
  const revive = { ...fileRevive, ...reviveOverride, type: { ...fileRevive.type, ...typeOverride } };
  return {
    instanceId: id, side: 'cat-enemy', posBcu, x: posBcu,
    ...(warp ? { kb: { kbType: 'warp' } } : {}),
    bcuCombatModel: { kind: 'enemy', proc: { revive } }
  };
}

function killTarget(target, { zombieKiller = false } = {}) {
  const semantic = zombieKiller ? { zombieKiller: true } : {};
  target.takeDamage(200, { timeMs: 0, damageCalculation: { abilityDebug: { eventAbilitySemantic: semantic } } });
  return target.resolvePostDamage({ nowMs: 0, tuning: { finalKnockbackBeforeDeath: false } });
}

function sceneFor(target, reviver) {
  target.scene = { actors: [target, reviver] };
}

// --- 1. range window: target inside [em.pos-200, em.pos+200] is revived -------
{
  const target = makeTarget('rng-in', { posBcu: 1100 }); // reviver 1000 -> window [800,1200]
  sceneFor(target, makeReviver('reviver-in', { posBcu: 1000 }));
  const result = killTarget(target);
  assert.equal(result.zombieReviveScheduled, true, 'an in-window target gets the extra revive');
  assert.equal(target.hp, fileRevive.health, 'extra revive restores the proc-object health percent');
  assert.equal(target.lastBcuZombieReviveDebug.mode, 'extra-revive', 'revive mode is extra-revive');
}

// --- 2. range window: target outside the window is not revived ----------------
{
  const target = makeTarget('rng-out', { posBcu: 1500 }); // outside [800,1200]
  sceneFor(target, makeReviver('reviver-out', { posBcu: 1000 }));
  const result = killTarget(target);
  assert.notEqual(result.zombieReviveScheduled, true, 'an out-of-window target is not revived by the ranged source');
}

// --- 3. revive_non_zombie gate: zombie target needs a revive_non_zombie source -
{
  const zTargetOk = makeTarget('z-ok', { posBcu: 1000, zombie: true });
  sceneFor(zTargetOk, makeReviver('z-src-ok', { posBcu: 1000, typeOverride: { revive_non_zombie: true } }));
  assert.equal(killTarget(zTargetOk).zombieReviveScheduled, true, 'a revive_non_zombie source revives a zombie target');

  const zTargetNo = makeTarget('z-no', { posBcu: 1000, zombie: true });
  sceneFor(zTargetNo, makeReviver('z-src-no', { posBcu: 1000, typeOverride: { revive_non_zombie: false } }));
  assert.notEqual(killTarget(zTargetNo).zombieReviveScheduled, true, 'a non-revive_non_zombie source does not extra-revive a zombie target');
}

// --- 4. imu_zkill: Zombie Killer cannot deny an imu_zkill revive --------------
{
  const blocked = makeTarget('zk-blocked', { posBcu: 1000 });
  sceneFor(blocked, makeReviver('zk-src-plain', { posBcu: 1000, typeOverride: { imu_zkill: false } }));
  assert.notEqual(killTarget(blocked, { zombieKiller: true }).zombieReviveScheduled, true, 'Zombie Killer denies a non-imu_zkill extra revive');

  const immune = makeTarget('zk-immune', { posBcu: 1000 });
  sceneFor(immune, makeReviver('zk-src-imu', { posBcu: 1000, typeOverride: { imu_zkill: true } }));
  assert.equal(killTarget(immune, { zombieKiller: true }).zombieReviveScheduled, true, 'imu_zkill keeps the extra revive despite a Zombie Killer hit');
}

// --- 5. warping reviver is excluded as a source ------------------------------
{
  const target = makeTarget('warp-src', { posBcu: 1000 });
  sceneFor(target, makeReviver('reviver-warp', { posBcu: 1000, warp: true }));
  assert.notEqual(killTarget(target).zombieReviveScheduled, true, 'a warping reviver is not a valid extra-revive source');
}

console.log('check-bcu-zombie-extra-revive-source-range-parity: OK');
