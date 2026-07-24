import { BcuStageSpawnRuntime } from './BcuStageSpawnRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-stage-global-respawn-boundary.v1');

export function installBcuStageGlobalRespawnBoundaryPatch() {
  const proto = BcuStageSpawnRuntime?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalCommitSpawn = proto.commitSpawn;
  if (typeof originalCommitSpawn !== 'function') return;

  proto.commitSpawn = function commitSpawnWithFullBcuGlobalCooldown(...args) {
    const result = originalCommitSpawn.apply(this, args);
    if (!result || result.ok !== true) return result;

    const sampled = Number(this.lastGlobalRespawnDebug?.nextGlobalRespawnTimeRaw);
    if (!Number.isFinite(sampled) || sampled <= 0) return result;

    // BCU stores the full sampled interval after a successful spawn. The next
    // update owns the first decrement. Compensate only for the legacy core
    // shape (`sampled - 1`) so this patch becomes a no-op after a direct fix.
    if (this.globalRespawnTime === sampled - 1) {
      this.globalRespawnTime = sampled;
      this.lastGlobalRespawnDebug = {
        ...this.lastGlobalRespawnDebug,
        nextGlobalRespawnTimeBeforeFutureTickDecrement: sampled,
        boundarySource: 'BCU StageBasis stores full interval; tick owns countdown'
      };
    }

    return result;
  };
}

installBcuStageGlobalRespawnBoundaryPatch();
