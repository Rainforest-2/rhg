import { BattleScene } from './BattleScene.js';

const PATCH_FLAG = Symbol.for('wanko-battle.deterministic-random-patch.v1');

function createBcuRng(seed = 0x2bc0ffee) {
  let state = (Number(seed) >>> 0) || 1;
  return function bcuRuntimeRandom() {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function ensureRng(scene) {
  if (typeof scene.__bcuRandom !== 'function') {
    const seed = scene?.stageDefinition?.id ?? scene?.stageId ?? scene?.config?.stage?.id ?? 0x2bc0ffee;
    scene.__bcuRandomSeed = Number(seed) >>> 0;
    scene.__bcuRandom = createBcuRng(scene.__bcuRandomSeed);
    scene.__bcuRandomCount = 0;
  }
  return () => {
    scene.__bcuRandomCount = (scene.__bcuRandomCount || 0) + 1;
    const value = scene.__bcuRandom();
    scene.lastBcuRandomDebug = {
      source: 'scene-scoped deterministic battle RNG; replaces Math.random in proc/surge runtime',
      seed: scene.__bcuRandomSeed,
      count: scene.__bcuRandomCount,
      value
    };
    return value;
  };
}

export function installBattleDeterministicRandomPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  proto.getBcuRandom = function getBcuRandom() {
    return ensureRng(this);
  };

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') {
    throw new Error('BattleScene.queueAttackDamage is missing; cannot install deterministic RNG patch');
  }

  proto.queueAttackDamage = function queueAttackDamageWithDeterministicRandom(attacker, target, targetType, event, meta = {}) {
    const random = meta.random || this.getBcuRandom();
    return originalQueueAttackDamage.call(this, attacker, target, targetType, event, { ...meta, random });
  };
}

installBattleDeterministicRandomPatch();
