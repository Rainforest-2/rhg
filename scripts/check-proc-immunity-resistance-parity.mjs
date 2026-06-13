import assert from 'node:assert/strict';
import { applyBcuProcDistance, applyBcuProcDuration, applyBcuProcPercent, getBcuResistValue, resolveBcuProcResistance } from '../js/battle/bcu-runtime/BcuResistRuntime.js';
import { BCU_ABI, BCU_TRAITS } from '../js/battle/BcuCombatModel.js';

const fullFreeze = resolveBcuProcResistance({ target: { side: 'dog-player' }, procName: 'IMUSTOP', procResist: 100 });
assert.equal(fullFreeze.implemented, true, 'BcuResistRuntime reports implemented for supported proc fields');
assert.equal(fullFreeze.full, true, 'full freeze immunity blocks proc');
assert.equal(fullFreeze.factor, 0, 'full immunity factor is zero');
assert.equal(fullFreeze.breakdown.fieldImmunity.value, 100, 'full immunity source is isolated in breakdown');
assert.equal(fullFreeze.breakdown.partialResistance.value, 0, 'full immunity is not mislabeled as partial resistance');

assert.equal(applyBcuProcDuration({ rawTime: 120, resist: 50 }), 60, 'partial freeze resistance reduces duration');
assert.equal(applyBcuProcDistance({ rawDistance: 165, resist: 40 }), 99, 'partial knockback resistance reduces distance');
assert.equal(applyBcuProcPercent({ rawPercent: 35, resist: 20 }), 28, 'partial toxic resistance reduces percent');
const partialFreeze = resolveBcuProcResistance({ target: { side: 'dog-player' }, procName: 'IMUSTOP', procResist: 50 });
assert.equal(partialFreeze.breakdown.partialResistance.value, 50, 'partial duration resistance source is isolated in breakdown');
const partialDistance = resolveBcuProcResistance({ target: { side: 'dog-player' }, procName: 'IMUKB', procResist: 40 });
assert.equal(partialDistance.breakdown.partialResistance.value, 40, 'partial distance resistance source is isolated in breakdown');
const partialToxic = resolveBcuProcResistance({ target: { side: 'dog-player' }, procName: 'IMUPOIATK', procResist: 20 });
assert.equal(partialToxic.breakdown.partialResistance.value, 20, 'partial toxic percent resistance source is isolated in breakdown');

const sageEnemy = getBcuResistValue({
  target: { side: 'cat-enemy', bcuCombatModel: { kind: 'enemy', traits: { flags: { [BCU_TRAITS.sage]: true } } } },
  attacker: { side: 'dog-player', bcuAbi: 0 },
  procName: 'IMUSTOP',
  procResist: 0
});
assert.equal(sageEnemy.factor, 0.3, 'enemy sage target applies 70% status resistance without AB_SKILL');
assert.equal(sageEnemy.effectiveBlock, 70, 'enemy sage effective block is exposed as percent');
assert.equal(sageEnemy.breakdown.sageResistance.value, 70, 'enemy sage resistance source is isolated in breakdown');
assert.equal(sageEnemy.breakdown.sageResistance.bypassedBySkill, false, 'enemy sage resistance is not bypassed without AB_SKILL');

const sageBypass = getBcuResistValue({
  target: { side: 'cat-enemy', bcuCombatModel: { kind: 'enemy', traits: { flags: { [BCU_TRAITS.sage]: true } } } },
  attacker: { side: 'dog-player', bcuAbi: BCU_ABI.AB_SKILL },
  procName: 'IMUSTOP',
  procResist: 0
});
assert.equal(sageBypass.factor, 1, 'AB_SKILL bypasses enemy sage status resistance');
assert.equal(sageBypass.breakdown.sageResistance.bypassedBySkill, true, 'AB_SKILL bypass is recorded in breakdown');

const unitHunter = getBcuResistValue({
  target: { side: 'dog-player', bcuCombatModel: { kind: 'unit', ability: { abi: BCU_ABI.AB_SKILL } } },
  attack: { traits: [BCU_TRAITS.sage] },
  procName: 'IMUSLOW',
  procResist: 0
});
assert.equal(Math.round(unitHunter.factor * 100), 30, 'unit AB_SKILL reduces sage-source status by SUPER_SAGE_HUNTER_RESIST');
assert.equal(unitHunter.breakdown.sageResistance.value, 70, 'unit AB_SKILL sage-source resistance is recorded in breakdown');

const unsupportedOrb = getBcuResistValue({
  target: { side: 'dog-player', bcuTalentOrbResistance: { IMUSTOP: 30 } },
  procName: 'IMUSTOP',
  procResist: 0
});
assert.equal(unsupportedOrb.factor, 1, 'future talent/orb source is not silently applied');
assert.deepEqual(unsupportedOrb.unsupportedSources, ['talent-orb-resistance'], 'future talent/orb source is documented as unsupported');
assert.equal(unsupportedOrb.breakdown.talentOrbResistance.implemented, false, 'future talent/orb branch remains explicitly unimplemented');

// Equipped resist orbs (the proven source-backed path) fold into field immunity
// additively, capped at 100 — mirrors EUnit.processAbilityOrbs ORB_*_RESIST.
// ORB_STOP_RESIST grade 2 => ORB_RESIST_MULT[2] = 20.
const orbStop = getBcuResistValue({
  target: { side: 'dog-player', bcuEquippedOrbs: [{ type: 20, grade: 2 }] },
  procName: 'IMUSTOP',
  procResist: 0
});
assert.equal(orbStop.breakdown.orbEquipmentResistance.value, 20, 'ORB_STOP_RESIST grade 2 contributes ORB_RESIST_MULT[2]=20');
assert.equal(orbStop.breakdown.orbEquipmentResistance.implemented, true, 'equipped-orb resistance is implemented');
assert.equal(orbStop.resist, 20, 'orb resistance reduces incoming status by its mult (resist = 20)');
assert.ok(Math.abs(orbStop.factor - 0.8) < 1e-9, 'orb resistance field factor is 1 - resist/100');
assert.ok(orbStop.notes.includes('orb-equipment-status-resist-applied'), 'orb resistance application is noted');

// CSV field immunity and orb resistance stack additively, capped at 100.
const orbStacked = getBcuResistValue({
  target: { side: 'dog-player', bcuEquippedOrbs: [{ type: 6, grade: 4 }] }, // ORB_WAVE_RESIST grade 4 => 50
  procName: 'IMUWAVE',
  procResist: 60
});
assert.equal(orbStacked.resist, 100, 'CSV 60 + orb 50 caps at 100 (min(100, ...))');
assert.equal(orbStacked.factor, 0, 'capped resistance is full immunity (factor 0)');

// A resist orb of a different family does not affect this proc.
const orbMismatch = getBcuResistValue({
  target: { side: 'dog-player', bcuEquippedOrbs: [{ type: 8, grade: 4 }] }, // ORB_KB_RESIST
  procName: 'IMUSTOP',
  procResist: 0
});
assert.equal(orbMismatch.breakdown.orbEquipmentResistance.value, 0, 'wrong-family resist orb contributes nothing');
assert.equal(orbMismatch.factor, 1, 'wrong-family resist orb leaves resistance unchanged');

console.log('check-proc-immunity-resistance-parity: OK');
