import { BattleScene } from './BattleScene.js';
import { buildInitialWave } from './BattleWaveRuntimePatch.js';

const PATCH_FLAG = Symbol.for('wanko-battle.scene-bcu-wave-on-blocked-hit.v1');

function isDirectDamageTarget(targetType) {
  return targetType === 'actor' || targetType === 'base';
}

function isBarrierOrShieldBlocked(result) {
  return result?.accepted === false && result?.blocked === true && (result?.blockedBy === 'barrier' || result?.blockedBy === 'shield');
}

function waveItems(calc) {
  return [...(calc?.proc?.pending || []), ...(calc?.proc?.applied || [])]
    .filter((p) => p?.key === 'wave' || p?.key === 'miniWave');
}

function enqueueBlockedHitWave(scene, item) {
  if (!scene.__bcuWaveContainers) scene.__bcuWaveContainers = [];
  item.group?.containers?.add(item);
  scene.__bcuWaveContainers.push(item);
  scene.pushEvent?.({
    type: 'bcuWaveCreatedFromBlockedHit',
    source: 'BattleSceneBcuWaveOnBlockedHitPatch',
    bcuReference: 'BCU AttackSimple.excuse calls e.damaged(atk), then spawns WAVE/MINIWAVE when capt is non-empty; Entity.damaged may return false for barrier/shield blocks, but capt remains non-empty.',
    id: item.id,
    kind: item.kind,
    attacker: item.attacker?.instanceId || item.attacker?.label || null,
    target: item.target?.instanceId || item.target?.label || null,
    effectKey: item.effectKey,
    pos: item.pos,
    layer: item.layer,
    remainingLevel: item.remainingLevel
  });
}

function enqueueFromBlockedBarrierShieldHit(scene, attacker, target, targetType, event, calc, result, meta = {}) {
  if (!isBarrierOrShieldBlocked(result) || !isDirectDamageTarget(targetType)) return;
  if (meta?.bcuWave || meta?.bcuSurge || meta?.bcuBlast) return;
  const items = waveItems(calc);
  if (!items.length) return;
  const projectileBaseDamage = Math.max(0, Math.trunc(Number(calc?.bcuProjectileBaseDamage ?? calc?.rawAttackDamage ?? calc?.rawBaseDamage ?? event?.damage ?? attacker?.damage ?? 0)));
  if (projectileBaseDamage <= 0) return;
  const hitIndex = meta.hitIndex ?? event?.hitIndex ?? null;
  const key = meta.key || `${scene.logicFrame}:${attacker?.instanceId || 'atk'}:${target?.instanceId || 'target'}:${hitIndex}:blocked-${result.blockedBy}`;
  for (const proc of items) enqueueBlockedHitWave(scene, buildInitialWave(attacker, proc, projectileBaseDamage, key, event, hitIndex, target));
}

export function installBattleSceneBcuWaveOnBlockedHitPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') throw new Error('BattleScene.queueAttackDamage is missing; cannot install BCU blocked-hit wave patch');

  proto.queueAttackDamage = function queueAttackDamageWithBcuBlockedHitWave(attacker, target, targetType, event, meta = {}) {
    const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
    const calc = targetType === 'actor' ? (target?.lastIncomingDamageCalculation || attacker?.lastDamageCalculation || null) : (attacker?.lastDamageCalculation || null);
    enqueueFromBlockedBarrierShieldHit(this, attacker, target, targetType, event, calc, result, meta);
    return result;
  };
}

installBattleSceneBcuWaveOnBlockedHitPatch();
