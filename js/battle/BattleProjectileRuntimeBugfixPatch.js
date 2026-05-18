import { BattleScene } from './BattleScene.js';
import { BcuTraceRuntime } from './bcu-runtime/BcuTraceRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.projectile-runtime-bugfix.v1');
const MAX_SURGE_ALIVE_FRAMES = 300;
const DEFAULT_SURGE_ALIVE_FRAMES = 20;

function trace(kind, payload) {
  BcuTraceRuntime.push(kind, payload);
  const key = kind === 'surge' ? '__BCU_SURGE_TRACE__' : '__BCU_WAVE_TRACE__';
  globalThis[key] = [...(globalThis[key] || []), payload].slice(-240);
}

function attackerKey(item) {
  return item?.attacker?.instanceId || item?.attacker?.label || item?.attacker?.id || 'unknown-attacker';
}

function normalizeSurgeAliveTime(item) {
  if (!item || (item.kind !== 'surge' && item.kind !== 'miniSurge')) return false;
  const raw = Number(item.aliveTime);
  let next = Number.isFinite(raw) ? raw : DEFAULT_SURGE_ALIVE_FRAMES;
  let reason = 'unchanged';

  // Some semantic payloads expose surge level rather than BCU frame duration.
  // BCU ContVolcano receives aliveTime in frames; Battle Cats surge levels map to 20F steps.
  if (next > 0 && next <= 10) {
    next *= 20;
    reason = 'level-to-frames';
  }
  if (!(next > 0)) {
    next = DEFAULT_SURGE_ALIVE_FRAMES;
    reason = 'default-invalid';
  }
  if (next > MAX_SURGE_ALIVE_FRAMES) {
    next = MAX_SURGE_ALIVE_FRAMES;
    reason = 'clamped-max';
  }
  next = Math.max(1, Math.trunc(next));
  if (next === raw) return false;
  item.aliveTime = next;
  item.time = next;
  item.lastSurgeAliveTimeNormalizeDebug = {
    source: 'BattleProjectileRuntimeBugfixPatch.normalizeSurgeAliveTime',
    rawAliveTime: raw,
    normalizedAliveTime: next,
    reason,
    bcuReference: 'ContVolcano aliveTime is frame duration; visible lifetime is aliveTime + VOLC_PRE + VOLC_POST'
  };
  return true;
}

function dedupeContainers(scene, prop, kind) {
  const list = Array.isArray(scene?.[prop]) ? scene[prop] : [];
  if (list.length <= 1) return { removed: 0, normalized: 0 };
  const seen = new Set();
  const out = [];
  let removed = 0;
  let normalized = 0;
  for (const item of list) {
    if (normalizeSurgeAliveTime(item)) normalized += 1;
    if (!Number.isFinite(item.createdLogicFrame)) item.createdLogicFrame = scene.logicFrame || 0;
    const key = [attackerKey(item), item.id || 'no-id', item.kind || 'unknown', item.createdLogicFrame].join('|');
    if (seen.has(key)) {
      removed += 1;
      item.activate = false;
      trace(kind, {
        source: 'BattleProjectileRuntimeBugfixPatch.dedupeContainers',
        event: 'deduped',
        containerProp: prop,
        id: item.id || null,
        kind: item.kind || null,
        attacker: attackerKey(item),
        createdLogicFrame: item.createdLogicFrame,
        bcuReference: 'Projectile/surge proc is generated once per direct attack event, not once per captured target'
      });
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  scene[prop] = out;
  if (removed || normalized) {
    trace(kind, {
      source: 'BattleProjectileRuntimeBugfixPatch.dedupeContainers',
      event: 'summary',
      containerProp: prop,
      input: list.length,
      output: out.length,
      removed,
      normalized,
      frame: scene.logicFrame || 0
    });
  }
  return { removed, normalized };
}

export function installBattleProjectileRuntimeBugfixPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage === 'function') {
    proto.queueAttackDamage = function queueAttackDamageWithProjectileBugfix(...args) {
      const result = originalQueueAttackDamage.apply(this, args);
      dedupeContainers(this, '__bcuSurgeContainers', 'surge');
      dedupeContainers(this, '__bcuWaveContainers', 'wave');
      return result;
    };
  }

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase === 'function') {
    proto.runTickPhase = function runTickPhaseWithProjectileBugfix(phase, fn = () => {}) {
      if (phase === 'proc-resolve') {
        return originalRunTickPhase.call(this, phase, () => {
          dedupeContainers(this, '__bcuSurgeContainers', 'surge');
          dedupeContainers(this, '__bcuWaveContainers', 'wave');
          const result = fn();
          dedupeContainers(this, '__bcuSurgeContainers', 'surge');
          dedupeContainers(this, '__bcuWaveContainers', 'wave');
          return result;
        });
      }
      return originalRunTickPhase.call(this, phase, fn);
    };
  }
}

installBattleProjectileRuntimeBugfixPatch();
