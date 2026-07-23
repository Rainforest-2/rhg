import assert from 'node:assert/strict';
import {
  applyCrownToEnemyRow,
  applyCrownToMagnification
} from '../js/battle/bcu-runtime/BcuStageCrownRuntime.js';
import { ActorStatsModel } from '../js/battle/ActorStatsModel.js';

assert.equal(applyCrownToMagnification(101, 150), 151.5);
assert.equal(applyCrownToMagnification(400, 150), 600);

const crowned = applyCrownToEnemyRow({
  magnification: 101,
  hpMagnification: 101,
  attackMagnification: 101
}, 150);
assert.equal(crowned.hpMagnification, 151.5);
assert.equal(crowned.attackMagnification, 151.5);
assert.equal(crowned.hpMagnificationFactor, 1.515);
assert.equal(crowned.attackMagnificationFactor, 1.515);
assert.equal(crowned.rawRowHpMagnificationPercent, 101);
assert.equal(crowned.crownAppliedExactlyOnce, true);

const baseProc = {
  barrier: { health: 333 },
  demonShield: { hp: 777, regen: 20 },
  DMGCUT: { dmg: 111, type: { magnif: true } },
  DMGCAP: { dmg: 222, type: { magnif: true } },
  HPREGEN: { amount: 444, scaleWithBuff: true }
};
const baseStats = {
  hp: 100000,
  damage: 101,
  attackHits: [{ hitIndex: 0, damage: 101 }],
  bcuCombatModel: { kind: 'enemy', proc: baseProc },
  bcuProc: baseProc,
  source: { type: 'enemy', enemyId: 1 }
};
const model = ActorStatsModel.applyStageEnemyMagnification(baseStats, crowned);
const stats = ActorStatsModel.toStatsObject(model);

// BCU Entity: (int)(hp * hpMagnif), i.e. truncation after the full float product.
assert.equal(stats.hp, 151500);
// BCU AtkModelEntity: Math.round(raw attack * atkMagnif).
assert.equal(stats.damage, 153);
assert.equal(stats.attackHits[0].damage, 153);
assert.equal(stats.stageMagnification.hpMagnification, 151.5);
assert.equal(stats.stageMagnification.attackMagnification, 151.5);

// HP-derived proc values use the same preserved HP factor and final int cast.
assert.equal(stats.bcuProc.barrier.health, Math.trunc(333 * 1.515));
assert.equal(stats.bcuProc.demonShield.hp, Math.trunc(777 * 1.515));
assert.equal(stats.bcuProc.DMGCUT.dmg, Math.trunc(111 * 1.515));
assert.equal(stats.bcuProc.DMGCAP.dmg, Math.trunc(222 * 1.515));
assert.equal(stats.bcuProc.HPREGEN.amount, Math.trunc(444 * 1.515));
assert.equal(stats.bcuCombatModel.proc, stats.bcuProc);

console.log('check-bcu-stage-crown-precision: OK');
