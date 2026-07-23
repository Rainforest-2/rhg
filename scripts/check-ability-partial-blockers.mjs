import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
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
assert.ok(!omitted.includes('orbs'), 'damage resolver now consumes equipped orbs (see check-bcu-orb-resolver-consumption)');
assert.ok(omitted.includes('combo proc-duration/runtime sources'), 'damage resolver still reports remaining combo proc-duration/runtime sources');
assert.ok(omitted.includes('remaining Trait targetForms capture edge cases'), 'damage resolver still reports remaining targetForms capture edges');
assert.ok(omitted.includes('sage status resistance'), 'damage resolver still reports missing sage status-resistance scope');

// The current status document is the SSOT. Assert stable table rows rather than
// historical prose or obsolete PARTIAL labels from superseded documents.
const doc = readFileSync('docs/ability-logic/current-ability-parity-status.md', 'utf8');
for (const phrase of [
  '| P_DELAY | `human-visual-review-needed`',
  '| Burrow | `human-visual-review-needed`',
  '| SUMMON | `human-visual-review-needed`',
  '| `Trait.targetType/targetForms` compatibility | `verified-owner`',
  '| Crown selection propagation | `verified-owner`',
  '| Crown multiplier precision | `verified-owner`',
  '| Ranking/trail overtime and score | `verified-owner`',
  '| BCU save / lineup import-export | `out-of-scope`'
]) {
  assert.ok(doc.includes(phrase), `status doc includes ${phrase}`);
}

// Loader-backed evidence files must exist for the graduated rows.
for (const evidence of [
  'scripts/fixtures/bcu-custom-pack/summon-proc-object.json',
  'scripts/fixtures/bcu-custom-pack/special-traits.json',
  'scripts/fixtures/bcu-custom-pack/revive-proc-object.json',
  'scripts/check-bcu-summon-procobject-loader-parity.mjs',
  'scripts/check-bcu-trait-targetforms-loader-parity.mjs',
  'scripts/check-bcu-modifier-realdata-sweep-parity.mjs',
  'scripts/check-bcu-zombie-extra-revive-source-range-parity.mjs',
  'scripts/check-formation-storage-failure-visibility.mjs'
]) {
  assert.ok(existsSync(evidence), `loader-backed evidence present: ${evidence}`);
}

console.log('check-ability-partial-blockers: OK');
