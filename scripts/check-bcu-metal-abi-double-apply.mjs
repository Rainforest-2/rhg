// Regression: BCU body classification and critical RNG ownership for Metallic.
// - Enemy bodies are metal only from the enemy Metal trait.
// - Unit bodies are metal only from AB_METALIC.
// - The base DamageAbilityResolver owns exactly one critical roll.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DamageAbilityResolver } from '../js/battle/DamageAbilityResolver.js';
import '../js/battle/DamageAbilityResolverMetalAbiPatch.js';

const AB_METALIC = 16;

function attacker(side, proc = {}) {
  return { side, bcuCombatModel: { kind: side === 'dog-player' ? 'unit' : 'enemy', proc } };
}

function target({ side, kind, abi = 0, traits = [], targetTraits = [] }) {
  const flags = Object.fromEntries(traits.map((trait) => [trait, true]));
  return {
    side,
    hp: 1000,
    traitFlags: flags,
    bcuCombatModel: {
      kind,
      ability: { abi },
      traits: { list: traits, flags },
      targetTraits: { list: targetTraits, flags: Object.fromEntries(targetTraits.map((trait) => [trait, true])) }
    }
  };
}

function resolve({ source, victim, baseDamage = 100, random = () => 0 }) {
  return DamageAbilityResolver.resolve({
    attacker: source,
    target: victim,
    baseDamage,
    targetType: 'actor',
    event: {},
    context: { random }
  });
}

// A unit that merely targets Metal is not a Metallic defender.
{
  let draws = 0;
  const result = resolve({
    source: attacker('cat-enemy', { critical: { prob: 0 }, metalKiller: { mult: 50 } }),
    victim: target({ side: 'dog-player', kind: 'unit', targetTraits: ['metal'] }),
    random: () => { draws += 1; return 0; }
  });
  assert.equal(result.finalDamage, 100, 'Metal-targeting unit without AB_METALIC must take ordinary damage');
  assert.equal(result.applied.metalKiller, false, 'metal killer must not apply to a merely Metal-targeting unit');
  assert.equal(draws, 0, '0% critical must consume no RNG');
  assert.equal(result.debug?.metalBodyClassification, 'unit-non-metallic');
}

// A unit with AB_METALIC is metal and the failed critical roll occurs exactly once.
{
  let draws = 0;
  const result = resolve({
    source: attacker('dog-player', { critical: { prob: 50 } }),
    victim: target({ side: 'cat-enemy', kind: 'unit', abi: AB_METALIC }),
    random: () => { draws += 1; return 0.99; }
  });
  assert.equal(result.finalDamage, 1, 'non-critical damage to an AB_METALIC unit must be capped to 1');
  assert.equal(draws, 1, 'AB_METALIC resolution must roll critical exactly once');
  assert.equal(result.debug?.criticalRollOwner, 'DamageAbilityResolver.resolve-single-roll');
}

// Modified CRIT.mult is applied by the same single roll.
{
  let draws = 0;
  const result = resolve({
    source: attacker('dog-player', { critical: { prob: 50, mult: 500 } }),
    victim: target({ side: 'cat-enemy', kind: 'unit', abi: AB_METALIC }),
    random: () => { draws += 1; return 0; }
  });
  assert.equal(result.finalDamage, 500, 'AB_METALIC critical must use modified CRIT.mult=500');
  assert.equal(draws, 1, 'successful AB_METALIC critical must still use one RNG draw');
}

// Enemy Metal trait remains the enemy-side body classifier.
{
  let draws = 0;
  const result = resolve({
    source: attacker('dog-player', { critical: { prob: 50 }, metalKiller: { mult: 50 } }),
    victim: target({ side: 'cat-enemy', kind: 'enemy', traits: ['metal'] }),
    random: () => { draws += 1; return 0.99; }
  });
  assert.equal(result.finalDamage, 501, 'enemy Metal trait must receive 1 damage plus one metal-killer burst');
  assert.equal(draws, 1, 'enemy Metal critical must roll once');
  assert.equal(result.debug?.metalBodyClassification, 'enemy-metal-trait');
}

// Runtime wiring: the pre-classification patch must remain in the core group.
{
  const group = readFileSync('js/boot/groups/battleCorePatches.js', 'utf8');
  assert.ok(group.includes('DamageAbilityResolverMetalAbiPatch.js'),
    'battleCorePatches must import DamageAbilityResolverMetalAbiPatch.js');
}

console.log('check-bcu-metal-abi-double-apply: OK');
