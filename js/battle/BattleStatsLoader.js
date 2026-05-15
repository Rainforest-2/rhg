import {
  BCU_STATS_SCHEMA_VERSION,
  UNIT_FIELD_SCHEMA,
  ENEMY_FIELD_SCHEMA,
  buildBcuAttackHits,
  summarizeBcuRawFields
} from './BcuStatsSchema.js';
import { AbilityModel } from './AbilityModel.js';
import { ActorStatsModel } from './ActorStatsModel.js';
import { BcuCombatModel } from './BcuCombatModel.js';

const val = (v, i, fallback = 0) => Number.isFinite(v?.[i]) ? v[i] : fallback;
const parseCsvRows = (text) => text.split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, '').trim()).filter(Boolean).map((line) => line.split(',').map((x) => x.trim()));
const toNumbers = (cols) => cols.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));

function attachBcuCombatModel(stats, rawValues, kind) {
  const combatModel = BcuCombatModel.parseStats({ rawValues, kind });
  stats.bcuCombatModel = combatModel;
  stats.traits = combatModel.traits.list;
  stats.traitFlags = combatModel.traits.flags;
  stats.bcuAbi = combatModel.ability.abi;
  stats.bcuAbilityFlags = combatModel.ability.flags;
  stats.bcuProc = combatModel.proc;
  stats.abilityModel = AbilityModel.buildStatsAbilityModel({
    stats,
    rawValues,
    kind,
    bcuCombatModel: combatModel
  });
  stats.abilities = {
    model: stats.abilityModel,
    attackAbilities: stats.abilityModel.attackAbilities,
    hasRawAbi: stats.abilityModel.hasRawAbi,
    mappingStatus: stats.abilityModel.mappingStatus,
    bcuAbi: stats.bcuAbi,
    bcuFlags: stats.bcuAbilityFlags,
    proc: stats.bcuProc
  };
  return stats;
}

export class BattleStatsLoader {
  constructor({ bcuDb } = {}) {
    this.db = bcuDb || null;
  }

  parseUnitCsv(text) { return parseCsvRows(text).map(toNumbers); }
  parseEnemyTUnitCsv(text) { return parseCsvRows(text).map(toNumbers); }

  validateBcuStats(stats) {
    const invalidFields = [];
    const suspiciousFields = [];
    if (!(stats.hp > 0)) invalidFields.push('hp');
    if (!(stats.knockbacks >= 1)) invalidFields.push('knockbacks');
    if (!(stats.speed >= 0)) invalidFields.push('speed');
    if (!(stats.damage >= 0)) invalidFields.push('damage');
    if (!(stats.range >= 0)) invalidFields.push('range');
    if (!(stats.tbaFrames === stats.rawTbaFrames * 2)) invalidFields.push('tbaFrames');
    if (!Array.isArray(stats.attackHits) || stats.attackHits.length !== stats.attackCount) invalidFields.push('attackHits');
    if (stats.source?.type === 'unit' && !Number.isFinite(stats.price)) invalidFields.push('price');
    if (stats.source?.type === 'unit' && !Number.isFinite(stats.respawnFrames)) invalidFields.push('respawnFrames');
    if (stats.source?.type === 'enemy' && !Number.isFinite(stats.reward)) invalidFields.push('reward');
    if (!stats.attackHits?.[0]) invalidFields.push('hit0');
    if ((stats.attackHits?.[0]?.preFramesAbsolute ?? -1) !== stats.attackStartupFrames) suspiciousFields.push('hit0.preFramesAbsolute');
    return { invalidFields, suspiciousFields, valid: invalidFields.length === 0 };
  }

  normalizeUnitStats(raw, sourceInfo = {}, fps = 30) {
    const v = raw || [];
    const UNIT = UNIT_FIELD_SCHEMA;
    const rawTbaFrames = val(v, UNIT.tba, 0);
    const tbaFrames = Math.max(0, rawTbaFrames * 2);
    const price = Math.max(0, val(v, UNIT.price, 0));
    const respawnFrames = Math.max(0, val(v, UNIT.respawn, 0) * 2);
    const attackHits = buildBcuAttackHits({ rawValues: v, kind: 'unit' });
    const stats = { hp: Math.max(1, val(v, UNIT.hp, 1)), knockbacks: Math.max(1, val(v, UNIT.knockbacks, 1)), speed: Math.max(0, val(v, UNIT.speed, 0)), damage: Math.max(0, val(v, UNIT.atk0, 0)), rawTbaFrames, tbaFrames, attackWaitFrames: tbaFrames, detectionRange: Math.max(0, val(v, UNIT.range, 0)), range: Math.max(0, val(v, UNIT.range, 0)), price, costOrReward: price, respawnFrames, respawnSeconds: respawnFrames / (Number.isFinite(fps) && fps > 0 ? fps : 30), width: Math.max(0, val(v, UNIT.width, 0)), attackType: val(v, UNIT.attackType, 0) === 1 ? 1 : 0, isRange: val(v, UNIT.attackType, 0) === 1, attackStartupFrames: Math.max(0, val(v, UNIT.pre0, 0)), longPreFrames: Math.max(0, val(v, UNIT.pre2, 0) > 0 ? val(v, UNIT.pre2, 0) : (val(v, UNIT.pre1, 0) > 0 ? val(v, UNIT.pre1, 0) : val(v, UNIT.pre0, 0))), front: val(v, UNIT.front, 0), back: val(v, UNIT.back, 0), ldStartRaw: val(v, UNIT.ldStart, 0), ldRangeRaw: val(v, UNIT.ldRange, 0), loop: val(v, UNIT.loop, 0), attackCount: attackHits.length, attackHits, rawValues: v, source: { ...sourceInfo, type: 'unit', bcuAssetKind: 'unit', bcuRole: 'ally-unit', mapping: 'bcu-dataunit-v0111', assetSource: 'org/unit/{unit}/unit{unit}.csv', csvKind: 'unit-form-row', mappingStatus: sourceInfo.mappingStatus || 'valid', schemaVersion: BCU_STATS_SCHEMA_VERSION, fieldSchemaSummary: summarizeBcuRawFields({ rawValues: v, kind: 'unit' }) } };
    const r = this.validateBcuStats(stats);
    stats.source.invalidFields = r.invalidFields;
    stats.source.suspiciousFields = r.suspiciousFields;
    stats.source.mappingStatus = r.valid ? (r.suspiciousFields.length ? 'provisional' : 'valid') : 'invalid';
    attachBcuCombatModel(stats, v, 'unit');
    return stats;
  }

  normalizeEnemyStats(raw, sourceInfo = {}) {
    const v = raw || [];
    const ENEMY = ENEMY_FIELD_SCHEMA;
    const rawTbaFrames = val(v, ENEMY.tba, 0);
    const tbaFrames = Math.max(0, rawTbaFrames * 2);
    const rewardRaw = Math.max(0, val(v, ENEMY.reward, 0));
    const attackHits = buildBcuAttackHits({ rawValues: v, kind: 'enemy' });
    const stats = { hp: Math.max(1, val(v, ENEMY.hp, 1)), knockbacks: Math.max(1, val(v, ENEMY.knockbacks, 1)), speed: Math.max(0, val(v, ENEMY.speed, 0)), damage: Math.max(0, val(v, ENEMY.atk0, 0)), rawTbaFrames, tbaFrames, attackWaitFrames: tbaFrames, detectionRange: Math.max(0, val(v, ENEMY.range, 0)), range: Math.max(0, val(v, ENEMY.range, 0)), reward: rewardRaw, rewardRaw, dropAmount: rewardRaw * 100, costOrReward: rewardRaw, respawnFrames: 0, width: Math.max(0, val(v, ENEMY.width, 0)), attackType: val(v, ENEMY.attackType, 0) === 1 ? 1 : 0, isRange: val(v, ENEMY.attackType, 0) === 1, attackStartupFrames: Math.max(0, val(v, ENEMY.pre0, 0)), longPreFrames: Math.max(0, val(v, ENEMY.pre2, 0) > 0 ? val(v, ENEMY.pre2, 0) : (val(v, ENEMY.pre1, 0) > 0 ? val(v, ENEMY.pre1, 0) : val(v, ENEMY.pre0, 0))), ldStartRaw: val(v, ENEMY.ldStart, 0), ldRangeRaw: val(v, ENEMY.ldRange, 0), loop: val(v, ENEMY.loop, 0), star: val(v, ENEMY.star, 0), attackCount: attackHits.length, attackHits, rawValues: v, source: { ...sourceInfo, type: 'enemy', bcuAssetKind: 'enemy', bcuRole: 'enemy', mapping: 'bcu-dataenemy-v0111', assetSource: 'org/data/t_unit.csv', csvKind: 'enemy-table-row', mappingStatus: sourceInfo.mappingStatus || 'valid', schemaVersion: BCU_STATS_SCHEMA_VERSION, fieldSchemaSummary: summarizeBcuRawFields({ rawValues: v, kind: 'enemy' }) } };
    const r = this.validateBcuStats(stats);stats.source.invalidFields = r.invalidFields;stats.source.suspiciousFields = r.suspiciousFields;stats.source.mappingStatus = r.valid ? (r.suspiciousFields.length ? 'provisional' : 'valid') : 'invalid';
    attachBcuCombatModel(stats, v, 'enemy');
    return stats;
  }

  describeStats(stats) { const source = stats?.source || {}; return { type: source.type || '-', bcuAssetKind: source.bcuAssetKind || source.type || '-', bcuRole: source.bcuRole || '-', mapping: source.mapping || '-', schemaVersion: source.schemaVersion || '-', file: source.file || '-', row: Number.isFinite(source.row) ? source.row : null, unitId: source.unitId ?? null, enemyId: source.enemyId ?? null, form: source.form || null, formRow: Number.isFinite(source.formRow) ? source.formRow : null, hp: stats?.hp ?? null, knockbacks: stats?.knockbacks ?? null, damage: stats?.damage ?? null, speed: stats?.speed ?? null, range: stats?.range ?? stats?.detectionRange ?? null, width: stats?.width ?? null, isRange: !!stats?.isRange, rawTbaFrames: stats?.rawTbaFrames ?? null, tbaFrames: stats?.tbaFrames ?? null, attackStartupFrames: stats?.attackStartupFrames ?? null, longPreFrames: stats?.longPreFrames ?? null, price: stats?.price ?? null, respawnFrames: stats?.respawnFrames ?? null, respawnSeconds: stats?.respawnSeconds ?? null, reward: stats?.reward ?? null, dropAmount: stats?.dropAmount ?? null, traits: stats?.traits || [], bcuAbi: stats?.bcuAbi ?? null, bcuAbilityFlags: stats?.bcuAbilityFlags || {}, proc: stats?.bcuProc || null, attackCount: stats?.attackCount ?? null, attackHits: Array.isArray(stats?.attackHits) ? stats.attackHits.map((h) => ({ hitIndex: h.hitIndex, damage: h.damage, preFrames: h.preFrames, preFramesAbsolute: h.preFramesAbsolute, deltaFramesFromPrevious: h.deltaFramesFromPrevious, abi: h.abi, shortPointRaw: h.shortPointRaw, longPointRaw: h.longPointRaw, ldStartRaw: h.ldStartRaw, ldRangeRaw: h.ldRangeRaw, isLd: !!h.isLd, isOmni: !!h.isOmni })) : [] }; }
  applyStageEnemyMagnification(baseStats, modifiers = {}) {
    const model = ActorStatsModel.applyStageEnemyMagnification(baseStats, modifiers);
    return ActorStatsModel.toStatsObject(model);
  }

  async loadUnitStats(unitId, form = 'f', formRow = 0) {
    if (!this.db) throw new Error('BattleStatsLoader requires bcuDb; stats CSV fetch is centralized in BcuAssetDatabase.');
    return this.db.units.getFormStats(unitId, Number.isFinite(Number(formRow)) ? Number(formRow) : form);
  }
  async loadEnemyStats(enemyId) {
    if (!this.db) throw new Error('BattleStatsLoader requires bcuDb; stats CSV fetch is centralized in BcuAssetDatabase.');
    return this.db.enemies.getStats(enemyId);
  }
}
