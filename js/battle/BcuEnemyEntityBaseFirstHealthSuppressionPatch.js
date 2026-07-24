import { BcuStageSpawnRuntime } from './BcuStageSpawnRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-eenemy-base-first-health-suppression.v1');

function shouldSuppressFirstHealthMatch(runtime, rowState, event) {
  if (runtime?.stageRuntime?.hasEnemyBaseEntity !== true) return false;
  if (runtime?.stageRuntime?.trail === true) return false;
  if (!rowState || rowState.enemyEntityBaseHealthMatchConsumed === true) return false;
  if (rowState.row?.baseEnemy === true || event?.baseEnemy === true) return false;
  return event?.healthWindowDebug?.inHealth === true;
}

export function installBcuEnemyEntityBaseFirstHealthSuppressionPatch() {
  const proto = BcuStageSpawnRuntime?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalTick = proto.tick;
  if (typeof originalTick !== 'function') return;

  proto.tick = function tickWithEnemyEntityBaseFirstHealthSuppression(frameOrMs, context = {}) {
    const frame = Number.isFinite(context?.logicFrame)
      ? Math.floor(context.logicFrame)
      : (Number.isFinite(frameOrMs) ? Math.floor(frameOrMs) : this.lastTickFrame || 0);
    const maxSuppressions = Math.max(1, (this.rows || []).length);

    for (let attempt = 0; attempt <= maxSuppressions; attempt += 1) {
      const out = originalTick.call(this, frameOrMs, context);
      const event = Array.isArray(out) ? out[0] : null;
      if (!event) return out;

      const rowState = (this.rows || []).find((state) =>
        state?.pendingSpawnEvent === event || state?.rowIndex === event.rowIndex);
      if (!shouldSuppressFirstHealthMatch(this, rowState, event)) return out;

      rowState.enemyEntityBaseHealthMatchConsumed = true;
      rowState.enemyEntityBaseHealthMatchConsumedFrame = frame;
      rowState.waitingForSpawnCommit = false;
      rowState.pendingSpawnEvent = null;
      rowState.triggered = false;
      rowState.waitingForMaxEnemySlot = false;
      rowState.lastBlockedReason = 'enemy-entity-base-first-health-match';
      rowState.nextFrame = Math.max(Number(rowState.nextFrame) || frame, frame + 1);
      rowState.nextAtFrame = rowState.nextFrame;

      // BCU EStage.allow() continues scanning later rows after this one-time inHealth()
      // suppression. Re-run the same frame so another eligible row can be considered,
      // while the consumed row is deferred until the next logic frame.
    }

    return [];
  };
}

installBcuEnemyEntityBaseFirstHealthSuppressionPatch();

export { shouldSuppressFirstHealthMatch };
