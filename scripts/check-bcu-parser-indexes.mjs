import assert from 'node:assert/strict';
import { BcuCombatModel, BCU_ABI } from '../js/battle/BcuCombatModel.js';

function raw(length, entries) {
  const out = Array.from({ length }, () => 0);
  for (const [index, value] of entries) out[index] = value;
  return out;
}

const unit = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, [
  [35, 80], [36, 4], [94, 1],
  [86, 70], [87, 40], [88, 80], [89, 3], [108, 1],
  [113, 60], [114, 100], [115, 200],
  [70, 55], [82, 40], [83, 150],
  [37, 50], [38, 90], [39, 30],
  [40, 33], [41, 200], [42, 15],
  [33, 1], [105, 1], [106, 20], [107, 45],
  [112, 12], [75, 160], [76, 200],
  [84, 25], [85, 70],
  [110, 42],
  [67, 3],
  [56, 1],
  [46, 1], [91, 1], [116, 1],
  [111, 1]
]) });

assert.equal(unit.proc.miniWave.prob, 80, 'unit mini-wave reads 35 when flag 94 is set');
assert.equal(unit.proc.miniWave.level, 4, 'unit mini-wave level reads 36');
assert.equal(unit.proc.wave.prob, 0, 'unit normal wave disabled by mini flag');
assert.equal(unit.proc.miniVolcano.prob, 70, 'unit mini-surge reads 86 when flag 108 is set');
assert.equal(unit.proc.miniVolcano.dis0, 10, 'unit surge start index 87 is /4');
assert.equal(unit.proc.miniVolcano.dis1, 30, 'unit surge range end uses (87+88)/4');
assert.equal(unit.proc.miniVolcano.aliveTimeFrames, 60, 'unit surge level maps to level*20 frames');
assert.equal(unit.proc.blast.prob, 60, 'unit blast prob index 113');
assert.equal(unit.proc.blast.dis0, 25, 'unit blast start index 114 is /4');
assert.equal(unit.proc.blast.dis1, 75, 'unit blast range end uses (114+115)/4');
assert.equal(unit.proc.barrierBreaker.prob, 55, 'unit barrier breaker index 70');
assert.equal(unit.proc.strongAttack.prob, 40, 'unit strongAttack prob index 82');
assert.equal(unit.proc.strongAttack.mult, 150, 'unit strongAttack mult index 83');
assert.equal(unit.proc.weaken.prob, 50, 'unit weaken prob index 37');
assert.equal(unit.proc.weaken.time, 90, 'unit weaken time index 38');
assert.equal(unit.proc.weaken.mult, 30, 'unit weaken mult index 39');
assert.equal(unit.proc.strengthen.health, 33, 'unit strengthen health index 40');
assert.equal(unit.proc.strengthen.mult, 200, 'unit strengthen mult index 41');
assert.equal(unit.proc.lethal.prob, 15, 'unit lethal index 42');
assert.equal(unit.proc.bounty.mult, 100, 'unit bounty index 33');
assert.equal(unit.proc.beastHunter.active, 1, 'unit beast hunter active index 105');
assert.equal(unit.proc.metalKiller.mult, 12, 'unit metal killer index 112');
assert.equal(unit.proc.attackNullify.prob, 25, 'unit attack-nullify prob index 84');
assert.equal(unit.proc.attackNullify.time, 70, 'unit attack-nullify time index 85');
assert.equal(unit.proc.spirit.id, 42, 'unit spirit id index 110');
assert.equal((unit.ability.abi & BCU_ABI.AB_IMUSW) !== 0, true, 'unit AB_IMUSW boss shockwave immunity index 56');
assert.equal((unit.ability.abi & BCU_ABI.AB_SKILL) !== 0, true, 'unit AB_SKILL index 111');
assert.equal(unit.proc.IMUWAVE.full, true, 'unit IMUWAVE index 46');
assert.equal(unit.proc.IMUVOLC.full, true, 'unit IMUVOLC index 91');
assert.equal(unit.proc.IMUBLAST.full, true, 'unit IMUBLAST index 116');
assert.equal(unit.deathAnimation.soulId, 3, 'unit death animation index 67');

const enemy = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [
  [27, 90], [28, 5], [86, 1],
  [81, 75], [82, 120], [83, 80], [84, 2], [102, 1],
  [89, 100], [90, 40], [91, 120], [92, 3],
  [106, 65], [107, 20], [108, 40],
  [64, 2666], [87, 3000], [88, 50],
  [54, 7],
  [65, 44], [66, 22], [67, 160], [68, 240],
  [79, 100], [80, 35],
  [77, 30], [78, 90],
  [29, 25], [30, 120], [31, 40],
  [32, 50], [33, 150], [34, 10],
  [43, 2], [44, 400],
  [45, 1], [46, 120], [47, 50],
  [111, 45], [112, 8]
]) });

assert.equal(enemy.proc.miniWave.prob, 90, 'enemy mini-wave reads 27 when flag 86 is set');
assert.equal(enemy.proc.miniVolcano.dis0, 30, 'enemy surge start index 82 is /4');
assert.equal(enemy.proc.miniVolcano.dis1, 50, 'enemy surge range end uses (82+83)/4');
assert.equal(enemy.proc.deathSurge.prob, 100, 'enemy death surge prob index 89');
assert.equal(enemy.proc.deathSurge.dis0, 10, 'enemy death surge start index 90 is /4');
assert.equal(enemy.proc.deathSurge.dis1, 40, 'enemy death surge range end uses (90+91)/4');
assert.equal(enemy.proc.blast.dis0, 5, 'enemy blast start index 107 is /4');
assert.equal(enemy.proc.blast.dis1, 15, 'enemy blast range end uses (107+108)/4');
assert.equal(enemy.proc.barrier.health, 2666, 'enemy barrier index 64');
assert.equal(enemy.proc.demonShield.hp, 3000, 'enemy demon shield hp index 87');
assert.equal(enemy.proc.demonShield.regen, 50, 'enemy demon shield regen index 88');
assert.equal(enemy.proc.warp.dis0, 40, 'enemy warp start index 67 is /4');
assert.equal(enemy.proc.warp.dis1, 60, 'enemy warp end index 68 is /4');
assert.equal(enemy.proc.toxic.prob, 100, 'enemy toxic prob index 79');
assert.equal(enemy.proc.toxic.mult, 35, 'enemy toxic mult index 80');
assert.equal(enemy.proc.attackNullify.prob, 30, 'enemy attack-nullify prob index 77');
assert.equal(enemy.proc.burrow.dis, 100, 'enemy burrow distance index 44 is /4');
assert.equal(enemy.proc.revive.count, 1, 'enemy revive count index 45');
assert.equal(enemy.proc.revive.time, 120, 'enemy revive time index 46');
assert.equal(enemy.proc.revive.health, 50, 'enemy revive health index 47');
assert.equal(enemy.proc.delay.prob, 45, 'enemy delay prob index 111');
assert.equal(enemy.proc.delay.strength, 8, 'enemy delay strength index 112');
assert.equal(enemy.deathAnimation.soulId, 7, 'enemy death animation index 54');

const enemySoulFallback = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [[54, -1], [63, 1]]) });
assert.equal(enemySoulFallback.deathAnimation.soulId, 9, 'enemy death animation fallback -1 and index 63 == 1 maps to Soul 9');

console.log('check-bcu-parser-indexes: OK');
