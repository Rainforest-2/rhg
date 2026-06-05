import { BCU_BATTLE_TIMER_PERIOD_MS } from '../BattleFrameClock.js';

export const BCU_TOUCH_NORMAL = 1;
export const BCU_TOUCH_KNOCKBACK = 2;
export const BCU_TOUCH_UNDERGROUND = 4;

function combatModel(actor) {
  return actor?.bcuCombatModel || actor?.rawStats?.bcuCombatModel || actor?.stats?.bcuCombatModel || null;
}

function burrowSpec(actor) {
  const p = combatModel(actor)?.proc?.burrow || actor?.bcuProc?.burrow || null;
  const count = Math.trunc(Number(p?.count || 0));
  const dis = Number(p?.dis || 0);
  if (!Number.isFinite(count) || count === 0 || !Number.isFinite(dis) || dis <= 0) return null;
  return { count, dis, source: p?.source || 'BCU DataEnemy.ints[43]/ints[44]/4' };
}

function direction(actor) {
  return Number(actor?.direction) < 0 ? -1 : 1;
}

function baseAhead(scene, actor) {
  const dir = direction(actor);
  const base = (scene?.bases || []).find((b) => b?.side !== actor?.side && (typeof b.isAlive !== 'function' || b.isAlive()));
  const pos = Number.isFinite(base?.getBattlePosBcu?.()) ? base.getBattlePosBcu() : (Number.isFinite(base?.posBcu) ? base.posBcu : base?.x);
  if (!Number.isFinite(pos)) return { ok: false, reason: 'base-missing' };
  const touchBase = Math.max(0, Number(actor?.bcuTouchBaseDistance ?? actor?.attackWidthBcu ?? actor?.rawStats?.width ?? 0) || 0);
  const distance = (pos - actor.x) * dir;
  return { ok: distance > touchBase, base, basePos: pos, touchBase, distance };
}

function isAliveForBurrow(actor) {
  if (typeof actor?.isAlive === 'function') return actor.isAlive();
  return actor?.hp > 0 && actor?.state !== 'dead';
}

export function getBcuBurrowSpec(actor) {
  const spec = burrowSpec(actor);
  if (!spec) return null;
  if (actor.__bcuBurrowRemainingInitialized !== true) {
    actor.__bcuBurrowRemainingInitialized = true;
    actor.bcuBurrowRemaining = spec.count < 0 ? -1 : spec.count;
  }
  return { ...spec, remaining: actor.bcuBurrowRemaining };
}

export function canStartBcuBurrow(scene, actor, target = null) {
  const spec = getBcuBurrowSpec(actor);
  if (!spec) return { ok: false, reason: 'no-burrow-spec' };
  if (spec.remaining === 0) return { ok: false, reason: 'count-exhausted' };
  if (actor?.bcuBurrow?.active) return { ok: false, reason: 'already-burrowing' };
  if (actor?.skipSpawnBurrow === true) return { ok: false, reason: 'skip-spawn-burrow' };
  if (!isAliveForBurrow(actor)) return { ok: false, reason: 'dead' };
  if (actor?.state === 'knockback' || actor?.deathPending || actor?.bcuWarpHidden || actor?.bcuWarpLifecycle?.active) return { ok: false, reason: 'blocked-lifecycle-state' };
  if (scene?.isActorBcuStopped?.(actor) === true || actor?.isBcuProcStatusActive?.('freeze', scene?.timeMs) === true) return { ok: false, reason: 'frozen' };
  if (!target) return { ok: false, reason: 'no-contact-target' };
  const base = baseAhead(scene, actor);
  if (!base.ok) return { ok: false, reason: base.reason || 'base-not-ahead', base };
  return { ok: true, spec, base, bcuReference: 'Entity.update2 checkTouch && status[P_BURROW][0] != 0 && base ahead -> startBurrow' };
}

function phaseFrames(actor, phase) {
  const configured = Number(actor?.bcuBurrowAnimationFrames?.[phase]);
  if (Number.isFinite(configured) && configured > 0) return Math.trunc(configured);
  const animId = phase === 'down' ? 'anim04' : phase === 'up' ? 'anim06' : 'anim05';
  const maxFrame = Number(actor?.animations?.get?.(animId)?.maxFrame);
  if (Number.isFinite(maxFrame) && maxFrame >= 0) return Math.max(1, Math.trunc(maxFrame) + 1);
  return 1;
}

export function startBcuBurrow(actor, { scene = null } = {}) {
  const spec = getBcuBurrowSpec(actor);
  if (!spec || spec.remaining === 0) return { started: false, reason: 'no-burrow-count' };
  if (actor.bcuBurrowRemaining > 0) actor.bcuBurrowRemaining -= 1;
  actor.bcuBurrow = {
    active: true,
    phase: 'down',
    framesRemaining: phaseFrames(actor, 'down'),
    distanceRemaining: spec.dis,
    startedAtFrame: scene?.logicFrame ?? null,
    startedAtMs: scene?.timeMs ?? null,
    source: 'BCU Entity.startBurrow',
    bcuReference: 'startBurrow: status[P_BURROW][0]--; status[P_BURROW][2]=BURROW_DOWN len; kbTime=-2'
  };
  actor.setAnimation?.('anim04', 'burrow-down', true);
  actor.lastBcuBurrowDebug = { source: 'BcuBurrowLifecycleRuntime.startBcuBurrow', phase: 'down', remaining: actor.bcuBurrowRemaining, distance: spec.dis };
  scene?.pushEvent?.({ type: 'bcuBurrowStarted', actor: actor.instanceId || actor.label || null, remaining: actor.bcuBurrowRemaining, distance: spec.dis });
  return { started: true, state: actor.bcuBurrow };
}

function transition(actor, phase, scene) {
  actor.bcuBurrow.phase = phase;
  actor.bcuBurrow.framesRemaining = phase === 'up' ? phaseFrames(actor, 'up') : 0;
  if (phase === 'move') {
    actor.bcuBurrow.distanceRemaining = getBcuBurrowSpec(actor)?.dis ?? actor.bcuBurrow.distanceRemaining;
    actor.setAnimation?.('anim05', 'burrow-move', true);
  } else if (phase === 'up') {
    actor.setAnimation?.('anim06', 'burrow-up', true);
  }
  scene?.pushEvent?.({ type: 'bcuBurrowPhase', actor: actor.instanceId || actor.label || null, phase });
}

export function finishBcuBurrow(actor, reason = 'complete') {
  if (!actor?.bcuBurrow) return;
  actor.lastBcuBurrowDebug = { ...(actor.lastBcuBurrowDebug || {}), finished: true, reason };
  actor.bcuBurrow.active = false;
  actor.bcuBurrow.phase = 'normal';
  actor.bcuBurrow = null;
  actor.setAnimation?.(actor.moveAnimId, 'move', true);
}

export function clearBcuBurrow(actor, reason = 'clear') {
  if (!actor?.bcuBurrow) return { cleared: false };
  finishBcuBurrow(actor, reason);
  return { cleared: true, reason };
}

export function getBcuBurrowTouchMask(actor) {
  const phase = actor?.bcuBurrow?.phase;
  if (phase === 'down' || phase === 'up') return BCU_TOUCH_NORMAL | BCU_TOUCH_UNDERGROUND;
  if (phase === 'move') return BCU_TOUCH_UNDERGROUND;
  return BCU_TOUCH_NORMAL;
}

export function isBcuBurrowNormallyTargetable(actor) {
  return getBcuBurrowTouchMask(actor) !== BCU_TOUCH_UNDERGROUND;
}

export function isBcuBurrowTargetableForEvent(actor, event = null) {
  const mask = getBcuBurrowTouchMask(actor);
  const attackMask = Number(event?.bcuTouchMask ?? event?.touchMask ?? BCU_TOUCH_NORMAL);
  return (mask & attackMask) !== 0;
}

export function tickBcuBurrow(actor, dt = BCU_BATTLE_TIMER_PERIOD_MS, { scene = actor?.scene || null } = {}) {
  const state = actor?.bcuBurrow;
  if (!state?.active) return { active: false };
  if (!isAliveForBurrow(actor)) {
    clearBcuBurrow(actor, 'death');
    return { active: false, cleared: true };
  }
  if (scene?.isActorBcuStopped?.(actor) === true || actor?.isBcuProcStatusActive?.('freeze', scene?.timeMs) === true) {
    actor.lastBcuBurrowTickDebug = { source: 'BcuBurrowLifecycleRuntime.tick', frozen: true, phase: state.phase };
    return { active: true, frozen: true, state };
  }
  if (state.phase === 'down') {
    state.framesRemaining -= Math.max(1, Math.round((Number(dt) || BCU_BATTLE_TIMER_PERIOD_MS) / BCU_BATTLE_TIMER_PERIOD_MS));
    if (state.framesRemaining <= 0) transition(actor, 'move', scene);
  }
  if (state.phase === 'move') {
    const base = baseAhead(scene, actor);
    if (state.distanceRemaining < 0 || (base.base && base.distance <= base.touchBase)) {
      transition(actor, 'up', scene);
    } else {
      const before = actor.x;
      const moved = scene?.moveActorBcu ? scene.moveActorBcu(actor, dt) : 0;
      const consumed = Math.max(0, Math.abs(Number.isFinite(moved) ? moved : (actor.x - before)));
      state.distanceRemaining -= consumed;
      const afterBase = baseAhead(scene, actor);
      if (afterBase.base && afterBase.distance <= afterBase.touchBase) {
        actor.x = afterBase.basePos - direction(actor) * afterBase.touchBase;
        transition(actor, 'up', scene);
      } else if (state.distanceRemaining < 0) {
        transition(actor, 'up', scene);
      }
    }
  }
  if (state.phase === 'up') {
    state.framesRemaining -= Math.max(1, Math.round((Number(dt) || BCU_BATTLE_TIMER_PERIOD_MS) / BCU_BATTLE_TIMER_PERIOD_MS));
    if (state.framesRemaining <= 0) finishBcuBurrow(actor, 'up-complete');
  }
  actor.lastBcuBurrowTickDebug = { source: 'BcuBurrowLifecycleRuntime.tick', active: !!actor.bcuBurrow?.active, phase: actor.bcuBurrow?.phase || 'normal', x: actor.x, distanceRemaining: actor.bcuBurrow?.distanceRemaining ?? null };
  return { active: !!actor.bcuBurrow?.active, state: actor.bcuBurrow };
}
