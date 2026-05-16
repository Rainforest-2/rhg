import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';

export const BCU_WORLD_UNITS = {
  fps: 1000 / BCU_BATTLE_TIMER_PERIOD_MS,
  timerPeriodMs: BCU_BATTLE_TIMER_PERIOD_MS,
  rangeToWorld: 1,
  widthToWorld: 1,
  knockbackDistanceToWorld: 1,
  speedToWorldPerFrame: 0.5
};

export function bcuRangeToWorld(v){ return Number(v)||0; }
export function bcuWidthToWorld(v){ return Number(v)||0; }
export function bcuKnockbackDistanceToWorld(v){ return Number(v)||0; }
export function bcuSpeedToWorldPerFrame(rawSpeed){ return (Number(rawSpeed)||0) * BCU_WORLD_UNITS.speedToWorldPerFrame; }
export function bcuSpeedToWorldPerSecond(rawSpeed, fps=BCU_WORLD_UNITS.fps){
  const safeFps = Number.isFinite(fps) ? fps : BCU_WORLD_UNITS.fps;
  return bcuSpeedToWorldPerFrame(rawSpeed) * safeFps;
}
