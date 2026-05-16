import { BattleStatsLoader } from './BattleStatsLoader.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';

const UNIT_IDS = [0, 1, 2, 3];
const ENEMY_IDS = [0, 1, 2];
const UNIT_LABELS = { 0: 'ネコ', 1: 'タンクネコ', 2: 'バトルネコ', 3: 'キモネコ' };
const ENEMY_LABELS = { 0: 'ワンコ', 1: 'ニョロ', 2: '例のヤツ' };
const expectedAttackCount = (atk1, atk2) => (atk1 === 0 ? 1 : (atk2 === 0 ? 2 : 3));
const expectedRespawnSeconds = (frames) => frames * BCU_BATTLE_TIMER_PERIOD_MS / 1000;

export async function verifyKnownStats() {
  const l = new BattleStatsLoader(); const errors = [];
  for (const id of UNIT_IDS) {
    const s = await l.loadUnitStats(id, 'f', 0);
    if (!(s.hp > 0)) errors.push(`unit-${id}: hp`);
    if (!(s.price > 0 || id !== 3)) errors.push(`unit-${id}: price`);
    if (s.respawnFrames !== (s.rawValues[7] || 0) * 2) errors.push(`unit-${id}: respawn`);
    if (Math.abs(s.respawnSeconds - expectedRespawnSeconds(s.respawnFrames)) > 0.000001) errors.push(`unit-${id}: respawnSeconds`);
    if (s.attackStartupFrames !== (s.rawValues[13] || 0)) errors.push(`unit-${id}: pre0`);
    if (s.attackCount !== expectedAttackCount(s.rawValues[59] || 0, s.rawValues[60] || 0)) errors.push(`unit-${id}: count`);
    if (id === 3) {
      if (!String(s.source.file).includes('unit003.csv')) errors.push('unit-3: file');
      if (s.source.row !== 0) errors.push('unit-3: row');
    }
  }
  for (const id of ENEMY_IDS) {
    const s = await l.loadEnemyStats(id);
    if (!(s.hp > 0)) errors.push(`enemy-${id}: hp`);
    if (!Number.isFinite(s.reward)) errors.push(`enemy-${id}: reward`);
  }
  return { ok: errors.length === 0, errors };
}

export async function printKnownStats() {
  const l = new BattleStatsLoader();
  for (const id of UNIT_IDS) {
    const s = await l.loadUnitStats(id, 'f', 0);
    console.log({ kind: 'unit', id, label: UNIT_LABELS[id], hp: s.hp, damage: s.damage, speed: s.speed, range: s.range, price: s.price, respawnFrames: s.respawnFrames, respawnSeconds: s.respawnSeconds, attackCount: s.attackCount, mapping: s.source.mapping, file: s.source.file, row: s.source.row });
  }
  for (const id of ENEMY_IDS) {
    const s = await l.loadEnemyStats(id);
    console.log({ kind: 'enemy', id, label: ENEMY_LABELS[id], hp: s.hp, damage: s.damage, speed: s.speed, range: s.range, price: null, respawnFrames: 0, respawnSeconds: 0, attackCount: s.attackCount, mapping: s.source.mapping, file: s.source.file, row: s.source.row });
  }
}
