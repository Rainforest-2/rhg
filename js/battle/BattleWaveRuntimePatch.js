import { BattleScene } from './BattleScene.js';
import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';
import { hasBcuWaveStopper } from './bcu-runtime/BcuWaveStopperRuntime.js';
import { BcuTraceRuntime } from './bcu-runtime/BcuTraceRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.wave-runtime-patch.v2.bcu-cont-wave-def');
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
  if (Number.isFinite(actor?.direction)) return actor.direction < 0 ? -1 : 1;
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
    abilityMappingStatus: 'bcu-cont-wave-def-no-recursive-wave',
    targetMode: 'range',
    allowBaseHit: false,
    attackKind: kind
  };
}

function getPayloadNumber(payload, keys, fallback) {
  for (const key of keys) {
    const n = Number(payload?.[key]);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function rollInclusive(min, max) {
  const lo = Math.trunc(Math.min(min, max));
  const hi = Math.trunc(Math.max(min, max));
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function initWaveLevel(payload = {}) {
  const lv = Math.max(1, Math.trunc(getPayloadNumber(payload, ['level', 'lv'], 1)));
  const maxlv = Math.max(lv, Math.trunc(getPayloadNumber(payload, ['maxLevel', 'maxlv'], lv)));
  return maxlv > lv ? rollInclusive(lv, maxlv) : lv;
}

function makeGroup() {
  return { active: true, containers: new Set(), incl: new Set() };
}

function trace(scene, entry) {
  const payload = { sceneFrame: scene?.logicFrame ?? null, ...entry };
  BcuTraceRuntime.push('wave', payload);
  globalThis.__BCU_WAVE_TRACE__ = [...(globalThis.__BCU_WAVE_TRACE__ || []), payload].slice(-200);
  scene?.pushEvent?.({ type: 'bcuWaveTrace', ...payload });
}

function enqueue(scene, item) {
  if (!scene.__bcuWaveContainers) scene.__bcuWaveContainers = [];
  item.group?.containers?.add(item);
  scene.__bcuWaveContainers.push(item);
  trace(scene, {
    source: 'BattleWaveRuntimePatch.enqueue',
    bcuReference: 'AttackSimple.excuse -> new ContWaveDef(new AttackWave(...), delay -3/-1)',
    event: 'created',
    id: item.id,
    kind: item.kind,
    t: item.t,
    attackFrame: item.attackFrame,
    spawnFrame: item.spawnFrame,
    maxt: item.maxt,
    attacker: item.attacker?.instanceId || item.attacker?.label || null,
    pos: item.pos,
    width: item.width,
    damage: item.damage,
    remainingLevel: item.remainingLevel,
    inverted: item.inverted,
    activeMode: 'bcu-cont-wave-def'
  });
}

function buildInitialWave(attacker, proc, finalDamage, key, event, hitIndex, target) {
  const payload = proc.payload || {};
  const d = dire(attacker);
  const origin = pos(attacker);
  const width = d === 1 ? W_E_WID : W_U_WID;
  const addp = (d === 1 ? W_E_INI : W_U_INI) + width / 2;
  const isMini = proc.key === 'miniWave';
  const level = initWaveLevel(payload);
  const inverted = !!payload.inverted;
  const initialOffset = inverted ? W_PROG * (level - 1) * d : 0;
  const p0 = origin + d * addp + initialOffset;
  const mult = isMini ? Math.max(0, Number(payload.mult ?? payload.damageMultiplier ?? 20)) / 100 : 1;
  const group = makeGroup();
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
    t: isMini ? -1 : -3,
    // BCU ContWaveDef maxt is animation length - 1. JS does not yet have wave EffAnim length in this patch;
    // use the existing BCU-tuned runtime lifetime, but the hit/next/update order below matches ContWaveDef.
    maxt: isMini ? W_MINI_TIME + 6 : W_TIME + 8,
    attackFrame: isMini ? 4 : 6,
    spawnFrame: isMini ? W_MINI_TIME : W_TIME,
    remainingLevel: Math.max(0, level - 1),
    damage: Math.max(1, Math.trunc(finalDamage * mult)),
    group,
    incl: group.incl,
    inverted,
    source: isMini ? 'BCU ContWaveDef MINIWAVE state machine' : 'BCU ContWaveDef WAVE state machine'
  };
}

function buildNextWave(item) {
  const nextDire = item.inverted ? -item.direction : item.direction;
  return {
    ...item,
    id: `${item.id}:next${item.remainingLevel}`,
    pos: item.pos + W_PROG * nextDire,
    t: 0,
    remainingLevel: item.remainingLevel - 1
  };
}

function targetsInRange(scene, attacker, startX, endX, incl) {
  const lo = Math.min(startX, endX);
  const hi = Math.max(startX, endX);
  return (scene.actors || []).filter((target) => {
    if (!target || target.side === attacker?.side || incl?.has(target)) return false;
    if (!(target.isTargetable?.() ?? target.isAlive?.())) return false;
    const p = pos(target);
    const half = Number(target.width || target.rawStats?.width || 0) / 2;
    return (p + half) >= lo && (p - half) <= hi;
  });
}

function deactivateGroup(scene, item, blockerActor) {
  if (item.group) {
    item.group.active = false;
    for (const w of item.group.containers || []) w.activate = false;
  }
  if (blockerActor?.anim?.getEff) blockerActor.anim.getEff('STPWAVE');
  trace(scene, {
    source: 'BattleWaveRuntimePatch.deactivateGroup',
    bcuReference: 'ContWaveDef.deactivate kills every related wave on AB_WAVES stopper',
    event: 'blocked',
    id: item.id,
    blockerActor: blockerActor?.instanceId || blockerActor?.label || null,
    t: item.t
  });
}

function attackAtFrame(scene, item) {
  const event = cloneEvent(item.event, item.damage, item.kind);
  const startX = item.pos - item.width / 2;
  const endX = item.pos + item.width / 2;
  const targets = targetsInRange(scene, item.attacker, startX, endX, item.incl);
  let applied = 0;
  for (const target of targets) {
    const res = scene.queueAttackDamage(item.attacker, target, 'actor', event, {
      key: `${item.id}:${target.instanceId || target.label || 'target'}`,
      hitIndex: item.hitIndex,
      bcuWave: item.kind,
      bcuRuntimeSource: 'ContWaveDef.attackFrame'
    });
    // BCU AttackWave.excuse adds every captured Entity to incl after damaged(), even when damage is guarded.
    item.incl.add(target);
    if (res?.accepted) applied += 1;
  }
  trace(scene, {
    source: 'BattleWaveRuntimePatch.attackAtFrame',
    bcuReference: 'ContWaveDef.update t == attack -> sb.getAttack(atk); AttackWave.excuse incl.add',
    event: 'attack-frame',
    id: item.id,
    kind: item.kind,
    t: item.t,
    targetCount: targets.length,
    appliedCount: applied,
    inclSize: item.incl.size,
    activeMode: 'bcu-cont-wave-def'
  });
}

function process(scene) {
  const q = Array.isArray(scene.__bcuWaveContainers) ? scene.__bcuWaveContainers : [];
  if (!q.length) return;
  const rest = [];
  for (const item of q) {
    if (item.activate === false || item.group?.active === false) continue;
    const rangeTargets = targetsInRange(scene, item.attacker, item.pos - item.width / 2, item.pos + item.width / 2, item.incl);
    if (item.t === 0) trace(scene, { source: 'BattleWaveRuntimePatch.process', bcuReference: 'ContWaveDef.update t == 0 CommonStatic.setSE(SE_WAVE)', event: 'se-wave', id: item.id, t: item.t });
    if (item.t <= item.attackFrame) {
      const stop = hasBcuWaveStopper(rangeTargets);
      if (stop.blocked) {
        deactivateGroup(scene, item, stop.blockerActor);
        continue;
      }
    }
    if (item.t === item.spawnFrame && item.remainingLevel > 0) {
      const next = buildNextWave(item);
      rest.push(next);
      next.group?.containers?.add(next);
      trace(scene, {
        source: 'BattleWaveRuntimePatch.nextWave',
        bcuReference: 'ContWaveDef.nextWave W_PROG=200, inverted reverses direction',
        event: 'next-wave',
        id: item.id,
        nextId: next.id,
        pos: next.pos,
        remainingLevel: next.remainingLevel,
        inverted: next.inverted,
        direction: next.direction
      });
    }
    if (item.t === item.attackFrame) attackAtFrame(scene, item);
    if (item.t === item.maxt) {
      trace(scene, { source: 'BattleWaveRuntimePatch.process', bcuReference: 'ContWaveDef.update if maxt == t activate=false', event: 'deactivated', id: item.id, t: item.t });
      continue;
    }
    if (item.t >= 0) {
      trace(scene, { source: 'BattleWaveRuntimePatch.process', bcuReference: 'ContWaveDef.update anim.update(false)', event: 'animation-update', id: item.id, t: item.t });
    }
    item.t += 1;
    rest.push(item);
  }
  scene.__bcuWaveContainers = rest.filter((w) => w.activate !== false && w.group?.active !== false);
}

function enqueueFromResult(scene, attacker, target, event, calc, result, meta = {}) {
  if (!result?.accepted || meta?.bcuWave || meta?.bcuSurge) return;
  const items = waveItems(calc);
  if (!items.length) return;
  const finalDamage = Math.max(0, Math.trunc(Number(calc?.finalDamage || 0)));
  if (finalDamage <= 0) return;
  const hitIndex = meta.hitIndex ?? event?.hitIndex ?? null;
  const key = meta.key || `${scene.logicFrame}:${attacker?.instanceId || 'atk'}:${target?.instanceId || 'target'}:${hitIndex}`;
  for (const proc of items) enqueue(scene, buildInitialWave(attacker, proc, finalDamage, key, event, hitIndex, target));
}

export function installBattleWaveRuntimePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') throw new Error('BattleScene.queueAttackDamage is missing');
  proto.queueAttackDamage = function queueAttackDamageWithBcuContWaveDef(attacker, target, targetType, event, meta = {}) {
    const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
    if (targetType === 'actor') {
      const calc = target?.lastIncomingDamageCalculation || attacker?.lastDamageCalculation || null;
      enqueueFromResult(this, attacker, target, event, calc, result, meta);
    }
    return result;
  };

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase === 'function') {
    proto.runTickPhase = function runTickPhaseWithBcuContWaveDef(phase, fn = () => {}) {
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
