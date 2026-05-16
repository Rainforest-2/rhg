import { BattleScene } from './BattleScene.js';
import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.wave-runtime-patch.v1');
const W_PROG = 200;
const W_E_INI = -32.75;
const W_U_INI = -67.5;
const W_E_WID = 500;
const W_U_WID = 400;
const W_TIME = 3;
const W_MINI_TIME = 1;

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
  if (!scene.__bcuWaveContainers) scene.__bcuWaveContainers = [];
  scene.__bcuWaveContainers.push(item);
  scene.pushEvent?.({
    type: 'bcuWaveContainerCreated',
    kind: item.kind,
    t: item.t,
    attackFrame: item.attackFrame,
    maxt: item.maxt,
    attacker: item.attacker?.instanceId || item.attacker?.label || null,
    pos: item.pos,
    width: item.width,
    damage: item.damage,
    remainingLevel: item.remainingLevel,
    source: item.source
  });
}

function buildWave(attacker, proc, finalDamage, key, scene, event, hitIndex, target) {
  const payload = proc.payload || {};
  const level = Math.max(1, Math.trunc(Number(payload.level || 1)));
  const d = dire(attacker);
  const origin = pos(attacker);
  const width = d === 1 ? W_E_WID : W_U_WID;
  const addp = (d === 1 ? W_E_INI : W_U_INI) + width / 2;
  const p0 = origin + d * addp;
  const isMini = proc.key === 'miniWave';
  const mult = isMini ? Math.max(0, Number(payload.mult || 20)) / 100 : 1;
  return {
    id: `${key}:${proc.key}`,
    kind: proc.key,
    attacker,
    target,
    event,
    hitIndex,
    pos: p0,
    width,
    direction: d,
    t: -3,
    maxt: isMini ? W_MINI_TIME + 6 : W_TIME + 8,
    attackFrame: isMini ? 4 : 6,
    spawnFrame: isMini ? W_MINI_TIME : W_TIME,
    remainingLevel: Math.max(0, level - 1),
    damage: Math.max(1, Math.trunc(finalDamage * mult)),
    source: isMini ? 'BCU ContWaveDef MINIWAVE state machine' : 'BCU ContWaveDef WAVE state machine'
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
  const q = Array.isArray(scene.__bcuWaveContainers) ? scene.__bcuWaveContainers : [];
  if (!q.length) return;
  const rest = [];
  for (const item of q) {
    if (item.t === item.spawnFrame && item.remainingLevel > 0) {
      const next = { ...item, id: `${item.id}:next${item.remainingLevel}`, pos: item.pos + W_PROG * item.direction, t: 0, remainingLevel: item.remainingLevel - 1 };
      rest.push(next);
      scene.pushEvent?.({ type: 'bcuWaveNextWave', id: item.id, nextId: next.id, pos: next.pos, remainingLevel: next.remainingLevel, source: 'ContWaveDef.nextWave W_PROG=200' });
    }
    if (item.t === item.attackFrame) {
      const event = cloneEvent(item.event, item.damage, item.kind);
      const startX = item.pos - item.width / 2;
      const endX = item.pos + item.width / 2;
      const targets = targetsInRange(scene, item.attacker, startX, endX);
      let applied = 0;
      for (const target of targets) {
        const res = scene.queueAttackDamage(item.attacker, target, 'actor', event, {
          key: `${item.id}:${target.instanceId || target.label || 'target'}`,
          hitIndex: item.hitIndex,
          bcuWave: item.kind
        });
        if (res?.accepted) applied += 1;
      }
      scene.pushEvent?.({ type: 'bcuWaveAttackFrame', id: item.id, kind: item.kind, t: item.t, targetCount: targets.length, appliedCount: applied, source: 'ContWaveDef.update t == attack' });
    }
    if (item.t >= item.maxt) {
      scene.pushEvent?.({ type: 'bcuWaveDeactivated', id: item.id, kind: item.kind, reason: 'maxt', t: item.t });
      continue;
    }
    item.t += 1;
    rest.push(item);
  }
  scene.__bcuWaveContainers = rest;
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
