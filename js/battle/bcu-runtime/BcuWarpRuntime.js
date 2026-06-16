
function currentWarpState(target) {
  const st = target?.bcuProcStatuses?.warp || null;
  const lifecycle = target?.bcuWarpLifecycle || null;
  return {
    state: lifecycle?.phase ?? st?.state ?? target?.bcuWarpState ?? null,
    hidden: target?.bcuWarpHidden === true || !!st?.hidden || lifecycle?.hideBaseActor === true,
    framesRemaining: Number.isFinite(lifecycle?.framesRemaining) ? lifecycle.framesRemaining : (Number.isFinite(st?.framesRemaining) ? st.framesRemaining : null),
    distance: Number.isFinite(lifecycle?.distance) ? lifecycle.distance : (Number.isFinite(st?.distance) ? st.distance : (Number.isFinite(target?.bcuWarpDistance) ? target.bcuWarpDistance : null)),
    lifecycle: lifecycle ? {
      phase: lifecycle.phase,
      frame: lifecycle.frame,
      totalFrames: lifecycle.totalFrames,
      procFrames: lifecycle.procFrames,
      enterFrames: lifecycle.enterFrames,
      exitFrames: lifecycle.exitFrames,
      moved: lifecycle.moved
    } : null
  };
}

export function resolveBcuWarp(ctx = {}) {
  const target = ctx.target || null;
  const payload = ctx.proc?.payload || ctx.payload || {};
  const nowMs = Number.isFinite(ctx.nowMs)
    ? ctx.nowMs
    : (Number.isFinite(ctx.attack?.sceneTimeMs) ? ctx.attack.sceneTimeMs : (Number.isFinite(target?.lastSceneTimeMs) ? target.lastSceneTimeMs : 0));

  let application = { applied: false, reason: 'target-applyBcuProc-missing' };
  if (target?.bcuProcStatuses?.warp) {
    application = { applied: true, alreadyActive: true, reason: 'warp-status-already-active' };
  } else if (target && typeof target.applyBcuProc === 'function') {
    application = target.applyBcuProc({ key: 'warp', payload }, {
      attacker: ctx.attacker || null,
      attack: ctx.attack || null,
      nowMs,
      random: ctx.random
    });
  }

  const result = {
    ...currentWarpState(target),
    kbType: 'INT_WARP',
    applied: application?.applied === true,
    traceOnly: false,
    application,
    bcuReference: 'Entity.processProcs WARP -> interrupt(INT_WARP); Entity.KBManager.updateKB handles status[P_WARP]/WaprCont'
  };
  return result;
}
