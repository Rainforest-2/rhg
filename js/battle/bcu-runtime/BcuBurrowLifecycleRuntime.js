import { BCU_BATTLE_TIMER_PERIOD_MS } from '../BattleFrameClock.js';

export const BCU_TOUCH_NORMAL = 1;
export const BCU_TOUCH_KNOCKBACK = 2;
export const BCU_TOUCH_UNDERGROUND = 4;

export const BCU_BURROW_ANIMATION_IDS = Object.freeze({
  down: 'anim04',
  move: 'anim05',
  up: 'anim06'
});

export const BCU_BURROW_ANIMATION_ROLES = Object.freeze({
  down: 'burrow-down',
  move: 'burrow-move',
  up: 'burrow-up'
});

export function getRequiredBcuBurrowAnimationIds() {
  return [BCU_BURROW_ANIMATION_IDS.down, BCU_BURROW_ANIMATION_IDS.move, BCU_BURROW_ANIMATION_IDS.up];
}

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

function animationMapHas(container, id) {
  if (!container || !id) return false;
  if (container instanceof Map) return container.has(id);
  return !!container[id];
}

function templateHasLoadedAnimation(template, id) {
  if (!template || !id) return false;
  if (template.loadedAnimations?.has?.(id)) return true;
  return animationMapHas(template.animations, id);
}

export function getMissingBcuBurrowAnimationIds(actorOrTemplate) {
  const ids = getRequiredBcuBurrowAnimationIds();
  return ids.filter((id) => {
    if (actorOrTemplate?.loadedAnimations || actorOrTemplate?.animations && !(actorOrTemplate?.animations instanceof Map)) {
      return !templateHasLoadedAnimation(actorOrTemplate, id);
    }
    return !animationMapHas(actorOrTemplate?.animations, id);
  });
}

export function hasBcuBurrowAnimationSet(actor) {
  return getMissingBcuBurrowAnimationIds(actor).length === 0;
}

export function hasBcuBurrowTemplateAnimations(template) {
  return getMissingBcuBurrowAnimationIds(template).length === 0;
}

export function hydrateBcuBurrowActorAnimations(actor, template) {
  if (!actor || !template?.animations) return getMissingBcuBurrowAnimationIds(actor);
  if (!(actor.animations instanceof Map)) actor.animations = new Map(Object.entries(actor.animations || {}));
  for (const id of getRequiredBcuBurrowAnimationIds()) {
    const anim = template.animations instanceof Map ? template.animations.get(id) : template.animations[id];
    if (anim) actor.animations.set(id, anim);
  }
  return getMissingBcuBurrowAnimationIds(actor);
}

function baseAhead(scene, actor) {
  const dir = direction(actor);
  const base = (scene?.bases || []).find((b) => b?.side !== actor?.side && (typeof b.isAlive !== 'function' || b.isAlive()));
  const pos = Number.isFinite(base?.getBattlePosBcu?.()) ? base.getBattlePosBcu() : (Number.isFinite(base?.posBcu) ? base.posBcu : base?.x);
  if (!Number.isFinite(pos)) return { ok: false, reason: 'base-missing' };
  const touchBase = Math.max(0, Number(actor?.bcuTouchBaseDistance ?? actor?.rawStats?.touchBase ?? actor?.stats?.touchBase ?? actor?.attackWidthBcu ?? actor?.rawStats?.width ?? 0) || 0);
  const distance = (pos - actor.x) * dir;
  return { ok: distance > touchBase, base, basePos: pos, touchBase, distance };
}

function isAliveForBurrow(actor) {
  if (typeof actor?.isAlive === 'function') return actor.isAlive() || actor?.state === 'burrow';
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
  if (actor?.state === 'knockback' || actor?.state === 'attack' || actor?.deathPending || actor?.bcuWarpHidden || actor?.bcuWarpLifecycle?.active) return { ok: false, reason: 'blocked-lifecycle-state' };
  if (scene?.isActorBcuStopped?.(actor) === true || actor?.isBcuProcStatusActive?.('freeze', scene?.timeMs) === true) return { ok: false, reason: 'frozen' };
  if (!hasBcuBurrowAnimationSet(actor)) return { ok: false, reason: 'burrow-animation-missing', missingAnimations: getMissingBcuBurrowAnimationIds(actor) };
  if (!target) return { ok: false, reason: 'no-contact-target' };
  const base = baseAhead(scene, actor);
  if (!base.ok) return { ok: false, reason: base.reason || 'base-not-ahead', base };
  return { ok: true, spec, base, bcuReference: 'Entity.update2 checkTouch && status[P_BURROW][0] != 0 && base ahead -> startBurrow' };
}

function phaseFrames(actor, phase) {
  const configured = Number(actor?.bcuBurrowAnimationFrames?.[phase]);
  if (Number.isFinite(configured) && configured > 0) return Math.trunc(configured);
  const animId = BCU_BURROW_ANIMATION_IDS[phase];
  const maxFrame = Number(actor?.animations?.get?.(animId)?.maxFrame);
  if (Number.isFinite(maxFrame) && maxFrame >= 0) return Math.max(1, Math.trunc(maxFrame) + 1);
  return 1;
}

function setBurrowAnimation(actor, phase, restart = true) {
  const animId = BCU_BURROW_ANIMATION_IDS[phase];
  const role = BCU_BURROW_ANIMATION_ROLES[phase];
  actor.setAnimation?.(animId, role, restart);
  if (actor.animator?.setLoop) actor.animator.setLoop(phase === 'move');
  actor.lastBcuBurrowAnimationDebug = {
    source: 'BcuBurrowLifecycleRuntime.setBurrowAnimation',
    phase,
    animId,
    role,
    loaded: actor.animations?.has?.(animId) === true,
    bcuReference: phase === 'down' ? 'anim.setAnim(UType.BURROW_DOWN, false)' : phase === 'move' ? 'anim.setAnim(UType.BURROW_MOVE, true)' : 'anim.setAnim(UType.BURROW_UP, skip)'
  };
}

export function startBcuBurrow(actor, { scene = null } = {}) {
  const spec = getBcuBurrowSpec(actor);
  if (!spec || spec.remaining === 0) return { started: false, reason: 'no-burrow-count' };
  const missing = getMissingBcuBurrowAnimationIds(actor);
  if (missing.length) return { started: false, reason: 'burrow-animation-missing', missingAnimations: missing };
  if (actor.bcuBurrowRemaining > 0) actor.bcuBurrowRemaining -= 1;
  actor.bcuBurrow = {
    active: true,
    phase: 'down',
    framesRemaining: phaseFrames(actor, 'down'),
    distanceRemaining: spec.dis,
    startedAtFrame: scene?.logicFrame ?? null,
    startedAtMs: scene?.timeMs ?? null,
    previousState: actor.state || 'move',
    source: 'BCU Entity.startBurrow',
    bcuReference: 'startBurrow: status[P_BURROW][0]--; status[P_BURROW][2]=BURROW_DOWN len; kbTime=-2'
  };
  actor.setState?.('burrow');
  setBurrowAnimation(actor, 'down', true);
  actor.lastBcuBurrowDebug = { source: 'BcuBurrowLifecycleRuntime.startBcuBurrow', phase: 'down', remaining: actor.bcuBurrowRemaining, distance: spec.dis };
  scene?.pushEvent?.({ type: 'bcuBurrowStarted', actor: actor.instanceId || actor.label || null, remaining: actor.bcuBurrowRemaining, distance: spec.dis });
  return { started: true, state: actor.bcuBurrow };
}

function transition(actor, phase, scene, { skip = true } = {}) {
  actor.bcuBurrow.phase = phase;
  if (phase === 'move') {
    actor.bcuBurrow.framesRemaining = 0;
    actor.bcuBurrow.distanceRemaining = getBcuBurrowSpec(actor)?.dis ?? actor.bcuBurrow.distanceRemaining;
    setBurrowAnimation(actor, 'move', true);
  } else if (phase === 'up') {
    actor.bcuBurrow.framesRemaining = phaseFrames(actor, 'up') + (skip === false ? 1 : 0);
    setBurrowAnimation(actor, 'up', true);
  }
  scene?.pushEvent?.({ type: 'bcuBurrowPhase', actor: actor.instanceId || actor.label || null, phase, skip });
}

export function finishBcuBurrow(actor, reason = 'complete') {
  if (!actor?.bcuBurrow) return;
  actor.lastBcuBurrowDebug = { ...(actor.lastBcuBurrowDebug || {}), finished: true, reason };
  actor.bcuBurrow.active = false;
  actor.bcuBurrow.phase = 'normal';
  actor.bcuBurrow = null;
  actor.setState?.('move');
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

function isSlowActive(actor, scene) {
  return scene?.isActorBcuSlowed?.(actor) === true
    || actor?.isBcuProcStatusActive?.('slow', scene?.timeMs) === true
    || actor?.bcuProcStatuses?.slow?.framesRemaining > 0;
}

function rawSpeed(actor) {
  const candidates = [actor?.rawStats?.speed, actor?.stats?.speed, actor?.baseStats?.speed, actor?.actorStatsModel?.speed];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  const perSecond = Number(actor?.moveSpeedWorldPerSecond ?? actor?.moveSpeed);
  const fps = 1000 / BCU_BATTLE_TIMER_PERIOD_MS;
  if (Number.isFinite(perSecond)) return perSecond / fps / 0.5;
  return 0;
}

function globalSpeed(scene, actor, speed) {
  const fn = scene?.getBcuGlobalSpeed;
  if (typeof fn !== 'function') return speed;
  const dir = direction(actor);
  const attempts = [() => fn(dir, speed), () => fn(actor, speed), () => fn(actor?.side, speed)];
  for (const call of attempts) {
    try {
      const v = Number(call());
      if (Number.isFinite(v) && v > -1) return v;
    } catch {}
  }
  return speed;
}

function speedProc(actor) {
  return actor?.bcuMoveSpeedProc || actor?.bcuProcStatuses?.speed || null;
}

function speedupPercent(actor) {
  const v = actor?.bcuSpeedupPercent ?? actor?.bcuProcStatuses?.speedup?.percent ?? actor?.bcuProcStatuses?.strengthenSpeed?.percent;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function getBcuBurrowMoveDistancePerFrame(actor, scene = null) {
  if (isSlowActive(actor, scene)) return 0.25;
  let speed = globalSpeed(scene, actor, rawSpeed(actor));
  let mov = speed * 0.5;
  const sp = speedProc(actor);
  if (sp && Number(sp.framesRemaining ?? sp.durationFrames ?? 0) !== 0) {
    const mode = Number(sp.mode ?? sp.type ?? 0);
    const amount = Number(sp.amount ?? sp.value ?? sp.percent ?? 0) || 0;
    if (mode === 0) mov += amount * 0.5;
    else if (mode === 1) mov = mov * (100 + amount) / 100;
    else if (mode === 2) mov = amount * 0.5;
  }
  const up = speedupPercent(actor);
  if (up !== 0) {
    mov += mov * up / 100;
    mov = Math.round(mov * 4) / 4;
  }
  return mov;
}

function moveBcuBurrowFrame(actor, scene) {
  const before = Number(actor.x) || 0;
  const moved = getBcuBurrowMoveDistancePerFrame(actor, scene) * direction(actor);
  actor.x = before + moved;
  actor.posBcu = actor.x;
  return actor.x - before;
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
  const steps = Math.max(1, Math.round((Number(dt) || BCU_BATTLE_TIMER_PERIOD_MS) / BCU_BATTLE_TIMER_PERIOD_MS));
  let movedTotal = 0;
  for (let i = 0; i < steps && actor.bcuBurrow?.active; i += 1) {
    if (state.phase === 'down') {
      state.framesRemaining -= 1;
      if (state.framesRemaining <= 0) transition(actor, 'move', scene);
    }
    if (state.phase === 'move') {
      const base = baseAhead(scene, actor);
      if (state.distanceRemaining < 0) {
        transition(actor, 'up', scene, { skip: false });
      } else if (base.base && base.distance - base.touchBase <= 0) {
        transition(actor, 'up', scene, { skip: true });
      } else {
        const moved = moveBcuBurrowFrame(actor, scene);
        movedTotal += moved;
        state.distanceRemaining -= moved * direction(actor);
      }
    }
    if (state.phase === 'up') {
      state.framesRemaining -= 1;
      if (state.framesRemaining <= 0) finishBcuBurrow(actor, 'up-complete');
    }
  }
  actor.lastBcuBurrowTickDebug = { source: 'BcuBurrowLifecycleRuntime.tick', active: !!actor.bcuBurrow?.active, phase: actor.bcuBurrow?.phase || 'normal', x: actor.x, moved: movedTotal, distanceRemaining: actor.bcuBurrow?.distanceRemaining ?? null, movePerFrame: getBcuBurrowMoveDistancePerFrame(actor, scene) };
  return { active: !!actor.bcuBurrow?.active, state: actor.bcuBurrow, moved: movedTotal };
}
