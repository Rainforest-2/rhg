import { BcuAnimator } from '../../bcu/BcuAnimator.js';
import { BcuModelInstance } from '../../bcu/BcuModelInstance.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from '../BattleFrameClock.js';
import { EffectRuntime } from '../EffectRuntime.js';
import { enqueueBcuSurgeFromPayload } from '../BattleSurgeRuntimePatch.js';
import { BCU_ABI } from '../BcuCombatModel.js';
import { getOrbMiniDeathSurgeProc } from './BcuOrbModifier.js';
import { BCU_SCALE_MODE, buildBcuEffectTrace } from './BcuEffectTraceRuntime.js';

export const BCU_DEATH_SOUL_Y_OFFSET = 100;
export const BCU_DEATH_SURGE_TRIGGER_FRAME = 21;
export const BCU_DEATH_SOUL_FALLBACK_FRAMES = 30;

function combatModel(actor) { return actor?.bcuCombatModel || actor?.rawStats?.bcuCombatModel || actor?.stats?.bcuCombatModel || null; }
function hasAbi(actor, bit) { const abi = Number(combatModel(actor)?.ability?.abi || 0) || 0; return (abi & bit) !== 0; }
export function isBcuGlassActor(actor) { return actor?.bcuGlassSelfRemoved === true || actor?.bcuAbilityFlags?.glass === true || actor?.abilityModel?.flags?.glass === true || combatModel(actor)?.ability?.flags?.glass === true || hasAbi(actor, BCU_ABI.AB_GLASS); }

export function getBcuDeathAnimationSpec(actor) {
  const spec = combatModel(actor)?.deathAnimation || actor?.deathAnimation || null;
  const rawSoulId = Math.trunc(Number(spec?.rawSoulId ?? spec?.soulId ?? 0) || 0);
  const soulId = Math.trunc(Number(spec?.soulId ?? rawSoulId) || 0);
  return { soulId, rawSoulId, source: spec?.source || 'BCU DataEntity.getDeathAnim', fallbackApplied: spec?.fallbackApplied === true, bcuReference: spec?.bcuReference || 'Entity.AnimManager.kill: Soul s = Identifier.get(e.data.getDeathAnim())' };
}
function soulAssetKey(actor, kind, spec) { if (kind === 'deathSurge') return actor?.direction === -1 || actor?.side === 'dog-player' ? 'demonSoulUnit' : 'demonSoulEnemy'; return `soul-${String(Math.max(0, Math.trunc(Number(spec?.soulId || 0)))).padStart(3, '0')}`; }
function createSoulRuntime(asset) {
  if (!asset?.loaded || !asset?.model || !asset?.anim) return null;
  const model = new BcuModelInstance(asset.model);
  const animator = new BcuAnimator(asset.anim);
  animator.setLoop?.(false);
  animator.restart?.();
  const maxFrame = Number(asset.anim?.maxFrame) || 0;
  return { model, animator, frameCount: Math.max(1, maxFrame + 1), maxFrame };
}
function actorEquippedOrbs(actor) {
  const orbs = actor?.bcuEquippedOrbs || actor?.stats?.bcuEquippedOrbs || actor?.rawStats?.bcuEquippedOrbs || combatModel(actor)?.bcuEquippedOrbs;
  return Array.isArray(orbs) ? orbs : [];
}
// MINIDEATHSURGE has no CSV holder in BCU; its only proven source is the
// ORB_DEATH_SURGE talent orb (EUnit.processAbilityOrbs). A future custom /
// proc-object source may expose proc.miniDeathSurge directly, so honour that
// first, then fall back to the orb-derived holder.
function actorMiniDeathSurgeProc(actor) {
  const cm = combatModel(actor)?.proc?.miniDeathSurge || null;
  if (cm && Number(cm.prob) > 0) return cm;
  return getOrbMiniDeathSurgeProc(actorEquippedOrbs(actor));
}
// Mirror Data.IntType.perform(CopRand): prob<=0 -> false (no roll consumed),
// prob>=100 -> true (no roll consumed), else one nextFloat()*100 < prob roll.
function performLikeBcu(prob, random) {
  const p = Number(prob) || 0;
  if (p <= 0) return { performed: false, rolled: null };
  if (p >= 100) return { performed: true, rolled: null };
  const rolled = random() * 100;
  return { performed: rolled < p, rolled };
}
// BCU Entity.AnimManager.kill(): deathSurge bitmask is set by rolling DEATHSURGE
// first and, only on failure (else-if), MINIDEATHSURGE — they are mutually
// exclusive and full takes priority. Both use the demon-soul death animation.
function rollDeathSurge(scene, actor) {
  const proc = combatModel(actor)?.proc || {};
  const full = proc.deathSurge || null;
  const mini = actorMiniDeathSurgeProc(actor);
  const rng = scene?.getBcuRandom?.();
  const random = typeof rng === 'function' ? rng : Math.random;
  const fullProb = Number(full?.prob || 0);
  const fullRoll = performLikeBcu(fullProb, random);
  if (fullRoll.performed) return { selected: true, isMini: false, proc: full, key: 'surge', prob: fullProb, rolled: fullRoll.rolled };
  const miniProb = Number(mini?.prob || 0);
  const miniRoll = performLikeBcu(miniProb, random);
  if (miniRoll.performed) return { selected: true, isMini: true, proc: mini, key: 'miniSurge', prob: miniProb, rolled: miniRoll.rolled };
  return { selected: false, isMini: false, proc: full || mini || null, key: null, prob: fullProb || miniProb, rolled: fullRoll.rolled ?? miniRoll.rolled };
}
function resolveBcuDeathSoulLayer(actor, kind) { return kind === 'normal' ? { layer: 0, source: 'BCU Entity.AnimManager.kill normal branch sets currentLayer = 0 before Soul draw' } : { layer: Number.isFinite(actor?.currentLayer) ? actor.currentLayer : 0, source: 'BCU Entity.AnimManager.kill death-surge branch keeps current layer before demon soul draw' }; }
function applySafeSoulFallback(state, scene, assetKey, reason = 'asset-missing') {
  const assetFrameCount = Number(scene?.soulEffectAssets?.[assetKey]?.frameCount);
  const fallbackFrameCount = Number.isFinite(assetFrameCount) && assetFrameCount > 0 ? Math.trunc(assetFrameCount) : BCU_DEATH_SOUL_FALLBACK_FRAMES;
  state.frameCount = Math.max(1, fallbackFrameCount);
  state.maxFrame = state.frameCount - 1;
  state.assetLoadPending = reason === 'asset-not-loaded' || reason === 'asset-missing';
  state.visualMissing = true;
  state.visualFallback = true;
  state.visualFallbackReason = reason;
  state.assetSource = scene?.soulEffectAssets?.[assetKey]?.source || null;
  state.bcuReference = `${state.bcuReference}; JS safe fallback only: never leave active death animation with frameCount=0`;
  return state;
}

export function spawnBcuDeathSoulEffect(scene, actor, state) {
  if (!scene || !actor || !state?.active || state.kind === 'glass') return null;
  const asset = scene.soulEffectAssets?.[state.assetKey] || null;
  if (!asset?.loaded) { scene.ensureBcuSoulEffectLoading?.(); scene.pushEvent?.({ type: 'bcuDeathSoulEffectSkipped', actor: actor.instanceId || actor.label || null, assetKey: state.assetKey, reason: asset?.reason || 'asset-not-loaded' }); return null; }
  const runtime = createSoulRuntime(asset);
  if (!runtime) return null;
  const effectLayer = Number.isFinite(state.layer) ? state.layer : (Number.isFinite(actor.currentLayer) ? actor.currentLayer : 0);
  const effect = EffectRuntime.createEffect({ id: `bcu-death-soul-${actor.instanceId || actor.label || 'actor'}-${scene.logicFrame || 0}`, type: 'deathSoul', x: Number.isFinite(actor.posBcu) ? actor.posBcu : (Number.isFinite(actor.x) ? actor.x : 0), y: 0, image: asset.image, imgcut: asset.imgcut, model: runtime.model, animator: runtime.animator, scale: 1, source: 'bcu-effanim-death-soul', createdAtMs: scene.timeMs, layer: effectLayer, bcuSmokeYOffset: BCU_DEATH_SOUL_Y_OFFSET, bcuScreenOffsetX: 0, renderFlipX: actor.renderFlipX === true, bcuScaleMode: BCU_SCALE_MODE.ENTITY_STATUS, debug: { source: 'bcu-effanim-death-soul', key: state.assetKey, effectKey: state.assetKey, phase: state.kind, actor: actor.instanceId || actor.label || null, soulId: state.soulId, bcuYOffset: BCU_DEATH_SOUL_Y_OFFSET, layer: effectLayer, layerSource: state.layerSource || null, frameCount: runtime.frameCount, maxFrame: runtime.maxFrame, bcuReference: 'Entity.AnimManager.draw: dead > 0 draws soul at p.y - 100*siz and returns before base actor draw' } });
  effect.durationMs = runtime.frameCount * BCU_BATTLE_TIMER_PERIOD_MS;
  effect.frameDurationMs = BCU_BATTLE_TIMER_PERIOD_MS;
  effect.elapsedMs = -BCU_BATTLE_TIMER_PERIOD_MS;
  scene.effects ||= [];
  scene.effects.push(effect);
  state.effectId = effect.id;
  state.frameCount = runtime.frameCount;
  state.maxFrame = runtime.maxFrame;
  state.deadRemaining = runtime.frameCount;
  state.assetSource = asset.source || null;
  state.visualMissing = false;
  state.visualFallback = false;
  return effect;
}

export function startBcuDeathAnimation(actor, { scene = actor?.scene || globalThis.__APP__?.scene || null, nowMs = actor?.lastSceneTimeMs ?? 0 } = {}) {
  if (!actor) return { active: false, reason: 'missing-actor' };
  if (actor.bcuDeathAnimation?.active) return actor.bcuDeathAnimation;
  if (isBcuGlassActor(actor)) { actor.bcuDeathAnimation = { active: false, kind: 'glass', hideBaseActor: false, cleanupWhenFinished: true, frame: 0, frameCount: 0, source: 'BCU Entity.AnimManager.kill AB_GLASS branch', bcuReference: 'Entity.AnimManager.kill: AB_GLASS sets e.dead=true and dead=0 without soul' }; actor.removeAfterMs = 0; return actor.bcuDeathAnimation; }
  const spec = getBcuDeathAnimationSpec(actor);
  const surge = rollDeathSurge(scene, actor);
  const kind = surge.selected ? 'deathSurge' : 'normal';
  const layerSpec = resolveBcuDeathSoulLayer(actor, kind);
  if (surge.proc) actor.__bcuDeathSurgeManagedByDeathRuntime = true;
  if (surge.proc && !surge.selected) actor.__bcuDeathSurgeDone = true;
  const assetKey = soulAssetKey(actor, kind, spec);
  const state = { active: true, kind, soulId: kind === 'deathSurge' ? 'demonSoul' : spec.soulId, rawSoulId: spec.rawSoulId, assetKey, frame: 0, frameCount: 0, deadRemaining: 0, layer: layerSpec.layer, layerSource: layerSpec.source, worldX: Number.isFinite(actor.posBcu) ? actor.posBcu : (Number.isFinite(actor.x) ? actor.x : 0), worldY: 0, bcuYOffset: BCU_DEATH_SOUL_Y_OFFSET, hideBaseActor: true, cleanupWhenFinished: true, deathSurge: surge.selected ? { proc: surge.proc, isMini: surge.isMini === true, key: surge.key || 'surge', prob: surge.prob, rolled: surge.rolled, triggerFrame: BCU_DEATH_SURGE_TRIGGER_FRAME, triggerMode: 'elapsed-soul-frames', condition: 'soul.len() - dead == 21', triggered: false } : null, source: 'BCU Entity.AnimManager.kill/draw', bcuReference: kind === 'deathSurge' ? 'Entity.AnimManager.kill: DEATHSURGE uses demonSouls; update triggers death surge when soul.len()-dead == 21' : `${spec.bcuReference}; normal death branch sets e.currentLayer = 0 before soul draw`, startedAtMs: Number.isFinite(nowMs) ? nowMs : 0 };
  actor.bcuDeathAnimation = state;
  actor.bcuRenderOverride = { mode: 'death-soul', hideBaseActor: true, targetable: false, touchable: false, source: state.source, containerId: null };
  actor.removeAfterMs = Number.POSITIVE_INFINITY;
  const effect = spawnBcuDeathSoulEffect(scene, actor, state);
  if (!effect && state.frameCount <= 0) { const asset = scene?.soulEffectAssets?.[assetKey] || null; applySafeSoulFallback(state, scene, assetKey, asset?.reason || 'asset-missing'); state.deadRemaining = state.frameCount; }
  state.trace = buildBcuEffectTrace({ effectKey: assetKey, phase: kind, worldX: state.worldX, worldY: state.worldY, screenOffsetX: 0, bcuSmokeYOffset: BCU_DEATH_SOUL_Y_OFFSET, layer: state.layer, bcuScaleMode: BCU_SCALE_MODE.ENTITY_STATUS, effectScale: 1, renderFlipX: actor.renderFlipX === true, source: state.source, bcuReference: state.bcuReference, extra: { soulId: state.soulId, hideBaseActor: true, cleanupWhenFinished: true, visualMissing: state.visualMissing === true, visualFallback: state.visualFallback === true, layerSource: state.layerSource } });
  return state;
}

function triggerDeathSurge(scene, actor, state) {
  if (!scene || !actor || !state?.deathSurge || state.deathSurge.triggered) return null;
  state.deathSurge.triggered = true;
  actor.__bcuDeathSurgeDone = true;
  const damage = Math.max(1, Math.trunc(Number(actor.damage || 1) || 1));
  // Mirror AtkModelEntity.getDeathSurge(d): bit1 -> WT_VOLC full surge, bit2 ->
  // WT_MIVC mini surge (MINIDEATHSURGE.mult/100 of base damage, applied inside
  // buildSurge). Both spawn at soul frame 21.
  const key = state.deathSurge.isMini ? 'miniSurge' : 'surge';
  const surge = enqueueBcuSurgeFromPayload(scene, actor, { key, payload: state.deathSurge.proc, damage, event: { damage, attackKind: key, bcuDeathSurge: true }, id: `${scene.logicFrame || 0}:${actor.instanceId || actor.label || 'actor'}:death-surge` });
  scene.pushEvent?.({ type: 'bcuDeathSurgeCreated', actor: actor.instanceId || actor.label || null, isMini: state.deathSurge.isMini === true, frame: state.frame, deadRemaining: state.deadRemaining, frameCount: state.frameCount, prob: state.deathSurge.prob, payload: state.deathSurge.proc, source: 'BcuDeathAnimationRuntime', bcuReference: 'Entity.AnimManager.update: if deathSurge > 0 && soul.len() - dead == 21 -> aam.getDeathSurge(deathSurge)' });
  return surge;
}

function frameSteps(dt) { return Math.max(1, Math.round((Number(dt) || BCU_BATTLE_TIMER_PERIOD_MS) / BCU_BATTLE_TIMER_PERIOD_MS)); }
function stepDeathFrame(scene, actor, state, nowMs) {
  state.frame += 1;
  state.deadRemaining = Math.max(0, (Number.isFinite(state.frameCount) ? state.frameCount : 0) - state.frame);
  if (state.deathSurge && !state.deathSurge.triggered && state.frame === BCU_DEATH_SURGE_TRIGGER_FRAME) triggerDeathSurge(scene, actor, state);
  if (state.frameCount > 0 && state.frame >= state.frameCount) { state.active = false; state.finished = true; actor.bcuRenderOverride = null; actor.removeAfterMs = 0; actor.deadAtMs = Number.isFinite(nowMs) ? nowMs : actor.deadAtMs; }
}

export function tickBcuDeathAnimation(actor, dt = BCU_BATTLE_TIMER_PERIOD_MS, { scene = actor?.scene || globalThis.__APP__?.scene || null, nowMs = actor?.lastSceneTimeMs ?? 0 } = {}) {
  const state = actor?.bcuDeathAnimation;
  if (!state?.active) return { active: false };
  if (!Number.isFinite(state.frameCount) || state.frameCount <= 0) { applySafeSoulFallback(state, scene, state.assetKey, 'invalid-frame-count'); state.deadRemaining = state.frameCount; }
  const frame = Number.isFinite(actor.lastSceneLogicFrame) ? actor.lastSceneLogicFrame : null;
  if (frame !== null && actor.__lastBcuDeathAnimationLogicFrame === frame) return { active: true, skipped: true, state };
  actor.__lastBcuDeathAnimationLogicFrame = frame;
  for (let i = 0; i < frameSteps(dt) && state.active; i += 1) stepDeathFrame(scene, actor, state, nowMs);
  actor.lastBcuDeathAnimationTickDebug = { source: 'BcuDeathAnimationRuntime.tick', active: state.active, kind: state.kind, frame: state.frame, frameCount: state.frameCount, deadRemaining: state.deadRemaining, deathSurgeTriggered: state.deathSurge?.triggered === true, deathSurgeTriggerFrame: state.deathSurge?.triggerFrame ?? null, hideBaseActor: state.hideBaseActor, cleanupWhenFinished: state.cleanupWhenFinished, visualMissing: state.visualMissing === true, visualFallback: state.visualFallback === true, visualFallbackReason: state.visualFallbackReason || null, bcuTriggerCondition: state.deathSurge?.condition || null };
  return { active: state.active, state };
}

export function isBcuDeathAnimationActive(actor) { return actor?.bcuDeathAnimation?.active === true; }
