import { BCU_ABI, BCU_TRAITS } from '../battle/BcuCombatModel.js';

export const CHARACTER_MODIFICATION_FIELD_STATUS = Object.freeze({
  EDITABLE: 'editable',
  READ_ONLY: 'readOnly',
  HIDDEN: 'hidden'
});

export const CHARACTER_MODIFICATION_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'stats', label: '基本性能' }),
  Object.freeze({ id: 'production', label: '生産' }),
  Object.freeze({ id: 'attackCycle', label: '攻撃サイクル' }),
  Object.freeze({ id: 'attacks', label: '攻撃' }),
  Object.freeze({ id: 'traits', label: '属性' }),
  Object.freeze({ id: 'abilities', label: '能力' }),
  Object.freeze({ id: 'procs', label: '攻撃効果・妨害' }),
  Object.freeze({ id: 'defense', label: '防御・耐性' }),
  Object.freeze({ id: 'lifecycle', label: 'ライフサイクル' }),
  Object.freeze({ id: 'unsupported', label: '未対応' })
]);

const MAX_INT = 2_147_483_647;
const MAX_FRAME = 10_800_000;
const MAX_WORLD_VALUE = 1_000_000;
const SUPPORT_BOTH = Object.freeze(['unit', 'enemy']);
const SUPPORT_UNIT = Object.freeze(['unit']);
const SUPPORT_ENEMY = Object.freeze(['enemy']);
const OWNER_BOTH = Object.freeze(['formation', 'custom-stage']);
const OWNER_FORMATION = Object.freeze(['formation']);
const STRUCTURED_FIELD_PRESENTATION = Object.freeze({
  enabled: Object.freeze({ label: '有効', editor: 'checkbox' }),
  chance: Object.freeze({ label: '発動率', unit: '%', editor: 'number' }),
  multiplier: Object.freeze({ label: '倍率', unit: '%', editor: 'number' }),
  durationFrames: Object.freeze({ label: '持続時間', unit: 'frame', editor: 'frames' }),
  level: Object.freeze({ label: 'レベル', editor: 'number' }),
  strength: Object.freeze({ label: '強度', unit: '%', editor: 'number' }),
  health: Object.freeze({ label: '体力', editor: 'number' }),
  healthPercent: Object.freeze({ label: '体力割合', unit: '%', editor: 'number' }),
  regenPercent: Object.freeze({ label: '再生割合', unit: '%', editor: 'number' }),
  count: Object.freeze({ label: '回数', editor: 'number' }),
  delayFrames: Object.freeze({ label: '待機時間', unit: 'frame', editor: 'frames' }),
  distance: Object.freeze({ label: '距離', unit: 'BCU', editor: 'number' }),
  minDistance: Object.freeze({ label: '最小出現距離', unit: 'BCU', editor: 'number' }),
  maxDistance: Object.freeze({ label: '最大出現距離', unit: 'BCU', editor: 'number' }),
  minLayer: Object.freeze({ label: '最小レイヤー', editor: 'number' }),
  maxLayer: Object.freeze({ label: '最大レイヤー', editor: 'number' }),
  start: Object.freeze({ label: '開始位置', unit: 'BCU', editor: 'number' }),
  end: Object.freeze({ label: '終了位置', unit: 'BCU', editor: 'number' }),
  type: Object.freeze({ label: '種類', editor: 'select' }),
  targetKind: Object.freeze({ label: '召喚対象の種類', editor: 'select' }),
  targetId: Object.freeze({ label: '召喚対象ID', editor: 'number' }),
  form: Object.freeze({ label: '形態', editor: 'number' }),
  postSpawnTbaFrames: Object.freeze({ label: '召喚後TBA', unit: 'frame', editor: 'frames' }),
  animType: Object.freeze({ label: '出現演出', editor: 'select' }),
  ignoreLimit: Object.freeze({ label: '出撃制限を無視', editor: 'checkbox' }),
  fixBuff: Object.freeze({ label: '倍率を固定', editor: 'checkbox' }),
  sameHealth: Object.freeze({ label: '対象の残り体力を継承', editor: 'checkbox' }),
  bondHp: Object.freeze({ label: '召喚元と体力を連結', editor: 'checkbox' }),
  onHit: Object.freeze({ label: '命中時に召喚', editor: 'checkbox' }),
  onKill: Object.freeze({ label: '撃破時に召喚', editor: 'checkbox' })
});

const integer = (min, max, extra = {}) => Object.freeze({
  type: 'number',
  integer: true,
  min,
  max,
  ...extra
});
const number = (min, max, extra = {}) => Object.freeze({
  type: 'number',
  min,
  max,
  ...extra
});
const boolean = (extra = {}) => Object.freeze({ type: 'boolean', ...extra });
const enumeration = (values, extra = {}) => Object.freeze({
  type: 'enum',
  values: Object.freeze(values.slice()),
  ...extra
});

function structured(fields, extra = {}) {
  return Object.freeze({
    type: 'object',
    fields: Object.freeze(Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        Object.freeze({ ...(STRUCTURED_FIELD_PRESENTATION[key] || {}), ...value })
      ])
    )),
    ...extra
  });
}

function entry(config) {
  const value = config?.value || Object.freeze({ type: 'unknown' });
  return {
    support: SUPPORT_BOTH,
    owners: OWNER_BOTH,
    status: CHARACTER_MODIFICATION_FIELD_STATUS.EDITABLE,
    editor: 'number',
    rebuild: Object.freeze([]),
    ...config,
    value,
    valueType: value.type,
    min: value.min,
    max: value.max,
    normalization: Object.freeze({
      source: 'registry-value-descriptor',
      sparse: true,
      omitNull: true,
      preserveExplicitFalse: true
    }),
    validation: value
  };
}

function stat(id, label, value, runtimeKeys, extra = {}) {
  return entry({
    id,
    category: 'stats',
    label,
    value,
    apply: Object.freeze({ kind: 'stat', runtimeKeys: Object.freeze(runtimeKeys) }),
    rebuild: Object.freeze(['actorStats', 'worldValues']),
    ...extra
  });
}

function abilityFlag(id, label, bit, support = SUPPORT_UNIT, extra = {}) {
  const key = id.slice('abilityFlags.'.length);
  return entry({
    id,
    category: 'abilities',
    label,
    support,
    editor: 'checkbox',
    value: boolean(),
    apply: Object.freeze({ kind: 'abilityFlag', runtimeKey: key, abiBit: bit }),
    rebuild: Object.freeze(['combatModel', 'abilityModel', 'attackProfile']),
    hitScoped: extra.hitScoped === true,
    ...extra
  });
}

const chanceFields = {
  enabled: boolean({ required: true }),
  chance: integer(0, 100, { requiredWhenEnabled: true })
};

function proc(id, label, runtimeKey, fields, extra = {}) {
  const disableWhenZero = extra.disableWhenZero === false
    ? null
    : (extra.disableWhenZero || 'chance');
  return entry({
    id: `procs.${id}`,
    category: extra.category || 'procs',
    label,
    support: extra.support || SUPPORT_BOTH,
    editor: 'structured',
    value: structured({
      ...fields
    }, {
      disableWhenZero
    }),
    apply: Object.freeze({
      kind: 'proc',
      runtimeKey,
      runtimeFields: Object.freeze({ ...(extra.runtimeFields || {}) }),
      runtimeDefaults: Object.freeze({ ...(extra.runtimeDefaults || {}) }),
      mirrors: Object.freeze([...(extra.mirrors || [])]),
      exclusiveRuntimeKeys: Object.freeze([...(extra.exclusiveRuntimeKeys || [])]),
      normalEnabledField: extra.normalEnabledField || disableWhenZero,
      normalEnabledRuntimeField: extra.normalEnabledRuntimeField || null
    }),
    rebuild: Object.freeze(extra.rebuild || ['combatModel', 'abilityModel', 'attackProfile', 'procRuntime']),
    dependencies: Object.freeze(extra.dependencies || []),
    hitScoped: extra.hitScoped === true,
    ...extra,
    id: `procs.${id}`,
    category: extra.category || 'procs'
  });
}

function lifecycle(id, label, runtimeKey, fields, extra = {}) {
  const normalEnabledField = extra.normalEnabledField
    || (Object.prototype.hasOwnProperty.call(fields, 'health') ? 'health' : 'count');
  return entry({
    id: `lifecycle.${id}`,
    category: 'lifecycle',
    label,
    support: extra.support || SUPPORT_ENEMY,
    editor: 'structured',
    value: structured(fields, { disableWhenZero: normalEnabledField }),
    apply: Object.freeze({
      kind: 'proc',
      runtimeKey,
      runtimeFields: Object.freeze({ ...(extra.runtimeFields || {}) }),
      runtimeDefaults: Object.freeze({ ...(extra.runtimeDefaults || {}) }),
      mirrors: Object.freeze([...(extra.mirrors || [])]),
      normalEnabledField
    }),
    rebuild: Object.freeze(extra.rebuild || ['combatModel', 'abilityModel', 'actorInitialState']),
    dependencies: Object.freeze(extra.dependencies || [])
  });
}

function immunity(id, label, runtimeKey, support = SUPPORT_BOTH) {
  return entry({
    id: `procs.${id}`,
    category: 'defense',
    label,
    support,
    editor: 'structured',
    value: structured({
      enabled: boolean({ required: true }),
      strength: integer(0, 100, { requiredWhenEnabled: true })
    }, { disableWhenZero: 'strength' }),
    apply: Object.freeze({
      kind: 'proc',
      runtimeKey,
      runtimeFields: Object.freeze({ strength: 'mult' }),
      runtimeDefaults: Object.freeze({}),
      mirrors: Object.freeze([]),
      normalEnabledField: 'strength'
    }),
    rebuild: Object.freeze(['combatModel', 'immunity', 'resistance', 'abilityModel'])
  });
}

function readOnly(id, category, label, reason, extra = {}) {
  return entry({
    id,
    category,
    label,
    status: CHARACTER_MODIFICATION_FIELD_STATUS.READ_ONLY,
    editor: extra.editor || 'readOnly',
    value: extra.value || Object.freeze({ type: 'unknown' }),
    apply: null,
    rebuild: Object.freeze([]),
    unsupported: true,
    unsupportedReason: reason,
    ...extra
  });
}

const traitValues = Object.freeze(Object.values(BCU_TRAITS));

function summonOriginalValue(stats) {
  const raw = stats?.bcuCombatModel?.proc?.SUMMON
    ?? stats?.bcuCombatModel?.proc?.summon
    ?? stats?.bcuProc?.SUMMON
    ?? stats?.bcuProc?.summon;
  if (!raw || typeof raw !== 'object') return { enabled: false };
  const type = raw.type && typeof raw.type === 'object' ? raw.type : {};
  const typeBits = Number.isFinite(Number(raw.type)) ? Math.trunc(Number(raw.type)) : 0;
  const rawTargetId = raw.statsId ?? raw.targetId ?? raw.unitId ?? raw.enemyId ?? raw.id;
  const targetId = rawTargetId && typeof rawTargetId === 'object'
    ? rawTargetId.id ?? rawTargetId.value ?? rawTargetId.num ?? rawTargetId.uid ?? rawTargetId.eid
    : rawTargetId;
  const targetClass = String(
    rawTargetId?.cls
      ?? rawTargetId?.className
      ?? rawTargetId?.kind
      ?? rawTargetId?.type
      ?? ''
  );
  const inferredTargetKind = /Unit/i.test(targetClass)
    ? 'unit'
    : (/Enemy|AbEnemy/i.test(targetClass) ? 'enemy' : undefined);
  const value = {
    enabled: Number(raw.prob ?? raw.probability ?? 0) > 0,
    chance: raw.prob ?? raw.probability,
    targetKind: raw.kind ?? raw.statsType ?? raw.targetKind ?? inferredTargetKind,
    targetId,
    form: raw.form ?? (Number.isFinite(Number(raw.formRow)) ? Number(raw.formRow) + 1 : undefined),
    multiplier: raw.mult ?? raw.level ?? raw.magnification,
    minDistance: raw.dis ?? raw.distance ?? raw.minDistance,
    maxDistance: raw.maxDis ?? raw.max_dis ?? raw.maxDistance,
    minLayer: raw.minLayer ?? raw.min_layer,
    maxLayer: raw.maxLayer ?? raw.max_layer,
    delayFrames: raw.time ?? raw.delayFrames,
    postSpawnTbaFrames: raw.tba ?? raw.waitTime,
    animType: type.animType ?? type.anim_type ?? (typeBits & 0b11),
    ignoreLimit: type.ignoreLimit ?? type.ignore_limit ?? raw.ignoreLimit ?? raw.ignore_limit ?? ((typeBits & (1 << 2)) !== 0),
    fixBuff: type.fixBuff ?? type.fix_buff ?? raw.fixBuff ?? raw.fix_buff ?? ((typeBits & (1 << 3)) !== 0),
    sameHealth: type.sameHealth ?? type.same_health ?? raw.sameHealth ?? raw.same_health ?? ((typeBits & (1 << 4)) !== 0),
    bondHp: type.bondHp ?? type.bond_hp ?? raw.bondHp ?? raw.bond_hp ?? ((typeBits & (1 << 5)) !== 0),
    onHit: type.onHit ?? type.on_hit ?? raw.onHit ?? raw.on_hit ?? ((typeBits & (1 << 6)) !== 0),
    onKill: type.onKill ?? type.on_kill ?? raw.onKill ?? raw.on_kill ?? ((typeBits & (1 << 7)) !== 0)
  };
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null));
}

const entries = [
  stat('stats.maxHp', '最大体力', integer(1, MAX_INT), ['hp']),
  stat('stats.knockbacks', 'ノックバック数', integer(1, 1_000_000), ['knockbacks']),
  stat('stats.speed', '移動速度', number(0, MAX_WORLD_VALUE), ['speed']),
  stat('stats.detectionRange', '感知射程', number(0, MAX_WORLD_VALUE), ['detectionRange', 'range']),
  stat('stats.width', '当たり幅', number(0, MAX_WORLD_VALUE), ['width']),
  stat('stats.layer', 'レイヤー', integer(-128, 128), ['layer', 'currentLayer'], {
    rebuild: Object.freeze(['actorStats', 'renderLayer'])
  }),

  entry({
    id: 'production.cost',
    category: 'production',
    label: 'コスト',
    support: SUPPORT_BOTH,
    owners: OWNER_FORMATION,
    editor: 'number',
    value: integer(0, MAX_INT),
    apply: Object.freeze({
      kind: 'production',
      runtimeKey: 'cost'
    }),
    rebuild: Object.freeze(['production'])
  }),
  entry({
    id: 'production.respawnFrames',
    category: 'production',
    label: '再生産時間',
    support: SUPPORT_BOTH,
    owners: OWNER_FORMATION,
    editor: 'frames',
    value: integer(0, MAX_FRAME),
    apply: Object.freeze({
      kind: 'production',
      runtimeKey: 'respawnFrames'
    }),
    rebuild: Object.freeze(['production'])
  }),
  entry({
    id: 'production.deployLimit',
    category: 'production',
    label: '出撃上限',
    support: SUPPORT_BOTH,
    owners: OWNER_FORMATION,
    editor: 'number',
    value: integer(0, 1000),
    apply: Object.freeze({ kind: 'production', runtimeKey: 'deployLimit' }),
    rebuild: Object.freeze(['production'])
  }),

  entry({
    id: 'attackCycle.tbaFrames',
    category: 'attackCycle',
    label: '攻撃間隔',
    editor: 'frames',
    value: integer(0, MAX_FRAME),
    apply: Object.freeze({
      kind: 'stat',
      runtimeKeys: Object.freeze(['tbaFrames', 'attackWaitFrames'])
    }),
    rebuild: Object.freeze(['attackProfile'])
  }),
  entry({
    id: 'attackCycle.loopCount',
    category: 'attackCycle',
    label: '攻撃回数',
    editor: 'number',
    value: integer(-1, 1_000_000),
    apply: Object.freeze({ kind: 'stat', runtimeKeys: Object.freeze(['loop']) }),
    rebuild: Object.freeze(['attackProfile'])
  }),
  entry({
    id: 'attackCycle.postAttackFrames',
    category: 'attackCycle',
    label: '攻撃後待機',
    editor: 'frames',
    value: integer(0, MAX_FRAME),
    apply: Object.freeze({
      kind: 'stat',
      runtimeKeys: Object.freeze(['postAttackFrames'])
    }),
    rebuild: Object.freeze(['attackProfile'])
  }),

  entry({
    id: 'attacks.hitCount',
    category: 'attacks',
    label: '攻撃hit数',
    editor: 'number',
    value: integer(1, 3),
    apply: Object.freeze({ kind: 'attackCount' }),
    rebuild: Object.freeze(['attackHits', 'abilityModel', 'attackProfile'])
  }),
  entry({
    id: 'attacks.targetMode',
    category: 'attacks',
    label: '攻撃範囲',
    editor: 'segmented',
    value: enumeration(['single', 'area']),
    apply: Object.freeze({ kind: 'targetMode' }),
    rebuild: Object.freeze(['attackProfile'])
  }),
  entry({
    id: 'attacks.allowBaseHit',
    category: 'attacks',
    label: '城への攻撃',
    editor: 'checkbox',
    value: boolean(),
    apply: Object.freeze({ kind: 'allowBaseHit' }),
    rebuild: Object.freeze(['attackProfile'])
  }),
  entry({
    id: 'attacks.hits.*.damage',
    category: 'attacks',
    label: '公称ダメージ',
    editor: 'number',
    value: integer(0, MAX_INT),
    apply: Object.freeze({ kind: 'attackHit', runtimeKey: 'damage' }),
    rebuild: Object.freeze(['attackHits', 'actorStats', 'attackProfile'])
  }),
  entry({
    id: 'attacks.hits.*.preFrames',
    category: 'attacks',
    label: '攻撃発生',
    editor: 'frames',
    value: integer(0, MAX_FRAME),
    apply: Object.freeze({ kind: 'attackHit', runtimeKey: 'preFrames' }),
    rebuild: Object.freeze(['attackHits', 'attackProfile'])
  }),
  entry({
    id: 'attacks.hits.*.range',
    category: 'attacks',
    label: '攻撃射程',
    editor: 'range',
    value: structured({
      type: enumeration(['normal', 'ld', 'omni'], { required: true }),
      start: number(-MAX_WORLD_VALUE, MAX_WORLD_VALUE, { requiredFor: Object.freeze(['ld', 'omni']) }),
      end: number(-MAX_WORLD_VALUE, MAX_WORLD_VALUE, { requiredFor: Object.freeze(['ld', 'omni']) })
    }),
    apply: Object.freeze({ kind: 'attackRange' }),
    rebuild: Object.freeze(['attackHits', 'attackProfile'])
  }),
  entry({
    id: 'attacks.hits.*.targetMode',
    category: 'attacks',
    label: 'hit別攻撃範囲',
    editor: 'segmented',
    value: enumeration(['single', 'area']),
    apply: Object.freeze({ kind: 'attackHitTargetMode' }),
    rebuild: Object.freeze(['attackHits', 'attackProfile'])
  }),
  entry({
    id: 'attacks.hits.*.allowBaseHit',
    category: 'attacks',
    label: 'hit別 城への攻撃',
    editor: 'checkbox',
    value: boolean(),
    apply: Object.freeze({ kind: 'attackHitAllowBaseHit' }),
    rebuild: Object.freeze(['attackHits', 'attackProfile'])
  }),

  entry({
    id: 'traits',
    category: 'traits',
    label: '属性・対象属性',
    editor: 'multiSelect',
    value: Object.freeze({
      type: 'array',
      item: enumeration(traitValues),
      unique: true,
      orderInsensitive: true,
      preserveEmpty: true,
      maxItems: traitValues.length
    }),
    apply: Object.freeze({ kind: 'traits' }),
    rebuild: Object.freeze(['combatModel', 'abilityModel', 'attackProfile'])
  }),

  abilityFlag('abilityFlags.strong', 'めっぽう強い', BCU_ABI.AB_GOOD, SUPPORT_UNIT, { hitScoped: true }),
  abilityFlag('abilityFlags.resistant', '打たれ強い', BCU_ABI.AB_RESIST),
  abilityFlag('abilityFlags.massiveDamage', '超ダメージ', BCU_ABI.AB_MASSIVE, SUPPORT_UNIT, { hitScoped: true }),
  abilityFlag('abilityFlags.targetOnly', '対象限定', BCU_ABI.AB_ONLY, SUPPORT_UNIT, { hitScoped: true }),
  abilityFlag('abilityFlags.metallic', 'メタル', BCU_ABI.AB_METALIC),
  abilityFlag('abilityFlags.waveBlocker', '波動ストッパー', BCU_ABI.AB_WAVES, SUPPORT_BOTH),
  abilityFlag('abilityFlags.zombieKiller', 'ゾンビキラー', BCU_ABI.AB_ZKILL, SUPPORT_UNIT, { hitScoped: true }),
  abilityFlag('abilityFlags.witchKiller', '魔女キラー', BCU_ABI.AB_WKILL, SUPPORT_UNIT, { hitScoped: true }),
  abilityFlag('abilityFlags.glass', '一回攻撃', BCU_ABI.AB_GLASS, SUPPORT_BOTH),
  abilityFlag('abilityFlags.bossShockwaveImmune', '衝撃波無効', BCU_ABI.AB_IMUSW),
  abilityFlag('abilityFlags.evaKiller', '使徒キラー', BCU_ABI.AB_EKILL, SUPPORT_UNIT, { hitScoped: true }),
  abilityFlag('abilityFlags.insanelyTough', '超打たれ強い', BCU_ABI.AB_RESISTS),
  abilityFlag('abilityFlags.insaneDamage', '極ダメージ', BCU_ABI.AB_MASSIVES, SUPPORT_UNIT, { hitScoped: true }),
  abilityFlag('abilityFlags.baronKiller', '超生命体特効', BCU_ABI.AB_BAKILL, SUPPORT_UNIT, { hitScoped: true }),
  abilityFlag('abilityFlags.soulstrike', '魂攻撃', BCU_ABI.AB_CKILL, SUPPORT_UNIT, { hitScoped: true }),
  abilityFlag('abilityFlags.counterSurge', '烈波カウンター', BCU_ABI.AB_CSUR, SUPPORT_BOTH),
  abilityFlag('abilityFlags.sageSlayer', '超賢者特効', BCU_ABI.AB_SKILL, SUPPORT_UNIT, { hitScoped: true }),
  abilityFlag('abilityFlags.villainKiller', '超悪獣特効', BCU_ABI.AB_VKILL, SUPPORT_UNIT, { hitScoped: true }),

  proc('knockback', 'ふっとばし', 'knockback', {
    ...chanceFields,
    distance: number(-MAX_WORLD_VALUE, MAX_WORLD_VALUE, { default: 165, omitDefault: true }),
    durationFrames: integer(0, MAX_FRAME, { default: 11, omitDefault: true })
  }, {
    runtimeFields: { chance: 'prob', distance: 'dis', durationFrames: 'time' },
    runtimeDefaults: { distance: 165, durationFrames: 11 },
    hitScoped: true
  }),
  proc('freeze', '動きを止める', 'freeze', {
    ...chanceFields,
    durationFrames: integer(1, MAX_FRAME, { requiredWhenEnabled: true })
  }, { runtimeFields: { chance: 'prob', durationFrames: 'time' }, hitScoped: true }),
  proc('slow', '動きを遅くする', 'slow', {
    ...chanceFields,
    durationFrames: integer(1, MAX_FRAME, { requiredWhenEnabled: true })
  }, { runtimeFields: { chance: 'prob', durationFrames: 'time' }, hitScoped: true }),
  proc('weaken', '攻撃力低下', 'weaken', {
    ...chanceFields,
    durationFrames: integer(1, MAX_FRAME, { requiredWhenEnabled: true }),
    strength: integer(0, 100, { requiredWhenEnabled: true })
  }, {
    runtimeFields: { chance: 'prob', durationFrames: 'time', strength: 'mult' },
    hitScoped: true
  }),
  proc('critical', 'クリティカル', 'critical', {
    ...chanceFields,
    multiplier: integer(1, 10_000, { default: 200, omitDefault: true })
  }, {
    category: 'abilities',
    runtimeFields: { chance: 'prob', multiplier: 'mult' },
    runtimeDefaults: { multiplier: 200 },
    hitScoped: true
  }),
  proc('baseDestroyer', '城破壊', 'baseDestroyer', {
    enabled: boolean({ required: true }),
    multiplier: integer(1, 10_000, { default: 300, omitDefault: true })
  }, {
    category: 'abilities',
    disableWhenZero: false,
    normalEnabledField: 'multiplier',
    runtimeFields: { multiplier: 'mult' },
    runtimeDefaults: { multiplier: 300 },
    hitScoped: true
  }),
  proc('wave', '波動', 'wave', {
    ...chanceFields,
    level: integer(1, 1000, { requiredWhenEnabled: true })
  }, {
    category: 'abilities',
    runtimeFields: { chance: 'prob', level: 'level' },
    conflicts: ['procs.miniWave'],
    exclusiveRuntimeKeys: ['miniWave'],
    hitScoped: true
  }),
  proc('miniWave', '小波動', 'miniWave', {
    ...chanceFields,
    level: integer(1, 1000, { requiredWhenEnabled: true }),
    multiplier: integer(1, 100, { default: 20, omitDefault: true })
  }, {
    category: 'abilities',
    runtimeFields: { chance: 'prob', level: 'level', multiplier: 'mult' },
    runtimeDefaults: { multiplier: 20 },
    conflicts: ['procs.wave'],
    exclusiveRuntimeKeys: ['wave'],
    hitScoped: true
  }),
  proc('surge', '烈波', 'volcano', {
    ...chanceFields,
    level: integer(1, 1000, { requiredWhenEnabled: true }),
    start: number(-MAX_WORLD_VALUE, MAX_WORLD_VALUE, { requiredWhenEnabled: true }),
    end: number(-MAX_WORLD_VALUE, MAX_WORLD_VALUE, { requiredWhenEnabled: true })
  }, {
    category: 'abilities',
    runtimeFields: { chance: 'prob', level: 'level', start: 'dis0', end: 'dis1' },
    rebuild: ['combatModel', 'abilityModel', 'attackProfile', 'surgeRuntime'],
    conflicts: ['procs.miniSurge'],
    exclusiveRuntimeKeys: ['miniVolcano'],
    hitScoped: true
  }),
  proc('miniSurge', '小烈波', 'miniVolcano', {
    ...chanceFields,
    level: integer(1, 1000, { requiredWhenEnabled: true }),
    start: number(-MAX_WORLD_VALUE, MAX_WORLD_VALUE, { requiredWhenEnabled: true }),
    end: number(-MAX_WORLD_VALUE, MAX_WORLD_VALUE, { requiredWhenEnabled: true }),
    multiplier: integer(1, 100, { default: 20, omitDefault: true })
  }, {
    category: 'abilities',
    runtimeFields: { chance: 'prob', level: 'level', start: 'dis0', end: 'dis1', multiplier: 'mult' },
    runtimeDefaults: { multiplier: 20 },
    rebuild: ['combatModel', 'abilityModel', 'attackProfile', 'surgeRuntime'],
    conflicts: ['procs.surge'],
    exclusiveRuntimeKeys: ['volcano'],
    hitScoped: true
  }),
  proc('blast', '爆波', 'blast', {
    ...chanceFields,
    start: number(-MAX_WORLD_VALUE, MAX_WORLD_VALUE, { requiredWhenEnabled: true }),
    end: number(-MAX_WORLD_VALUE, MAX_WORLD_VALUE, { requiredWhenEnabled: true })
  }, {
    category: 'abilities',
    runtimeFields: { chance: 'prob', start: 'dis0', end: 'dis1' },
    rebuild: ['combatModel', 'abilityModel', 'attackProfile', 'blastRuntime'],
    hitScoped: true
  }),
  proc('strongAttack', '渾身の一撃', 'strongAttack', {
    ...chanceFields,
    multiplier: integer(1, 10_000, { requiredWhenEnabled: true })
  }, {
    category: 'abilities',
    runtimeFields: { chance: 'prob', multiplier: 'mult' },
    hitScoped: true
  }),
  proc('barrierBreaker', 'バリアブレイカー', 'barrierBreaker', chanceFields, {
    category: 'abilities',
    runtimeFields: { chance: 'prob' },
    hitScoped: true
  }),
  proc('shieldPierce', 'シールドブレイカー', 'shieldBreaker', chanceFields, {
    category: 'abilities',
    runtimeFields: { chance: 'prob' },
    hitScoped: true
  }),
  proc('warp', 'ワープ', 'warp', {
    ...chanceFields,
    durationFrames: integer(1, MAX_FRAME, { requiredWhenEnabled: true }),
    start: number(-MAX_WORLD_VALUE, MAX_WORLD_VALUE, { requiredWhenEnabled: true }),
    end: number(-MAX_WORLD_VALUE, MAX_WORLD_VALUE, { requiredWhenEnabled: true })
  }, {
    support: SUPPORT_ENEMY,
    runtimeFields: { chance: 'prob', durationFrames: 'time', start: 'dis0', end: 'dis1' },
    hitScoped: true
  }),
  proc('curse', '呪い', 'curse', {
    ...chanceFields,
    durationFrames: integer(1, MAX_FRAME, { requiredWhenEnabled: true })
  }, { runtimeFields: { chance: 'prob', durationFrames: 'time' }, hitScoped: true }),
  proc('seal', '封印', 'seal', {
    ...chanceFields,
    durationFrames: integer(1, MAX_FRAME, { requiredWhenEnabled: true })
  }, { runtimeFields: { chance: 'prob', durationFrames: 'time' }, hitScoped: true }),
  proc('toxic', '毒撃', 'toxic', {
    ...chanceFields,
    strength: integer(1, 100, { requiredWhenEnabled: true })
  }, { support: SUPPORT_ENEMY, runtimeFields: { chance: 'prob', strength: 'mult' }, hitScoped: true }),
  proc('attackNullify', '攻撃無効', 'attackNullify', {
    ...chanceFields,
    durationFrames: integer(1, MAX_FRAME, { requiredWhenEnabled: true })
  }, {
    category: 'defense',
    runtimeFields: { chance: 'prob', durationFrames: 'time' },
    mirrors: ['IMUATK']
  }),
  proc('strengthen', '攻撃力上昇', 'strengthen', {
    enabled: boolean({ required: true }),
    healthPercent: integer(1, 100, { requiredWhenEnabled: true }),
    strength: integer(1, 10_000, { requiredWhenEnabled: true })
  }, {
    category: 'abilities',
    disableWhenZero: false,
    normalEnabledField: 'healthPercent',
    runtimeFields: { healthPercent: 'health', strength: 'mult' }
  }),
  proc('lethal', '生き残る', 'lethal', chanceFields, {
    category: 'lifecycle',
    runtimeFields: { chance: 'prob' }
  }),
  proc('bounty', 'お金二倍', 'bounty', {
    enabled: boolean({ required: true }),
    multiplier: integer(1, 10_000, { default: 100, omitDefault: true })
  }, {
    category: 'abilities',
    support: SUPPORT_UNIT,
    disableWhenZero: false,
    normalEnabledField: 'multiplier',
    runtimeFields: { multiplier: 'mult' },
    runtimeDefaults: { multiplier: 100 }
  }),
  proc('metalKiller', 'メタルキラー', 'metalKiller', {
    enabled: boolean({ required: true }),
    strength: integer(1, 100, { requiredWhenEnabled: true })
  }, {
    category: 'abilities',
    support: SUPPORT_UNIT,
    disableWhenZero: false,
    normalEnabledField: 'strength',
    runtimeFields: { strength: 'mult' },
    hitScoped: true
  }),
  proc('beastHunter', '超獣特効', 'beastHunter', {
    enabled: boolean({ required: true }),
    chance: integer(0, 100, { requiredWhenEnabled: true }),
    durationFrames: integer(0, MAX_FRAME, { requiredWhenEnabled: true })
  }, {
    category: 'abilities',
    support: SUPPORT_UNIT,
    normalEnabledRuntimeField: 'active',
    runtimeFields: { chance: 'prob', durationFrames: 'time' },
    runtimeDefaults: { active: 1 },
    mirrors: ['bsthunt', 'BSTHUNT']
  }),
  proc('deathSurge', '死亡烈波', 'deathSurge', {
    ...chanceFields,
    level: integer(1, 1000, { requiredWhenEnabled: true }),
    start: number(-MAX_WORLD_VALUE, MAX_WORLD_VALUE, { requiredWhenEnabled: true }),
    end: number(-MAX_WORLD_VALUE, MAX_WORLD_VALUE, { requiredWhenEnabled: true })
  }, {
    category: 'lifecycle',
    support: SUPPORT_ENEMY,
    runtimeFields: { chance: 'prob', level: 'level', start: 'dis0', end: 'dis1' },
    rebuild: ['combatModel', 'abilityModel', 'deathEffectRuntime']
  }),
  proc('delay', '遅延', 'delay', {
    ...chanceFields,
    strength: integer(1, MAX_FRAME, { requiredWhenEnabled: true })
  }, { support: SUPPORT_ENEMY, runtimeFields: { chance: 'prob', strength: 'strength' }, hitScoped: true }),

  immunity('immuneKnockback', 'ふっとばし耐性', 'IMUKB'),
  immunity('immuneFreeze', '停止耐性', 'IMUSTOP'),
  immunity('immuneSlow', '遅くする耐性', 'IMUSLOW'),
  immunity('immuneWeaken', '攻撃力低下耐性', 'IMUWEAK'),
  immunity('immuneCurse', '呪い耐性', 'IMUCURSE'),
  immunity('immuneWarp', 'ワープ耐性', 'IMUWARP'),
  immunity('immuneToxic', '毒撃耐性', 'IMUPOIATK'),
  immunity('immuneWave', '波動耐性', 'IMUWAVE'),
  immunity('immuneSurge', '烈波耐性', 'IMUVOLC'),
  immunity('immuneBlast', '爆波耐性', 'IMUBLAST'),
  immunity('immuneSummon', '召喚耐性', 'IMUSUMMON'),
  immunity('immuneDelay', '遅延耐性', 'IMUDELAY'),

  lifecycle('barrier', 'バリア', 'barrier', {
    enabled: boolean({ required: true }),
    health: integer(1, MAX_INT, { requiredWhenEnabled: true })
  }, { runtimeFields: { health: 'health' } }),
  lifecycle('demonShield', '悪魔シールド', 'demonShield', {
    enabled: boolean({ required: true }),
    health: integer(1, MAX_INT, { requiredWhenEnabled: true }),
    regenPercent: integer(0, 100, { requiredWhenEnabled: true })
  }, { runtimeFields: { health: 'hp', regenPercent: 'regen' } }),
  lifecycle('revive', '蘇生', 'revive', {
    enabled: boolean({ required: true }),
    count: integer(-1, 1_000_000, { requiredWhenEnabled: true }),
    delayFrames: integer(0, MAX_FRAME, { requiredWhenEnabled: true }),
    healthPercent: integer(1, 100, { requiredWhenEnabled: true })
  }, {
    runtimeFields: { count: 'count', delayFrames: 'time', healthPercent: 'health' },
    dependencies: [{ field: 'traits', includes: BCU_TRAITS.zombie, severity: 'warning' }]
  }),
  lifecycle('burrow', '地中移動', 'burrow', {
    enabled: boolean({ required: true }),
    count: integer(-1, 1_000_000, { requiredWhenEnabled: true }),
    distance: number(0, MAX_WORLD_VALUE, { requiredWhenEnabled: true })
  }, {
    runtimeFields: { count: 'count', distance: 'dis' },
    dependencies: [{ field: 'traits', includes: BCU_TRAITS.zombie, severity: 'warning' }]
  }),

  entry({
    id: 'summon',
    category: 'lifecycle',
    label: '召喚',
    editor: 'structured',
    value: structured({
      enabled: boolean({ required: true }),
      chance: integer(0, 100, { requiredWhenEnabled: true }),
      targetKind: enumeration(['unit', 'enemy'], { requiredWhenEnabled: true }),
      targetId: integer(0, MAX_INT, { requiredWhenEnabled: true }),
      form: integer(1, 4, { default: 1, omitDefault: true }),
      multiplier: integer(0, 999_900, { requiredWhenEnabled: true }),
      minDistance: number(-MAX_WORLD_VALUE, MAX_WORLD_VALUE, { default: 0, omitDefault: true }),
      maxDistance: number(-MAX_WORLD_VALUE, MAX_WORLD_VALUE, { default: 0, omitDefault: true }),
      minLayer: integer(-1, 128, { default: -1, omitDefault: true }),
      maxLayer: integer(-1, 128, { default: -1, omitDefault: true }),
      delayFrames: integer(0, MAX_FRAME, { default: 0, omitDefault: true }),
      postSpawnTbaFrames: integer(-1, MAX_FRAME, { default: 0, omitDefault: true }),
      animType: enumeration([0, 1, 2, 3], { default: 0, omitDefault: true }),
      ignoreLimit: boolean({ default: false, omitDefault: true }),
      fixBuff: boolean({ default: false, omitDefault: true }),
      sameHealth: boolean({ default: false, omitDefault: true }),
      bondHp: boolean({ default: false, omitDefault: true }),
      onHit: boolean({ default: false, omitDefault: true }),
      onKill: boolean({ default: false, omitDefault: true })
    }, { disableWhenZero: 'chance' }),
    apply: Object.freeze({
      kind: 'proc',
      runtimeKey: 'SUMMON',
      runtimeFields: Object.freeze({
        chance: 'prob',
        targetKind: 'kind',
        targetId: 'statsId',
        form: 'form',
        multiplier: 'mult',
        minDistance: 'dis',
        maxDistance: 'maxDis',
        minLayer: 'minLayer',
        maxLayer: 'maxLayer',
        delayFrames: 'time',
        postSpawnTbaFrames: 'tba',
        animType: 'type',
        ignoreLimit: 'ignoreLimit',
        fixBuff: 'fixBuff',
        sameHealth: 'sameHealth',
        bondHp: 'bondHp',
        onHit: 'onHit',
        onKill: 'onKill'
      }),
      runtimeDefaults: Object.freeze({
        form: 1,
        minDistance: 0,
        maxDistance: 0,
        minLayer: -1,
        maxLayer: -1,
        delayFrames: 0,
        postSpawnTbaFrames: 0,
        animType: 0,
        ignoreLimit: false,
        fixBuff: false,
        sameHealth: false,
        bondHp: false,
        onHit: false,
        onKill: false
      }),
      mirrors: Object.freeze([]),
      normalEnabledField: 'chance',
      deleteAliases: Object.freeze(['summon'])
    }),
    rebuild: Object.freeze(['combatModel', 'abilityModel', 'attackProfile', 'summonRuntime', 'actorInitialState']),
    dependencies: Object.freeze([
      Object.freeze({
        kind: 'assetReference',
        targetField: 'targetId',
        targetKindField: 'targetKind',
        formField: 'form',
        resolver: 'summon',
        requiredWhenEnabled: true
      })
    ]),
    getOriginalValue: summonOriginalValue
  }),
  readOnly('lifecycle.spirit', 'unsupported', '精霊', 'Spirit slot assets and production ownership cannot be reconstructed from a scalar override.'),
  readOnly('procs.damageCut', 'defense', 'ダメージ軽減', 'The current runtime does not expose BCU damage-cut ownership as a stable editable proc.'),
  readOnly('procs.damageCap', 'defense', 'ダメージ上限', 'The current runtime does not expose BCU damage-cap ownership as a stable editable proc.'),
  readOnly('procs.hpRegen', 'defense', '体力回復', 'The current runtime does not expose BCU HP regeneration as a stable editable proc.'),
  readOnly('procs.armor', 'defense', 'アーマー', 'The current runtime does not expose BCU ARMOR semantics as a stable editable proc.'),
  readOnly('attacks.hits.*.rawAbi', 'unsupported', 'raw ABI', 'Raw CSV ABI bitmasks are intentionally not an editing surface.'),
  readOnly('assets.animationId', 'unsupported', 'アニメーション素材', 'Animation and semantic ZIP assets are outside character modification scope.')
];

const hitScopedEntries = entries.filter((item) => item.hitScoped === true);
for (const source of hitScopedEntries) {
  const isAbility = source.id.startsWith('abilityFlags.');
  const isProc = source.id.startsWith('procs.');
  if (!isAbility && !isProc) continue;
  const suffix = isAbility
    ? source.id.slice('abilityFlags.'.length)
    : source.id.slice('procs.'.length);
  const id = isAbility
    ? `attacks.hits.*.abilityFlags.${suffix}`
    : `attacks.hits.*.procs.${suffix}`;
  const conflicts = (source.conflicts || []).map((conflict) => (
    conflict.startsWith('procs.')
      ? `attacks.hits.*.procs.${conflict.slice('procs.'.length)}`
      : conflict
  ));
  entries.push(entry({
    ...source,
    id,
    category: 'attacks',
    label: `hit別 ${source.label}`,
    apply: Object.freeze({
      ...(source.apply || {}),
      kind: isAbility ? 'attackHitAbilityFlag' : 'attackHitProc'
    }),
    conflicts: Object.freeze(conflicts),
    registrySourceId: source.id,
    hitScoped: false
  }));
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

export const CHARACTER_MODIFICATION_FIELD_REGISTRY = deepFreeze(entries.map(entry));

const byId = new Map(CHARACTER_MODIFICATION_FIELD_REGISTRY.map((item) => [item.id, item]));

function splitPath(path) {
  return String(path || '').split('.').filter(Boolean);
}

export function matchCharacterModificationField(path) {
  const direct = byId.get(String(path));
  if (direct) return Object.freeze({ entry: direct, params: Object.freeze({}), path: String(path) });
  const parts = splitPath(path);
  for (const item of CHARACTER_MODIFICATION_FIELD_REGISTRY) {
    if (!item.id.includes('*')) continue;
    const pattern = splitPath(item.id);
    if (pattern.length !== parts.length) continue;
    const params = {};
    let matched = true;
    for (let index = 0; index < pattern.length; index += 1) {
      if (pattern[index] === '*') params.wildcard = parts[index];
      else if (pattern[index] !== parts[index]) {
        matched = false;
        break;
      }
    }
    if (matched) return Object.freeze({ entry: item, params: Object.freeze(params), path: String(path) });
  }
  return null;
}

export function getCharacterModificationField(id) {
  return byId.get(String(id)) || null;
}

export function getCharacterModificationFields(options = {}) {
  const kind = options.kind || null;
  const owner = options.owner || null;
  const category = options.category || null;
  const includeHidden = options.includeHidden === true;
  const includeReadOnly = options.includeReadOnly !== false;
  return CHARACTER_MODIFICATION_FIELD_REGISTRY.filter((item) => {
    if (category && item.category !== category) return false;
    if (kind && !item.support.includes(kind)) return false;
    if (owner && !item.owners.includes(owner)) return false;
    if (!includeHidden && item.status === CHARACTER_MODIFICATION_FIELD_STATUS.HIDDEN) return false;
    if (!includeReadOnly && item.status !== CHARACTER_MODIFICATION_FIELD_STATUS.EDITABLE) return false;
    return true;
  });
}

export function getCharacterModificationRootKeys() {
  return Object.freeze([...new Set(
    CHARACTER_MODIFICATION_FIELD_REGISTRY.map((item) => item.id.split('.')[0])
  )].sort());
}

export function characterModificationFieldSupports(entryOrId, kind, owner = null) {
  const item = typeof entryOrId === 'string' ? getCharacterModificationField(entryOrId) : entryOrId;
  return !!item
    && (!kind || item.support.includes(kind))
    && (!owner || item.owners.includes(owner));
}

export function expandCharacterModificationFields(options = {}) {
  const fields = getCharacterModificationFields(options);
  const normalCount = Array.isArray(options.normalStats?.attackHits)
    ? options.normalStats.attackHits.length
    : Number(options.normalStats?.attackCount || 0);
  const modifiedCount = Number(options.modification?.attacks?.hitCount || 0);
  const hitCount = Math.max(1, Math.min(3, modifiedCount || normalCount || 1));
  const expanded = [];
  for (const item of fields) {
    if (!item.id.includes('*')) {
      expanded.push(item);
      continue;
    }
    for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
      const id = item.id.replace('*', String(hitIndex));
      expanded.push(Object.freeze({
        ...item,
        id,
        registryId: item.id,
        params: Object.freeze({ wildcard: String(hitIndex), hitIndex })
      }));
    }
  }
  return Object.freeze(expanded);
}

export const CHARACTER_MODIFICATION_TRAITS = traitValues;
