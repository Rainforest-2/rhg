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
  cfg.kbeffRuntime = s.createKbeffRuntimeForKb(cfg.bcuType);
  cfg.kbeffInitialUpdate = BATTLE_CONFIG.tuning.knockback.kbEffect?.bcuDoInterruptInitialUpdate !== false;
  a.startKnockback({ ...cfg, nowMs: 0 });
  const startedAnimOk = a.currentAnimId !== a.knockbackAnimId && a.kbeffEnabled === true;
  const x0 = a.x;
  while (a.kbMoveFramesRemaining > 0) a.stepKnockbackFrame();
  const result = { moved: Math.abs(a.x - x0), actor: a };
  const movedOk = Math.abs(result.moved - expected) <= 0.01;
  const framesOk = a.kbBcuTimeFrames === 23 && a.kbMoveFramesTotal === 22 && a.kbMoveFramesTotal === a.kbBcuTimeFrames - 1;
  const visualOk = a.kbDisableSyntheticBounce === true && a.kbVisualOffsetX === 0 && a.kbVisualOffsetY === 0 && a.kbVisualScale === 1;
  return { ok: movedOk && framesOk && visualOk && startedAnimOk, movedOk, framesOk, visualOk, startedAnimOk, moved: result.moved, expected, bcuTimeFrames: a.kbBcuTimeFrames, moveFramesTotal: a.kbMoveFramesTotal };
}

export async function printBcuHpKnockbackSemantics() {
  const p = simulateBcuLinearRemaining({ bcuTimeFrames: 23, bcuDistance: 345 });
  console.log({ bcuFrames: 23, moveFrames: p.length, last: p[p.length - 1] });
}

export async function verifyUnitKnockbackAnimOnlyForProcKb() {
  const s = new BattleScene();
  await s.init();
  const a = s.actors.find((x) => x.side === 'cat-enemy') || s.actors[0];
  const hp = a.getKnockbackConfig(BATTLE_CONFIG.tuning, 'hp');
  a.startKnockback({ ...hp, nowMs: 0, kbeffRuntime: s.createKbeffRuntimeForKb(hp.bcuType), kbeffInitialUpdate: true });
  const hpUsesUnitKnockbackAnim = a.currentAnimId === a.knockbackAnimId;
  const proc = a.getKnockbackConfig(BATTLE_CONFIG.tuning, 'proc');
  a.startKnockback({ ...proc, nowMs: 0 });
  const procUsesUnitKnockbackAnim = a.currentAnimId === a.knockbackAnimId;
  return { ok: !hpUsesUnitKnockbackAnim && procUsesUnitKnockbackAnim, hpUsesUnitKnockbackAnim, procUsesUnitKnockbackAnim };
}
