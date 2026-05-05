import { BattleStatsLoader } from './BattleStatsLoader.js';

const UNIT_IDS = [0, 1, 2];
const ENEMY_IDS = [0, 1, 2];

const expectedAttackCount = (atk1, atk2) => (atk1 === 0 ? 1 : (atk2 === 0 ? 2 : 3));

function verifyCommon(s, errors, prefix) {
  if (!(s.hp > 0)) errors.push(`${prefix}: hp`);
  if (!(s.knockbacks >= 1)) errors.push(`${prefix}: knockbacks`);
  if (!(s.speed >= 0)) errors.push(`${prefix}: speed`);
  if (!(s.damage >= 0)) errors.push(`${prefix}: damage`);
  if (!(s.detectionRange >= 0)) errors.push(`${prefix}: detectionRange`);
  if (s.tbaFrames !== s.rawTbaFrames * 2) errors.push(`${prefix}: tbaFrames`);
}

export async function verifyKnownStats() {
  const l = new BattleStatsLoader();
  const errors = [];
  for (const id of UNIT_IDS) {
    const s = await l.loadUnitStats(id, 'f', 0);
    verifyCommon(s, errors, `unit-${id}`);
    if (!Number.isFinite(s.price)) errors.push(`unit-${id}: price`);
    if (s.respawnFrames !== (s.rawValues[7] || 0) * 2) errors.push(`unit-${id}: respawnFrames`);
    if (s.attackCount !== expectedAttackCount(s.rawValues[59] || 0, s.rawValues[60] || 0)) errors.push(`unit-${id}: attackCount`);
    if ((s.attackHits[0]?.preFramesAbsolute ?? -1) !== (s.rawValues[13] || 0)) errors.push(`unit-${id}: hit0 pre`);
  }
  for (const id of ENEMY_IDS) {
    const s = await l.loadEnemyStats(id);
    verifyCommon(s, errors, `enemy-${id}`);
    if (!Number.isFinite(s.reward)) errors.push(`enemy-${id}: reward`);
    if (s.attackCount !== expectedAttackCount(s.rawValues[55] || 0, s.rawValues[56] || 0)) errors.push(`enemy-${id}: attackCount`);
    if ((s.attackHits[0]?.shortPointRaw ?? NaN) !== s.ldStartRaw) errors.push(`enemy-${id}: ld short`);
    if ((s.attackHits[0]?.longPointRaw ?? NaN) !== s.ldStartRaw + s.ldRangeRaw) errors.push(`enemy-${id}: ld long`);
  }
  return { ok: errors.length === 0, errors };
}

export async function printKnownStats() {
  const l = new BattleStatsLoader();
  for (const id of UNIT_IDS) {
    const s = await l.loadUnitStats(id, 'f', 0);
    console.log('unit', id, { hp: s.hp, price: s.price, respawnFrames: s.respawnFrames, attackCount: s.attackCount });
  }
  for (const id of ENEMY_IDS) {
    const s = await l.loadEnemyStats(id);
    console.log('enemy', id, { hp: s.hp, reward: s.reward, dropAmount: s.dropAmount, attackCount: s.attackCount });
  }
}
