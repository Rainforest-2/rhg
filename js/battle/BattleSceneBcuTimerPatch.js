import { BattleScene } from './BattleScene.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import {
  ProductionRuntime,
  applyCharacterModificationToProduction,
  applyCustomStageProductionModifiers,
  hasCharacterModificationProduction,
  hasCustomStageProductionModifiers,
  resolveBcuProductionValues,
  resolveUnitDefinitionProductionValues
} from './ProductionRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-timer-patch.v2');

function finiteNonNegative(value, fallback = BCU_BATTLE_TIMER_PERIOD_MS) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function respawnFramesToMs(frames) {
  return Math.max(0, Number(frames) || 0) * BCU_BATTLE_TIMER_PERIOD_MS;
}

function applyLineupChangeAtStageBasisTail(scene, dt) {
  if (!scene.lineupChanging) return;
  const stepDt = finiteNonNegative(dt, BCU_BATTLE_TIMER_PERIOD_MS);
  scene.lineupChangeElapsedMs += stepDt;
  scene.lineupChangeFrameAccumulatorMs += stepDt;
  while (scene.lineupChangeFrameAccumulatorMs >= BCU_BATTLE_TIMER_PERIOD_MS && scene.lineupChangeFrameRemaining > 0) {
    scene.lineupChangeFrameAccumulatorMs -= BCU_BATTLE_TIMER_PERIOD_MS;
    scene.lineupChangeFrameRemaining -= 1;
    if (!scene.lineupChangeSwapped && scene.lineupChangeFrameRemaining === 2) {
      scene.frontLineup = scene.lineupChangeNewFront;
      scene.lineupChangeSwapped = true;
    }
  }
  if (scene.lineupChangeFrameRemaining <= 0) {
    scene.lineupChanging = false;
    scene.lineupChangeElapsedMs = 0;
    scene.lineupChangeFrameAccumulatorMs = 0;
    scene.lineupChangeSwapped = false;
    scene.lineupChangeOldFront = scene.frontLineup;
    scene.lineupChangeNewFront = scene.frontLineup === 0 ? 1 : 0;
  }
}

export function installBattleSceneBcuTimerPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalTick = proto.tick;
  if (typeof originalTick !== 'function') {
    throw new Error('BattleScene.tick is missing; cannot install BCU timer patch');
  }

  proto.tick = function tickBcuTimer(dt = BCU_BATTLE_TIMER_PERIOD_MS) {
    const stepDt = finiteNonNegative(dt);
    this.__bcuLineupChangeDeferred = true;
    this.__bcuLineupChangeDeferredDt = null;
    try {
      return originalTick.call(this, stepDt);
    } finally {
      const deferredDt = this.__bcuLineupChangeDeferredDt;
      this.__bcuLineupChangeDeferred = false;
      this.__bcuLineupChangeDeferredDt = null;
      if (deferredDt !== null && this.battleState === 'running') {
        applyLineupChangeAtStageBasisTail(this, deferredDt);
        this.pushEvent?.({
          type: 'bcuLineupChangeTickAtStageBasisTail',
          source: 'BCU StageBasis.update lines 989-999',
          dtMs: deferredDt,
          frontLineup: this.frontLineup,
          lineupChanging: this.lineupChanging
        });
      }
    }
  };

  proto.applyBcuProductionStatsFromTemplates = function applyBcuProductionStatsFromTemplatesBcuTimer(roster = []) {
    const stageLimits = this.stage?.runtime?.customStageLimits
      || this.stage?.definition?.customStageLimits
      || null;
    const hasStageModifiers = hasCustomStageProductionModifiers(stageLimits);
    for (const u of roster) {
      if (!u) continue;
      const hasProductionModification = hasCharacterModificationProduction(u.characterModification);
      if (u.statsType !== 'unit' && !hasProductionModification && !hasStageModifiers) continue;
      const tpl = this.actorFactory.getTemplate(u);
      const st = tpl?.stats;
      let normalProd;
      if (u.statsType === 'unit') {
        normalProd = resolveBcuProductionValues(st);
      } else {
        normalProd = u.bcuNormalProductionBase || resolveUnitDefinitionProductionValues(u);
        if (!u.bcuNormalProductionBase) u.bcuNormalProductionBase = { ...normalProd };
      }
      const stageProd = applyCustomStageProductionModifiers(normalProd, stageLimits);
      const prod = applyCharacterModificationToProduction(stageProd, u.characterModification, {
        source: u.characterModificationSource || 'formation',
        modificationHash: u.characterModificationHash || null
      });
      const modifiedFields = new Set(prod.characterModification?.changedFields || []);
      const stageCostModified = stageProd.customStageProduction?.applied === true
        && stageProd.customStageProduction.globalCostMultiplier !== 1;
      const stageCooldownModified = stageProd.customStageProduction?.applied === true
        && stageProd.customStageProduction.globalCooldownMultiplier !== 1;
      u.bcuProduction = prod;
      if (stageProd.customStageProduction?.applied) {
        u.bcuPreStageDeployCost = stageProd.normalBeforeStageDeployCost ?? null;
        u.bcuPreStageRespawnFrames = stageProd.normalBeforeStageRespawnFrames ?? null;
      }
      if (prod.characterModification?.applied) {
        u.bcuNormalDeployCost = prod.normalDeployCost ?? prod.deployCost ?? null;
        u.bcuNormalRespawnFrames = prod.normalRespawnFrames ?? prod.respawnFrames ?? null;
      }
      if (Number.isFinite(prod.deployCost)) {
        u.cost = prod.deployCost;
        u.defaultCost = prod.deployCost;
        u.costSource = modifiedFields.has('production.cost')
          ? 'character-modification-absolute'
          : (stageCostModified ? 'custom-stage-global-cost-multiplier' : 'bcu-unit-deploy-cost');
        u.productionCostSource = modifiedFields.has('production.cost') || stageCostModified
          ? u.costSource
          : (u.productionCostSource || u.costSource);
        if (u.statsType === 'unit') {
          u.bcuPrice = prod.rawPrice;
          u.bcuStagePrice = prod.stagePrice;
        }
        u.bcuDeployCost = prod.deployCost;
      }
      if (Number.isFinite(prod.respawnFrames)) {
        u.bcuRespawnFrames = prod.respawnFrames;
        if (u.statsType === 'unit') u.bcuRawRespawnFrames = prod.rawRespawnFrames;
        u.bcuRespawnMs = respawnFramesToMs(prod.respawnFrames);
        u.cooldownMs = u.bcuRespawnMs;
        u.cooldownSource = modifiedFields.has('production.respawnFrames')
          ? 'character-modification-absolute'
          : (stageCooldownModified ? 'custom-stage-global-cooldown-multiplier' : 'bcu-unit-respawn-final');
        u.productionCooldownSource = modifiedFields.has('production.respawnFrames') || stageCooldownModified
          ? u.cooldownSource
          : (u.productionCooldownSource || u.cooldownSource);
      }
      if (Number.isFinite(prod.deployLimit)) u.deployLimit = prod.deployLimit;
      u.productionSourceDebug = ProductionRuntime.describeProductionSources(u);
    }
  };

  proto.tickLineupChange = function tickLineupChangeBcuTimer(dt) {
    if (this.__bcuLineupChangeDeferred) {
      this.__bcuLineupChangeDeferredDt = finiteNonNegative(dt, BCU_BATTLE_TIMER_PERIOD_MS);
      return;
    }
    applyLineupChangeAtStageBasisTail(this, dt);
  };

  proto.tickKnockback = function tickKnockbackBcuTimer(actor, dt, target) {
    actor.kbFrameAccumulatorMs = (actor.kbFrameAccumulatorMs || 0) + finiteNonNegative(dt, BCU_BATTLE_TIMER_PERIOD_MS);
    let processed = 0;
    while (actor.kbFrameAccumulatorMs >= BCU_BATTLE_TIMER_PERIOD_MS && actor.state === 'knockback' && processed < 1) {
      actor.kbFrameAccumulatorMs -= BCU_BATTLE_TIMER_PERIOD_MS;
      const step = actor.stepKnockbackFrame?.();
      processed += 1;
      if (step?.done) break;
    }
    if (actor.lastKnockbackDebug) {
      actor.lastKnockbackDebug.frameTimeSource = 'BCU-java-PC main.Timer.p = 33ms';
      actor.lastKnockbackDebug.battleTimeScale = BATTLE_CONFIG.tuning?.battleTimeScale;
      actor.lastKnockbackDebug.maxFramesPerTick = 1;
    }
    if (actor.kbMoveFramesRemaining > 0) return;
    this.finishKnockback(actor, target);
  };
}

installBattleSceneBcuTimerPatch();
