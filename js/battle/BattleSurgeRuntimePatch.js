import { BattleScene } from './BattleScene.js';
import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';
import { BcuTraceRuntime } from './bcu-runtime/BcuTraceRuntime.js';
import { EffectRuntime } from './EffectRuntime.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../bcu/BcuAnimator.js';

const PATCH_FLAG = Symbol.for('wanko-battle.surge-runtime-patch.v4.bcu-point-capture');
const W_VOLC_INNER = 250;
const W_VOLC_PIERCE = 125;
const VOLC_PRE = 15;
const VOLC_POST = 10;
const VOLC_SE = 30;
const VOLC_ITV = 20;
const BCU_SURGE_EFFECT_SOURCE = 'bcu-effanim-surge-cont-volcano';
const BCU_SURGE_EFFECT_SCALE = 1;

const SEAL_PROC_KEYS = new Set(['CRIT', 'SNIPER', 'BREAK', 'SUMMON', 'SATK', 'SHIELDBREAK']);
const CURSE_PROC_KEYS = new Set(['KB', 'STOP', 'SLOW', 'WEAK', 'WARP', 'CURSE', 'SNIPER', 'SEAL', 'POISON', 'BOSS', 'POIATK', 'ARMOR', 'SPEED', 'LETHARGY', 'DMGCUT', 'DMGCAP', 'DELAY']);

function pos(actor) {
  const n = BattleCombatCoordinateRuntime.getEntityPosBcu(actor);
  return Number.isFinite(n) ? n : (Number.isFinite(actor?.x) ? actor.x : 0);
}

function dire(actor) {
  if (Number.isFinite(actor?.direction)) return actor.direction < 0 ? -1 : 1;
  return actor?.side === 'dog-player' ? -1 : 1;
}

function isDirectDamageTarget(targetType) {
  return targetType === 'actor' || targetType === 'base';
}

function surgeItems(calc) {
  return [...(calc?.proc?.pending || []), ...(calc?.proc?.applied || [])]
    .filter((p) => p?.key === 'surge' || p?.key === 'miniSurge');
}

function normalizeProcKey(key) {
  const k = String(key || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (k === 'CRITICAL') return 'CRIT';
  if (k === 'BARRIERBREAK' || k === 'BARRIERBREAKER') return 'BREAK';
  if (k === 'SHIELDBREAKER') return 'SHIELDBREAK';
  if (k === 'TOXIC') return 'POISON';
  return k;
}

function isStatusActive(actor, names = []) {
  const nowMs = globalThis.__APP__?.scene?.timeMs;
  for (const name of names) {
    if (typeof actor?.isBcuProcStatusActive === 'function' && actor.isBcuProcStatusActive(name, nowMs)) return true;
    const st = actor?.bcuProcStatuses?.[name] || actor?.status?.[name];
    if (!st) continue;
    if (typeof st === 'boolean') return st;
    if (Number.isFinite(st.framesRemaining) && st.framesRemaining > 0) return true;
    if (Number.isFinite(st.untilMs) && (!Number.isFinite(nowMs) || nowMs > 0 && nowMs < st.untilMs)) return true;
    if (Number.isFinite(st.remaining) && st.remaining > 0) return true;
    if (Number.isFinite(st.time) && st.time > 0) return true;
  }
  return false;
}

function filterProcAbilities(abilities = {}, attacker = null) {
  const cursed = isStatusActive(attacker, ['curse', 'P_CURSE']);
  const sealed = isStatusActive(attacker, ['seal', 'P_SEAL']);
  if (!cursed && !sealed) return { abilities: { ...abilities }, cursed, sealed, removed: [] };
  const removed = [];
  const out = {};
  for (const [key, value] of Object.entries(abilities || {})) {
    const normalized = normalizeProcKey(key);
    const removeBySeal = sealed && SEAL_PROC_KEYS.has(normalized);
    const removeByCurse = (cursed || sealed) && CURSE_PROC_KEYS.has(normalized);
    if (removeBySeal || removeByCurse) {
      removed.push({ key, normalized, removeBySeal, removeByCurse });
      continue;
    }
    out[key] = value;
  }
  return { abilities: out, cursed, sealed, removed };
}

function cloneEvent(event = {}, damage, kind, attacker = null) {
  const baseAbilities = { ...(event?.abilities || event?.ability?.semantic || {}) };
  delete baseAbilities.wave;
  delete baseAbilities.miniWave;
  delete baseAbilities.surge;
  delete baseAbilities.miniSurge;
  const procFilter = filterProcAbilities(baseAbilities, attacker);
  return {
    ...event,
    damage,
    abilities: procFilter.abilities,
    ability: { ...(event?.ability || {}), semantic: procFilter.abilities },
    rawAbi: 0,
    abilityMappingStatus: 'bcu-cont-volcano-no-recursive-surge',
    targetMode: 'range',
    allowBaseHit: false,
    attackKind: kind,
    bcuNoHitSmoke: true,
    bcuContVolcanoProcFilter: procFilter
  };
}

function trace(scene, entry) {
  const payload = { sceneFrame: scene?.logicFrame ?? null, ...entry };
  BcuTraceRuntime.push('surge', payload);
  globalThis.__BCU_SURGE_TRACE__ = [...(globalThis.__BCU_SURGE_TRACE__ || []), payload].slice(-240);
  scene?.pushEvent?.({ type: 'bcuSurgeTrace', ...payload });
}

function effectKeyFor(kind, direction) {
  const enemy = direction === 1;
  if (kind === 'miniSurge') return enemy ? 'enemyMiniSurge' : 'unitMiniSurge';
  return enemy ? 'enemySurge' : 'unitSurge';
}

function createSurgeEffectRuntime(asset, phase = 'start') {
  const anim = asset?.phases?.[phase] || asset?.anim;
  if (!asset?.loaded || !asset?.model || !anim) return null;
  const model = new BcuModelInstance(asset.model);
  const animator = new BcuAnimator(anim);
  animator.setLoop?.(false);
  animator.restart?.();
  const maxFrame = Number(anim?.maxFrame) || 0;
  return { model, animator, frameCount: Math.max(1, maxFrame + 1), maxFrame, phase, source: asset.source || null };
}

function spawnSurgeEffect(scene, item, phase = 'start') {
  if (!scene || !item) return null;
  if (!item.effectPhasesSpawned) item.effectPhasesSpawned = new Set();
  if (item.effectPhasesSpawned.has(phase)) return null;
  item.effectPhasesSpawned.add(phase);
  const asset = scene.waveEffectAssets?.[item.effectKey] || null;
  if (!asset?.loaded) {
    scene.ensureWaveEffectLoading?.();
    trace(scene, {
      source: 'BattleSurgeRuntimePatch.spawnSurgeEffect',
      event: 'effect-skipped',
      reason: asset?.reason || 'surge-effect-asset-not-ready',
      id: item.id,
      kind: item.kind,
      effectKey: item.effectKey,
      phase,
      t: item.t
    });
    return null;
  }
  const runtime = createSurgeEffectRuntime(asset, phase);
  if (!runtime) {
    trace(scene, {
      source: 'BattleSurgeRuntimePatch.spawnSurgeEffect',
      event: 'effect-skipped',
      reason: 'runtime-create-failed',
      id: item.id,
      kind: item.kind,
      effectKey: item.effectKey,
      phase,
      t: item.t
    });
    return null;
  }
  const effect = EffectRuntime.createEffect({
    id: `bcu-surge-${scene.logicFrame || 0}-${item.effectKey}-${phase}-${Math.random().toString(36).slice(2)}`,
    type: item.kind,
    x: item.pos,
    y: 0,
    image: asset.image,
    imgcut: asset.imgcut,
    model: runtime.model,
    animator: runtime.animator,
    scale: BCU_SURGE_EFFECT_SCALE,
    source: BCU_SURGE_EFFECT_SOURCE,
    createdAtMs: scene.timeMs,
    layer: item.layer,
    bcuSmokeYOffset: 0,
    debug: {
      source: BCU_SURGE_EFFECT_SOURCE,
      bcuReference: 'BCU ContVolcano draws VolcEff START/DURING/END via A_VOLC/A_E_VOLC/A_MINIVOLC/A_E_MINIVOLC',
      id: item.id,
      kind: item.kind,
      effectKey: item.effectKey,
      phase,
      pos: item.pos,
      startX: item.startX,
      endX: item.endX,
      direction: item.direction,
      t: item.t,
      layer: item.layer,
      frameCount: runtime.frameCount,
      maxFrame: runtime.maxFrame,
      assetSource: runtime.source
    }
  });
  effect.durationMs = runtime.frameCount * BCU_BATTLE_TIMER_PERIOD_MS;
  effect.frameDurationMs = BCU_BATTLE_TIMER_PERIOD_MS;
  effect.elapsedMs = -BCU_BATTLE_TIMER_PERIOD_MS;
  scene.effects.push(effect);
  trace(scene, {
    source: 'BattleSurgeRuntimePatch.spawnSurgeEffect',
    event: 'effect-spawned',
    id: item.id,
    effectId: effect.id,
    kind: item.kind,
    effectKey: item.effectKey,
    phase,
    pos: item.pos,
    layer: item.layer,
    frameCount: runtime.frameCount,
    t: item.t
  });
  return effect;
}

function enqueue(scene, item) {
  if (!scene.__bcuSurgeContainers) scene.__bcuSurgeContainers = [];
  scene.__bcuSurgeContainers.push(item);
  scene.ensureWaveEffectLoading?.();
  trace(scene, {
    source: 'BattleSurgeRuntimePatch.enqueue',
    bcuReference: 'AttackSimple.excuse -> new ContVolcano(new AttackVolcano(...), aliveTime, dis_0, dis_1)',
    event: 'created',
    id: item.id,
    kind: item.kind,
    t: item.t,
    aliveTime: item.aliveTime,
    startX: item.startX,
    endX: item.endX,
    pos: item.pos,
    damage: item.damage,
    animType: item.animType,
    soundEffect: 'SE_VOLC_START',
    effectKey: item.effectKey,
    activeMode: 'bcu-cont-volcano'
  });
}

function extractVolc(payload = {}, isMini = false) {
  return isMini ? (payload.miniVolcano || payload.miniVolc || payload || {}) : (payload.volcano || payload.deathSurge || payload || {});
}

function numAny(obj, names, fallback = 0) {
  for (const name of names) {
    const n = Number(obj?.[name]);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function rollExclusiveLikeBcu(min, max) {
  const lo = Math.trunc(min);
  const hi = Math.trunc(max);
  const span = hi - lo;
  if (span <= 0) return lo;
  return lo + Math.floor(Math.random() * span);
}

function resolveAliveTime(volc) {
  const explicitFrames = numAny(volc, ['aliveTimeFrames', 'timeFrames'], NaN);
  if (Number.isFinite(explicitFrames) && explicitFrames > 0) return Math.max(1, Math.trunc(explicitFrames));
  const base = Math.max(1, Math.trunc(numAny(volc, ['time'], 20)));
  const max = Math.max(base, Math.trunc(numAny(volc, ['maxtime', 'maxTime'], base)));
  if (max > base) return Math.floor(rollExclusiveLikeBcu(base, max) / 20) * 20;
  return base;
}

function buildSurge(attacker, proc, projectileBaseDamage, key, event, hitIndex, target) {
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
  return {
    id: `${key}:${proc.key}`,
    kind: proc.key,
    attacker,
    target,
    event,
    hitIndex,
    pos: center,
    dis0: d0,
    dis1: d1,
    startX: Math.min(sta, end),
    endX: Math.max(sta, end),
    sta,
    end,
    direction: d,
    layer: Number.isFinite(attacker?.currentLayer) ? attacker.currentLayer : 0,
    effectKey: effectKeyFor(proc.key, d),
    effectPhasesSpawned: new Set(),
    damage: Math.max(1, Math.trunc(projectileBaseDamage * mult)),
    projectileBaseDamage: Math.max(0, Math.trunc(projectileBaseDamage)),
    projectileDamageScale: mult,
    t: 0,
    aliveTime,
    animType: 'START',
    vcapt: new Set(),
    volcTime: VOLC_ITV,
    attacked: false,
    lastProcFilter: null,
    source: isMini ? 'BCU ContVolcano MINIVOLC state machine' : 'BCU ContVolcano VOLC state machine'
  };
}

function targetsInRange(scene, attacker, startX, endX, vcapt = null) {
  const lo = Math.min(startX, endX);
  const hi = Math.max(startX, endX);
  return (scene.actors || []).filter((target) => {
    if (!target || target.side === attacker?.side || vcapt?.has(target)) return false;
    if (!(target.isTargetable?.() ?? target.isAlive?.())) return false;
    const p = pos(target);
    // BCU StageBasis.inRange checks AbEntity.pos as a point: left <= pos <= right.
    // It does not expand the range by target width. Expanding by half width made surge
    // hits occur outside the visible ContVolcano column.
    return p >= lo && p <= hi;
  });
}

function updateProc(scene, item) {
  const abilities = { ...(item.event?.abilities || item.event?.ability?.semantic || {}) };
  delete abilities.surge;
  delete abilities.miniSurge;
  delete abilities.wave;
  delete abilities.miniWave;
  const filter = filterProcAbilities(abilities, item.attacker);
  item.lastProcFilter = filter;
  trace(scene, {
    source: 'BattleSurgeRuntimePatch.updateProc',
    bcuReference: 'ContVolcano.updateProc clears SEAL and CURSE proc groups while attacker is sealed/cursed',
    event: 'update-proc',
    id: item.id,
    t: item.t,
    cursed: filter.cursed,
    sealed: filter.sealed,
    removed: filter.removed.map((r) => r.normalized),
    activeMode: 'bcu-cont-volcano'
  });
  return filter;
}

function attackTick(scene, item) {
  const targets = targetsInRange(scene, item.attacker, item.startX, item.endX, item.vcapt);
  item.volcTime -= 1;
  const clearedBeforeProcess = item.volcTime === 0;
  if (clearedBeforeProcess) {
    item.volcTime = VOLC_ITV;
    item.vcapt.clear();
  }
  const event = {
    ...cloneEvent(item.event, item.damage, item.kind, item.attacker),
    bcuSurgeAliveTime: item.aliveTime,
    bcuCounterSurgePayload: { dis0: item.dis0, dis1: item.dis1, time: item.aliveTime, timeFrames: item.aliveTime }
  };
  let applied = 0;
  for (const target of targets) {
    const res = scene.queueAttackDamage(item.attacker, target, 'actor', event, {
      key: `${item.id}:${item.t}:${target.instanceId || target.label || 'target'}`,
      hitIndex: item.hitIndex,
      bcuSurge: item.kind,
      bcuProjectileNoHitSmoke: true,
      bcuRangeStart: item.startX,
      bcuRangeEnd: item.endX,
      bcuRuntimeSource: 'ContVolcano.attackTick'
    });
    item.vcapt.add(target);
    if (res?.accepted) applied += 1;
  }
  item.attacked = targets.length > 0;
  trace(scene, {
    source: 'BattleSurgeRuntimePatch.attackTick',
    bcuReference: 'ContVolcano.update -> sb.getAttack(v); AttackVolcano.capture uses StageBasis.inRange point-position capture and vcapt VOLC_ITV',
    event: 'attack-tick',
    id: item.id,
    kind: item.kind,
    t: item.t,
    targetCount: targets.length,
    appliedCount: applied,
    vcaptSize: item.vcapt.size,
    volcTime: item.volcTime,
    clearedBeforeProcess,
    procRemoved: event.bcuContVolcanoProcFilter?.removed?.map((r) => r.normalized) || [],
    activeMode: 'bcu-cont-volcano'
  });
}

function process(scene) {
  const q = Array.isArray(scene.__bcuSurgeContainers) ? scene.__bcuSurgeContainers : [];
  if (!q.length) return;
  const rest = [];
  for (const item of q) {
    if (item.t === 0) spawnSurgeEffect(scene, item, 'start');
    updateProc(scene, item);
    if (item.t >= VOLC_PRE && item.t <= VOLC_PRE + item.aliveTime && item.animType !== 'DURING') {
      item.animType = 'DURING';
      spawnSurgeEffect(scene, item, 'during');
      trace(scene, { source: 'BattleSurgeRuntimePatch.process', bcuReference: 'ContVolcano.update anim.changeAnim(DURING,false)', event: 'anim-changed', id: item.id, animType: item.animType, soundEffect: 'SE_VOLC_LOOP', t: item.t });
    } else if (item.t > VOLC_PRE + item.aliveTime && item.animType !== 'END') {
      item.animType = 'END';
      spawnSurgeEffect(scene, item, 'end');
      trace(scene, { source: 'BattleSurgeRuntimePatch.process', bcuReference: 'ContVolcano.update anim.changeAnim(END,false)', event: 'anim-changed', id: item.id, animType: item.animType, t: item.t });
    }
    if (item.t >= VOLC_PRE && item.t < VOLC_PRE + item.aliveTime && (item.t - VOLC_PRE) % VOLC_SE === 0) {
      trace(scene, { source: 'BattleSurgeRuntimePatch.process', bcuReference: 'ContVolcano.update SE_VOLC_LOOP cadence', event: 'se-loop', id: item.id, t: item.t, soundEffect: 'SE_VOLC_LOOP' });
    }
    if (item.t >= item.aliveTime + VOLC_POST + VOLC_PRE) {
      trace(scene, { source: 'BattleSurgeRuntimePatch.process', bcuReference: 'ContVolcano.update t >= aliveTime + VOLC_POST + VOLC_PRE activate=false', event: 'deactivated', id: item.id, t: item.t });
      continue;
    }
    item.t += 1;
    if (item.t > VOLC_PRE && item.t < VOLC_POST + item.aliveTime) attackTick(scene, item);
    trace(scene, { source: 'BattleSurgeRuntimePatch.process', bcuReference: 'ContVolcano.updateAnimation anim.update(false)', event: 'animation-update', id: item.id, t: item.t, animType: item.animType });
    rest.push(item);
  }
  scene.__bcuSurgeContainers = rest;
}

function enqueueFromResult(scene, attacker, target, event, calc, result, meta = {}) {
  if (!result?.accepted || meta?.bcuSurge || meta?.bcuWave || meta?.bcuBlast) return;
  const items = surgeItems(calc);
  if (!items.length) return;
  const projectileBaseDamage = Math.max(0, Math.trunc(Number(calc?.bcuProjectileBaseDamage ?? calc?.rawAttackDamage ?? calc?.rawBaseDamage ?? event?.damage ?? attacker?.damage ?? 0)));
  if (projectileBaseDamage <= 0) return;
  const hitIndex = meta.hitIndex ?? event?.hitIndex ?? null;
  const key = meta.key || `${scene.logicFrame}:${attacker?.instanceId || 'atk'}:${target?.instanceId || 'target'}:${hitIndex}`;
  for (const proc of items) enqueue(scene, buildSurge(attacker, proc, projectileBaseDamage, key, event, hitIndex, target));
}

export function enqueueBcuSurgeFromPayload(scene, attacker, {
  key = 'surge',
  payload = {},
  damage = null,
  event = {},
  hitIndex = null,
  target = null,
  id = null
} = {}) {
  if (!scene || !attacker) return null;
  const kind = key === 'miniSurge' ? 'miniSurge' : 'surge';
  const projectileBaseDamage = Math.max(1, Math.trunc(Number(damage ?? event?.damage ?? attacker?.damage ?? 1) || 1));
  const proc = { key: kind, payload: kind === 'miniSurge' ? { miniVolcano: payload, ...payload } : { volcano: payload, ...payload } };
  const surge = buildSurge(attacker, proc, projectileBaseDamage, id || `${scene.logicFrame || 0}:${attacker?.instanceId || 'actor'}:explicit-${kind}`, event, hitIndex, target);
  enqueue(scene, surge);
  return surge;
}

export function installBattleSurgeRuntimePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') throw new Error('BattleScene.queueAttackDamage is missing');
  proto.queueAttackDamage = function queueAttackDamageWithBcuContVolcano(attacker, target, targetType, event, meta = {}) {
    const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
    if (isDirectDamageTarget(targetType)) {
      const calc = target?.lastIncomingDamageCalculation || attacker?.lastDamageCalculation || null;
      enqueueFromResult(this, attacker, target, event, calc, result, meta);
    }
    return result;
  };

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase === 'function') {
    proto.runTickPhase = function runTickPhaseWithBcuContVolcano(phase, fn = () => {}) {
      if (phase === 'proc-resolve') {
        return originalRunTickPhase.call(this, phase, () => {
          const res = fn();
          process(this);
          return res;
        });
      }
      return originalRunTickPhase.call(this, phase, fn);
    };
  }
}

installBattleSurgeRuntimePatch();
