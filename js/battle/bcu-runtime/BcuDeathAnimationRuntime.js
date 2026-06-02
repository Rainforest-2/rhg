import { BcuAnimator } from '../../bcu/BcuAnimator.js';
import { BcuModelInstance } from '../../bcu/BcuModelInstance.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from '../BattleFrameClock.js';
import { EffectRuntime } from '../EffectRuntime.js';
import { enqueueBcuSurgeFromPayload } from '../BattleSurgeRuntimePatch.js';
import { BCU_ABI } from '../BcuCombatModel.js';
import { BCU_SCALE_MODE, buildBcuEffectTrace } from './BcuEffectTraceRuntime.js';

export const BCU_DEATH_SOUL_Y_OFFSET = 100;
export const BCU_DEATH_SURGE_TRIGGER_FRAME = 21;

function combatModel(actor) {
  return actor?.bcuCombatModel || actor?.rawStats?.bcuCombatModel || actor?.stats?.bcuCombatModel || null;
}

function hasAbi(actor, bit) {
  const model = combatModel(actor);
  const abi = Number(model?.ability?.abi || 0) || 0;
  return (abi & bit) !== 0;
}

export function isBcuGlassActor(actor) {
  return actor?.bcuGlassSelfRemoved === true || actor?.bcuAbilityFlags?.glass === true || actor?.abilityModel?.flags?.glass === true || combatModel(actor)?.ability?.flags?.glass === true || hasAbi(actor, BCU_ABI.AB_GLASS);
}

export function getBcuDeathAnimationSpec(actor) {
  const spec = combatModel(actor)?.deathAnimation || actor?.deathAnimation || null;
  const rawSoulId = Math.trunc(Number(spec?.rawSoulId ?? spec?.soulId ?? 0) || 0);
  const soulId = Math.trunc(Number(spec?.soulId ?? rawSoulId) || 0);
  return {
    soulId,
    rawSoulId,
    source: spec?.source || 'BCU DataEntity.getDeathAnim',
    fallbackApplied: spec?.fallbackApplied === true,
    bcuReference: spec?.bcuReference || 'Entity.AnimManager.kill: Soul s = Identifier.get(e.data.getDeathAnim())'
  };
}

function soulAssetKey(actor, kind, spec) {
  if (kind === 'deathSurge') return actor?.direction === -1 || actor?.side === 'dog-player' ? 'demonSoulUnit' : 'demonSoulEnemy';
  return `soul-${String(Math.max(0, Math.trunc(Number(spec?.soulId || 0)))).padStart(3, '0')}`;
}

function createSoulRuntime(asset) {
  if (!asset?.loaded || !asset?.model || !asset?.anim) return null;
  const model = new BcuModelInstance(asset.model);
  const animator = new BcuAnimator(asset.anim);
  animator.setLoop?.(false);
  animator.restart?.();
  const maxFrame = Number(asset.anim?.maxFrame) || 0;
  return { model, animator, frameCount: Math.max(1, maxFrame + 1), maxFrame };
}

function rollDeathSurge(scene, actor) {
  const ds = combatModel(actor)?.proc?.deathSurge || null;
  const prob = Number(ds?.prob || 0);
  if (!ds || prob <= 0) return { selected: false, proc: null, prob: 0, rolled: null };
  const rng = scene?.getBcuRandom?.();
  const random = typeof rng === 'function' ? rng : Math.random;
  const rolled = random() * 100;
  return { selected: rolled < prob, proc: ds, prob, rolled };
}

export function spawnBcuDeathSoulEffect(scene, actor, state) {
  if (!scene || !actor || !state?.active || state.kind === 'glass') return null;
  const asset = scene.soulEffectAssets?.[state.assetKey] || null;
  if (!asset?.loaded) {
    scene.ensureBcuSoulEffectLoading?.();
    scene.pushEvent?.({ type: 'bcuDeathSoulEffectSkipped', actor: actor.instanceId || actor.label || null, assetKey: state.assetKey, reason: asset?.reason || 'asset-not-loaded' });
    return null;
  }
  const runtime = createSoulRuntime(asset);
  if (!runtime) return null;
  const effect = EffectRuntime.createEffect({
    id: `bcu-death-soul-${actor.instanceId || actor.label || 'actor'}-${scene.logicFrame || 0}`,
    type: 'deathSoul',
    x: Number.isFinite(actor.posBcu) ? actor.posBcu : (Number.isFinite(actor.x) ? actor.x : 0),
    y: 0,
    image: asset.image,
    imgcut: asset.imgcut,
    model: runtime.model,
    animator: runtime.animator,
    scale: 1,
    source: 'bcu-effanim-death-soul',
    createdAtMs: scene.timeMs,
    layer: Number.isFinite(actor.currentLayer) ? actor.currentLayer : 0,
    bcuSmokeYOffset: BCU_DEATH_SOUL_Y_OFFSET,
    bcuScreenOffsetX: 0,
    renderFlipX: actor.renderFlipX === true,
    bcuScaleMode: BCU_SCALE_MODE.ENTITY_STATUS,
    debug: {
      source: 'bcu-effanim-death-soul',
      key: state.assetKey,
      effectKey: state.assetKey,
      phase: state.kind,
      actor: actor.instanceId || actor.label || null,
      soulId: state.soulId,
      bcuYOffset: BCU_DEATH_SOUL_Y_OFFSET,
      frameCount: runtime.frameCount,
      maxFrame: runtime.maxFrame,
      bcuReference: 'Entity.AnimManager.draw: dead > 0 draws soul at p.y - 100*siz and returns before base actor draw'
    }
  });
  effect.durationMs = runtime.frameCount * BCU_BATTLE_TIMER_PERIOD_MS;
  effect.frameDurationMs = BCU_BATTLE_TIMER_PERIOD_MS;
  effect.elapsedMs = -BCU_BATTLE_TIMER_PERIOD_MS;
  scene.effects ||= [];
  scene.effects.push(effect);
  state.effectId = effect.id;
  state.frameCount = runtime.frameCount;
  state.maxFrame = runtime.maxFrame;
  state.assetSource = asset.source || null;
  return effect;
}

export function startBcuDeathAnimation(actor, { scene = actor?.scene || globalThis.__APP__?.scene || null, nowMs = actor?.lastSceneTimeMs ?? 0 } = {}) {
  if (!actor) return { active: false, reason: 'missing-actor' };
  if (actor.bcuDeathAnimation?.active) return actor.bcuDeathAnimation;
  if (isBcuGlassActor(actor)) {
    actor.bcuDeathAnimation = {
      active: false,
      kind: 'glass',
      hideBaseActor: false,
      cleanupWhenFinished: true,
      frame: 0,
      frameCount: 0,
      source: 'BCU Entity.AnimManager.kill AB_GLASS branch',
      bcuReference: 'Entity.AnimManager.kill: AB_GLASS sets e.dead=true and dead=0 without soul'
    };
    actor.removeAfterMs = 0;
    return actor.bcuDeathAnimation;
  }
  const spec = getBcuDeathAnimationSpec(actor);
  const surge = rollDeathSurge(scene, actor);
  const kind = surge.selected ? 'deathSurge' : 'normal';
  if (surge.proc) actor.__bcuDeathSurgeManagedByDeathRuntime = true;
  if (surge.proc && !surge.selected) actor.__bcuDeathSurgeDone = true;
  const assetKey = soulAssetKey(actor, kind, spec);
  const state = {
    active: true,
    kind,
    soulId: kind === 'deathSurge' ? 'demonSoul' : spec.soulId,
    rawSoulId: spec.rawSoulId,
    assetKey,
    frame: 0,
    frameCount: 0,
    layer: Number.isFinite(actor.currentLayer) ? actor.currentLayer : 0,
    worldX: Number.isFinite(actor.posBcu) ? actor.posBcu : (Number.isFinite(actor.x) ? actor.x : 0),
    worldY: 0,
    bcuYOffset: BCU_DEATH_SOUL_Y_OFFSET,
    hideBaseActor: true,
    cleanupWhenFinished: true,
    deathSurge: surge.selected ? { proc: surge.proc, prob: surge.prob, rolled: surge.rolled, triggerFrame: BCU_DEATH_SURGE_TRIGGER_FRAME, triggered: false } : null,
    source: 'BCU Entity.AnimManager.kill/draw',
    bcuReference: kind === 'deathSurge'
      ? 'Entity.AnimManager.kill: DEATHSURGE uses demonSouls; update triggers death surge when soul.len()-dead == 21'
      : spec.bcuReference,
    startedAtMs: Number.isFinite(nowMs) ? nowMs : 0
  };
  actor.bcuDeathAnimation = state;
  actor.bcuRenderOverride = { mode: 'death-soul', hideBaseActor: true, targetable: false, touchable: false, source: state.source, containerId: null };
  actor.removeAfterMs = Number.POSITIVE_INFINITY;
  const effect = spawnBcuDeathSoulEffect(scene, actor, state);
  if (!effect && state.frameCount <= 0) {
    const assetFrameCount = Number(scene?.soulEffectAssets?.[assetKey]?.frameCount);
    state.frameCount = Number.isFinite(assetFrameCount) && assetFrameCount > 0 ? Math.trunc(assetFrameCount) : 0;
  }
  state.trace = buildBcuEffectTrace({
    effectKey: assetKey,
    phase: kind,
    worldX: state.worldX,
    worldY: state.worldY,
    screenOffsetX: 0,
    bcuSmokeYOffset: BCU_DEATH_SOUL_Y_OFFSET,
    layer: state.layer,
    bcuScaleMode: BCU_SCALE_MODE.ENTITY_STATUS,
    effectScale: 1,
    renderFlipX: actor.renderFlipX === true,
    source: state.source,
    bcuReference: state.bcuReference,
    extra: { soulId: state.soulId, hideBaseActor: true, cleanupWhenFinished: true }
  });
  return state;
}

function triggerDeathSurge(scene, actor, state) {
  if (!scene || !actor || !state?.deathSurge || state.deathSurge.triggered) return null;
  state.deathSurge.triggered = true;
  actor.__bcuDeathSurgeDone = true;
  const damage = Math.max(1, Math.trunc(Number(actor.damage || 1) || 1));
  const surge = enqueueBcuSurgeFromPayload(scene, actor, {
    key: 'surge',
    payload: state.deathSurge.proc,
    damage,
    event: { damage, attackKind: 'surge', bcuDeathSurge: true },
    id: `${scene.logicFrame || 0}:${actor.instanceId || actor.label || 'actor'}:death-surge`
  });
  scene.pushEvent?.({
    type: 'bcuDeathSurgeCreated',
    actor: actor.instanceId || actor.label || null,
    frame: state.frame,
    prob: state.deathSurge.prob,
    payload: state.deathSurge.proc,
    source: 'BcuDeathAnimationRuntime',
    bcuReference: 'Entity.AnimManager.update: if deathSurge > 0 && soul.len() - dead == 21 -> aam.getDeathSurge(deathSurge)'
  });
  return surge;
}

export function tickBcuDeathAnimation(actor, dt = BCU_BATTLE_TIMER_PERIOD_MS, { scene = actor?.scene || globalThis.__APP__?.scene || null, nowMs = actor?.lastSceneTimeMs ?? 0 } = {}) {
  const state = actor?.bcuDeathAnimation;
  if (!state?.active) return { active: false };
  const frame = Number.isFinite(actor.lastSceneLogicFrame) ? actor.lastSceneLogicFrame : null;
  if (frame !== null && actor.__lastBcuDeathAnimationLogicFrame === frame) return { active: true, skipped: true, state };
  actor.__lastBcuDeathAnimationLogicFrame = frame;
  state.frame += Math.max(1, Math.round((Number(dt) || BCU_BATTLE_TIMER_PERIOD_MS) / BCU_BATTLE_TIMER_PERIOD_MS));
  if (state.deathSurge && state.frame >= BCU_DEATH_SURGE_TRIGGER_FRAME) triggerDeathSurge(scene, actor, state);
  if (state.frameCount > 0 && state.frame >= state.frameCount) {
    state.active = false;
    state.finished = true;
    actor.bcuRenderOverride = null;
    actor.removeAfterMs = 0;
    actor.deadAtMs = Number.isFinite(nowMs) ? nowMs : actor.deadAtMs;
  }
  actor.lastBcuDeathAnimationTickDebug = {
    source: 'BcuDeathAnimationRuntime.tick',
    active: state.active,
    kind: state.kind,
    frame: state.frame,
    frameCount: state.frameCount,
    hideBaseActor: state.hideBaseActor,
    cleanupWhenFinished: state.cleanupWhenFinished
  };
  return { active: state.active, state };
}

export function isBcuDeathAnimationActive(actor) {
  return actor?.bcuDeathAnimation?.active === true;
}
