import { BattleScene } from './BattleScene.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-lineup-patch.v1');
const LINEUP_CHANGE_TIME_FRAMES = 6;
const LINEUP_CHANGE_DIVISION = LINEUP_CHANGE_TIME_FRAMES / 2;

function hasBackLineup(scene) {
  try { return scene?.hasBackLineup?.() === true; } catch { return false; }
}

function playerBaseAlive(scene) {
  const base = scene?.bases?.find?.((b) => b?.side === 'dog-player');
  if (!base || !Number.isFinite(base.health)) return true;
  return base.health !== 0;
}

function startChange(scene, direction = 'up') {
  if (scene.lineupChanging || scene.battleState !== 'running' || !hasBackLineup(scene) || !playerBaseAlive(scene)) {
    scene.pushEvent?.({ type: 'bcuLineupChangeRejected', direction, lineupChanging: !!scene.lineupChanging, battleState: scene.battleState || null, hasBackLineup: hasBackLineup(scene), playerBaseAlive: playerBaseAlive(scene) });
    return false;
  }
  scene.lineupChanging = true;
  scene.goingUp = direction !== 'down';
  scene.lineupChangeDirection = direction === 'down' ? 'down' : 'up';
  scene.lineupChangeFrameRemaining = LINEUP_CHANGE_TIME_FRAMES;
  scene.lineupChangeDivision = LINEUP_CHANGE_DIVISION;
  scene.lineupChangeFrameAccumulatorMs = 0;
  scene.lineupChangeElapsedMs = 0;
  scene.lineupChangeSwapped = false;
  scene.lineupChangeOldFront = scene.frontLineup ?? 0;
  scene.lineupChangeNewFront = 1 - scene.lineupChangeOldFront;
  scene.pushEvent?.({ type: 'bcuLineupChangeStarted', direction: scene.lineupChangeDirection, changeFrame: scene.lineupChangeFrameRemaining, changeDivision: scene.lineupChangeDivision, oldFrontLineup: scene.lineupChangeOldFront, plannedNewFrontLineup: scene.lineupChangeNewFront });
  return true;
}

function advanceOneFrame(scene) {
  if (!scene.lineupChanging) return;
  scene.lineupChangeFrameRemaining -= 1;
  if (!scene.lineupChangeSwapped && scene.lineupChangeFrameRemaining === LINEUP_CHANGE_DIVISION - 1) {
    scene.frontLineup = 1 - (scene.frontLineup ?? 0);
    scene.lineupChangeSwapped = true;
    scene.lineupChangeNewFront = scene.frontLineup;
    scene.pushEvent?.({ type: 'bcuLineupFrontSwapped', frontLineup: scene.frontLineup, changeFrame: scene.lineupChangeFrameRemaining });
  }
  if (scene.lineupChangeFrameRemaining === 0) {
    scene.lineupChanging = false;
    scene.lineupChangeFrameRemaining = -1;
    scene.lineupChangeDivision = -1;
    scene.lineupChangeFrameAccumulatorMs = 0;
    scene.lineupChangeElapsedMs = 0;
    scene.lineupChangeSwapped = false;
    scene.lineupChangeOldFront = scene.frontLineup ?? 0;
    scene.lineupChangeNewFront = 1 - scene.lineupChangeOldFront;
    scene.pushEvent?.({ type: 'bcuLineupChangeEnded', frontLineup: scene.frontLineup });
  }
}

function advanceChange(scene, dt = BCU_BATTLE_TIMER_PERIOD_MS) {
  if (!scene.lineupChanging) return;
  scene.lineupChangeElapsedMs = (scene.lineupChangeElapsedMs || 0) + dt;
  scene.lineupChangeFrameAccumulatorMs = (scene.lineupChangeFrameAccumulatorMs || 0) + dt;
  while (scene.lineupChanging && scene.lineupChangeFrameAccumulatorMs >= BCU_BATTLE_TIMER_PERIOD_MS) {
    scene.lineupChangeFrameAccumulatorMs -= BCU_BATTLE_TIMER_PERIOD_MS;
    advanceOneFrame(scene);
  }
}

export function installBattleSceneBcuLineupPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const originalTick = proto.tick;
  proto.requestLineupChange = function requestLineupChangeBcuAndroid(direction = 'up') {
    return startChange(this, direction);
  };
  proto.tick = function tickBcuLineupPatched(dt = BCU_BATTLE_TIMER_PERIOD_MS) {
    const result = originalTick.call(this, dt);
    advanceChange(this, Number.isFinite(Number(dt)) ? Number(dt) : BCU_BATTLE_TIMER_PERIOD_MS);
    return result;
  };
}

installBattleSceneBcuLineupPatch();
