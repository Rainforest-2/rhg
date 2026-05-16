import { BattleScene } from './BattleScene.js';
import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.wave-runtime-patch.v1');
const WAVE_STEP_RANGE = 200;
const WAVE_BASE_RANGE = 467;
const WAVE_HIT_WIDTH = 532;

function pos(actor) {
  const n = BattleCombatCoordinateRuntime.getEntityPosBcu(actor);
  return Number.isFinite(n) ? n : (Number.isFinite(actor?.x) ? actor.x : 0);
}

function dire(actor) {
  if (Number.isFinite(actor?.direction)) return actor.direction;
  return actor?.side === 'dog-player' ? -1 : 1;
}

function waveItems(calc) {
  return [...(calc?.proc?.pending || []), ...(calc?.proc?.applied || [])]
    .filter((p) => p?.key === 'wave' || p?.key === 'miniWave');
}

function cloneEvent(event = {}, damage, kind) {
  const abilities = { ...(event?.abilities || event?.ability?.semantic || {}) };
  delete abilities.wave;
  delete abilities.miniWave;
  delete abilities.surge;
  delete abilities.miniSurge;
  return {
    ...event,
    damage,
    abilities,
    ability: { ...(event?.ability || {}), semantic: abilities },
    rawAbi: 0,
    abilityMappingStatus: 'bcu-wave-runtime-no-recursive-wave',
    targetMode: 'range',
    allowBaseHit: false,
    attackKind: kind
  };
}

function enqueue(scene, item) {
  if (!scene.__bcuWaveQueue) scene.__bcuWaveQueue = [];
  scene.__bcuWaveQueue.push(item);
  scene.pushEvent?.({
    type: 'bcuWaveQueued',
    kind: item.kind,
    dueFrame: item.dueFrame,
    attacker: item.attacker?.instanceId || item.attacker?.label || null,
    startX: item.startX,
    endX: item.endX,
    damage: item.damage,
    source: item.source
  });
}

function buildWave(attacker, proc, finalDamage, key, scene, event, hitIndex, target) {
  const payload = proc.payload || {};
  const level = Math.max(1, Math.trunc(Number(payload.level || 1)));
  const d = dire(attacker);
  const origin = pos(attacker);
  const reach = WAVE_BASE_RANGE + WAVE_STEP_RANGE * Math.max(0, level - 1);
  const center = origin + d * reach;
  const start = Math.min(origin + d * WAVE_BASE_RANGE, center) - WAVE_HIT_WIDTH / 2;
  const end = Math.max(origin + d * WAVE_BASE_RANGE, center) + WAVE_HIT_WIDTH / 2;
  const isMini = proc.key === 'miniWave';
  const mult = isMini ? Math.max(0, Number(payload.mult || 20)) / 100 : 1;
  return {
    id: `${key}:${proc.key}`,
    kind: proc.key,
    attacker,
    target,
    event,
    hitIndex,
    startX: start,
    endX: end,
    damage: Math.max(1, Math.trunc(finalDamage * mult)),
    dueFrame: scene.logicFrame + 1,
    source: isMini ? 'BCU MINIWAVE after captured hit' : 'BCU WAVE after captured hit'
  };
}

function targetsInRange(scene, attacker, startX, endX) {
  const lo = Math.min(startX, endX);
  const hi = Math.max(startX, endX);
  return (scene.actors || []).filter((target) => {
    if (!target || target.side === attacker?.side) return false;
    if (!(target.isTargetable?.() ?? target.isAlive?.())) return false;
    const p = pos(target);
    const half = Number(target.width || target.rawStats?.width || 0) / 2;
    return (p + half) >= lo && (p - half) <= hi;
  });
}

function process(scene) {
  const q = Array.isArray(scene.__bcuWaveQueue) ? scene.__bcuWaveQueue : [];
  if (!q.length) return;
  const rest = [];
  for (const item of q) {
    if (item.dueFrame > scene.logicFrame) {
      rest.push(item);
      continue;
    }
    const event = cloneEvent(item.event, item.damage, item.kind);
    const targets = targetsInRange(scene, item.attacker, item.startX, item.endX);
    let applied = 0;
    for (const target of targets) {
      const res = scene.queueAttackDamage(item.attacker, target, 'actor', event, {
        key: `${item.id}:${target.instanceId || target.label || 'target'}`,
        hitIndex: item.hitIndex,
        bcuWave: item.kind
      });
      if (res?.accepted) applied += 1;
    }
    scene.pushEvent?.({ type: 'bcuWaveResolved', id: item.id, kind: item.kind, targetCount: targets.length, appliedCount: applied });
  }
  scene.__bcuWaveQueue = rest;
}

function enqueueFromResult(scene, attacker, target, event, calc, result, meta = {}) {
  if (!result?.accepted) return;
  const items = waveItems(calc);
  if (!items.length) return;
  const finalDamage = Math.max(0, Math.trunc(Number(calc?.finalDamage || 0)));
  if (finalDamage <= 0) return;
  const hitIndex = meta.hitIndex ?? event?.hitIndex ?? null;
  const key = meta.key || `${scene.logicFrame}:${attacker?.instanceId || 'atk'}:${target?.instanceId || 'target'}:${hitIndex}`;
  for (const proc of items) enqueue(scene, buildWave(attacker, proc, finalDamage, key, scene, event, hitIndex, target));
}

export function installBattleWaveRuntimePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') throw new Error('BattleScene.queueAttackDamage is missing');
  proto.queueAttackDamage = function queueAttackDamageWithBcuWave(attacker, target, targetType, event, meta = {}) {
    const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
    if (targetType === 'actor') {
      const calc = target?.lastIncomingDamageCalculation || attacker?.lastDamageCalculation || null;
      enqueueFromResult(this, attacker, target, event, calc, result, meta);
    }
    return result;
  };

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase === 'function') {
    proto.runTickPhase = function runTickPhaseWithBcuWave(phase, fn = () => {}) {
      if (phase === 'proc-resolve') {
        return originalRunTickPhase.call(this, phase, () => {
          const res = fn();
          process(this);
          return res;
        });
      }
      return originalRunTickPhase.call(this, phase, fn);
    };
  }
}

installBattleWaveRuntimePatch();
