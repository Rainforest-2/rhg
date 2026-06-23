// Deterministic check: a real BCU custom-pack special-Trait FILE
// (name/id/targetType/targetForms) is loaded and drives the single trait
// compatibility gate across the proc and target-only cross-paths.
//
// BCU facts:
// - util/unit/Trait.java: name, Identifier id, boolean targetType, ArrayList<Form> targetForms.
// - battle/data/DataUnit.getTraits(): adds a user-pack trait to a unit when
//   trait.targetForms.contains(form) || (trait.targetType && Trait.isTargetTraited(traits)).
// - Entity.checkTouch()/AB_ONLY uses traitCompatible; AtkModel proc application
//   also requires traitCompatible. rhg routes all of these through the single
//   bcuTraitCompatible() owner (BattleAttackResolver / ProcResolver / touch).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  bcuTraitCompatible,
  describeBcuTraitCompatibility,
  hasTargetOnly
} from '../js/battle/BcuTraitCompatibility.js';
import { ProcResolver } from '../js/battle/ProcResolver.js';
import { BCU_ABI } from '../js/battle/BcuCombatModel.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, 'fixtures', 'bcu-custom-pack', 'special-traits.json');
const pack = JSON.parse(readFileSync(fixturePath, 'utf8'));
const [formTrait, targetTypeTrait] = pack.traits;

assert.ok(Array.isArray(formTrait.targetForms) && formTrait.targetForms.length === 1, 'fixture form-trait carries a real targetForms list');
assert.equal(formTrait.targetType, false, 'fixture form-trait is not a target-type trait');
assert.equal(targetTypeTrait.targetType, true, 'fixture target-type trait flips targetType');

const ALL_TARGET_TRAITED = ['red', 'floating', 'black', 'angel', 'alien', 'zombie'];

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

// --- 1. targetForms branch (file-loaded trait on the target) -----------------
{
  const target = enemyTarget({ traits: ['black'], specialEntries: [formTrait] });
  const hit = unitAttacker({ slotId: 'cat-unit-042-f', attackTraits: ['red'] });
  const miss = unitAttacker({ slotId: 'cat-unit-099-f', attackTraits: ['red'] });
  assert.equal(bcuTraitCompatible({ attacker: hit, target }), true, 'targetForms trait makes a form-042 attacker compatible (no normal red/black match)');
  assert.equal(bcuTraitCompatible({ attacker: miss, target }), false, 'a form-099 attacker is not in the loaded targetForms list -> incompatible');
}

// --- 2. target-type trait on the target + target-traited attacker -----------
{
  const target = enemyTarget({ traits: ['metal'], specialEntries: [targetTypeTrait] });
  const traited = unitAttacker({ attackTraits: ALL_TARGET_TRAITED });
  const notTraited = unitAttacker({ attackTraits: ALL_TARGET_TRAITED.slice(0, 5) });
  assert.equal(bcuTraitCompatible({ attacker: traited, target }), true, 'loaded targetType trait + fully target-traited attacker -> compatible');
  assert.equal(bcuTraitCompatible({ attacker: notTraited, target }), false, 'missing one target trait -> attacker is not target-traited -> incompatible');
}

// --- 3. target-type trait carried by the attacker, target is target-traited --
{
  const target = enemyTarget({ traits: ALL_TARGET_TRAITED, specialEntries: [] });
  const partialTarget = enemyTarget({ traits: ALL_TARGET_TRAITED.slice(0, 5), specialEntries: [] });
  const attacker = unitAttacker({ attackTraits: [targetTypeTrait] });
  assert.equal(bcuTraitCompatible({ attacker, target }), true, 'attacker targetType trait hits a fully target-traited target');
  assert.equal(bcuTraitCompatible({ attacker, target: partialTarget }), false, 'attacker targetType trait misses a non-target-traited target');
}

// --- 4. proc cross-path: the same gate skips procs to incompatible targets ---
{
  const proc = { slow: { prob: 100, time: 60 } };
  const target = enemyTarget({ traits: ['black'], specialEntries: [formTrait] });
  const compatible = unitAttacker({ slotId: 'cat-unit-042-f', attackTraits: ['red'], proc });
  const incompatible = unitAttacker({ slotId: 'cat-unit-099-f', attackTraits: ['red'], proc });
  const event = { hitIndex: 0, key: 'hit-0', bcuHitAbi: 1 };
  const context = { random: () => 0 };

  const blocked = ProcResolver.resolve({ attacker: incompatible, target, targetType: 'actor', event, context });
  const blockedSlow = blocked.skipped.find((s) => s.key === 'slow');
  assert.ok(blockedSlow, 'slow proc is evaluated for the incompatible target');
  assert.equal(blockedSlow.reason, 'target-trait-incompatible', 'slow proc is skipped because the special-trait gate is incompatible');

  const allowed = ProcResolver.resolve({ attacker: compatible, target, targetType: 'actor', event, context });
  const allowedSkipForTrait = allowed.skipped.find((s) => s.key === 'slow' && s.reason === 'target-trait-incompatible');
  assert.equal(allowedSkipForTrait, undefined, 'slow proc is not trait-blocked once the loaded targetForms trait makes the attacker compatible');
}

// --- 5. target-only cross-path: AB_ONLY + special-trait compatibility --------
{
  const target = enemyTarget({ traits: ['black'], specialEntries: [formTrait] });
  const compatible = unitAttacker({ slotId: 'cat-unit-042-f', attackTraits: ['red'], abi: BCU_ABI.AB_ONLY });
  const incompatible = unitAttacker({ slotId: 'cat-unit-099-f', attackTraits: ['red'], abi: BCU_ABI.AB_ONLY });
  assert.equal(hasTargetOnly(compatible), true, 'AB_ONLY attacker reports Target Only');
  assert.equal(describeBcuTraitCompatibility({ attacker: compatible, target, targetOnly: true }).compatible, true, 'Target Only attacker can hit a special-trait-compatible target');
  assert.equal(describeBcuTraitCompatibility({ attacker: incompatible, target, targetOnly: true }).compatible, false, 'Target Only attacker cannot hit an incompatible target');
}

console.log('check-bcu-trait-targetforms-loader-parity: OK');
