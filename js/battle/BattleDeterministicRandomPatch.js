import './BattleMiniProcParityPatch.js';
import { BattleScene } from './BattleScene.js';
import { DamageCalculator } from './DamageCalculator.js';
import { BcuCopRand, normalizeBattleSeed, randomBattleSeed } from './bcu-runtime/BcuCopRand.js';

const SCENE_PATCH_FLAG = Symbol.for('wanko-battle.deterministic-random-scene-patch.v3');
const CALC_PATCH_FLAG = Symbol.for('wanko-battle.deterministic-random-calculator-patch.v1');
const RANDOM_STACK = [];

// Resolve the scene's battle seed. BCU StageBasis uses a single CopRand (basis.r) seeded
// at battle start. We accept an explicit 64-bit `battleSeed` from scene options, fall back
// to a generated seed, and persist it as a string so replay/debug can reuse the exact run.
// NOTE: stage ID is deliberately NOT treated as the seed.
function resolveBattleSeed(scene) {
  const fromOptions = normalizeBattleSeed(
    scene?.options?.battleSeed ?? scene?.options?.seed ?? scene?.battleSeed
  );
  if (fromOptions !== null) return fromOptions;
  return randomBattleSeed();
}

function ensureCopRand(scene) {
  if (scene.__bcuCopRand instanceof BcuCopRand) return scene.__bcuCopRand;
  const seed = resolveBattleSeed(scene);
  scene.__bcuCopRand = new BcuCopRand(seed);
  scene.__bcuRandomSeed = seed;
  // Persisted as a string so the full 64-bit signed seed survives JSON (replay/debug).
  scene.battleSeed = seed.toString();
  scene.battleSeedSource = (normalizeBattleSeed(scene?.options?.battleSeed ?? scene?.options?.seed) !== null)
    ? 'scene-options-battleSeed'
    : 'generated';
  scene.lastBcuRandomDebug = {
    source: 'scene CopRand (BCU basis.r); single seeded battle RNG',
    seed: scene.battleSeed,
    seedSource: scene.battleSeedSource,
    drawCount: 0
  };
  return scene.__bcuCopRand;
}

function ensureRng(scene) {
  ensureCopRand(scene);
  return () => {
    const value = scene.__bcuCopRand.nextFloat();
    scene.lastBcuRandomDebug = {
      source: 'scene CopRand (BCU basis.r) nextFloat passed to DamageCalculator/spawn context',
      seed: scene.battleSeed,
      seedSource: scene.battleSeedSource,
      drawCount: scene.__bcuCopRand.drawCount,
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

  // Returns the scene's single CopRand instance (BCU basis.r). All deterministic battle
  // draws (proc, spawn, respawn, layer, hit smoke, wave) must consume from this instance
  // so consumption order matches BCU.
  proto.getBcuCopRand = function getBcuCopRand() {
    return ensureCopRand(this);
  };

  // float draw consumer used as DamageCalculator context.random and spawn/layer RNG.
  proto.getBcuRandom = function getBcuRandom() {
    return ensureRng(this);
  };

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') {
    throw new Error('BattleScene.queueAttackDamage is missing; cannot install deterministic RNG patch');
  }

  proto.queueAttackDamage = function queueAttackDamageWithDeterministicRandom(attacker, target, targetType, event, meta = {}) {
    const random = meta.random || this.getBcuRandom();
    if (targetType === 'actor' && target) target.__bcuLastBattleRandom = random;
    RANDOM_STACK.push(random);
    try {
      return originalQueueAttackDamage.call(this, attacker, target, targetType, event, { ...meta, random });
    } finally {
      RANDOM_STACK.pop();
    }
  };
}

installBattleDeterministicRandomPatch();
