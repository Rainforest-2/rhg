export const BCU_WORLD_UNITS = {
  fps: 30,
  rangeToWorld: 1,
  widthToWorld: 1,
  knockbackDistanceToWorld: 1,
  speedToWorldPerFrame: 1
};

export function bcuRangeToWorld(v){ return Number(v)||0; }
export function bcuWidthToWorld(v){ return Number(v)||0; }
export function bcuKnockbackDistanceToWorld(v){ return Number(v)||0; }
export function bcuSpeedToWorldPerSecond(rawSpeed, fps=BCU_WORLD_UNITS.fps){
  return (Number(rawSpeed)||0) * (Number.isFinite(fps) ? fps : BCU_WORLD_UNITS.fps);
}
