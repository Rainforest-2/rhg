import { BattleActor } from './BattleActor.js';
import { BattleScene } from './BattleScene.js';
import { TEMPLATE_LOAD_LEVEL } from './BattleActorFactory.js';
import {
  clearBcuBurrow,
  canStartBcuBurrow,
  getBcuBurrowTouchMask,
  getRequiredBcuBurrowAnimationIds,
  hasBcuBurrowTemplateAnimations,
  hydrateBcuBurrowActorAnimations,
  isBcuBurrowNormallyTargetable,
  isBcuBurrowTargetableForEvent,
  startBcuBurrow,
  tickBcuBurrow
} from './bcu-runtime/BcuBurrowLifecycleRuntime.js';

const ACTOR_PATCH_FLAG = Symbol.for('wanko-battle.actor-bcu-burrow.v3');
const SCENE_PATCH_FLAG = Symbol.for('wanko-battle.scene-bcu-burrow.v3');

function templateHasBurrow(template) {
  return !!template?.stats?.bcuCombatModel?.proc?.burrow?.count;
}

function actorTemplate(scene, actor) {
  return scene?.actorFactory?.templates?.get?.(actor?.slotId || actor?.templateId) || null;
}

function animationDefinitionsFor(unitDef, template = null) {
  const defs = template?.assetDef?.animations || unitDef?.assetDef?.animations || [];
  return Array.isArray(defs) ? defs : [];
}

function definedBurrowAnimationIds(unitDef, template = null) {
  const wanted = new Set(getRequiredBcuBurrowAnimationIds());
  return animationDefinitionsFor(unitDef, template).map((d) => d?.id).filter((id) => wanted.has(id));
}

function hasBurrowAnimationDefinitions(unitDef, template = null) {
  return definedBurrowAnimationIds(unitDef, template).length === getRequiredBcuBurrowAnimationIds().length;
}

function disableBurrowForMissingDefinitions(scene, unitDef, template = null, reason = 'burrow-animation-definitions-missing') {
  if (template?.stats?.bcuCombatModel?.proc?.burrow) template.stats.bcuCombatModel.proc.burrow.disabled = true;
  if (template?.stats?.bcuCombatModel?.proc?.burrow) template.stats.bcuCombatModel.proc.burrow.count = 0;
  scene?.pushEvent?.({
    type: 'bcuBurrowDisabled',
    slotId: unitDef?.slotId || template?.unitDef?.slotId || null,
    semanticKey: unitDef?.assetDef?.semanticKey || template?.assetDef?.semanticKey || null,
    reason,
    requiredAnimations: getRequiredBcuBurrowAnimationIds(),
    definedAnimations: definedBurrowAnimationIds(unitDef, template),
    bcuReference: 'TYPE7 burrow requires BURROW_DOWN/BURROW_MOVE/BURROW_UP; JS must not enter invisible burrow if bundle lacks these definitions'
  });
}

function preloadBurrowAnimations(scene, unitDef, template = null, reason = 'burrow-animation-preload') {
  if (!scene?.actorFactory?.preloadTemplate || !unitDef) return null;
  const ids = definedBurrowAnimationIds(unitDef, template);
  if (ids.length !== getRequiredBcuBurrowAnimationIds().length) {
    disableBurrowForMissingDefinitions(scene, unitDef, template, 'burrow-animation-definitions-missing');
    return null;
  }
  const promise = scene.actorFactory.preloadTemplate(unitDef, { level: TEMPLATE_LOAD_LEVEL.FULL_VISUAL, animIds: ids });
  scene.pushEvent?.({ type: 'bcuBurrowAnimationPreloadRequested', slotId: unitDef.slotId || null, animIds: ids, reason });
  return promise;
}

function ensureActorBurrowAnimations(scene, actor) {
  const tpl = actorTemplate(scene, actor);
  if (tpl) hydrateBcuBurrowActorAnimations(actor, tpl);
  return tpl;
}

export function installBattleActorBcuBurrowPatch() {
  const proto = BattleActor?.prototype;
  if (proto && !proto[ACTOR_PATCH_FLAG]) {
    proto[ACTOR_PATCH_FLAG] = true;

    proto.getBcuTouchMask = function getBcuTouchMask() {
      return getBcuBurrowTouchMask(this);
    };

    proto.isBcuTargetableForEvent = function isBcuTargetableForEvent(event = null) {
      if (this.bcuBurrow?.active) return isBcuBurrowTargetableForEvent(this, event);
      if (typeof this.isTargetable === 'function') return this.isTargetable();
      return this.hp > 0;
    };

    const originalIsTargetable = proto.isTargetable;
    proto.isTargetable = function isTargetableWithBcuBurrow() {
      if (this.bcuBurrow?.active && !isBcuBurrowNormallyTargetable(this)) return false;
      return originalIsTargetable.call(this);
    };

    const originalIsTouchable = proto.isTouchable;
    proto.isTouchable = function isTouchableWithBcuBurrow() {
      if (this.bcuBurrow?.active && !isBcuBurrowNormallyTargetable(this)) return false;
      return originalIsTouchable.call(this);
    };

    const originalTick = proto.tick;
    proto.tick = function tickWithBcuBurrow(dt) {
      if (this.bcuBurrow?.active) {
        tickBcuBurrow(this, dt, { scene: this.scene || globalThis.__APP__?.scene || null });
        return;
      }
      return originalTick.call(this, dt);
    };

    const originalEnterDeadState = proto.enterDeadState;
    proto.enterDeadState = function enterDeadStateClearingBcuBurrow(nowMs = 0) {
      clearBcuBurrow(this, 'death');
      return originalEnterDeadState.call(this, nowMs);
    };
  }

  const sceneProto = BattleScene?.prototype;
  if (sceneProto && !sceneProto[SCENE_PATCH_FLAG]) {
    sceneProto[SCENE_PATCH_FLAG] = true;

    const originalSpawnStageEnemy = sceneProto.spawnStageEnemy;
    if (typeof originalSpawnStageEnemy === 'function') {
      sceneProto.spawnStageEnemy = function spawnStageEnemyWithBurrowAnimations(unitDef, row) {
        const tpl = this.actorFactory?.templates?.get?.(unitDef?.slotId);
        if (templateHasBurrow(tpl) && !hasBcuBurrowTemplateAnimations(tpl)) {
          if (!hasBurrowAnimationDefinitions(unitDef, tpl)) {
            disableBurrowForMissingDefinitions(this, unitDef, tpl);
          } else {
            preloadBurrowAnimations(this, unitDef, tpl, 'stage-enemy-burrow-required');
            this.pushEvent?.({ type: 'stageEnemySpawnDeferred', rowIndex: row?.rowIndex, slotId: unitDef?.slotId, reason: 'bcu-burrow-animation-loading' });
            return false;
          }
        }
        const before = this.actors?.length || 0;
        const result = originalSpawnStageEnemy.call(this, unitDef, row);
        if (result) {
          for (const actor of (this.actors || []).slice(before)) {
            ensureActorBurrowAnimations(this, actor);
          }
        }
        return result;
      };
    }

    const originalSpawnActor = sceneProto.spawnActor;
    if (typeof originalSpawnActor === 'function') {
      sceneProto.spawnActor = function spawnActorHydratingBurrowAnimations(unitDef, side, isPlayerProduced = false, options = {}) {
        const actor = originalSpawnActor.call(this, unitDef, side, isPlayerProduced, options);
        if (actor) ensureActorBurrowAnimations(this, actor);
        return actor;
      };
    }

    const originalStartActorAttack = sceneProto.startActorAttack;
    sceneProto.startActorAttack = function startActorAttackWithBcuBurrow(actor, target, targetType) {
      const tpl = ensureActorBurrowAnimations(this, actor);
      const start = canStartBcuBurrow(this, actor, target);
      if (start.ok) {
        startBcuBurrow(actor, { scene: this });
        return true;
      }
      if (start.reason === 'burrow-animation-missing') {
        const unitDef = tpl?.unitDef || { slotId: actor?.slotId, assetDef: actor?.assetDef };
        const preload = preloadBurrowAnimations(this, unitDef, tpl, 'attack-start-burrow-required');
        this.pushEvent?.({ type: 'bcuBurrowStartDeferred', actor: actor?.instanceId || actor?.label || null, missingAnimations: start.missingAnimations || [], skipped: preload === null });
        if (preload !== null) return false;
      }
      return originalStartActorAttack.call(this, actor, target, targetType);
    };
  }
}

installBattleActorBcuBurrowPatch();
