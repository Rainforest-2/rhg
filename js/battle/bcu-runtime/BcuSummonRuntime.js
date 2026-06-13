import { BATTLE_CONFIG } from '../BattleConfig.js';
import { BattleCombatCoordinateRuntime } from '../BattleCombatCoordinateRuntime.js';
import { TEMPLATE_LOAD_LEVEL } from '../BattleActorFactory.js';

export const BCU_SUMMON_RUNTIME_VERSION = 'bcu-summon-runtime-v1';
export const BCU_SUMMON_REFERENCE = 'BCU AtkModelEntity#setProc/invokeLater, AtkModelUnit#summon, AtkModelEnemy#summon, Entity#setSummon';

const FORM_CODES = Object.freeze(['f', 'c', 's', 'u']);

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstNumber(...values) {
  for (const value of values) {
    const n = numberOrNull(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function int(value, fallback = 0) {
  const n = numberOrNull(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clampPercent(value) {
  const n = int(value, 0);
  return Math.max(0, Math.min(100, n));
}

function bool(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  return false;
}

function sideDefaultKind(attacker) {
  const kind = attacker?.bcuCombatModel?.kind || attacker?.rawStats?.bcuCombatModel?.kind || attacker?.stats?.bcuCombatModel?.kind || attacker?.rawStats?.source?.type || attacker?.statsType || attacker?.sourceKind;
  if (kind === 'unit' || kind === 'enemy') return kind;
  return attacker?.side === 'dog-player' ? 'unit' : 'enemy';
}

function sideForKind(kind, attacker) {
  if (kind === 'unit') return 'dog-player';
  if (kind === 'enemy') return 'cat-enemy';
  return attacker?.side === 'dog-player' ? 'dog-player' : 'cat-enemy';
}

function directionForSide(side, fallback = 1) {
  if (side === 'dog-player') return -1;
  if (side === 'cat-enemy') return 1;
  return Number.isFinite(fallback) ? fallback : 1;
}

function parseType(rawType = null, source = {}) {
  if (rawType && typeof rawType === 'object') {
    return {
      animType: Math.max(0, Math.min(3, int(rawType.animType ?? rawType.anim_type, source.animType ?? 0))),
      ignoreLimit: bool(rawType.ignoreLimit ?? rawType.ignore_limit ?? source.ignoreLimit ?? source.ignore_limit),
      fixBuff: bool(rawType.fixBuff ?? rawType.fix_buff ?? source.fixBuff ?? source.fix_buff),
      sameHealth: bool(rawType.sameHealth ?? rawType.same_health ?? source.sameHealth ?? source.same_health),
      bondHp: bool(rawType.bondHp ?? rawType.bond_hp ?? source.bondHp ?? source.bond_hp),
      onHit: bool(rawType.onHit ?? rawType.on_hit ?? source.onHit ?? source.on_hit),
      onKill: bool(rawType.onKill ?? rawType.on_kill ?? source.onKill ?? source.on_kill)
    };
  }
  const bits = int(rawType ?? source.typeBits ?? source.type, 0);
  return {
    animType: bits & 0b11,
    ignoreLimit: (bits & (1 << 2)) !== 0 || bool(source.ignoreLimit ?? source.ignore_limit),
    fixBuff: (bits & (1 << 3)) !== 0 || bool(source.fixBuff ?? source.fix_buff),
    sameHealth: (bits & (1 << 4)) !== 0 || bool(source.sameHealth ?? source.same_health),
    bondHp: (bits & (1 << 5)) !== 0 || bool(source.bondHp ?? source.bond_hp),
    onHit: (bits & (1 << 6)) !== 0 || bool(source.onHit ?? source.on_hit),
    onKill: (bits & (1 << 7)) !== 0 || bool(source.onKill ?? source.on_kill)
  };
}

function idObjectKind(id) {
  const cls = String(id?.cls || id?.className || id?.kind || id?.type || '');
  if (/Unit/.test(cls)) return 'unit';
  if (/Enemy|AbEnemy/.test(cls)) return 'enemy';
  return null;
}

function normalizeKind(raw, attacker) {
  const value = String(raw || '').toLowerCase();
  if (value === 'unit' || value === 'ally' || value === 'cat' || value === 'eunit') return 'unit';
  if (value === 'enemy' || value === 'abenemy' || value === 'eenemy') return 'enemy';
  return sideDefaultKind(attacker);
}

function normalizeId(raw) {
  if (raw === null || raw === undefined) return { statsId: null, kind: null, rawId: raw };
  if (typeof raw === 'object') {
    const statsId = firstNumber(raw.id, raw.value, raw.num, raw.uid, raw.eid);
    return { statsId: Number.isFinite(statsId) ? Math.trunc(statsId) : null, kind: idObjectKind(raw), rawId: raw };
  }
  const statsId = firstNumber(raw);
  return { statsId: Number.isFinite(statsId) ? Math.trunc(statsId) : null, kind: null, rawId: raw };
}

function attackEventKey(event, meta = {}) {
  return meta.key || meta.attackEventKey || event?.key || event?.attackEventKey || `hit-${event?.hitIndex ?? meta.hitIndex ?? 0}`;
}

function actorRollMap(actor) {
  if (!actor.__bcuSummonEventRolls) actor.__bcuSummonEventRolls = new Map();
  return actor.__bcuSummonEventRolls;
}

function eventRollKey(attacker, event, meta = {}) {
  return [
    attacker?.attackCycleId ?? 0,
    attackEventKey(event, meta),
    event?.hitIndex ?? meta.hitIndex ?? 0
  ].join(':');
}

function randomFrom(scene, meta = {}) {
  if (typeof meta.random === 'function') return meta.random;
  const r = scene?.getBcuRandom?.();
  if (typeof r === 'function') return r;
  return Math.random;
}

function rollPercent(prob, random = Math.random) {
  const p = clampPercent(prob);
  if (p <= 0) return false;
  if (p >= 100) return true;
  return random() * 100 < p;
}

function isSealActive(actor, scene = null) {
  if (!actor) return false;
  if (actor?.isBcuProcStatusActive?.('seal', scene?.timeMs) === true) return true;
  const st = actor?.bcuProcStatuses?.seal || actor?.bcuProcStatuses?.P_SEAL;
  if (!st) return false;
  if (Number.isFinite(st.framesRemaining)) return st.framesRemaining > 0;
  if (Number.isFinite(st.untilMs) && Number.isFinite(scene?.timeMs)) return scene.timeMs < st.untilMs;
  return !!st.active;
}

function combatModel(actor) {
  return actor?.bcuCombatModel || actor?.rawStats?.bcuCombatModel || actor?.stats?.bcuCombatModel || null;
}

function procModel(actor) {
  return combatModel(actor)?.proc || actor?.bcuProc || actor?.rawStats?.bcuProc || actor?.rawStats?.bcuCombatModel?.proc || actor?.stats?.bcuCombatModel?.proc || {};
}

function entityKind(actor) {
  const kind = combatModel(actor)?.kind || actor?.rawStats?.source?.type || actor?.rawStats?.statsType || actor?.statsType || actor?.sourceKind || null;
  if (kind === 'unit' || kind === 'enemy') return kind;
  return actor?.side === 'dog-player' ? 'unit' : 'enemy';
}

function summonerLevel(actor) {
  return Math.max(0, int(
    actor?.bcuUnitLevel?.effectiveLevel
      ?? actor?.rawStats?.bcuUnitLevel?.effectiveLevel
      ?? actor?.rawStats?.source?.bcuUnitLevel?.effectiveLevel
      ?? actor?.lvl
      ?? actor?.level,
    0
  ));
}

function unitLevelCap(unitDef) {
  const meta = unitDef?.bcuUnitLevelMeta || unitDef?.rawStats?.bcuUnitLevelMeta || unitDef?.stats?.bcuUnitLevelMeta || {};
  const maxLevel = firstNumber(meta.maxLevel, meta.max, unitDef?.maxLevel);
  const maxPlus = firstNumber(meta.maxPlusLevel, meta.maxp, unitDef?.maxPlusLevel, 0);
  if (!Number.isFinite(maxLevel)) return null;
  return Math.max(1, Math.trunc(maxLevel) + Math.max(0, Math.trunc(maxPlus || 0)));
}

function enemyMagnification(actor) {
  const model = actor?.stageMagnification || actor?.rawStats?.stageMagnification || actor?.actorStatsModelDebug?.stageMagnification || actor?.rawStats?.statsModelDebug?.stageMagnification || {};
  const fallback = firstNumber(model.magnification, actor?.actorStatsModelDebug?.magnification, actor?.rawStats?.statsModelDebug?.magnification, 100) ?? 100;
  return {
    hp: firstNumber(model.hpMagnification, actor?.actorStatsModelDebug?.hpMagnification, actor?.rawStats?.statsModelDebug?.hpMagnification, fallback) ?? fallback,
    attack: firstNumber(model.attackMagnification, actor?.actorStatsModelDebug?.attackMagnification, actor?.rawStats?.statsModelDebug?.attackMagnification, fallback) ?? fallback
  };
}

function computeSummonScaling(proc, summoner, resistance, unitDef = null) {
  const factor = Number.isFinite(resistance?.factor) ? resistance.factor : 1;
  if (proc.kind === 'unit') {
    let level = proc.mult;
    if (entityKind(summoner) === 'unit' && !proc.type.fixBuff) level += summonerLevel(summoner);
    const cap = unitLevelCap(unitDef);
    if (Number.isFinite(cap)) level = Math.max(1, Math.min(cap, level));
    const scaledLevel = Math.trunc(level * factor);
    return {
      scaledMult: scaledLevel,
      scaledHpMult: scaledLevel,
      scaledAttackMult: scaledLevel,
      baseMult: level,
      source: entityKind(summoner) === 'unit' && !proc.type.fixBuff ? 'proc.mult + summoner level' : 'proc.mult'
    };
  }
  let hp = proc.mult;
  let attack = proc.mult;
  if (entityKind(summoner) === 'enemy' && !proc.type.fixBuff) {
    const mag = enemyMagnification(summoner);
    hp *= mag.hp / 100;
    attack *= mag.attack / 100;
  }
  return {
    scaledMult: Math.trunc(proc.mult * factor),
    scaledHpMult: Math.trunc(hp * factor),
    scaledAttackMult: Math.trunc(attack * factor),
    baseMult: proc.mult,
    source: entityKind(summoner) === 'enemy' && !proc.type.fixBuff ? 'proc.mult * summoner enemy magnification' : 'proc.mult'
  };
}

function summonResistance(actor) {
  const proc = procModel(actor);
  const direct = actor?.bcuProcResist?.IMUSUMMON ?? actor?.bcuProcResist?.summon;
  const raw = firstNumber(direct, proc?.IMUSUMMON?.mult, proc?.IMUSUMMON?.block, combatModel(actor)?.immunity?.summon?.mult, 0);
  const mult = clampPercent(raw);
  return {
    field: 'IMUSUMMON',
    mult,
    full: mult >= 100,
    partial: mult > 0 && mult < 100,
    factor: Math.max(0, (100 - mult) / 100),
    source: 'target.getProc().IMUSUMMON.mult'
  };
}

function posBcu(actor) {
  const n = BattleCombatCoordinateRuntime.getEntityPosBcu(actor);
  return Number.isFinite(n) ? n : 0;
}

function currentLayer(actor, fallback = 0) {
  return Number.isFinite(actor?.currentLayer) ? Math.trunc(actor.currentLayer) : fallback;
}

function spawnLayer(actor, fallback = 0) {
  return Number.isFinite(actor?.spawnLayer) ? Math.trunc(actor.spawnLayer) : currentLayer(actor, fallback);
}

function stageLength(scene) {
  const n = firstNumber(scene?.stage?.runtime?.stageLen, scene?.stage?.stageLen, BATTLE_CONFIG.stage?.stageLen, 4000);
  return Number.isFinite(n) ? n : 4000;
}

function actorWidth(actor, unitDef = null) {
  return Math.max(0, firstNumber(actor?.attackWidthBcu, actor?.rawStats?.width, actor?.stats?.width, unitDef?.rawStats?.width, unitDef?.width, 0) ?? 0);
}

function aliveCount(scene, side) {
  return (scene?.actors || []).filter((a) => a?.side === side && (typeof a.isAlive === 'function' ? a.isAlive() : a?.hp > 0)).length;
}

function sideLimit(scene, side) {
  if (side === 'cat-enemy' && typeof scene?.getEffectiveEnemyMaxCount === 'function') return scene.getEffectiveEnemyMaxCount();
  const n = firstNumber(scene?.maxAliveActorsPerSide, BATTLE_CONFIG.tuning?.maxAliveActorsPerSide, 15);
  return Number.isFinite(n) ? n : 15;
}

function randomIntInclusive(min, max, random = Math.random) {
  const lo = Math.min(int(min, 0), int(max, int(min, 0)));
  const hi = Math.max(int(min, 0), int(max, int(min, 0)));
  if (lo === hi) return lo;
  return lo + Math.floor(random() * (hi - lo + 1));
}

function formCode(formRow = 0) {
  return FORM_CODES[Math.max(0, Math.min(FORM_CODES.length - 1, int(formRow, 0)))] || 'f';
}

function formatBcuId(id) {
  return String(Math.max(0, int(id, 0))).padStart(3, '0');
}

function semanticActorEntry(scene, key) {
  return scene?.bcuDb?.semanticProvider?.getActorEntry?.(key) || scene?.bcuDb?.semanticIndexes?.actors?.byKey?.[key] || globalThis.__BCU_DB__?.semanticProvider?.getActorEntry?.(key) || null;
}

function unitBundleAssetDef(scene, id, form = 'f') {
  const bcuId = formatBcuId(id);
  const semanticKey = `unit:${Number(id)}:${form}`;
  const resolved = scene?.bcuDb?.assets?.resolveUnitAsset?.(id, form);
  if (resolved?.semanticKey || resolved?.bundleRef) return resolved;
  const entry = semanticActorEntry(scene, semanticKey);
  if (!entry?.bundleRef) return null;
  return {
    id: `unit-${bcuId}-${form}`,
    kind: 'unit',
    semanticKey,
    bundleRef: entry.bundleRef,
    renderMode: 'animated-unit',
    image: 'image.png',
    imgcut: 'imgcut.imgcut',
    model: 'model.mamodel',
    animations: ['move', 'idle', 'attack', 'kb'].map((role, i) => ({ id: `anim0${i}`, file: `${role}.maanim` }))
  };
}

function enemyBundleAssetDef(scene, id) {
  const bcuId = formatBcuId(id);
  const semanticKey = `enemy:${Number(id)}`;
  const resolved = scene?.bcuDb?.assets?.resolveEnemyAsset?.(id);
  if (resolved?.semanticKey || resolved?.bundleRef) return resolved;
  const entry = semanticActorEntry(scene, semanticKey);
  if (!entry?.bundleRef) return null;
  return {
    id: `enemy-${bcuId}`,
    kind: 'enemy',
    semanticKey,
    bundleRef: entry.bundleRef,
    renderMode: 'animated-unit',
    image: 'image.png',
    imgcut: 'imgcut.imgcut',
    model: 'model.mamodel',
    animations: ['move', 'idle', 'attack', 'kb'].map((role, i) => ({ id: `anim0${i}`, file: `${role}.maanim` }))
  };
}

function findExistingUnitDef(scene, proc) {
  const id = proc.statsId;
  const kind = proc.kind;
  const form = formCode(proc.formRow);
  const maps = [
    scene?.bcuSummonUnitDefs,
    scene?.bcuSummonEnemyDefs
  ].filter(Boolean);
  for (const map of maps) {
    const keys = [
      `${kind}:${id}:${form}`,
      `${kind}:${id}`,
      id,
      String(id)
    ];
    for (const key of keys) {
      const value = typeof map.get === 'function' ? map.get(key) : map[key];
      if (value) return value;
    }
  }
  const rosters = [
    ...(BATTLE_CONFIG.rosters?.dogPlayer || []),
    ...(BATTLE_CONFIG.rosters?.catEnemy || []),
    ...(BATTLE_CONFIG.rosters?.catUnits || []),
    ...(scene?.playerProductionRoster || []),
    ...(scene?.stageEnemyUnitDefs || [])
  ];
  return rosters.find((u) => u && u.statsType === kind && Number(u.statsId) === Number(id) && (kind !== 'unit' || int(u.formRow, 0) === proc.formRow)) || null;
}

function buildUnitDef(scene, proc, side) {
  if (proc.unitDef) return proc.unitDef;
  const existing = findExistingUnitDef(scene, proc);
  if (existing) return { ...existing, side, direction: directionForSide(side, existing.direction), facing: directionForSide(side, existing.facing), renderFlipX: side === 'dog-player' ? false : (existing.renderFlipX ?? true) };
  if (!Number.isFinite(proc.statsId)) return null;
  if (proc.kind === 'unit') {
    const form = formCode(proc.formRow);
    const assetDef = unitBundleAssetDef(scene, proc.statsId, form);
    if (!assetDef) return null;
    return {
      slotId: `bcu-summon-unit-${formatBcuId(proc.statsId)}-${form}`,
      label: `summon-unit-${formatBcuId(proc.statsId)}-${form}`,
      assetId: `unit-${formatBcuId(proc.statsId)}-${form}`,
      assetDef,
      statsType: 'unit',
      statsId: proc.statsId,
      formRow: proc.formRow,
      sourceKind: 'unit',
      source: 'bcu-summon-runtime',
      side,
      direction: directionForSide(side),
      facing: directionForSide(side),
      renderFlipX: side !== 'dog-player',
      collisionRadius: 44,
      scale: 1.12,
      idleAnimId: 'anim01',
      moveAnimId: 'anim00',
      attackAnimId: 'anim02',
      knockbackAnimId: 'anim03',
      bcuUnitLevel: { level: Math.max(1, int(proc.scaledMult, proc.mult || 1)), source: 'BCU SUMMON.mult' }
    };
  }
  const assetDef = enemyBundleAssetDef(scene, proc.statsId);
  if (!assetDef) return null;
  return {
    slotId: `bcu-summon-enemy-${formatBcuId(proc.statsId)}`,
    label: `summon-enemy-${formatBcuId(proc.statsId)}`,
    assetId: `enemy-${formatBcuId(proc.statsId)}`,
    assetDef,
    statsType: 'enemy',
    statsId: proc.statsId,
    sourceKind: 'enemy',
    source: 'bcu-summon-runtime',
    side,
    direction: directionForSide(side),
    facing: directionForSide(side),
    renderFlipX: side === 'dog-player',
    collisionRadius: 46,
    scale: 1.12,
    idleAnimId: 'anim01',
    moveAnimId: 'anim00',
    attackAnimId: 'anim02',
    knockbackAnimId: 'anim03',
    stageStatModifiers: {
      source: 'BCU SUMMON.mult magnification',
      magnification: proc.scaledMult,
      hpMagnification: proc.scaledHpMult ?? proc.scaledMult,
      attackMagnification: proc.scaledAttackMult ?? proc.scaledMult
    }
  };
}

export function normalizeBcuSummonProc(input, { attacker = null } = {}) {
  const source = input?.SUMMON || input?.summon || input?.bcuSummon || input;
  if (!source || typeof source !== 'object') return null;
  const idInfo = normalizeId(source.id ?? source.identifier ?? source.targetId ?? source.statsId ?? source.unitId ?? source.enemyId);
  const rawKind = source.kind ?? source.statsType ?? source.entityKind ?? source.targetKind ?? idInfo.kind;
  const kind = normalizeKind(rawKind, attacker);
  const statsId = firstNumber(source.statsId, kind === 'unit' ? source.unitId : source.enemyId, idInfo.statsId);
  const form = int(source.form, Number.isFinite(source.formRow) ? source.formRow + 1 : 1);
  const formRow = Math.max(0, int(source.formRow, form - 1));
  const dis = int(source.dis ?? source.distance ?? source.minDistance, 0);
  const maxDis = int(source.maxDis ?? source.max_dis ?? source.maxDistance, dis);
  const type = parseType(source.type, source);
  const prob = clampPercent(source.prob ?? source.probability ?? 0);
  const mult = int(source.mult ?? source.level ?? source.magnification, 0);
  const normalized = {
    exists: prob > 0 && kind !== null,
    prob,
    kind,
    statsId: Number.isFinite(statsId) ? Math.trunc(statsId) : null,
    rawId: idInfo.rawId,
    form,
    formRow,
    mult,
    scaledMult: mult,
    dis,
    maxDis,
    minLayer: int(source.minLayer ?? source.min_layer, -1),
    maxLayer: int(source.maxLayer ?? source.max_layer, -1),
    time: Math.max(0, int(source.time ?? source.delayFrames, 0)),
    tba: int(source.tba ?? source.waitTime ?? 0, 0),
    type,
    unitDef: source.unitDef || null,
    source,
    bcuReference: BCU_SUMMON_REFERENCE
  };
  normalized.exists = normalized.exists && (normalized.statsId !== null || normalized.unitDef || idInfo.rawId == null);
  return normalized;
}

export function getBcuSummonProcForEvent(attacker, event, meta = {}) {
  const hitIndex = meta.hitIndex ?? event?.hitIndex ?? 0;
  const candidates = [
    event?.bcuProc?.SUMMON,
    event?.bcuProc?.summon,
    event?.proc?.SUMMON,
    event?.proc?.summon,
    event?.SUMMON,
    event?.summon,
    event?.bcuSummon,
    attacker?.bcuProc?.SUMMON,
    attacker?.bcuProc?.summon,
    attacker?.rawStats?.bcuProc?.SUMMON,
    attacker?.rawStats?.bcuProc?.summon,
    attacker?.rawStats?.attackHits?.[hitIndex]?.bcuProc?.SUMMON,
    attacker?.rawStats?.attackHits?.[hitIndex]?.summon
  ];
  for (const candidate of candidates) {
    const proc = normalizeBcuSummonProc(candidate, { attacker });
    if (proc?.exists) return proc;
  }
  return null;
}

export function prepareBcuSummonForEvent(scene, attacker, event, meta = {}) {
  const proc = getBcuSummonProcForEvent(attacker, event, meta);
  if (!proc?.exists) return { rolled: false, proc: null, reason: 'no-summon-proc' };
  const key = eventRollKey(attacker, event, meta);
  const rolls = actorRollMap(attacker);
  if (rolls.has(key)) return rolls.get(key);
  if (isSealActive(attacker, scene)) {
    const result = { rolled: false, proc, reason: 'attacker-sealed', key };
    rolls.set(key, result);
    return result;
  }
  const random = randomFrom(scene, meta);
  const rolled = rollPercent(proc.prob, random);
  const result = { rolled, proc, reason: rolled ? 'rolled' : 'probability-failed', key };
  rolls.set(key, result);
  return result;
}

function ensureSpawnQueue(scene) {
  if (!Array.isArray(scene.bcuSummonSpawnQueue)) scene.bcuSummonSpawnQueue = [];
  return scene.bcuSummonSpawnQueue;
}

function ensureTokenQueue(scene) {
  if (!Array.isArray(scene.bcuSummonTokens)) scene.bcuSummonTokens = [];
  return scene.bcuSummonTokens;
}

function layerRange(proc, summoner, summonerIsEnemySide) {
  let minLayer = proc.minLayer;
  let maxLayer = proc.maxLayer;
  const fallbackLayer = summonerIsEnemySide ? spawnLayer(summoner, 0) : currentLayer(summoner, 0);
  if (minLayer === -1 && maxLayer === -1) minLayer = maxLayer = fallbackLayer;
  if (minLayer === -1 || maxLayer === -1) minLayer = maxLayer = fallbackLayer;
  return { minLayer, maxLayer };
}

function selectLayer(proc, summoner, random = Math.random) {
  const range = layerRange(proc, summoner, summoner?.side !== 'dog-player');
  return randomIntInclusive(range.minLayer, range.maxLayer, random);
}

function targetAliveAfterDamage(actor) {
  if (!actor) return false;
  if (actor.hp <= 0 || actor.deathPending || actor.deathAfterKnockback || actor.state === 'dead' || actor.state === 'dying') return false;
  return true;
}

function stageAllow(scene, proc, unitDef, side) {
  if (proc.kind !== 'enemy') return { allowed: true, source: 'unit-summon-no-stage-allow' };
  const resolver = scene?.getBcuSummonStageAllow || scene?.stage?.runtime?.getBcuSummonStageAllow;
  if (typeof resolver === 'function') {
    const result = resolver.call(scene, { proc, unitDef, side, scene });
    if (typeof result === 'boolean') return { allowed: result, source: 'scene-getBcuSummonStageAllow' };
    return {
      ...(result || {}),
      allowed: result?.allowed !== false && result?.allow !== false,
      group: result?.group ?? null,
      source: result?.source || 'scene-getBcuSummonStageAllow'
    };
  }
  return { allowed: true, group: null, source: 'stage-allow-not-modeled-assumed-allowed' };
}

function buildSpawnPlan(scene, proc, summoner, anchor, meta = {}) {
  const resistance = summonResistance(anchor);
  if (resistance.full) {
    const item = { key: 'summon', payload: proc, proc, field: 'IMUSUMMON' };
    const result = anchor?.applyBcuProc?.(item, { scene, attacker: summoner, nowMs: scene?.timeMs, attack: meta.event || null }) || {
      applied: false,
      immune: true,
      reason: 'bcu-IMUSUMMON-immunity',
      field: 'IMUSUMMON'
    };
    return { ok: false, reason: 'summon-immunity-full', resistance, proc, immunityResult: result };
  }

  const random = randomFrom(scene, meta);
  const probeSide = sideForKind(proc.kind, summoner);
  const probeUnitDef = proc.unitDef || findExistingUnitDef(scene, proc);
  const scaling = computeSummonScaling(proc, summoner, resistance, probeUnitDef);
  if (proc.mult > 0 && scaling.scaledMult <= 0 && scaling.scaledHpMult <= 0 && scaling.scaledAttackMult <= 0) return { ok: false, reason: 'summon-mult-zero-after-resistance', resistance, proc };
  const scaledProc = { ...proc, ...scaling, resistance };
  if (scaledProc.type.sameHealth && !(anchor?.hp > 0)) return { ok: false, reason: 'same-health-anchor-dead', resistance, proc: scaledProc };

  const side = probeSide;
  const unitDef = buildUnitDef(scene, scaledProc, side);
  if (!unitDef) return { ok: false, reason: 'summon-unitdef-missing', resistance, proc: scaledProc };
  const allow = stageAllow(scene, scaledProc, unitDef, side);
  if (!allow.allowed && !scaledProc.type.ignoreLimit) return { ok: false, reason: 'summon-stage-allow-rejected', resistance, proc: scaledProc, unitDef, allow };

  const maxAlive = sideLimit(scene, side);
  const currentAlive = aliveCount(scene, side);
  if (!scaledProc.type.ignoreLimit && currentAlive >= maxAlive) return { ok: false, reason: 'summon-side-limit-reached', resistance, proc: scaledProc, unitDef, currentAlive, maxAlive };

  const distance = randomIntInclusive(scaledProc.dis, scaledProc.maxDis, random);
  const dire = Number.isFinite(summoner?.direction) ? summoner.direction : directionForSide(summoner?.side);
  let x = posBcu(anchor || summoner) + dire * distance;
  if (scaledProc.kind === 'enemy') {
    const width = actorWidth(anchor, unitDef);
    x = Math.max(width, Math.min(x, stageLength(scene) - 800));
  }
  const layer = selectLayer(scaledProc, summoner, random);
  return {
    ok: true,
    proc: scaledProc,
    unitDef,
    side,
    x: Math.trunc(x),
    distance,
    layer,
    delayFrames: Math.max(1, int(scaledProc.time, 0)),
    anchor,
    summoner,
    sameHealth: scaledProc.type.sameHealth ? Math.max(0, int(anchor?.hp, 0)) : null,
    allow,
    resistance,
    source: BCU_SUMMON_REFERENCE
  };
}

export function enqueueBcuSummonSpawn(scene, { proc, summoner, anchor, event = null, trigger = 'unknown', meta = {} } = {}) {
  const plan = buildSpawnPlan(scene, proc, summoner, anchor || summoner, { ...meta, event });
  if (!plan.ok) {
    scene?.pushEvent?.({
      type: 'bcuSummonRejected',
      reason: plan.reason,
      trigger,
      actor: summoner?.instanceId || summoner?.label || null,
      anchor: anchor?.instanceId || anchor?.label || null,
      field: plan.resistance?.field || null,
      resistance: plan.resistance?.mult ?? null,
      source: BCU_SUMMON_REFERENCE
    });
    return plan;
  }
  const queue = ensureSpawnQueue(scene);
  const pending = {
    ...plan,
    event,
    trigger,
    enqueuedAtFrame: scene?.logicFrame ?? null,
    enqueuedAtMs: scene?.timeMs ?? null,
    spawned: false
  };
  queue.push(pending);
  scene?.pushEvent?.({
    type: 'bcuSummonQueued',
    trigger,
    actor: summoner?.instanceId || summoner?.label || null,
    anchor: anchor?.instanceId || anchor?.label || null,
    targetSlotId: pending.unitDef?.slotId || null,
    side: pending.side,
    x: pending.x,
    layer: pending.layer,
    delayFrames: pending.delayFrames,
    source: BCU_SUMMON_REFERENCE
  });
  return { ok: true, pending };
}

export function queueBcuImmediateSummon(scene, attacker, event, meta = {}) {
  const prepared = prepareBcuSummonForEvent(scene, attacker, event, meta);
  const proc = prepared.proc;
  if (!prepared.rolled || !proc || proc.type.onHit || proc.type.onKill) return { queued: false, prepared };
  const key = `immediate:${prepared.key}`;
  if (!attacker.__bcuSummonImmediateQueued) attacker.__bcuSummonImmediateQueued = new Set();
  if (attacker.__bcuSummonImmediateQueued.has(key)) return { queued: false, prepared, reason: 'already-queued' };
  attacker.__bcuSummonImmediateQueued.add(key);
  const result = enqueueBcuSummonSpawn(scene, { proc, summoner: attacker, anchor: attacker, event, trigger: 'immediate', meta });
  return { queued: result.ok === true, prepared, result };
}

function shouldSkipTargetToken(result) {
  if (result?.bcuDamageGuard?.accepted === false) return true;
  if (result?.reason === 'bcu-damage-guard-rejected') return true;
  return false;
}

export function queueBcuTargetSummonToken(scene, attacker, target, event, queueResult = null, meta = {}) {
  const prepared = prepareBcuSummonForEvent(scene, attacker, event, meta);
  const proc = prepared.proc;
  if (!prepared.rolled || !proc || (!proc.type.onHit && !proc.type.onKill)) return { queued: false, prepared };
  if (shouldSkipTargetToken(queueResult)) return { queued: false, prepared, reason: 'damage-guard-rejected' };
  const tokenQueue = ensureTokenQueue(scene);
  const token = {
    proc,
    summoner: attacker,
    anchor: target,
    event,
    requiresKill: proc.type.onKill === true,
    trigger: proc.type.onKill ? 'on-kill' : 'on-hit',
    hitIndex: meta.hitIndex ?? event?.hitIndex ?? null,
    eventKey: attackEventKey(event, meta),
    queuedAtFrame: scene?.logicFrame ?? null,
    queuedAtMs: scene?.timeMs ?? null
  };
  tokenQueue.push(token);
  scene?.pushEvent?.({
    type: 'bcuSummonTokenQueued',
    trigger: token.trigger,
    actor: attacker?.instanceId || attacker?.label || null,
    anchor: target?.instanceId || target?.label || null,
    eventKey: token.eventKey,
    source: 'BCU AtkModelEntity.invokeLater token'
  });
  return { queued: true, token, prepared };
}

export function processBcuSummonTokens(scene, reason = 'knockback-death') {
  const queue = ensureTokenQueue(scene);
  if (!queue.length) return { processed: 0, spawned: 0, skipped: 0 };
  const batch = queue.splice(0, queue.length);
  let spawned = 0;
  let skipped = 0;
  for (const token of batch) {
    if (token.requiresKill && targetAliveAfterDamage(token.anchor)) {
      skipped += 1;
      scene?.pushEvent?.({ type: 'bcuSummonSkipped', reason: 'on-kill-target-alive', anchor: token.anchor?.instanceId || token.anchor?.label || null, source: BCU_SUMMON_REFERENCE });
      continue;
    }
    const result = enqueueBcuSummonSpawn(scene, {
      proc: token.proc,
      summoner: token.summoner,
      anchor: token.anchor,
      event: token.event,
      trigger: token.trigger,
      meta: { reason }
    });
    if (result.ok) spawned += 1;
    else skipped += 1;
  }
  return { processed: batch.length, spawned, skipped };
}

export async function ensureBcuSummonTemplate(scene, unitDef) {
  if (!scene?.actorFactory || !unitDef?.slotId) return { ok: false, reason: 'actor-factory-missing' };
  const template = scene.actorFactory.templates?.get?.(unitDef.slotId);
  if (template && (template.loadingLevel === TEMPLATE_LOAD_LEVEL.SPAWN_READY || template.loadingLevel === TEMPLATE_LOAD_LEVEL.FULL_VISUAL)) {
    return { ok: true, template, source: 'template-ready' };
  }
  if (typeof scene.actorFactory.preloadTemplate !== 'function') return { ok: false, reason: 'preloadTemplate-missing' };
  try {
    const loaded = await scene.actorFactory.preloadTemplate(unitDef, { level: TEMPLATE_LOAD_LEVEL.SPAWN_READY });
    return { ok: true, template: loaded, source: 'preloaded-spawn-ready' };
  } catch (error) {
    return { ok: false, reason: 'template-preload-failed', message: String(error?.message || error) };
  }
}

function requestBcuSummonTemplate(scene, unitDef, pending = null) {
  if (!scene?.actorFactory || !unitDef?.slotId) return { requested: false, ready: false, reason: 'actor-factory-missing' };
  const template = scene.actorFactory.templates?.get?.(unitDef.slotId);
  if (template && (template.loadingLevel === TEMPLATE_LOAD_LEVEL.SPAWN_READY || template.loadingLevel === TEMPLATE_LOAD_LEVEL.FULL_VISUAL)) {
    return { requested: false, ready: true, template, source: 'template-ready' };
  }
  if (typeof scene.actorFactory.preloadTemplate !== 'function') return { requested: false, ready: false, reason: 'preloadTemplate-missing' };
  if (pending?.templatePreloadFailed) return { requested: false, ready: false, reason: 'template-preload-failed' };
  if (pending?.templatePreloadPromise) return { requested: false, ready: false, pending: true, reason: 'template-preload-pending' };
  const promise = scene.actorFactory.preloadTemplate(unitDef, { level: TEMPLATE_LOAD_LEVEL.SPAWN_READY })
    .then((templateResult) => {
      if (pending) {
        pending.templatePreloadReady = true;
        pending.templatePreloadResult = { ok: true, loadingLevel: templateResult?.loadingLevel || null };
      }
      return templateResult;
    })
    .catch((error) => {
      if (pending) {
        pending.templatePreloadFailed = true;
        pending.templatePreloadResult = { ok: false, message: String(error?.message || error) };
      }
      return null;
    });
  if (pending) pending.templatePreloadPromise = promise;
  return { requested: true, ready: false, pending: true };
}

export function markBcuSummonedActor(actor, pending) {
  if (!actor) return actor;
  const proc = pending?.proc || {};
  const allowGroup = firstNumber(pending?.allow?.group, pending?.allow?.allowGroup);
  actor.bcuIsSummoned = true;
  actor.bcuSummonProc = proc;
  actor.bcuSummonTrigger = pending?.trigger || null;
  actor.bcuSummonStageAllow = pending?.allow || null;
  if (Number.isFinite(allowGroup)) {
    actor.bcuSummonGroup = Math.trunc(allowGroup);
    actor.bcuStageGroup = Math.trunc(allowGroup);
    actor.group = Math.trunc(allowGroup);
  }
  actor.bcuSummonAnimationType = proc?.type?.animType ?? 0;
  actor.bcuSummonEntry = ['normal', 'warp-exit', 'burrow-move', 'burrow-up'][actor.bcuSummonAnimationType] || 'normal';
  actor.bcuSummonTba = Number.isFinite(proc?.tba) ? proc.tba : 0;
  if (proc?.tba === -1) actor.bcuSummonWaitMode = 'default-tba';
  else if (proc?.tba > 0) actor.bcuSummonWaitFrames = proc.tba;
  if (pending?.sameHealth !== null && Number.isFinite(pending?.sameHealth)) {
    actor.hp = Math.max(0, pending.sameHealth);
  }
  actor.currentLayer = pending?.layer ?? actor.currentLayer;
  actor.lastBcuSummonDebug = {
    source: 'BcuSummonRuntime.markBcuSummonedActor',
    bcuReference: 'Entity#setSummon(anim_type,bond)',
    trigger: pending?.trigger || null,
    animType: actor.bcuSummonAnimationType,
    entry: actor.bcuSummonEntry,
    x: actor.x,
    layer: actor.currentLayer,
    group: actor.bcuSummonGroup ?? null,
    stageAllow: pending?.allow || null,
    sameHealth: pending?.sameHealth,
    tba: proc?.tba ?? null,
    visualReview: actor.bcuSummonAnimationType === 0 ? 'not-required' : 'human-visual-review-needed'
  };
  return actor;
}

export function linkBcuSummonBond(parent, child) {
  if (!parent || !child) return false;
  parent.bcuSummonBondChildren = Array.isArray(parent.bcuSummonBondChildren) ? parent.bcuSummonBondChildren : [];
  child.bcuSummonBondChildren = Array.isArray(child.bcuSummonBondChildren) ? child.bcuSummonBondChildren : [];
  if (!parent.bcuSummonBondChildren.includes(child)) parent.bcuSummonBondChildren.push(child);
  if (!child.bcuSummonBondChildren.includes(parent)) child.bcuSummonBondChildren.push(parent);
  child.bcuSummonBondParent = parent;
  return true;
}

export function spawnBcuSummonActor(scene, pending) {
  if (!scene || !pending?.unitDef) return { ok: false, reason: 'scene-or-unitdef-missing' };
  const template = requestBcuSummonTemplate(scene, pending.unitDef, pending);
  if (!template.ready) return { ok: false, retry: !template.reason || template.pending === true || template.requested === true, reason: template.reason || 'template-not-ready', pending };
  const actor = scene.spawnActor?.(pending.unitDef, pending.side, false, {
    x: pending.x,
    currentLayer: pending.layer,
    bcuRenderLayerSource: 'bcu-summon-min-max-layer'
  });
  if (!actor) return { ok: false, reason: 'spawnActor-returned-null', pending };
  markBcuSummonedActor(actor, pending);
  if (pending.proc?.type?.bondHp) linkBcuSummonBond(pending.summoner, actor);
  actor.bcuSummoner = pending.summoner || null;
  scene.pushEvent?.({
    type: 'bcuSummonSpawned',
    actor: actor.instanceId || actor.label || null,
    targetSlotId: pending.unitDef?.slotId || null,
    side: pending.side,
    x: pending.x,
    layer: pending.layer,
    trigger: pending.trigger,
    source: BCU_SUMMON_REFERENCE
  });
  return { ok: true, actor };
}

export function tickBcuSummonSpawnQueue(scene, reason = 'actor-state-update') {
  const queue = ensureSpawnQueue(scene);
  if (!queue.length) return { processed: 0, spawned: 0, pending: 0 };
  const keep = [];
  let processed = 0;
  let spawned = 0;
  for (const item of queue) {
    item.delayFrames = Math.max(0, int(item.delayFrames, 0) - 1);
    if (item.delayFrames > 0) {
      keep.push(item);
      continue;
    }
    processed += 1;
    const result = spawnBcuSummonActor(scene, item);
    item.spawnResult = result;
    if (result.ok) spawned += 1;
    else if (result.retry) {
      item.delayFrames = 1;
      keep.push(item);
    }
    else scene?.pushEvent?.({ type: 'bcuSummonSpawnRejected', reason: result.reason, targetSlotId: item.unitDef?.slotId || null, source: BCU_SUMMON_REFERENCE });
  }
  queue.splice(0, queue.length, ...keep);
  return { processed, spawned, pending: keep.length, reason };
}

export function propagateBcuSummonBondDamage(actor, damage, meta = {}) {
  if (!actor || meta?.bcuSummonBondPropagation === true) return { propagated: 0 };
  const amount = Math.max(0, Number(damage) || 0);
  if (amount <= 0) return { propagated: 0 };
  const children = Array.isArray(actor.bcuSummonBondChildren) ? actor.bcuSummonBondChildren : [];
  let propagated = 0;
  for (const child of children) {
    if (!child || child === actor) continue;
    if (typeof child.isAlive === 'function' && !child.isAlive()) continue;
    if (typeof child.takeDamage !== 'function') continue;
    const result = child.takeDamage(amount, { ...meta, bcuSummonBondPropagation: true, bcuBondSource: actor?.instanceId || actor?.label || null });
    if (result?.accepted) propagated += 1;
  }
  actor.lastBcuSummonBondDamageDebug = {
    source: 'BCU Entity.SummonManager.damaged',
    amount,
    propagated,
    childCount: children.length
  };
  return { propagated };
}
