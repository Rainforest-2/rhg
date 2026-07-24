import { StageRuntime } from './StageRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.stage-runtime-boss-flag-positive.v1');

export function isBcuBossRow(value) {
  if (value === true) return true;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 1;
}

export function installStageRuntimeBossFlagPatch() {
  const proto = StageRuntime?.prototype;
  if (!proto || proto[PATCH_FLAG]) return false;
  const original = proto.getEnemySpawnWorldX;
  if (typeof original !== 'function') return false;

  proto.getEnemySpawnWorldX = function getEnemySpawnWorldXWithPositiveBossFlag(options = {}) {
    const rawBossFlag = options?.bossFlag ?? options?.row?.bossFlag;
    if (!isBcuBossRow(rawBossFlag) || rawBossFlag === true || rawBossFlag === 1) {
      return original.call(this, options);
    }

    // StageRuntime's legacy predicate only recognizes true/1. Normalize only the
    // coordinate decision while leaving the raw numeric category on the row/event
    // for boss=2 camera-shake and other category-specific behavior.
    return original.call(this, { ...options, bossFlag: true });
  };

  proto[PATCH_FLAG] = true;
  return true;
}

installStageRuntimeBossFlagPatch();
