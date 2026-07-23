// Deterministic check: a real BCU custom-pack special-Trait file
// (name/id/targetType/targetForms) drives the shared compatibility gate.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  bcuTraitCompatible,
  describeBcuTraitCompatibility,
  hasTargetOnly,
  isBcuTargetTraited
} from '../js/battle/BcuTraitCompatibility.js';
import { ProcResolver } from '../js/battle/ProcResolver.js';
import { BCU_ABI } from '../js/battle/BcuCombatModel.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, 'fixtures', 'bcu-custom-pack', 'special-traits.json');
const pack = JSON.parse(readFileSync(fixturePath, 'utf8'));
const [formTrait, targetTypeTrait] = pack.traits;

assert.ok(Array.isArray(formTrait.targetForms) && formTrait.targetForms.length === 1);
assert.equal(formTrait.targetType, false);
assert.equal(targetTypeTrait.targetType, true);

// BCU Trait.isTargetTraited: red/floating/black/angel/alien/zombie/demon/relic.
// Metal and white are deliberately not part of this predicate.
const ALL_TARGET_TRAITED = ['red', 'floating', 'black', 'angel', 'alien', 'zombie', 'demon', 'relic'];
assert.equal(isBcuTargetTraited(ALL_TARGET_TRAITED), true, 'all eight BCU target traits must pass');
assert.equal(isBcuTargetTraited(ALL_TARGET_TRAITED.filter((trait) => trait !== 'demon')), false, 'missing Demon must fail');
assert.equal(isBcuTargetTraited(ALL_TARGET_TRAITED.filter((trait) => trait !== 'relic')), false, 'missing Relic must fail');
assert.equal(isBcuTargetTraited([...ALL_TARGET_TRAITED.filter((trait) => trait !== 'relic'), 'metal', 'white']), false,
  'Metal/white must not substitute for Relic');

function unitAttacker({ slotId = 'cat-unit-042-f', attackTraits = ['red'], abi = 0, proc = {} } = {}) {
  return {
    side: 'dog-player',
    slotId,
    bcuAbi: abi,
    bcuCombatModel: {
      kind: 'unit',
      ability: { abi },
      targetTraits: { list: attackTraits, entries: attackTraits },
      traits: { list: attackTraits, entries: attackTraits },
      proc
    }
  };
}

function enemyTarget({ traits = ['black'], specialEntries = [] } = {}) {
  return {
    side: 'cat-enemy',
    bcuCombatModel: {
      kind: 'enemy',
      traits: { list: traits, entries: [...traits, ...specialEntries] }
    }
  };
}

// targetForms branch.
{
  const target = enemyTarget({ traits: ['black'], specialEntries: [formTrait] });
  const hit = unitAttacker({ slotId: 'cat-unit-042-f', attackTraits: ['red'] });
  const miss = unitAttacker({ slotId: 'cat-unit-099-f', attackTraits: ['red'] });
  assert.equal(bcuTraitCompatible({ attacker: hit, target }), true);
  assert.equal(bcuTraitCompatible({ attacker: miss, target }), false);
}

// target-type trait on target requires all eight target traits on attacker.
{
  const target = enemyTarget({ traits: ['metal'], specialEntries: [targetTypeTrait] });
  const complete = unitAttacker({ attackTraits: ALL_TARGET_TRAITED });
  const noDemon = unitAttacker({ attackTraits: ALL_TARGET_TRAITED.filter((trait) => trait !== 'demon') });
  const noRelic = unitAttacker({ attackTraits: ALL_TARGET_TRAITED.filter((trait) => trait !== 'relic') });
  assert.equal(bcuTraitCompatible({ attacker: complete, target }), true);
  assert.equal(bcuTraitCompatible({ attacker: noDemon, target }), false);
  assert.equal(bcuTraitCompatible({ attacker: noRelic, target }), false);
}

// target-type trait carried by attacker requires a fully target-traited target.
{
  const completeTarget = enemyTarget({ traits: ALL_TARGET_TRAITED });
  const partialTarget = enemyTarget({ traits: ALL_TARGET_TRAITED.filter((trait) => trait !== 'relic') });
  const attacker = unitAttacker({ attackTraits: [targetTypeTrait] });
  assert.equal(bcuTraitCompatible({ attacker, target: completeTarget }), true);
  assert.equal(bcuTraitCompatible({ attacker, target: partialTarget }), false);
}

// Proc cross-path uses the same compatibility owner.
{
  const proc = { slow: { prob: 100, time: 60 } };
  const target = enemyTarget({ traits: ['black'], specialEntries: [formTrait] });
  const compatible = unitAttacker({ slotId: 'cat-unit-042-f', attackTraits: ['red'], proc });
  const incompatible = unitAttacker({ slotId: 'cat-unit-099-f', attackTraits: ['red'], proc });
  const event = { hitIndex: 0, key: 'hit-0', bcuHitAbi: 1 };
  const context = { random: () => 0 };
  const blocked = ProcResolver.resolve({ attacker: incompatible, target, targetType: 'actor', event, context });
  assert.equal(blocked.skipped.find((entry) => entry.key === 'slow')?.reason, 'target-trait-incompatible');
  const allowed = ProcResolver.resolve({ attacker: compatible, target, targetType: 'actor', event, context });
  assert.equal(allowed.skipped.find((entry) => entry.key === 'slow' && entry.reason === 'target-trait-incompatible'), undefined);
}

// Target Only cross-path uses the same special-trait gate.
{
  const target = enemyTarget({ traits: ['black'], specialEntries: [formTrait] });
  const compatible = unitAttacker({ slotId: 'cat-unit-042-f', attackTraits: ['red'], abi: BCU_ABI.AB_ONLY });
  const incompatible = unitAttacker({ slotId: 'cat-unit-099-f', attackTraits: ['red'], abi: BCU_ABI.AB_ONLY });
  assert.equal(hasTargetOnly(compatible), true);
  assert.equal(describeBcuTraitCompatibility({ attacker: compatible, target, targetOnly: true }).compatible, true);
  assert.equal(describeBcuTraitCompatibility({ attacker: incompatible, target, targetOnly: true }).compatible, false);
}

console.log('check-bcu-trait-targetforms-loader-parity: OK');
