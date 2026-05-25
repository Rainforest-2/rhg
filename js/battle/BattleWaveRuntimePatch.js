import { BattleScene } from './BattleScene.js';
import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';
import { hasBcuWaveStopper } from './bcu-runtime/BcuWaveStopperRuntime.js';
import { BcuTraceRuntime } from './bcu-runtime/BcuTraceRuntime.js';
import { EffectRuntime } from './EffectRuntime.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../bcu/BcuAnimator.js';
import { BattleWaveEffectLoader } from './BattleWaveEffectLoader.js';
import { directionForActor, spawnWaveBundleEffect } from './BcuWaveBundleEffectSpawner.js';

const PATCH_FLAG = Symbol.for('wanko-battle.wave-runtime-patch.v5-explicit-proc-resolve');
const W_PROG = 200;
const W_E_INI = -32.75;
const W_U_INI = -67.5;
const W_E_WID = 500;
const W_U_WID = 400;
const W_TIME = 3;
const W_MINI_TIME = 1;
const BCU_WAVE_EFFECT_SOURCE = 'bcu-effanim-wave-cont-wave-def';
const BCU_WAVE_EFFECT_SCALE = 1;
const WAVE_EFFECT_TOTAL = null;

function describeWaveEffectAssets(assets = {}) {
  return Object.fromEntries(Object.entries(assets || {}).map(([key, asset]) => [key, {
    loaded: asset?.loaded === true,
    reason: asset?.reason || null,
    source: asset?.source || null,
    maxFrame: asset?.maxFrame ?? null,
    frameCount: asset?.frameCount ?? null,
    partCount: asset?.partCount ?? null,
    image: asset?.image ? true : false,
    model: asset?.model ? true : false,
    anim: asset?.anim ? true : false,
    phases: asset?.phases ? Object.keys(asset.phases) : []
  }]));
}

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

function waveItems(calc) {
  return [...(calc?.proc?.pending || []), ...(calc?.proc?.applied || [])]
    .filter((p) => p?.key === 'wave' || p?.key === 'miniWave');
}

function cloneEvent(event = {}, damage, kind) {
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
    abilityMappingStatus: 'bcu-cont-wave-def-no-recursive-wave',
    targetMode: 'range',
    allowBaseHit: false,
    attackKind: kind
  };
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

function initWaveLevel(payload = {}) {
  const lv = Math.max(1, Math.trunc(getPayloadNumber(payload, ['level', 'lv'], 1)));
  const maxlv = Math.max(lv, Math.trunc(getPayloadNumber(payload, ['maxLevel', 'maxlv'], lv)));
  return maxlv > lv ? rollInclusive(lv, maxlv) : lv;
}

function makeGroup() {
  return { active: true, containers: new Set(), incl: new Set() };
}

function trace(scene, entry) {
  const payload = { sceneFrame: scene?.logicFrame ?? null, ...entry };
  BcuTraceRuntime.push('wave', payload);
  globalThis.__BCU_WAVE_TRACE__ = [...(globalThis.__BCU_WAVE_TRACE__ || []), payload].slice(-200);
  scene?.pushEvent?.({ type: 'bcuWaveTrace', ...payload });
}

function enqueue(scene, item) {
  if (!scene.__bcuWaveContainers) scene.__bcuWaveContainers = [];
  item.group?.containers?.add(item);
  scene.__bcuWaveContainers.push(item);
  trace(scene, {
    source: 'BattleWaveRuntimePatch.enqueue',
    bcuReference: 'AttackSimple.excuse -> new ContWaveDef(new AttackWave(...), delay -3/-1)',
    event: 'created',
    id: item.id,
    kind: item.kind,
    t: item.t,
    attackFrame: item.attackFrame,
    spawnFrame: item.spawnFrame,
    maxt: item.maxt,
    attacker: item.attacker?.instanceId || item.attacker?.label || null,
    pos: item.pos,
    width: item.width,
    damage: item.damage,
    remainingLevel: item.remainingLevel,
    inverted: item.inverted,
    effectKey: item.effectKey,
    activeMode: 'bcu-cont-wave-def'
  });
}

function effectKeyFor(kind, direction) {
  const enemy = direction === 1;
  if (kind === 'miniWave') return enemy ? 'enemyMiniWave' : 'unitMiniWave';
  return enemy ? 'enemyWave' : 'unitWave';
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
  const group = makeGroup();
  const kind = proc.key;
  return {
    id: `${key}:${proc.key}`,
    kind,
    attacker,
    target,
    event,
    hitIndex,
    pos: p0,
    width,
    direction: d,
    layer: Number.isFinite(attacker?.currentLayer) ? attacker.currentLayer : 0,
    effectKey: effectKeyFor(kind, d),
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
    source: isMini ? 'BCU ContWaveDef MINIWAVE state machine' : 'BCU ContWaveDef WAVE state machine'
  };
}

function buildNextWave(item) {
  const nextDire = item.inverted ? -item.direction : item.direction;
  return {
    ...item,
    id: `${item.id}:next${item.remainingLevel}`,
    pos: item.pos + W_PROG * nextDire,
    t: 0,
    effectSpawned: false,
    remainingLevel: item.remainingLevel - 1
  };
}

function targetsInRange(scene, attacker, startX, endX, incl) {
  const lo = Math.min(startX, endX);
  const hi = Math.max(startX, endX);
  return (scene.actors || []).filter((target) => {
    if (!target || target.side === attacker?.side || incl?.has(target)) return false;
    if (!(target.isTargetable?.() ?? target.isAlive?.())) return false;
    const p = pos(target);
    const half = Number(target.width || target.rawStats?.width || 0) / 2;
    return (p + half) >= lo && (p - half) <= hi;
  });
}

function deactivateGroup(scene, item, blockerActor) {
  if (item.group) {
    item.group.active = false;
    for (const w of item.group.containers || []) w.activate = false;
  }
  if (blockerActor?.anim?.getEff) blockerActor.anim.getEff('STPWAVE');
  const blockerDirection = directionForActor(blockerActor);
  spawnWaveBundleEffect(scene, {
    key: blockerDirection === 1 ? 'enemyWaveStop' : 'unitWaveStop',
    actor: blockerActor,
    type: 'waveStop',
    source: 'bcu-effanim-wave-stop',
    debug: {
      bcuReference: 'ContWaveDef.update: AB_WAVES blocker calls anim.getEff(STPWAVE) before deactivate',
      waveId: item.id,
      blockerDirection
    }
  });
  trace(scene, {
    source: 'BattleWaveRuntimePatch.deactivateGroup',
    bcuReference: 'ContWaveDef.deactivate kills every related wave on AB_WAVES stopper',
    event: 'blocked',
    id: item.id,
    blockerActor: blockerActor?.instanceId || blockerActor?.label || null,
    t: item.t
  });
}

function createWaveEffectRuntime(asset) {
  if (!asset?.loaded || !asset?.model || !asset?.anim) return null;
  const model = new BcuModelInstance(asset.model);
  const animator = new BcuAnimator(asset.anim);
  animator.setLoop?.(false);
  animator.restart?.();
  return { model, animator, frameCount: asset.frameCount || Math.max(1, (Number(asset.anim?.maxFrame) || 0) + 1), maxFrame: asset.maxFrame || Number(asset.anim?.maxFrame) || 0 };
}

function spawnWaveEffect(scene, item) {
  if (!scene || !item || item.effectSpawned) return null;
  item.effectSpawned = true;
  const assets = scene.waveEffectAssets || null;
  const asset = assets?.[item.effectKey] || null;
  if (!asset?.loaded) {
    scene.ensureWaveEffectLoading?.();
    trace(scene, {
      source: 'BattleWaveRuntimePatch.spawnWaveEffect',
      event: 'effect-skipped',
      reason: asset?.reason || 'wave-effect-asset-not-ready',
      id: item.id,
      kind: item.kind,
      effectKey: item.effectKey,
      t: item.t
    });
    return null;
  }
  const runtime = createWaveEffectRuntime(asset);
  if (!runtime) {
    trace(scene, { source: 'BattleWaveRuntimePatch.spawnWaveEffect', event: 'effect-skipped', reason: 'runtime-create-failed', id: item.id, kind: item.kind, effectKey: item.effectKey, t: item.t });
    return null;
  }
  const effect = EffectRuntime.createEffect({
    id: `bcu-wave-${scene.logicFrame || 0}-${item.effectKey}-${Math.random().toString(36).slice(2)}`,
    type: item.kind,
    x: item.pos,
    y: 0,
    image: asset.image,
    imgcut: asset.imgcut,
    model: runtime.model,
    animator: runtime.animator,
    scale: BCU_WAVE_EFFECT_SCALE,
    source: BCU_WAVE_EFFECT_SOURCE,
    createdAtMs: scene.timeMs,
    layer: item.layer,
    bcuSmokeYOffset: 0,
    debug: {
      source: BCU_WAVE_EFFECT_SOURCE,
      bcuReference: 'BCU ContWaveDef.draw uses A_WAVE/A_E_WAVE/A_MINIWAVE/A_E_MINIWAVE once t >= 0',
      id: item.id,
      kind: item.kind,
      effectKey: item.effectKey,
      pos: item.pos,
      width: item.width,
      direction: item.direction,
      t: item.t,
      layer: item.layer,
      frameCount: runtime.frameCount,
      maxFrame: runtime.maxFrame,
      assetSource: asset.source || null
    }
  });
  effect.durationMs = runtime.frameCount * BCU_BATTLE_TIMER_PERIOD_MS;
  effect.frameDurationMs = BCU_BATTLE_TIMER_PERIOD_MS;
  effect.elapsedMs = -BCU_BATTLE_TIMER_PERIOD_MS;
  scene.effects.push(effect);
  trace(scene, { source: 'BattleWaveRuntimePatch.spawnWaveEffect', event: 'effect-spawned', id: item.id, effectId: effect.id, kind: item.kind, effectKey: item.effectKey, pos: item.pos, layer: item.layer, frameCount: runtime.frameCount, t: item.t });
  return effect;
}

function attackAtFrame(scene, item) {
  const event = cloneEvent(item.event, item.damage, item.kind);
  const startX = item.pos - item.width / 2;
  const endX = item.pos + item.width / 2;
  const targets = targetsInRange(scene, item.attacker, startX, endX, item.incl);
  let applied = 0;
  for (const target of targets) {
    const res = scene.queueAttackDamage(item.attacker, target, 'actor', event, {
      key: `${item.id}:${target.instanceId || target.label || 'target'}`,
      hitIndex: item.hitIndex,
      bcuWave: item.kind,
      bcuRuntimeSource: 'ContWaveDef.attackFrame'
    });
    item.incl.add(target);
    if (res?.accepted) applied += 1;
  }
  trace(scene, { source: 'BattleWaveRuntimePatch.attackAtFrame', bcuReference: 'ContWaveDef.update t == attack -> sb.getAttack(atk); AttackWave.excuse incl.add', event: 'attack-frame', id: item.id, kind: item.kind, t: item.t, targetCount: targets.length, appliedCount: applied, inclSize: item.incl.size, activeMode: 'bcu-cont-wave-def' });
}

function process(scene) {
  const q = Array.isArray(scene.__bcuWaveContainers) ? scene.__bcuWaveContainers : [];
  if (!q.length) return { processed: 0, active: 0, source: 'BattleWaveRuntimePatch.process' };
  const rest = [];
  let processed = 0;
  for (const item of q) {
    processed += 1;
    if (item.activate === false || item.group?.active === false) continue;
    const rangeTargets = targetsInRange(scene, item.attacker, item.pos - item.width / 2, item.pos + item.width / 2, item.incl);
    if (item.t === 0) {
      trace(scene, { source: 'BattleWaveRuntimePatch.process', bcuReference: 'ContWaveDef.update t == 0 CommonStatic.setSE(SE_WAVE); draw begins because t >= 0', event: 'se-wave', id: item.id, t: item.t });
      spawnWaveEffect(scene, item);
    }
    if (item.t <= item.attackFrame) {
      const stop = hasBcuWaveStopper(rangeTargets);
      if (stop.blocked) {
        deactivateGroup(scene, item, stop.blockerActor);
        continue;
      }
    }
    if (item.t === item.spawnFrame && item.remainingLevel > 0) {
      const next = buildNextWave(item);
      rest.push(next);
      next.group?.containers?.add(next);
      trace(scene, { source: 'BattleWaveRuntimePatch.nextWave', bcuReference: 'ContWaveDef.nextWave W_PROG=200, inverted reverses direction', event: 'next-wave', id: item.id, nextId: next.id, pos: next.pos, remainingLevel: next.remainingLevel, inverted: next.inverted, direction: next.direction, effectKey: next.effectKey });
    }
    if (item.t === item.attackFrame) attackAtFrame(scene, item);
    if (item.t === item.maxt) {
      trace(scene, { source: 'BattleWaveRuntimePatch.process', bcuReference: 'ContWaveDef.update if maxt == t activate=false', event: 'deactivated', id: item.id, t: item.t });
      continue;
    }
    if (item.t >= 0) trace(scene, { source: 'BattleWaveRuntimePatch.process', bcuReference: 'ContWaveDef.update anim.update(false)', event: 'animation-update', id: item.id, t: item.t });
    item.t += 1;
    rest.push(item);
  }
  scene.__bcuWaveContainers = rest.filter((w) => w.activate !== false && w.group?.active !== false);
  return { processed, active: scene.__bcuWaveContainers.length, source: 'BattleWaveRuntimePatch.process' };
}

function enqueueFromResult(scene, attacker, target, event, calc, result, meta = {}) {
  if (!result?.accepted || meta?.bcuWave || meta?.bcuSurge) return;
  const items = waveItems(calc);
  if (!items.length) return;
  const finalDamage = Math.max(0, Math.trunc(Number(calc?.finalDamage || 0)));
  if (finalDamage <= 0) return;
  const hitIndex = meta.hitIndex ?? event?.hitIndex ?? null;
  const key = meta.key || `${scene.logicFrame}:${attacker?.instanceId || 'atk'}:${target?.instanceId || 'target'}:${hitIndex}`;
  for (const proc of items) enqueue(scene, buildInitialWave(attacker, proc, finalDamage, key, event, hitIndex, target));
}

export function installBattleWaveRuntimePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  proto.processBcuWaveRuntime = function processBcuWaveRuntimePhase() {
    return process(this);
  };

  proto.ensureWaveEffectLoading = function ensureWaveEffectLoadingBcu() {
    if (this._waveEffectPromise) return this._waveEffectPromise;
    const loader = this.waveEffectLoader || new BattleWaveEffectLoader({ semanticProvider: this.bcuDb?.semanticProvider || this.semanticProvider || globalThis.__BCU_DB__?.semanticProvider || null });
    this.waveEffectLoader = loader;
    this._waveEffectPromise = loader.loadAll()
      .then((assets) => {
        this.waveEffectAssets = assets;
        this.lastWaveEffectLoadDebug = { source: 'BattleWaveRuntimePatch.ensureWaveEffectLoading', ...loader.lastLoadDebug, assets: describeWaveEffectAssets(assets) };
        globalThis.__BCU_WAVE_EFFECT_LOAD_DEBUG__ = this.lastWaveEffectLoadDebug;
        return assets;
      })
      .catch((error) => {
        this.waveEffectAssets = {};
        this.lastWaveEffectLoadDebug = { source: 'BattleWaveRuntimePatch.ensureWaveEffectLoading', loaded: 0, total: WAVE_EFFECT_TOTAL, reason: String(error?.message || error) };
        globalThis.__BCU_WAVE_EFFECT_LOAD_DEBUG__ = this.lastWaveEffectLoadDebug;
        return {};
      });
    return this._waveEffectPromise;
  };

  const originalInit = proto.init;
  if (typeof originalInit === 'function') {
    proto.init = async function initWithBcuWaveEffects(...args) {
      const result = await originalInit.apply(this, args);
      // Effect assets are non-critical visual resources. Loading every effect alias synchronously
      // blocks battle start on some browsers after the expanded bundle was added, leaving the
      // scene rendered once but the tick loop not yet running. Start loading in the background;
      // runtime callers already skip and retry effects until the bundle is available.
      void this.ensureWaveEffectLoading?.();
      return result;
    };
  }

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') throw new Error('BattleScene.queueAttackDamage is missing');
  proto.queueAttackDamage = function queueAttackDamageWithBcuContWaveDef(attacker, target, targetType, event, meta = {}) {
    const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
    if (isDirectDamageTarget(targetType)) {
      const calc = target?.lastIncomingDamageCalculation || attacker?.lastDamageCalculation || null;
      enqueueFromResult(this, attacker, target, event, calc, result, meta);
    }
    return result;
  };

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase === 'function') {
    proto.runTickPhase = function runTickPhaseWithBcuContWaveDef(phase, fn = () => {}) {
      if (phase === 'proc-resolve') {
        return originalRunTickPhase.call(this, phase, () => {
          const res = fn();
          this.processBcuWaveRuntime?.();
          return res;
        });
      }
      return originalRunTickPhase.call(this, phase, fn);
    };
  }
}

installBattleWaveRuntimePatch();
