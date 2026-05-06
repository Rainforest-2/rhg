import { BattleSimulationClock } from '../preview/BattleSimulationClock.js';

export async function verifyVisibilityPauseDoesNotAdvanceBattle() {
  const clock = new BattleSimulationClock();
  let ticks = 0;
  clock.resume(0);
  clock.pause('hidden');
  clock.step(1000, 1, () => { ticks += 1; });
  const ok = ticks === 0;
  return { ok, errors: ok ? [] : ['tick advanced while paused'] };
}

export async function verifyLargeDeltaIsClampedOrSubstepped() {
  const clock = new BattleSimulationClock({ fixedStepMs: 1000/30, maxSubStepsPerFrame: 5, maxFrameDtMs: 100 });
  const dts = [];
  clock.resume(0);
  const r = clock.step(5000, 1, (dt) => dts.push(dt));
  const ok = dts.length <= 5 && dts.every((v) => v <= (1000/30)+0.0001) && r.rawDt === 5000;
  return { ok, errors: ok ? [] : ['large delta not clamped/substepped correctly'] };
}

export async function verifyFocusResumeDropsHiddenElapsedTime() {
  const clock = new BattleSimulationClock();
  const dts = [];
  clock.resume(0);
  clock.pause('hidden');
  clock.resume(10000);
  const r = clock.step(10010, 1, (dt) => dts.push(dt));
  const ok = dts.length === 0 && r.rawDt <= 20;
  return { ok, errors: ok ? [] : ['hidden elapsed time leaked into resumed step'] };
}
