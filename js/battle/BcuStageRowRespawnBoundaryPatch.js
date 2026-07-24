import { BcuStageSpawnRuntime } from './BcuStageSpawnRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-stage-row-respawn-boundary.v1');

function findRowState(runtime, eventOrRowIndex) {
  const rows = Array.isArray(runtime?.rows) ? runtime.rows : [];
  if (eventOrRowIndex && typeof eventOrRowIndex === 'object') {
    if (Number.isFinite(eventOrRowIndex.rowIndex)) {
      return rows.find((row) => row?.rowIndex === eventOrRowIndex.rowIndex) || null;
    }
    if (eventOrRowIndex.spawnId) {
      return rows.find((row) => row?.pendingSpawnEvent?.spawnId === eventOrRowIndex.spawnId) || null;
    }
  }
  if (Number.isFinite(eventOrRowIndex)) {
    return rows.find((row) => row?.rowIndex === eventOrRowIndex) || null;
  }
  return null;
}

export function installBcuStageRowRespawnBoundaryPatch() {
  const proto = BcuStageSpawnRuntime?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalCommitSpawn = proto.commitSpawn;
  if (typeof originalCommitSpawn !== 'function') return;

  // Activate only for the known legacy core formula. Once the core schedules
  // `spawnFrame + Math.max(1, interval)` directly, this wrapper is a no-op.
  const legacyFormula = /spawnFrame\s*\+\s*interval\s*\+\s*1/.test(Function.prototype.toString.call(originalCommitSpawn));
  if (!legacyFormula) return;

  proto.commitSpawn = function commitSpawnWithBcuRowRespawnBoundary(eventOrRowIndex, ...rest) {
    const rowState = findRowState(this, eventOrRowIndex);
    const pending = rowState?.pendingSpawnEvent || null;
    const spawnFrame = Number.isFinite(pending?.spawnFrame) ? pending.spawnFrame : this.lastTickFrame;
    const result = originalCommitSpawn.call(this, eventOrRowIndex, ...rest);

    if (!result || result.ok !== true || !rowState || rowState.exhausted) return result;

    const scheduled = Number(rowState.nextFrame);
    // Legacy core uses F + interval + 1. A zero interval must remain F + 1;
    // every positive interval is corrected to F + interval.
    if (Number.isFinite(spawnFrame) && Number.isFinite(scheduled) && scheduled > spawnFrame + 1) {
      rowState.nextFrame = scheduled - 1;
      rowState.nextAtFrame = rowState.nextFrame;
      rowState.lastRowRespawnBoundaryDebug = {
        source: 'BCU EStage allow/update same-frame decrement',
        spawnFrame,
        legacyScheduledFrame: scheduled,
        correctedScheduledFrame: rowState.nextFrame
      };
    }

    return result;
  };
}

installBcuStageRowRespawnBoundaryPatch();
