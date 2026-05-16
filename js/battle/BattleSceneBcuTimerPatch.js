import { BattleScene } from './BattleScene.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { ProductionRuntime } from './ProductionRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-timer-patch.v1');

function finiteNonNegative(value, fallback = BCU_BATTLE_TIMER_PERIOD_MS) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function respawnFramesToMs(frames) {
  return Math.max(0, Number(frames) || 0) * BCU_BATTLE_TIMER_PERIOD_MS;
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
    return originalTick.call(this, finiteNonNegative(dt));
  };

  proto.applyBcuProductionStatsFromTemplates = function applyBcuProductionStatsFromTemplatesBcuTimer(roster = []) {
    for (const u of roster) {
      if (!u || u.statsType !== 'unit') continue;
      const tpl = this.actorFactory.templates.get(u.slotId);
      const st = tpl?.stats;
      if (Number.isFinite(st?.price)) {
        u.cost = st.price;
        u.costSource = 'bcu-unit-price';
        u.productionCostSource = u.productionCostSource || u.costSource;
        u.bcuPrice = st.price;
      }
      if (Number.isFinite(st?.respawnFrames)) {
        u.bcuRespawnFrames = st.respawnFrames;
        u.bcuRespawnMs = respawnFramesToMs(st.respawnFrames);
        u.cooldownMs = u.bcuRespawnMs;
        u.cooldownSource = 'bcu-unit-respawn';
        u.productionCooldownSource = u.productionCooldownSource || u.cooldownSource;
      }
      u.productionSourceDebug = ProductionRuntime.describeProductionSources(u);
    }
  };

  proto.tickLineupChange = function tickLineupChangeBcuTimer(dt) {
    if (!this.lineupChanging) return;
    const stepDt = finiteNonNegative(dt, BCU_BATTLE_TIMER_PERIOD_MS);
    this.lineupChangeElapsedMs += stepDt;
    this.lineupChangeFrameAccumulatorMs += stepDt;
    while (this.lineupChangeFrameAccumulatorMs >= BCU_BATTLE_TIMER_PERIOD_MS && this.lineupChangeFrameRemaining > 0) {
      this.lineupChangeFrameAccumulatorMs -= BCU_BATTLE_TIMER_PERIOD_MS;
      this.lineupChangeFrameRemaining -= 1;
      if (!this.lineupChangeSwapped && this.lineupChangeFrameRemaining === 2) {
        this.frontLineup = this.lineupChangeNewFront;
        this.lineupChangeSwapped = true;
      }
    }
    if (this.lineupChangeFrameRemaining <= 0) {
      this.lineupChanging = false;
      this.lineupChangeElapsedMs = 0;
      this.lineupChangeFrameAccumulatorMs = 0;
      this.lineupChangeSwapped = false;
      this.lineupChangeOldFront = this.frontLineup;
      this.lineupChangeNewFront = this.frontLineup === 0 ? 1 : 0;
    }
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
