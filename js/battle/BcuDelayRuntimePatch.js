import { BattleActor } from './BattleActor.js';
import { BattleScene } from './BattleScene.js';
import { ProcResolver, isBcuHitProcDisabled } from './ProcResolver.js';
import { bcuTraitCompatible, describeBcuTraitCompatibility } from './BcuTraitCompatibility.js';
import { flushBcuDelayProcQueues, queueBcuDelayProc } from './bcu-runtime/BcuDelayRuntime.js';
import { applyBcuProcPercent, resolveBcuProcResistance } from './bcu-runtime/BcuResistRuntime.js';
import { spawnWaveBundleEffect } from './BcuWaveBundleEffectSpawner.js';
import { BCU_SCALE_MODE } from './bcu-runtime/BcuEffectTraceRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-delay-runtime-patch.v1');
const PROC_RESOLVER_FLAG = Symbol.for('wanko-battle.proc-resolver-delay-patch.v1');
const SCENE_ROW_FLAG = Symbol.for('wanko-battle.bcu-delay-stage-row-metadata.v1');
const SCENE_FLUSH_FLAG = Symbol.for('wanko-battle.bcu-delay-proc-flush.v1');

function getCombatModel(entity) {
  return entity?.bcuCombatModel || entity?.rawStats?.bcuCombatModel || entity?.stats?.bcuCombatModel || null;
}

function getProcModel(entity) {
  return getCombatModel(entity)?.proc || entity?.bcuProc || entity?.rawStats?.bcuProc || entity?.abilityModel?.bcuProc || {};
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function delayPayloadFromProc(proc = {}) {
  const delay = proc?.delay || {};
  return {
    prob: number(delay.prob, 0),
    strength: number(delay.strength, 0),
    type: Math.max(0, Math.min(2, Math.trunc(number(delay.type, 0))))
  };
}

function hasDelayCandidate(proc = {}, semantic = {}) {
  return semantic?.delay === true || number(proc?.delay?.prob, 0) > 0;
}

function chance(prob, rng = Math.random) {
  const p = number(prob, 0);
  if (p <= 0) return false;
  if (p >= 100) return true;
  return rng() * 100 < p;
}

function statusActive(actor, keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) {
    if (typeof actor?.isBcuProcStatusActive === 'function' && actor.isBcuProcStatusActive(key, actor.lastSceneTimeMs)) return true;
    const st = actor?.bcuProcStatuses?.[key];
    if (Number.isFinite(st?.framesRemaining) && st.framesRemaining > 0) return true;
    if (Number.isFinite(st?.untilMs)) {
      const nowMs = Number.isFinite(actor?.lastSceneTimeMs) ? actor.lastSceneTimeMs : 0;
      if (nowMs < st.untilMs) return true;
    }
  }
  return false;
}

function delaySuppressionReason(attacker) {
  if (statusActive(attacker, ['seal', 'P_SEAL'])) return 'attacker-seal-suppressed-delay-proc';
  if (statusActive(attacker, ['curse', 'P_CURSE'])) return 'attacker-curse-suppressed-delay-proc';
  return null;
}

function alreadyHasDelay(result) {
  return ['applied', 'pending', 'skipped'].some((key) => Array.isArray(result?.[key]) && result[key].some((item) => item?.key === 'delay'));
}

function delayImuMult(actor) {
  const cm = getCombatModel(actor);
  const proc = getProcModel(actor);
  const direct = number(cm?.immunity?.delay?.mult, NaN);
  if (Number.isFinite(direct)) return direct;
  return number(proc?.IMUDELAY?.mult ?? proc?.IMUDELAY?.block ?? actor?.bcuProcResist?.IMUDELAY, 0);
}

function adjustDelayPayloadForResistance(payload = {}, resistance = null) {
  if (!resistance?.partial) return { payload, adjusted: false };
  const out = { ...payload };
  const rawStrength = number(out.strength, 0);
  out.strength = Math.trunc(applyBcuProcPercent({ rawPercent: rawStrength, resist: resistance.mult }));
  return { payload: out, adjusted: true };
}

function annotateSpawnedStageEnemy(scene, beforeCount, row) {
  const after = scene?.actors?.length || 0;
  if (!scene || after <= beforeCount) return null;
  const actor = scene.actors[after - 1] || null;
  if (!actor) return null;
  const rowIndex = Number(row?.rowIndex ?? row?.row?.rowIndex);
  if (!Number.isFinite(rowIndex)) return actor;
  actor.stageSpawnRowIndex = Math.trunc(rowIndex);
  actor.stageSpawn = row?.row || row;
  actor.stageSpawnSource = 'BcuDelayRuntimePatch.spawnStageEnemy row metadata for EStage.delay parity';
  actor.lastBcuDelayStageRowDebug = {
    source: actor.stageSpawnSource,
    rowIndex: actor.stageSpawnRowIndex,
    bcuReference: 'EEnemy.processProcs stores its stage line index; postUpdate routes P_DELAY to basis.lineDelay[line]'
  };
  return actor;
}

function spawnDelayEffect(actor, scene) {
  if (!actor || !scene) return null;
  return spawnWaveBundleEffect(scene, {
    key: 'enemyDelay',
    actor,
    layer: Number.isFinite(actor.currentLayer) ? actor.currentLayer : 0,
    type: 'delay',
    source: 'bcu-effanim-delay-proc',
    bcuSmokeYOffset: -50,
    bcuScaleMode: BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT,
    debug: {
      bcuReference: 'EUnit/EEnemy.processProcs: basis.lea.add(new EAnimCont(pos, currentLayer, effas().A_E_DELAY.getEAnim(DefEff.DEF), -50f))'
    }
  });
}

export function installBcuDelayRuntimePatch() {
  if (!ProcResolver[PROC_RESOLVER_FLAG]) {
    ProcResolver[PROC_RESOLVER_FLAG] = true;
    const originalGetCatalog = ProcResolver.getProcCatalog;
    ProcResolver.getProcCatalog = function getProcCatalogWithDelay() {
      const catalog = originalGetCatalog.call(this);
      return {
        ...catalog,
        delay: {
          key: 'delay',
          category: 'state',
          implemented: true,
          pendingSupported: true,
          pendingType: 'state',
          target: 'actor',
          runtime: 'BcuDelayRuntimePatch -> BcuDelayRuntime ELineUp/EStage delay parity'
        }
      };
    };

    const originalResolve = ProcResolver.resolve;
    ProcResolver.resolve = function resolveWithDelay(args = {}) {
      const result = originalResolve.call(this, args) || { applied: [], pending: [], skipped: [], notes: [], debug: {} };
      const { attacker = null, target = null, targetType = 'actor', event = null, context = {} } = args;
      const semantic = event?.abilities || event?.ability?.semantic || {};
      const proc = getProcModel(attacker);
      if (!hasDelayCandidate(proc, semantic) || alreadyHasDelay(result)) return result;

      const payload = delayPayloadFromProc(proc);
      const rng = typeof context?.random === 'function' ? context.random : Math.random;
      const skipped = result.skipped ||= [];
      const pending = result.pending ||= [];
      const applied = result.applied ||= [];
      const notes = result.notes ||= [];
      const targetId = target?.instanceId || target?.label || target?.side || null;
      const attackerId = attacker?.instanceId || attacker?.label || null;
      const hitIndex = event?.hitIndex ?? null;
      const attackEventKey = context?.attackEventKey ?? event?.key ?? null;

      if (targetType !== 'actor') {
        skipped.push({ key: 'delay', category: 'state', reason: 'delay-target-not-actor', payload });
      } else if (isBcuHitProcDisabled(event)) {
        skipped.push({ key: 'delay', category: 'state', reason: 'bcu-hit-abi-disabled', payload, bcuHitAbi: event?.bcuHitAbi ?? null, bcuReference: 'AtkModelUnit/AtkModelEnemy.getAttack: DELAY is in the setProc par list, gated by abis[ind] == 1' });
      } else {
        const suppressed = delaySuppressionReason(attacker);
        if (suppressed) {
          skipped.push({ key: 'delay', category: 'state', reason: suppressed, payload, bcuReference: 'P_DELAY is a removable status proc and follows curse/seal proc suppression groups' });
        } else if (!bcuTraitCompatible({ attacker, target, targetType, targetOnly: semantic?.targetOnly === true })) {
          skipped.push({ key: 'delay', category: 'state', reason: 'target-trait-incompatible', payload, traitCompatibility: describeBcuTraitCompatibility({ attacker, target, targetType, targetOnly: semantic?.targetOnly === true }) });
        } else if (number(payload.prob, 0) <= 0) {
          skipped.push({ key: 'delay', category: 'state', reason: 'zero-probability', payload });
        } else if (!chance(payload.prob, rng)) {
          skipped.push({ key: 'delay', category: 'state', reason: 'probability-failed', prob: payload.prob, payload });
        } else {
          const item = {
            key: 'delay',
            category: 'state',
            pendingType: 'state',
            implemented: true,
            targetType: 'actor',
            targetId,
            attackerId,
            hitIndex,
            attackEventKey,
            source: 'BcuDelayRuntimePatch.proc-roll-ready-to-runtime',
            candidateSource: semantic?.delay === true ? 'semantic-or-bcu-delay-proc' : 'bcu-proc-model',
            runtime: 'BcuDelayRuntimePatch -> BcuDelayRuntime',
            reason: 'runtime-application-supported',
            payload,
            context: { targetType },
            bcuReference: 'EUnit/EEnemy.processProcs DELAY -> status[P_DELAY]; postUpdate routes to cdDelay or lineDelay'
          };
          pending.push(item);
          applied.push(item);
        }
      }

      result.debug ||= {};
      result.debug.proc = proc;
      result.debug.candidateKeys = [...new Set([...(result.debug.candidateKeys || []), 'delay'])];
      result.debug.candidates = [...(result.debug.candidates || []), { key: 'delay', category: 'state', implemented: true, target: 'actor', source: 'BcuDelayRuntimePatch' }];
      result.debug.pendingCount = pending.length;
      result.debug.appliedCount = applied.length;
      result.debug.skippedCount = skipped.length;
      if (!notes.includes('delay-proc-resolved-by-bcu-delay-runtime-patch')) notes.push('delay-proc-resolved-by-bcu-delay-runtime-patch');
      return result;
    };
  }

  if (!BattleActor.prototype[PATCH_FLAG]) {
    BattleActor.prototype[PATCH_FLAG] = true;
    const previousApply = BattleActor.prototype.applyBcuProc;
    BattleActor.prototype.applyBcuProc = function applyBcuProcWithDelayRuntime(item, meta = {}) {
      if (item?.key !== 'delay') {
        return previousApply ? previousApply.call(this, item, meta) : { applied: false, reason: 'previous-applyBcuProc-missing' };
      }
      if (!this.isAlive?.()) return { applied: false, reason: 'target-not-alive', item };
      const resistance = resolveBcuProcResistance({
        target: this,
        attacker: meta?.attacker || item?.attacker || null,
        item: { ...item, attack: meta?.attack || item?.attack || null },
        procName: 'IMUDELAY',
        procResist: delayImuMult(this)
      });
      if (resistance.full) {
        const result = { applied: false, immune: true, reason: 'bcu-IMUDELAY-immunity', field: 'IMUDELAY', resistance, item };
        this.lastBcuDelayProcDebug = { source: 'BcuDelayRuntimePatch.applyBcuProc', result, resistance, item };
        this.lastBcuProcApplyDebug = { item, result, nowMs: meta.nowMs ?? null, source: 'BcuDelayRuntimePatch.applyBcuProc' };
        return result;
      }
      const adjusted = adjustDelayPayloadForResistance(item.payload || {}, resistance);
      const adjustedItem = { ...item, payload: adjusted.payload, bcuProcResistance: resistance };
      spawnDelayEffect(this, meta.scene || this.scene || null);
      const result = queueBcuDelayProc(this, adjustedItem, meta);
      if (adjusted.adjusted) result.bcuProcResistance = { field: 'IMUDELAY', mult: resistance.mult, breakdown: resistance.breakdown || null };
      this.lastBcuDelayProcDebug = { source: 'BcuDelayRuntimePatch.applyBcuProc', item: adjustedItem, result, resistance };
      this.lastBcuProcApplyDebug = { item: adjustedItem, result, nowMs: meta.nowMs ?? null, source: 'BcuDelayRuntimePatch.applyBcuProc' };
      return result;
    };
  }

  const sceneProto = BattleScene?.prototype;
  if (sceneProto && !sceneProto[SCENE_ROW_FLAG]) {
    sceneProto[SCENE_ROW_FLAG] = true;
    const originalSpawnStageEnemy = sceneProto.spawnStageEnemy;
    if (typeof originalSpawnStageEnemy === 'function') {
      sceneProto.spawnStageEnemy = function spawnStageEnemyWithBcuDelayRowMetadata(unitDef, row) {
        const before = this.actors?.length || 0;
        const ok = originalSpawnStageEnemy.call(this, unitDef, row);
        const actor = annotateSpawnedStageEnemy(this, before, row);
        if (actor?.stageSpawnRowIndex !== undefined) {
          this.pushEvent?.({ type: 'bcuDelayStageRowAnnotated', actor: actor.instanceId || actor.label || null, rowIndex: actor.stageSpawnRowIndex });
        }
        return ok;
      };
    }
  }

  if (sceneProto && !sceneProto[SCENE_FLUSH_FLAG]) {
    sceneProto[SCENE_FLUSH_FLAG] = true;
    const originalRunTickPhase = sceneProto.runTickPhase;
    if (typeof originalRunTickPhase === 'function') {
      sceneProto.runTickPhase = function runTickPhaseWithBcuDelayFlush(phase, fn = () => {}) {
        if (phase === 'proc-resolve') {
          return originalRunTickPhase.call(this, phase, () => {
            const result = fn();
            flushBcuDelayProcQueues(this, 'proc-resolve');
            return result;
          });
        }
        if (phase === 'knockback-death' || phase === 'cleanup') {
          return originalRunTickPhase.call(this, phase, () => {
            flushBcuDelayProcQueues(this, `pre-${phase}-safety`);
            return fn();
          });
        }
        return originalRunTickPhase.call(this, phase, fn);
      };
    }
  }
}

installBcuDelayRuntimePatch();
