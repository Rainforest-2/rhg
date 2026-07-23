import { BattleScene } from './BattleScene.js';
import { BcuRankingRuntime } from './BcuRankingRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-ranking-runtime.v1');

function ensureRankingRuntime(scene) {
  const stageRuntime = scene?.stage?.runtime || {};
  const identity = `${stageRuntime.sourcePath || stageRuntime.stageId || 'stage'}:${stageRuntime.trail === true}:${Number(stageRuntime.timeLimit || 0)}`;
  if (!(scene.bcuRankingRuntime instanceof BcuRankingRuntime) || scene.bcuRankingRuntimeStageIdentity !== identity) {
    scene.bcuRankingRuntime = new BcuRankingRuntime(stageRuntime);
    scene.bcuRankingRuntimeStageIdentity = identity;
  }
  return scene.bcuRankingRuntime;
}

function publishRankingDebug(scene, reason) {
  const runtime = ensureRankingRuntime(scene);
  const debug = { ...runtime.describe(), reason, logicFrame: scene?.logicFrame ?? null };
  scene.lastBcuRankingRuntimeDebug = debug;
  if (scene?.stage?.runtime) {
    scene.stage.runtime.rankingScore = runtime.score;
    scene.stage.runtime.rankingOvertime = runtime.overtime;
    scene.stage.runtime.rankingRuntimeDebug = debug;
  }
  globalThis.__BCU_RANKING_RUNTIME_DEBUG__ = debug;
  return debug;
}

export function installBattleSceneBcuRankingRuntimePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  proto.getBcuRankingRuntime = function getBcuRankingRuntime() {
    return ensureRankingRuntime(this);
  };
  proto.getBcuRankingRuntimeDebug = function getBcuRankingRuntimeDebug() {
    return publishRankingDebug(this, 'explicit-read');
  };

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase !== 'function') throw new Error('BattleScene.runTickPhase is missing');
  proto.runTickPhase = function runTickPhaseWithBcuRanking(phase, fn) {
    const result = originalRunTickPhase.call(this, phase, fn);
    const ranking = ensureRankingRuntime(this);
    if (phase === 'advance-clock') {
      ranking.updateClock(this.logicFrame);
      publishRankingDebug(this, 'advance-clock');
    } else if (phase === 'knockback-death' && ranking.trail) {
      for (const actor of this.actors || []) {
        const scoreEvent = ranking.scoreEnemyDeath(this, actor);
        if (!scoreEvent) continue;
        this.pushEvent?.({ type: 'bcuRankingEnemyScore', ...scoreEvent });
      }
      publishRankingDebug(this, 'knockback-death');
    }
    return result;
  };

  const originalTickStageEnemySpawn = proto.tickStageEnemySpawn;
  if (typeof originalTickStageEnemySpawn === 'function') {
    proto.tickStageEnemySpawn = function tickStageEnemySpawnWithBcuOvertime(...args) {
      const ranking = ensureRankingRuntime(this);
      ranking.updateClock(this.logicFrame);
      if (ranking.trail && ranking.overtime) {
        publishRankingDebug(this, 'enemy-spawn-blocked-overtime');
        return [];
      }
      return originalTickStageEnemySpawn.apply(this, args);
    };
  }

  const originalUpdateBattleState = proto.updateBattleState;
  if (typeof originalUpdateBattleState !== 'function') throw new Error('BattleScene.updateBattleState is missing');
  proto.updateBattleState = function updateBattleStateWithBcuRanking() {
    const ranking = ensureRankingRuntime(this);
    ranking.updateClock(this.logicFrame);
    const overtimeLoss = ranking.enforceOvertimeLoss(this);
    if (overtimeLoss) {
      this.pushEvent?.({
        type: 'bcuRankingScoreLimitFailed',
        score: ranking.score,
        scoreLimit: ranking.scoreLimit,
        elapsedFrames: ranking.elapsedFrames,
        timeLimitFrames: ranking.timeLimitFrames
      });
    }
    const result = originalUpdateBattleState.apply(this, arguments);
    publishRankingDebug(this, overtimeLoss ? 'overtime-score-limit-failed' : 'battle-state-update');
    return result;
  };
}

installBattleSceneBcuRankingRuntimePatch();

export { ensureRankingRuntime, publishRankingDebug };
