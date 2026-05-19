import './BattleMiniProcParityPatch.js';
import { BattleScene } from './BattleScene.js';
import { DamageCalculator } from './DamageCalculator.js';

const SCENE_PATCH_FLAG = Symbol.for('wanko-battle.deterministic-random-scene-patch.v2');
const CALC_PATCH_FLAG = Symbol.for('wanko-battle.deterministic-random-calculator-patch.v1');
const RANDOM_STACK = [];

function createBcuRng(seed = 0x2bc0ffee) {
  let state = (Number(seed) >>> 0) || 1;
  return function bcuRuntimeRandom() {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function ensureRng(scene) {
  if (typeof scene.__bcuRandom !== 'function') {
    const seed = scene?.stageDefinition?.id ?? scene?.stageId ?? scene?.config?.stage?.id ?? scene?.stage?.selectedStageId ?? 0x2bc0ffee;
    scene.__bcuRandomSeed = Number(seed) >>> 0;
    scene.__bcuRandom = createBcuRng(scene.__bcuRandomSeed);
    scene.__bcuRandomCount = 0;
  }
  return () => {
    scene.__bcuRandomCount = (scene.__bcuRandomCount || 0) + 1;
    const value = scene.__bcuRandom();
    scene.lastBcuRandomDebug = {
      source: 'scene-scoped deterministic battle RNG passed to DamageCalculator context; BCU basis.r analogue',
      seed: scene.__bcuRandomSeed,
      count: scene.__bcuRandomCount,
      value
    };
    return value;
  };
}

function currentRandom() {
  return RANDOM_STACK.length ? RANDOM_STACK[RANDOM_STACK.length - 1] : null;
}

function installDamageCalculatorRandomBridge() {
  if (!DamageCalculator || DamageCalculator[CALC_PATCH_FLAG]) return;
  DamageCalculator[CALC_PATCH_FLAG] = true;
  const originalCalculate = DamageCalculator.calculate;
  if (typeof originalCalculate !== 'function') throw new Error('DamageCalculator.calculate is missing; cannot install RNG bridge');
  DamageCalculator.calculate = function calculateWithSceneRandom(args = {}) {
    const random = args?.context?.random || currentRandom();
    if (!random) return originalCalculate.call(this, args);
    return originalCalculate.call(this, { ...args, context: { ...(args.context || {}), random } });
  };
}

export function installBattleDeterministicRandomPatch() {
  installDamageCalculatorRandomBridge();
  const proto = BattleScene?.prototype;
  if (!proto || proto[SCENE_PATCH_FLAG]) return;
  proto[SCENE_PATCH_FLAG] = true;

  proto.getBcuRandom = function getBcuRandom() {
    return ensureRng(this);
  };

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') {
    throw new Error('BattleScene.queueAttackDamage is missing; cannot install deterministic RNG patch');
  }

  proto.queueAttackDamage = function queueAttackDamageWithDeterministicRandom(attacker, target, targetType, event, meta = {}) {
    const random = meta.random || this.getBcuRandom();
    RANDOM_STACK.push(random);
    try {
      return originalQueueAttackDamage.call(this, attacker, target, targetType, event, { ...meta, random });
    } finally {
      RANDOM_STACK.pop();
    }
  };
}

installBattleDeterministicRandomPatch();