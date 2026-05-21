import { BattleScene } from './BattleScene.js';
import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';
import { EffectRuntime } from './EffectRuntime.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../bcu/BcuAnimator.js';
import { DamageCalculator } from './DamageCalculator.js';

const PATCH_FLAG = Symbol.for('wanko-battle.blast-runtime-patch.v2-base-hit-fallback');
const BLAST_SHIFT = 100;
const BLAST_HALF_WIDTH = 75;
const BLAST_PRE_FRAME = 11;
const BLAST_DURATION_FRAME = 44;
const BLAST_SOURCE = 'bcu-effanim-cont-blast';

function pos(actor) {
  const n = BattleCombatCoordinateRuntime.getEntityPosBcu(actor);
  return Number.isFinite(n) ? n : (Number(actor?.x) || 0);
}

function dire(actor) {
  if (Number.isFinite(actor?.direction)) return actor.direction < 0 ? -1 : 1;
  return actor?.side === 'dog-player' ? -1 : 1;
}

function blastItems(calc) {
  return [...(calc?.proc?.pending || []), ...(calc?.proc?.applied || [])].filter((p) => p?.key === 'blast');
}

function hasBlastProc(calc) {
  return blastItems(calc).length > 0;
}

function fallbackDamage(attacker, event) {
  const n = Number(event?.damage);
  if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));
  const raw = Number(attacker?.damage);
  return Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
}

function resolveBlastDamageCalculation(scene, attacker, target, targetType, event, result, meta = {}) {
  const direct = result?.damageCalculation
    || result?.damageResult
    || target?.lastIncomingDamageCalculation
    || attacker?.lastDamageCalculation
    || null;
  if (hasBlastProc(direct)) return direct;

  try {
    const random = typeof meta?.random === 'function'
      ? meta.random
      : (typeof scene?.getBcuRandom === 'function' ? scene.getBcuRandom() : Math.random);
    const fallback = DamageCalculator.calculate({
      attacker,
      target,
      targetType,
      event,
      context: {
        random,
        attackEventKey: meta?.key ?? event?.key ?? null
      }
    });
    fallback.blastFallbackDebug = {
      source: 'BattleBlastRuntimePatch.resolveBlastDamageCalculation',
      reason: direct ? 'direct-calc-had-no-blast-proc-or-no-proc' : 'direct-calc-missing',
      directSource: direct?.source || null,
      targetType,
      bcuReference: 'BCU AttackSimple.excuse creates ContBlast when captured target list is not empty, including castle/base captures'
    };
    return fallback;
  } catch (error) {
    scene.lastBlastProcError = {
      source: 'BattleBlastRuntimePatch.resolveBlastDamageCalculation',
      targetType,
      message: String(error?.message || error)
    };
    return direct;
  }
}

function cloneEvent(event = {}, damage) {
  const abilities = { ...(event?.abilities || event?.ability?.semantic || {}) };
  delete abilities.blast;
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
    abilityMappingStatus: 'bcu-cont-blast-no-recursive-projectile',
    targetMode: 'range',
    allowBaseHit: false,
    attackKind: 'blast'
  };
}

function rollOffset(payload = {}, random = Math.random) {
  const d0 = Math.trunc(Number(payload.dis0 ?? payload.blast?.dis0 ?? 0) || 0);
  const d1 = Math.trunc(Number(payload.dis1 ?? payload.blast?.dis1 ?? d0) || d0);
  const lo = Math.min(d0, d1);
  const hi = Math.max(d0, d1);
  if (hi <= lo) return lo;
  return lo + Math.trunc(random() * (hi - lo));
}

function effectKeyFor(direction) {
  return direction === 1 ? 'enemyBlast' : 'unitBlast';
}

function createRuntime(asset, phase = 'start') {
  const anim = asset?.phases?.[phase] || asset?.anim;
  if (!asset?.loaded || !asset?.model || !anim) return null;
  const model = new BcuModelInstance(asset.model);
  const animator = new BcuAnimator(anim);
  animator.setLoop?.(false);
  animator.restart?.();
  return { model, animator, frameCount: Math.max(1, (Number(anim?.maxFrame) || 0) + 1), maxFrame: Number(anim?.maxFrame) || 0 };
}

function spawnBlastEffect(scene, item, phase = 'start') {
  if (!scene || !item) return null;
  const asset = scene.waveEffectAssets?.[item.effectKey] || null;
  if (!asset?.loaded) {
    scene.ensureWaveEffectLoading?.();
    return null;
  }
  const runtime = createRuntime(asset, phase);
  if (!runtime) return null;
  const effect = EffectRuntime.createEffect({
    id: `bcu-blast-${phase}-${scene.logicFrame || 0}-${scene.effects.length}-${Math.random().toString(36).slice(2)}`,
    type: 'blast',
    x: item.pos,
    y: 0,
    image: asset.image,
    imgcut: asset.imgcut,
    model: runtime.model,
    animator: runtime.animator,
    scale: 1,
    source: BLAST_SOURCE,
    createdAtMs: scene.timeMs,
    layer: item.layer,
    bcuSmokeYOffset: 0,
    debug: {
      source: BLAST_SOURCE,
      bcuReference: 'BCU ContBlast A_BLAST/A_E_BLAST START then EXPLODE at t=11',
      id: item.id,
      phase,
      pos: item.pos,
      direction: item.direction,
      t: item.t,
      frameCount: runtime.frameCount,
      maxFrame: runtime.maxFrame,
      effectKey: item.effectKey,
      assetSource: asset.source || null
    }
  });
  effect.durationMs = runtime.frameCount * BCU_BATTLE_TIMER_PERIOD_MS;
  effect.frameDurationMs = BCU_BATTLE_TIMER_PERIOD_MS;
  effect.elapsedMs = -BCU_BATTLE_TIMER_PERIOD_MS;
  scene.effects.push(effect);
  return effect;
}

function levelAt(t) {
  if (t >= 10 && t <= 19) return 0;
  if (t >= 20 && t <= 29) return 1;
  if (t >= 30) return 2;
  return -1;
}

function rangesFor(item, level) {
  if (level === 0) return [[item.pos - BLAST_HALF_WIDTH, item.pos + BLAST_HALF_WIDTH]];
  if (level > 0) {
    const leftEnd = item.pos - BLAST_HALF_WIDTH - BLAST_SHIFT * (level - 1);
    const leftStart = leftEnd - BLAST_SHIFT;
    const rightStart = item.pos + BLAST_HALF_WIDTH + BLAST_SHIFT * (level - 1);
    const rightEnd = rightStart + BLAST_SHIFT;
    return [[leftStart, leftEnd], [rightStart, rightEnd]];
  }
  return [];
}

function targetsInRanges(scene, attacker, ranges, seen) {
  return (scene.actors || []).filter((target) => {
    if (!target || target.side === attacker?.side || seen?.has(target)) return false;
    if (!(target.isTargetable?.() ?? target.isAlive?.())) return false;
    const p = pos(target);
    const half = Number(target.width || target.rawStats?.width || 0) / 2;
    return ranges.some(([lo, hi]) => (p + half) >= Math.min(lo, hi) && (p - half) <= Math.max(lo, hi));
  });
}

function attackBlast(scene, item, level) {
  const ranges = rangesFor(item, level);
  const seen = item.capturedByLevel[level] || new Set();
  item.capturedByLevel[level] = seen;
  const damage = Math.max(1, Math.trunc(item.damage * (100 - 30 * level) / 100));
  const event = cloneEvent(item.event, damage);
  const targets = targetsInRanges(scene, item.attacker, ranges, seen);
  let applied = 0;
  for (const target of targets) {
    const res = scene.queueAttackDamage(item.attacker, target, 'actor', event, {
      key: `${item.id}:lvl${level}:${target.instanceId || target.label || 'target'}`,
      hitIndex: item.hitIndex,
      bcuBlast: true,
      bcuRuntimeSource: 'ContBlast.sb.getAttack'
    });
    seen.add(target);
    if (res?.accepted) applied += 1;
  }
  scene.pushEvent?.({ type: 'bcuBlastAttackFrame', id: item.id, level, targetCount: targets.length, appliedCount: applied, damage, ranges, source: 'BattleBlastRuntimePatch.attackBlast' });
}

function enqueue(scene, item) {
  if (!scene.__bcuBlastContainers) scene.__bcuBlastContainers = [];
  scene.__bcuBlastContainers.push(item);
  scene.ensureWaveEffectLoading?.();
  spawnBlastEffect(scene, item, 'start');
  scene.pushEvent?.({ type: 'bcuBlastCreated', id: item.id, actor: item.attacker?.instanceId || item.attacker?.label || null, pos: item.pos, effectKey: item.effectKey, source: 'BattleBlastRuntimePatch.enqueue' });
}

function enqueueFromResult(scene, attacker, target, targetType, event, calc, result, meta = {}) {
  if (targetType !== 'base' && !result?.accepted) return;
  if (meta?.bcuBlast || meta?.bcuWave || meta?.bcuSurge) return;
  const items = blastItems(calc);
  if (!items.length) return;
  const rawDamage = fallbackDamage(attacker, event);
  const finalDamage = Math.max(0, Math.trunc(Number(calc?.finalDamage ?? rawDamage)));
  if (finalDamage <= 0) return;
  const d = dire(attacker);
  const random = meta.random || scene.getBcuRandom?.() || Math.random;
  const hitIndex = meta.hitIndex ?? event?.hitIndex ?? null;
  const targetId = target?.instanceId || target?.label || target?.side || 'base';
  const key = meta.key || `${scene.logicFrame}:${attacker?.instanceId || 'atk'}:${targetId}:${hitIndex}`;
  for (const proc of items) {
    const addp = rollOffset(proc.payload || {}, random);
    const blastPos = pos(attacker) + d * addp;
    enqueue(scene, {
      id: `${key}:blast`,
      attacker,
      target,
      event,
      hitIndex,
      pos: blastPos,
      direction: d,
      layer: Number.isFinite(attacker?.currentLayer) ? attacker.currentLayer : 0,
      effectKey: effectKeyFor(d),
      t: 0,
      damage: finalDamage,
      capturedByLevel: [new Set(), new Set(), new Set()],
      source: targetType === 'base'
        ? 'BCU AttackSimple.excuse -> ContBlast from captured base hit'
        : 'BCU AttackSimple.excuse -> ContBlast(new AttackBlast(pos+75,pos-75))'
    });
  }
}

function process(scene) {
  const q = Array.isArray(scene.__bcuBlastContainers) ? scene.__bcuBlastContainers : [];
  if (!q.length) return;
  const rest = [];
  for (const item of q) {
    item.t += 1;
    if (item.t === BLAST_PRE_FRAME) spawnBlastEffect(scene, item, 'explode');
    if (item.t === 10 || item.t === 20 || item.t === 30) {
      const level = levelAt(item.t);
      if (level >= 0) item.capturedByLevel[level] = new Set();
    }
    if (item.t >= 10) {
      const level = levelAt(item.t);
      if (level >= 0) attackBlast(scene, item, level);
    }
    if (item.t < BLAST_DURATION_FRAME) rest.push(item);
    else scene.pushEvent?.({ type: 'bcuBlastEnded', id: item.id, source: 'BattleBlastRuntimePatch.process' });
  }
  scene.__bcuBlastContainers = rest;
}

export function installBattleBlastRuntimePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') throw new Error('BattleScene.queueAttackDamage is missing; cannot install blast runtime patch');
  proto.queueAttackDamage = function queueAttackDamageWithBcuContBlast(attacker, target, targetType, event, meta = {}) {
    const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
    if (targetType === 'actor' || targetType === 'base') {
      const calc = resolveBlastDamageCalculation(this, attacker, target, targetType, event, result, meta);
      enqueueFromResult(this, attacker, target, targetType, event, calc, result, meta);
    }
    return result;
  };

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase === 'function') {
    proto.runTickPhase = function runTickPhaseWithBcuContBlast(phase, fn = () => {}) {
      if (phase !== 'proc-resolve') return originalRunTickPhase.call(this, phase, fn);
      return originalRunTickPhase.call(this, phase, () => {
        const res = fn();
        process(this);
        return res;
      });
    };
  }
}

installBattleBlastRuntimePatch();
