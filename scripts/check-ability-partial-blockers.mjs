import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../js/battle/BcuDelayRuntimePatch.js';
import { BcuCombatModel } from '../js/battle/BcuCombatModel.js';
import { ProcResolver } from '../js/battle/ProcResolver.js';
import { DamageAbilityResolver } from '../js/battle/DamageAbilityResolver.js';

function raw(length, entries) {
  const out = Array.from({ length }, () => 0);
  for (const [index, value] of entries) out[index] = value;
  return out;
}

const enemy = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [
  [43, 2], [44, 400],
  [111, 45], [112, 8]
]) });

assert.equal(enemy.proc.burrow.count, 2, 'enemy burrow parser reads DataEnemy.ints[43]');
assert.equal(enemy.proc.burrow.dis, 100, 'enemy burrow distance parser applies /4 to DataEnemy.ints[44]');
assert.equal(enemy.proc.delay.prob, 45, 'enemy delay parser reads DataEnemy.ints[111]');
assert.equal(enemy.proc.delay.strength, 8, 'enemy delay parser reads DataEnemy.ints[112]');

const catalog = ProcResolver.getProcCatalog();
assert.equal(catalog.delay?.implemented, true, 'delay runtime owner is proven and registered after BcuDelayRuntimePatch import');
assert.ok(String(catalog.delay?.runtime || '').includes('BcuDelayRuntime'), 'delay catalog records BcuDelayRuntime owner');
assert.equal(Object.hasOwn(catalog, 'burrow'), false, 'burrow is an Entity lifecycle, not an attack ProcResolver runtime catalog entry');

const probe = DamageAbilityResolver.resolve({
  attacker: { side: 'dog-player', traits: ['red'], stats: { bcuCombatModel: BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, []) }) } },
  target: { side: 'cat-enemy', traits: ['red'], stats: { bcuCombatModel: BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, []) }) } },
  targetType: 'actor',
  baseDamage: 100,
  context: { random: () => 1 }
});

const omitted = probe.implementationStatus?.omittedRuntimeState || [];
assert.ok(omitted.includes('orbs'), 'damage resolver still reports missing orb runtime state');
assert.ok(omitted.includes('combos'), 'damage resolver still reports missing combo runtime state');
assert.ok(omitted.includes('full Trait targetForms special cases'), 'damage resolver still reports missing targetForms cases');
assert.ok(omitted.includes('sage status resistance'), 'damage resolver still reports missing sage status-resistance scope');

const doc = readFileSync('docs/ability-logic/current-ability-parity-status.md', 'utf8');
for (const phrase of [
  '`P_DELAY`',
  'code-complete-candidate',
  'burrow | `code-complete-candidate`',
  'combo / orb / treasure / talent / PCoin damage modifiers | `needs-loader-backed-fixtures`',
  'AB_SKILL status resistance side | `partial`',
  'death surge / zombie corpse interaction | `partial`'
]) {
  assert.ok(doc.includes(phrase), `status doc includes ${phrase}`);
}

console.log('check-ability-partial-blockers: OK');
