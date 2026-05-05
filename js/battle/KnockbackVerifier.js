import { BattleScene } from './BattleScene.js';
import { BATTLE_CONFIG } from './BattleConfig.js';

export function simulateBcuLinearRemaining({ bcuTimeFrames, bcuDistance }) {
  let kbTime = Math.max(1, Math.floor(bcuTimeFrames || 1));
  let kbDis = Number(bcuDistance) || 0;
  let pos = 0;
  const positions = [];
  while (true) {
    kbTime -= 1;
    if (kbTime === 0) break;
    const mov = kbDis / kbTime;
    kbDis -= mov;
    pos += mov;
    positions.push(pos);
  }
  return positions;
}

export function simulateCurrentKnockback(actor, kbConfig) {
  const x0 = actor.x;
  actor.startKnockback({ ...kbConfig, nowMs: 0 });
  while (actor.kbMoveFramesRemaining > 0) actor.stepKnockbackFrame();
  return { moved: Math.abs(actor.x - x0), actor };
}

export async function verifyBcuHpKnockbackSemantics() {
  const s = new BattleScene();
  await s.init();
  const a = s.actors.find((x) => x.side === 'cat-enemy') || s.actors[0];
  const cfg = a.getKnockbackConfig(BATTLE_CONFIG.tuning, 'hp');
  const expected = cfg.bcuDistance * (BATTLE_CONFIG.tuning.knockback.knockbackDistanceToPx ?? BATTLE_CONFIG.tuning.rangeToPx);
  const result = simulateCurrentKnockback(a, cfg);
  const movedOk = Math.abs(result.moved - expected) <= 0.01;
  const framesOk = a.kbBcuTimeFrames === 23 && a.kbMoveFramesTotal === 22 && a.kbMoveFramesTotal === a.kbBcuTimeFrames - 1;
  const visualOk = a.kbDisableSyntheticBounce === true && a.kbVisualOffsetX === 0 && a.kbVisualOffsetY === 0 && a.kbVisualScale === 1;
  return { ok: movedOk && framesOk && visualOk, movedOk, framesOk, visualOk, moved: result.moved, expected, bcuTimeFrames: a.kbBcuTimeFrames, moveFramesTotal: a.kbMoveFramesTotal };
}

export async function printBcuHpKnockbackSemantics() {
  const p = simulateBcuLinearRemaining({ bcuTimeFrames: 23, bcuDistance: 345 });
  console.log({ bcuFrames: 23, moveFrames: p.length, last: p[p.length - 1] });
}
