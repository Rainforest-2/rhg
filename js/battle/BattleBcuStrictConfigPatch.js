import { BATTLE_CONFIG } from './BattleConfig.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-strict-config-patch.v2');
const BCU_TIMER_FPS = 1000 / BCU_BATTLE_TIMER_PERIOD_MS;

export function installBattleBcuStrictConfigPatch() {
  if (BATTLE_CONFIG[PATCH_FLAG]) return;
  BATTLE_CONFIG[PATCH_FLAG] = true;

  const tuning = BATTLE_CONFIG.tuning || (BATTLE_CONFIG.tuning = {});
  tuning.fps = BCU_TIMER_FPS;
  tuning.speedToPxPerSecond = BCU_TIMER_FPS;
  tuning.battleTimeScale = 1;
  tuning.combatPositionMode = 'bcu-pos';
  tuning.coordinateContract = {
    ...(tuning.coordinateContract || {}),
    mode: 'bcu-pos',
    source: 'BCU strict: Entity.pos / range / width capture',
    combatSource: 'actor.getBattlePosBcu',
    rangeSource: 'detectionRangeBcu',
    widthSource: 'attackWidthBcu',
    targetSource: 'target.getBattlePosBcu',
    bcuPosEnabled: true
  };

  // BCU attack timing comes from DataUnit/DataEnemy pre/TBA/anim frames.
  // Browser-preview smoothing multipliers and minimum waits must not re-enter runtime timing.
  tuning.timingParity = {
    enabled: true,
    source: 'BCU strict: DataUnit/DataEnemy frame timing only',
    disableAttackWaitMultiplier: true,
    disableMinAttackWait: true,
    disablePostAttackIdleHold: true,
    disableMinAttackAnim: true,
    disableMinAttackStartup: true,
    disableAttackPhaseMultiplier: true,
    disableAttackAnimationSpeedMultiplier: true
  };
  tuning.minAttackWaitMs = 0;
  tuning.minAttackAnimMs = 0;
  tuning.minAttackStartupMs = 0;
  tuning.attackPhaseTimeMultiplier = 1;
  tuning.attackAnimationSpeedMultiplier = 1;
  tuning.attackWaitMultiplier = 1;
  tuning.postAttackIdleHoldMs = 0;

  const kb = tuning.knockback || (tuning.knockback = {});
  kb.parity = {
    ...(kb.parity || {}),
    enabled: true,
    source: 'BCU strict: one knockback frame per battle tick',
    frameRate: BCU_TIMER_FPS,
    useBattleTimeScale: false,
    disableSyntheticBounce: true,
    failClosedKbeff: true,
    requireActorTimelineVerifier: true
  };
  kb.frameManager = {
    ...(kb.frameManager || {}),
    enabled: true,
    source: 'BCU strict: one KB frame per Timer.p tick',
    fps: BCU_TIMER_FPS,
    useFrameAccumulator: true,
    maxFramesPerTick: 1,
    debug: true
  };

  const stage = BATTLE_CONFIG.stage || (BATTLE_CONFIG.stage = {});
  if (stage.spawnPreview) {
    stage.spawnPreview.fps = BCU_TIMER_FPS;
    stage.spawnPreview.timerPeriodMs = BCU_BATTLE_TIMER_PERIOD_MS;
  }

  BATTLE_CONFIG.bcuStrictConfig = {
    enabled: true,
    source: 'BCU-java-PC Timer.p = 33ms; Entity.pos capture; no preview-only timing multipliers',
    timerPeriodMs: BCU_BATTLE_TIMER_PERIOD_MS,
    fps: BCU_TIMER_FPS,
    combatPositionMode: tuning.combatPositionMode,
    appliedAt: Date.now()
  };
}

installBattleBcuStrictConfigPatch();
