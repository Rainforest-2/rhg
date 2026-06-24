import { BattleScene } from './BattleScene.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import {
  BCU_BUTTON_DELAY_FRAMES,
  createBcuButtonDelayState,
  requestBcuButtonDelaySpawn,
  tickBcuButtonDelay
} from './bcu-runtime/BcuButtonDelayRuntime.js';

// BCU manual-deploy button delay (StageBasis.act_spawn buttonDelay=6). Installed AFTER the spirit
// patch so this requestPlayerSpawn gate is the OUTERMOST wrapper: a press starts the delay and
// queues the unit, and the queued real deploy 6 frames later flows back through the inner (spirit /
// production) chain. Only BattleSceneBcuSpiritPatch wraps requestPlayerSpawn, so chaining is exact.
const SCENE_PATCH_FLAG = Symbol.for('wanko-battle.scene-button-delay.v1');

function buttonDelayConfig() {
  const cfg = BATTLE_CONFIG.production?.player?.buttonDelay || BATTLE_CONFIG.buttonDelay || {};
  return {
    enabled: cfg.enabled !== false,
    frames: Number.isFinite(cfg.frames) ? Math.floor(cfg.frames) : BCU_BUTTON_DELAY_FRAMES
  };
}

function ensureState(scene) {
  if (!scene.bcuButtonDelay) scene.bcuButtonDelay = createBcuButtonDelayState();
  return scene.bcuButtonDelay;
}

export function installBattleSceneBcuButtonDelayPatch() {
  const sceneProto = BattleScene?.prototype;
  if (!sceneProto || sceneProto[SCENE_PATCH_FLAG]) return;
  sceneProto[SCENE_PATCH_FLAG] = true;

  // The (spirit-wrapped) real deploy. The delayed fire calls THIS, bypassing the gate below.
  const innerRequestPlayerSpawn = sceneProto.requestPlayerSpawn;

  sceneProto.requestPlayerSpawn = function requestPlayerSpawnWithBcuButtonDelay(slotId, row = this.frontLineup, col = null) {
    const cfg = buttonDelayConfig();
    if (!cfg.enabled) return innerRequestPlayerSpawn.call(this, slotId, row, col);
    const resolvedSlotId = (col === null ? slotId : this.getPlayerLineupRows?.()?.[row]?.[col]?.slotId) || slotId;
    // BCU only starts a delay for a real filled lineup slot (elu.price[i][j] != -1). An empty/unknown
    // slot falls through to the normal path, which raises the proper rejection event.
    if (!this.findPlayerProductionUnit?.(resolvedSlotId)) {
      return innerRequestPlayerSpawn.call(this, slotId, row, col);
    }
    const disposition = requestBcuButtonDelaySpawn(ensureState(this), { slotId, row, col }, {
      enabled: cfg.enabled,
      frames: cfg.frames,
      lineupChanging: this.lineupChanging === true
    });
    if (disposition.action === 'queued') {
      this.pushEvent?.({ type: 'playerSpawnButtonDelayQueued', slotId: resolvedSlotId, frames: disposition.frames, source: 'BCU StageBasis.act_spawn buttonDelay=6' });
      return true;
    }
    // blocked: a delay is already counting down (or the lineup is swapping) -> drop this press.
    this.pushEvent?.({ type: 'playerSpawnButtonDelayBlocked', slotId: resolvedSlotId, remaining: disposition.remaining || 0, reason: disposition.reason || 'button-delay-active' });
    return false;
  };

  const originalRunTickPhase = sceneProto.runTickPhase;
  sceneProto.runTickPhase = function runTickPhaseWithBcuButtonDelay(phase, fn = () => {}) {
    // BCU StageBasis.update(): `if (buttonDelay > 0 && --buttonDelay == 0) act_spawn(selectedUnit,true)`.
    // Run the countdown once per frame (production phase); fire the queued deploy when it reaches 0.
    if (phase === 'player-production-requests' && buttonDelayConfig().enabled) {
      const { fire } = tickBcuButtonDelay(ensureState(this));
      if (fire) innerRequestPlayerSpawn.call(this, fire.slotId, fire.row, fire.col);
    }
    return originalRunTickPhase.call(this, phase, fn);
  };
}

installBattleSceneBcuButtonDelayPatch();
