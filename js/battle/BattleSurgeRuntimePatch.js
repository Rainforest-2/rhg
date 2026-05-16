import { BattleScene } from './BattleScene.js';
import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.surge-runtime-patch.v1');
const SURGE_HALF_WIDTH = 250;

function pos(actor) {
  const n = BattleCombatCoordinateRuntime.getEntityPosBcu(actor);
  return Number.isFinite(n) ? n : (Number.isFinite(actor?.x) ? actor.x : 0);
}

function dire(actor) {
  if (Number.isFinite(actor?.direction)) return actor.direction;
  return actor?.side === 'dog-player' ? -1 : 1;
}

function surgeItems(calc) {
  return [...(calc?.proc?.pending || []), ...(calc?.proc?.applied || [])]
    .filter((p) => p?.key === 'surge' || p?.key === 'miniSurge');
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
    abilityMappingStatus: 'bcu-surge-runtime-no-recursive-surge',
    targetMode: 'range',
    allowBaseHit: false,
    attackKind: kind
  };
}

function enqueue(scene, item) {
  if (!scene.__bcuSurgeQueue) scene.__bcuSurgeQueue = [];
  scene.__bcuSurgeQueue.push(item);
  scene.pushEvent?.({ type: 'bcuSurgeQueued', kind: item.kind, dueFrame: item.dueFrame, repeatRemaining: item.repeatRemaining, startX: item.startX, endX: item.endX, damage: item.damage, source: item.source });
}

function extractVolc(payload = {}, isMini = false) {
  return isMini ? (payload.miniVolcano || payload.miniVolc || payload || {}) : (payload.volcano || payload.deathSurge || payload || {});
}

function numAny(obj, names, fallback = 0) {
  for (const name of names) {
    const n = Number(obj?.[name]);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function buildSurge(attacker, proc, finalDamage, key, scene, event, hitIndex, target) {
  const payload = proc.payload || {};
  const isMini = proc.key === 'miniSurge';
  const volc = extractVolc(payload, isMini);
  const d = dire(attacker);
  const origin = pos(attacker);
  const d0 = numAny(volc, ['dis0', 'dis_0', 'dis0Raw'], 0);
  const d1 = numAny(volc, ['dis1', 'dis_1', 'dis1Raw'], d0);
  const min = Math.min(d0, d1);
  const max = Math.max(d0, d1);
  const rolled = min + Math.floor(Math.random() * Math.max(1, max - min + 1));
  const center = origin + d * rolled;
  const mult = isMini ? Math.max(0, Number(volc.mult ?? payload.mult ?? 20)) / 100 : 1;
  const timeFrames = Math.max(1, Math.trunc(Number(volc.time || 1)));
  return {
    id: `${key}:${proc.key}`,
    kind: proc.key,
    attacker,
    target,
    event,
    hitIndex,
    startX: center - SURGE_HALF_WIDTH,
    endX: center + SURGE_HALF_WIDTH,
    damage: Math.max(1, Math.trunc(finalDamage * mult)),
    dueFrame: scene.logicFrame + 1,
    repeatRemaining: Math.max(0, Math.trunc(timeFrames / 20) - 1),
    repeatIntervalFrames: 20,
    source: isMini ? 'BCU MINIVOLC after captured hit' : 'BCU VOLC after captured hit'
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
  const q = Array.isArray(scene.__bcuSurgeQueue) ? scene.__bcuSurgeQueue : [];
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
      const res = scene.queueAttackDamage(item.attacker, target, 'actor', event, { key: `${item.id}:${target.instanceId || target.label || 'target'}`, hitIndex: item.hitIndex, bcuSurge: item.kind });
      if (res?.accepted) applied += 1;
    }
    scene.pushEvent?.({ type: 'bcuSurgeResolved', id: item.id, kind: item.kind, targetCount: targets.length, appliedCount: applied, repeatRemaining: item.repeatRemaining });
    if (item.repeatRemaining > 0) rest.push({ ...item, dueFrame: scene.logicFrame + item.repeatIntervalFrames, repeatRemaining: item.repeatRemaining - 1 });
  }
  scene.__bcuSurgeQueue = rest;
}

function enqueueFromResult(scene, attacker, target, event, calc, result, meta = {}) {
  if (!result?.accepted) return;
  const items = surgeItems(calc);
  if (!items.length) return;
  const finalDamage = Math.max(0, Math.trunc(Number(calc?.finalDamage || 0)));
  if (finalDamage <= 0) return;
  const hitIndex = meta.hitIndex ?? event?.hitIndex ?? null;
  const key = meta.key || `${scene.logicFrame}:${attacker?.instanceId || 'atk'}:${target?.instanceId || 'target'}:${hitIndex}`;
  for (const proc of items) enqueue(scene, buildSurge(attacker, proc, finalDamage, key, scene, event, hitIndex, target));
}

export function installBattleSurgeRuntimePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') throw new Error('BattleScene.queueAttackDamage is missing');
  proto.queueAttackDamage = function queueAttackDamageWithBcuSurge(attacker, target, targetType, event, meta = {}) {
    const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
    if (targetType === 'actor') {
      const calc = target?.lastIncomingDamageCalculation || attacker?.lastDamageCalculation || null;
      enqueueFromResult(this, attacker, target, event, calc, result, meta);
    }
    return result;
  };

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase === 'function') {
    proto.runTickPhase = function runTickPhaseWithBcuSurge(phase, fn = () => {}) {
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

installBattleSurgeRuntimePatch();
