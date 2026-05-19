import { BattleScene } from './BattleScene.js';
import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';
import { DamageCalculator } from './DamageCalculator.js';

const PATCH_FLAG = Symbol.for('wanko-battle.base-projectile-proc-patch.v2-calc-fallback');

const W_PROG = 200;
const W_E_INI = -32.75;
const W_U_INI = -67.5;
const W_E_WID = 500;
const W_U_WID = 400;
const W_TIME = 3;
const W_MINI_TIME = 1;
const W_VOLC_INNER = 250;
const W_VOLC_PIERCE = 125;
const VOLC_ITV = 20;

function pos(actor) {
  const n = BattleCombatCoordinateRuntime.getEntityPosBcu(actor);
  return Number.isFinite(n) ? n : (Number.isFinite(actor?.x) ? actor.x : 0);
}

function dire(actor) {
  if (Number.isFinite(actor?.direction)) return actor.direction < 0 ? -1 : 1;
  return actor?.side === 'dog-player' ? -1 : 1;
}

function numAny(obj, names, fallback = 0) {
  for (const name of names) {
    const n = Number(obj?.[name]);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function getPayloadNumber(payload, keys, fallback) {
  for (const key of keys) {
    const n = Number(payload?.[key]);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function rollInclusive(min, max) {
  const lo = Math.trunc(Math.min(min, max));
  const hi = Math.trunc(Math.max(min, max));
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function rollExclusiveLikeBcu(min, max) {
  const lo = Math.trunc(min);
  const hi = Math.trunc(max);
  const span = hi - lo;
  if (span <= 0) return lo;
  return lo + Math.floor(Math.random() * span);
}

function initWaveLevel(payload = {}) {
  const lv = Math.max(1, Math.trunc(getPayloadNumber(payload, ['level', 'lv'], 1)));
  const maxlv = Math.max(lv, Math.trunc(getPayloadNumber(payload, ['maxLevel', 'maxlv'], lv)));
  return maxlv > lv ? rollInclusive(lv, maxlv) : lv;
}

function waveItems(calc) {
  return [...(calc?.proc?.pending || []), ...(calc?.proc?.applied || [])]
    .filter((p) => p?.key === 'wave' || p?.key === 'miniWave');
}

function surgeItems(calc) {
  return [...(calc?.proc?.pending || []), ...(calc?.proc?.applied || [])]
    .filter((p) => p?.key === 'surge' || p?.key === 'miniSurge');
}

function hasProjectileProc(calc) {
  return waveItems(calc).length > 0 || surgeItems(calc).length > 0;
}

function isAcceptedBaseDamage(result = {}) {
  return result?.accepted === true
    || result?.applied === true
    || result?.damageApplied === true
    || result?.baseDamageApplied === true
    || Number.isFinite(Number(result?.damage));
}

function resolveBaseDamageCalculation(scene, attacker, target, event, result, meta = {}) {
  const direct = result?.damageCalculation
    || result?.damageResult
    || target?.lastIncomingDamageCalculation
    || attacker?.lastDamageCalculation
    || null;
  if (hasProjectileProc(direct)) return direct;

  try {
    const random = typeof meta?.random === 'function'
      ? meta.random
      : (typeof scene?.getBcuRandom === 'function' ? scene.getBcuRandom() : Math.random);
    const fallback = DamageCalculator.calculate({
      attacker,
      target,
      targetType: 'base',
      event,
      context: {
        random,
        attackEventKey: meta?.key ?? event?.key ?? null
      }
    });
    fallback.baseProjectileFallbackDebug = {
      source: 'BattleBaseProjectileProcPatch.resolveBaseDamageCalculation',
      reason: direct ? 'direct-calc-had-no-projectile-proc-or-no-proc' : 'direct-calc-missing',
      directSource: direct?.source || null,
      bcuReference: 'BCU AttackSimple.excuse checks wave/volcano proc after successful base damage as it does for entity damage'
    };
    return fallback;
  } catch (error) {
    scene.lastBaseProjectileProcError = {
      source: 'BattleBaseProjectileProcPatch.resolveBaseDamageCalculation',
      message: String(error?.message || error)
    };
    return direct;
  }
}

function effectKeyForWave(kind, direction) {
  const enemy = direction === 1;
  if (kind === 'miniWave') return enemy ? 'enemyMiniWave' : 'unitMiniWave';
  return enemy ? 'enemyWave' : 'unitWave';
}

function effectKeyForSurge(kind, direction) {
  const enemy = direction === 1;
  if (kind === 'miniSurge') return enemy ? 'enemyMiniSurge' : 'unitMiniSurge';
  return enemy ? 'enemySurge' : 'unitSurge';
}

function makeWaveGroup() {
  return { active: true, containers: new Set(), incl: new Set() };
}

function cloneWaveEvent(event = {}, damage, kind) {
  const abilities = { ...(event?.abilities || event?.ability?.semantic || {}) };
  delete abilities.wave;
  delete abilities.miniWave;
  delete abilities.surge;
  delete abilities.miniSurge;
  return {
    ...event,
    damage,
    abilities,
    ability: { ...(event?.ability || {}), semantic: abilities },
    rawAbi: 0,
    abilityMappingStatus: 'bcu-cont-wave-def-no-recursive-wave-base-hit',
    targetMode: 'range',
    allowBaseHit: false,
    attackKind: kind
  };
}

function cloneSurgeEvent(event = {}, damage, kind) {
  const abilities = { ...(event?.abilities || event?.ability?.semantic || {}) };
  delete abilities.wave;
  delete abilities.miniWave;
  delete abilities.surge;
  delete abilities.miniSurge;
  return {
    ...event,
    damage,
    abilities,
    ability: { ...(event?.ability || {}), semantic: abilities },
    rawAbi: 0,
    abilityMappingStatus: 'bcu-cont-volcano-no-recursive-surge-base-hit',
    targetMode: 'range',
    allowBaseHit: false,
    attackKind: kind,
    bcuNoHitSmoke: true
  };
}

function buildInitialWave(attacker, proc, finalDamage, key, event, hitIndex, target) {
  const payload = proc.payload || {};
  const d = dire(attacker);
  const origin = pos(attacker);
  const width = d === 1 ? W_E_WID : W_U_WID;
  const addp = (d === 1 ? W_E_INI : W_U_INI) + width / 2;
  const isMini = proc.key === 'miniWave';
  const level = initWaveLevel(payload);
  const inverted = !!payload.inverted;
  const initialOffset = inverted ? W_PROG * (level - 1) * d : 0;
  const p0 = origin + d * addp + initialOffset;
  const mult = isMini ? Math.max(0, Number(payload.mult ?? payload.damageMultiplier ?? 20)) / 100 : 1;
  const group = makeWaveGroup();
  const kind = proc.key;
  const item = {
    id: `${key}:${proc.key}`,
    kind,
    attacker,
    target,
    event: cloneWaveEvent(event, Math.max(1, Math.trunc(finalDamage * mult)), kind),
    hitIndex,
    pos: p0,
    width,
    direction: d,
    layer: Number.isFinite(attacker?.currentLayer) ? attacker.currentLayer : 0,
    effectKey: effectKeyForWave(kind, d),
    effectSpawned: false,
    t: isMini ? -1 : -3,
    maxt: isMini ? W_MINI_TIME + 6 : W_TIME + 8,
    attackFrame: isMini ? 4 : 6,
    spawnFrame: isMini ? W_MINI_TIME : W_TIME,
    remainingLevel: Math.max(0, level - 1),
    damage: Math.max(1, Math.trunc(finalDamage * mult)),
    group,
    incl: group.incl,
    inverted,
    createdLogicFrame: Number.isFinite(attacker?.scene?.logicFrame) ? attacker.scene.logicFrame : null,
    source: isMini ? 'BCU ContWaveDef MINIWAVE state machine from base hit' : 'BCU ContWaveDef WAVE state machine from base hit'
  };
  group.containers.add(item);
  return item;
}

function extractVolc(payload = {}, isMini = false) {
  return isMini ? (payload.miniVolcano || payload.miniVolc || payload || {}) : (payload.volcano || payload.deathSurge || payload || {});
}

function resolveAliveTime(volc) {
  const explicitFrames = numAny(volc, ['aliveTimeFrames', 'timeFrames'], NaN);
  if (Number.isFinite(explicitFrames) && explicitFrames > 0) return Math.max(1, Math.trunc(explicitFrames));
  const base = Math.max(1, Math.trunc(numAny(volc, ['time'], 20)));
  const max = Math.max(base, Math.trunc(numAny(volc, ['maxtime', 'maxTime'], base)));
  if (max > base) return Math.floor(rollExclusiveLikeBcu(base, max) / 20) * 20;
  return base;
}

function buildSurge(attacker, proc, finalDamage, key, event, hitIndex, target) {
  const payload = proc.payload || {};
  const isMini = proc.key === 'miniSurge';
  const volc = extractVolc(payload, isMini);
  const d = dire(attacker);
  const origin = pos(attacker);
  const d0 = numAny(volc, ['dis0', 'dis_0', 'dis0Raw'], 0);
  const d1 = numAny(volc, ['dis1', 'dis_1', 'dis1Raw'], d0);
  const addp = rollExclusiveLikeBcu(d0, d1);
  const center = origin + d * addp;
  const sta = center + (d === 1 ? W_VOLC_PIERCE : W_VOLC_INNER);
  const end = center - (d === 1 ? W_VOLC_INNER : W_VOLC_PIERCE);
  const mult = isMini ? Math.max(0, Number(volc.mult ?? payload.mult ?? 20)) / 100 : 1;
  const aliveTime = resolveAliveTime(volc);
  const kind = proc.key;
  const damage = Math.max(1, Math.trunc(finalDamage * mult));
  return {
    id: `${key}:${proc.key}`,
    kind,
    attacker,
    target,
    event: cloneSurgeEvent(event, damage, kind),
    hitIndex,
    pos: center,
    startX: Math.min(sta, end),
    endX: Math.max(sta, end),
    sta,
    end,
    direction: d,
    layer: Number.isFinite(attacker?.currentLayer) ? attacker.currentLayer : 0,
    effectKey: effectKeyForSurge(kind, d),
    effectPhasesSpawned: new Set(),
    damage,
    t: 0,
    aliveTime,
    animType: 'START',
    vcapt: new Set(),
    volcTime: VOLC_ITV,
    attacked: false,
    lastProcFilter: null,
    source: isMini ? 'BCU ContVolcano MINIVOLC state machine from base hit' : 'BCU ContVolcano VOLC state machine from base hit'
  };
}

function enqueueBaseProjectiles(scene, attacker, target, event, calc, result, meta, beforeWaveCount, beforeSurgeCount) {
  if (!isAcceptedBaseDamage(result) || meta?.bcuWave || meta?.bcuSurge) return;
  const finalDamage = Math.max(0, Math.trunc(Number(calc?.finalDamage || 0)));
  if (finalDamage <= 0) return;
  const hitIndex = meta.hitIndex ?? event?.hitIndex ?? null;
  const targetId = target?.instanceId || target?.label || target?.side || 'base';
  const key = meta.key || `${scene.logicFrame}:${attacker?.instanceId || 'atk'}:${targetId}:${hitIndex}`;

  const waveItemsToSpawn = waveItems(calc);
  if (waveItemsToSpawn.length && (scene.__bcuWaveContainers?.length || 0) === beforeWaveCount) {
    if (!scene.__bcuWaveContainers) scene.__bcuWaveContainers = [];
    for (const proc of waveItemsToSpawn) scene.__bcuWaveContainers.push(buildInitialWave(attacker, proc, finalDamage, key, event, hitIndex, target));
  }

  const surgeItemsToSpawn = surgeItems(calc);
  if (surgeItemsToSpawn.length && (scene.__bcuSurgeContainers?.length || 0) === beforeSurgeCount) {
    if (!scene.__bcuSurgeContainers) scene.__bcuSurgeContainers = [];
    scene.ensureWaveEffectLoading?.();
    for (const proc of surgeItemsToSpawn) scene.__bcuSurgeContainers.push(buildSurge(attacker, proc, finalDamage, key, event, hitIndex, target));
  }

  scene.lastBaseProjectileProcDebug = {
    source: 'BattleBaseProjectileProcPatch.enqueueBaseProjectiles',
    target: targetId,
    accepted: isAcceptedBaseDamage(result),
    finalDamage,
    hasCalc: !!calc,
    calcSource: calc?.source || null,
    fallback: calc?.baseProjectileFallbackDebug || null,
    procPendingCount: calc?.proc?.pending?.length || 0,
    procAppliedCount: calc?.proc?.applied?.length || 0,
    waveCount: waveItemsToSpawn.length,
    surgeCount: surgeItemsToSpawn.length,
    beforeWaveCount,
    afterWaveCount: scene.__bcuWaveContainers?.length || 0,
    beforeSurgeCount,
    afterSurgeCount: scene.__bcuSurgeContainers?.length || 0,
    bcuReference: 'BCU AttackSimple.excuse creates ContWaveDef/ContVolcano after a successful base hit just like actor hits'
  };
  scene.pushEvent?.({ type: 'bcuBaseProjectileProcQueued', ...scene.lastBaseProjectileProcDebug });
}

export function installBattleBaseProjectileProcPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') throw new Error('BattleScene.queueAttackDamage is missing');

  proto.queueAttackDamage = function queueAttackDamageWithBaseProjectileProc(attacker, target, targetType, event, meta = {}) {
    const beforeWaveCount = this.__bcuWaveContainers?.length || 0;
    const beforeSurgeCount = this.__bcuSurgeContainers?.length || 0;
    const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
    if (targetType === 'base') {
      const calc = resolveBaseDamageCalculation(this, attacker, target, event, result, meta);
      enqueueBaseProjectiles(this, attacker, target, event, calc, result, meta, beforeWaveCount, beforeSurgeCount);
    }
    return result;
  };
}

installBattleBaseProjectileProcPatch();
