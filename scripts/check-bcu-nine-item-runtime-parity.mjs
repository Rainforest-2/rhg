import assert from 'node:assert/strict';
import { BattleActor } from '../js/battle/BattleActor.js';
import '../js/battle/BattleActorZombieRevivePatch.js';
import { BCU_ABI, BCU_TRAITS } from '../js/battle/BcuCombatModel.js';
import { bcuTraitCompatible } from '../js/battle/BcuTraitCompatibility.js';
import { DamageAbilityResolver } from '../js/battle/DamageAbilityResolver.js';
import { applyTalentToStats } from '../js/battle/bcu-runtime/BcuTalentInfoData.js';
import { attachBcuProcObjectSummonsToAttackHits, normalizeBcuSummonProc } from '../js/battle/bcu-runtime/BcuSummonRuntime.js';

const antiTraited = [BCU_TRAITS.red, BCU_TRAITS.floating, BCU_TRAITS.black, BCU_TRAITS.angel, BCU_TRAITS.alien, BCU_TRAITS.zombie];

function flags(list) {
  return Object.fromEntries(list.map((key) => [key, true]));
}

function unit({ abi = 0, targetTraits = antiTraited, slotId = 'cat-unit-001-f', combo = null, stats = {} } = {}) {
  return {
    side: 'dog-player',
    slotId,
    rawStats: {
      bcuComboModifiers: combo,
      bcuCombatModel: {
        kind: 'unit',
        formRow: 0,
        traits: { list: targetTraits, flags: flags(targetTraits) },
        targetTraits: { list: targetTraits, flags: flags(targetTraits) },
        ability: { abi, flags: {} },
        proc: {}
      },
      ...stats
    }
  };
}

function enemy({ traits = [], specialTraits = [], slotId = 'enemy-special' } = {}) {
  return {
    side: 'cat-enemy',
    slotId,
    bcuSpecialTraits: specialTraits,
    rawStats: {
      bcuCombatModel: {
        kind: 'enemy',
        traits: { list: traits, flags: flags(traits), entries: [...traits, ...specialTraits] },
        ability: { abi: 0, flags: {} },
        proc: {}
      }
    }
  };
}

{
  const attacker = unit({ targetTraits: [{ key: 'anti-traited-special', targetType: true }] });
  const target = enemy({ traits: antiTraited });
  assert.equal(bcuTraitCompatible({ attacker, target, targetType: 'actor', targetOnly: true }), true, 'Trait.targetType attacker branch matches anti-traited target');
  const mismatchAttacker = unit({ targetTraits: ['red'] });
  mismatchAttacker.side = 'cat-player';
  assert.equal(bcuTraitCompatible({ attacker: mismatchAttacker, target: enemy({ traits: ['black'] }), targetType: 'actor', targetOnly: true }), false, 'ordinary trait mismatch stays incompatible outside the existing dog-mirror shortcut');
}

{
  const attacker = unit({ abi: BCU_ABI.AB_MASSIVE, targetTraits: antiTraited });
  const target = enemy({ specialTraits: [{ key: 'custom-special', targetType: true }] });
  const result = DamageAbilityResolver.resolve({ attacker, target, targetType: 'actor', baseDamage: 100 });
  assert.equal(result.finalDamage, 300, 'EEnemy.getDamage targetType special trait contributes to damage-family compatibility');
}

{
  const attacker = unit({ abi: BCU_ABI.AB_MASSIVE, targetTraits: ['red'], slotId: 'cat-unit-001-f' });
  const target = enemy({ specialTraits: [{ key: 'form-special', targetForms: ['cat-unit-001-f'] }] });
  const result = DamageAbilityResolver.resolve({ attacker, target, targetType: 'actor', baseDamage: 100 });
  assert.equal(result.finalDamage, 300, 'Trait.targetForms contributes to damage-family compatibility for the listed form only');
  const miss = DamageAbilityResolver.resolve({ attacker: unit({ abi: BCU_ABI.AB_MASSIVE, targetTraits: ['red'], slotId: 'cat-unit-002-f' }), target, targetType: 'actor', baseDamage: 100 });
  assert.equal(miss.finalDamage, 100, 'Trait.targetForms does not broaden unrelated forms');
}

{
  const combo = { increments: { massive: 10, witchKiller: 100, villainKiller: 1 } };
  const massive = DamageAbilityResolver.resolve({
    attacker: unit({ abi: BCU_ABI.AB_MASSIVE, targetTraits: [BCU_TRAITS.red], combo }),
    target: enemy({ traits: [BCU_TRAITS.red] }),
    targetType: 'actor',
    baseDamage: 100
  });
  assert.equal(massive.finalDamage, 440, 'C_MASSIVE combo increment is consumed by getOrbMassiveFactor');

  const witch = DamageAbilityResolver.resolve({
    attacker: unit({ abi: BCU_ABI.AB_WKILL, targetTraits: [BCU_TRAITS.witch], combo }),
    target: enemy({ traits: [BCU_TRAITS.witch] }),
    targetType: 'actor',
    baseDamage: 100
  });
  assert.equal(witch.finalDamage, 500, 'C_WKILL combo increment drives Treasure.getWKAtk');

  const villainAttack = DamageAbilityResolver.resolve({
    attacker: unit({ targetTraits: [BCU_TRAITS.villain], combo }),
    target: enemy({ traits: [BCU_TRAITS.villain] }),
    targetType: 'actor',
    baseDamage: 100
  });
  assert.equal(villainAttack.finalDamage, 250, 'C_VKILL combo increment grants AB_VKILL attack multiplier');

  const villainDefense = DamageAbilityResolver.resolve({
    attacker: enemy({ traits: [BCU_TRAITS.villain] }),
    target: unit({ combo }),
    targetType: 'actor',
    baseDamage: 100
  });
  assert.equal(villainDefense.finalDamage, 40, 'C_VKILL combo increment grants AB_VKILL defense multiplier');
}

{
  const base = {
    hp: 1000,
    maxHp: 1000,
    damage: 100,
    speed: 10,
    tbaFrames: 60,
    bcuCombatModel: {
      kind: 'unit',
      traits: { list: [], flags: {} },
      targetTraits: { list: [], flags: {} },
      ability: { abi: 0, flags: {} },
      proc: {}
    }
  };
  const info = [
    [5, 1, 0, 0],     // PC_AB AB_GOOD
    [18, 1, 40, 40],  // PC_P IMUWEAK partial resistance
    [44, 1, 0, 0],    // PC_IMU IMUWEAK full immunity
    [33, 1, 0, 0],    // PC_TRAIT red target
    [27, 1, 3, 3],    // PC_BASE speed
    [61, 1, 20, 20]   // PC_BASE TBA
  ];
  const out = applyTalentToStats(base, info, [1, 1, 1, 1, 1, 1]);
  assert.equal((out.bcuCombatModel.ability.abi & BCU_ABI.AB_GOOD) !== 0, true, 'PC_AB talent adds battle ability bits');
  assert.equal(out.bcuCombatModel.proc.IMUWEAK.mult, 100, 'PC_IMU talent overrides matching resistance field to full immunity');
  assert.equal(out.traitFlags.red, true, 'PC_TRAIT talent adds target trait');
  assert.equal(out.speed, 13, 'PC_BASE speed talent mutates battle speed');
  assert.equal(out.tbaFrames, 48, 'PC_BASE TBA talent reduces attack interval frames');
}

{
  const stats = { attackHits: [{ hitIndex: 0, damage: 1 }] };
  const out = attachBcuProcObjectSummonsToAttackHits(stats, {
    atks: [{ proc: { SUMMON: { prob: 100, id: { cls: 'Unit', id: 7 }, form: 1, mult: 10, type: 0 } } }]
  });
  assert.equal(out.attackHits[0].summon.prob, 100, 'custom/proc-object SUMMON loader attaches per-hit summon holder');
  assert.equal(normalizeBcuSummonProc(out.attackHits[0].summon).kind, 'unit', 'attached proc remains normalizable by summon runtime');
}

function actor(id, model) {
  const a = new BattleActor({
    assetDef: { id },
    side: 'cat-enemy',
    x: 1000,
    y: 0,
    direction: 1,
    stats: {
      hp: 100,
      damage: 10,
      speed: 0,
      detectionRange: 100,
      range: 100,
      width: 40,
      bcuCombatModel: model
    },
    animations: {}
  });
  a.instanceId = id;
  a.maxHp = 100;
  return a;
}

{
  const target = actor('extra-revive-target', {
    kind: 'enemy',
    traits: { list: [], flags: {} },
    ability: { abi: 0, flags: {} },
    proc: { revive: { count: 0, time: 0, health: 0 } }
  });
  target.bcuZombieExtraReviveSources = [{ reviveOthers: true, count: 1, timeFrames: 5, healthPercent: 40 }];
  target.takeDamage(200, { timeMs: 0, damageCalculation: { abilityDebug: { eventAbilitySemantic: {} } } });
  const result = target.resolvePostDamage({ nowMs: 0, tuning: { finalKnockbackBeforeDeath: false } });
  assert.equal(result.zombieReviveScheduled, true, 'explicit extra revive source can schedule custom revive without normal CSV revive');
  assert.equal(target.lastBcuZombieReviveDebug.mode, 'extra-revive', 'extra revive scheduling is traceable');
  assert.equal(target.hp, 40, 'extra revive uses max health percent from the source');
}

console.log('check-bcu-nine-item-runtime-parity: OK');
