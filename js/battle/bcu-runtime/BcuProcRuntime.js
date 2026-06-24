import { resolveBcuProcRuntimePayload } from './BcuResistRuntime.js';

export class BcuProcRuntime {
  performProc({ attacker, target, attack, proc, rng } = {}) {
    const { resist, rawTime, rawDistance, finalTime, finalDistance, runtimePayload } = resolveBcuProcRuntimePayload({ target, attack, proc });
    let application = { applied: false, delegatedToLegacy: true, reason: 'not-yet-ported' };
    const runtimeKeys = new Set(['freeze', 'slow', 'weaken', 'curse', 'seal', 'knockbackProc', 'warp', 'toxic']);
    if (proc?.alreadyApplied === true) {
      application = { applied: true, handledBy: proc.handledBy || 'BattleSceneProcApplyPatch', legacyShouldSkip: true, reason: 'already-applied' };
    } else if (target && runtimeKeys.has(proc?.key)) {
      if (proc.key === 'warp' && target.bcuWarpImmune === true) {
        application = { applied: false, blocked: true, reason: 'warp-immunity' };
      } else if (proc.key === 'knockbackProc' && target.bcuKbImmune === true) {
        application = { applied: false, blocked: true, reason: 'kb-immunity' };
      } else if (typeof target.applyBcuProc === 'function') {
        application = target.applyBcuProc({ ...proc, payload: runtimePayload }, { attacker, attack, nowMs: attack?.sceneTimeMs ?? attacker?.lastSceneTimeMs ?? target?.lastSceneTimeMs ?? 0 });
        if (application?.applied) application = { ...application, handledBy: 'BcuProcRuntime', legacyShouldSkip: true };
      } else {
        application = { applied: false, reason: 'target-applyBcuProc-missing' };
      }
    }
    const result = {
      attacker: attacker?.instanceId || attacker?.label || null,
      target: target?.instanceId || target?.label || null,
      procName: proc?.key || null,
      rawTime,
      rawDistance,
      fruit: proc?.fruit || 0,
      resist,
      finalTime,
      finalDistance,
      blocked: application?.blocked === true,
      rngKnown: !!rng,
      applied: application?.applied === true,
      traceOnly: false,
      application
    };
    return result;
  }

  applyStop(ctx) { return this.performProc({ ...ctx, proc: { ...(ctx?.proc || {}), key: 'freeze' } }); }
  applySlow(ctx) { return this.performProc({ ...ctx, proc: { ...(ctx?.proc || {}), key: 'slow' } }); }
  applyWeak(ctx) { return this.performProc({ ...ctx, proc: { ...(ctx?.proc || {}), key: 'weaken' } }); }
  applyCurse(ctx) { return this.performProc({ ...ctx, proc: { ...(ctx?.proc || {}), key: 'curse' } }); }
  applyKb(ctx) { return this.performProc({ ...ctx, proc: { ...(ctx?.proc || {}), key: 'knockbackProc' } }); }
  applyWarp(ctx) { return this.performProc({ ...ctx, proc: { ...(ctx?.proc || {}), key: 'warp' } }); }
  applySeal(ctx) { return this.performProc({ ...ctx, proc: { ...(ctx?.proc || {}), key: 'seal' } }); }
  applyPoison(ctx) { return this.performProc({ ...ctx, proc: { ...(ctx?.proc || {}), key: 'toxic' } }); }
  applyArmor(ctx) { return this.performProc({ ...ctx, proc: { ...(ctx?.proc || {}), key: 'armor' } }); }
  applySpeed(ctx) { return this.performProc({ ...ctx, proc: { ...(ctx?.proc || {}), key: 'speed' } }); }
  applyLethargy(ctx) { return this.performProc({ ...ctx, proc: { ...(ctx?.proc || {}), key: 'lethargy' } }); }
}
