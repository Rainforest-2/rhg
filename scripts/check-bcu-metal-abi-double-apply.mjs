// Regression: AB_METALIC (metal-by-ability, no metal trait) must apply the BCU metal
// crit-cap / metalKiller block exactly ONCE.
//
// The base DamageAbilityResolver.isTargetMetalForDamage already treats an AB_METALIC
// target as metal for every NON dog-player attacker, so it runs the full metal block.
// DamageAbilityResolverMetalAbiPatch exists only to cover the dog-player attacker case
// (where the base keys metal off the trait flag, not AB_METALIC). Before the guard, the
// patch also fired for enemy-side attackers on top of the base, doubling the metalKiller
// health-percent burst (700 -> 1200) and re-rolling crit (desyncing the RNG stream).
import assert from 'node:assert/strict';
import { DamageAbilityResolver } from '../js/battle/DamageAbilityResolver.js';
import '../js/battle/DamageAbilityResolverMetalAbiPatch.js';

const AB_METALIC = 16;
const rngPass = () => 0; // critical roll always succeeds (prob 100)

function metalTarget(side) {
  return { side, hp: 1000, traitFlags: {}, bcuCombatModel: { ability: { abi: AB_METALIC } } };
}
function metalAttacker(side) {
  return { side, bcuCombatModel: { proc: { critical: { prob: 100 }, metalKiller: { mult: 50 } } } };
}

function countMetalKiller(result) {
  const details = result.appliedDetails || result.steps || [];
  return details.filter((d) => d && d.key === 'metalKiller').length;
}

// Enemy attacker: the base resolver owns AB_METALIC; the patch must NOT fire again.
const enemy = DamageAbilityResolver.resolve({
  attacker: metalAttacker('cat-enemy'),
  target: metalTarget('dog-player'),
  baseDamage: 100,
  targetType: 'actor',
  event: {},
  context: { random: rngPass }
});
assert.equal(enemy.finalDamage, 700, `enemy attacker AB_METALIC should be 200 crit + 500 metalKiller = 700 (single application), got ${enemy.finalDamage}`);
assert.equal(enemy.applied.metalKiller, true, 'enemy attacker metalKiller should apply once');
assert.equal(countMetalKiller(enemy), 1, `metalKiller must be applied exactly once, got ${countMetalKiller(enemy)}`);
assert.ok(!(enemy.debug && enemy.debug.metalAbiPatch), 'metal-abi patch must not run for enemy-side attacker');

// Dog-player attacker: the base ignores AB_METALIC (trait-keyed), so the patch supplies
// the single metal block. Same BCU-correct total as the enemy path.
const player = DamageAbilityResolver.resolve({
  attacker: metalAttacker('dog-player'),
  target: metalTarget('cat-enemy'),
  baseDamage: 100,
  targetType: 'actor',
  event: {},
  context: { random: rngPass }
});
assert.equal(player.finalDamage, 700, `dog-player attacker AB_METALIC should total 700 (single application), got ${player.finalDamage}`);
assert.equal(player.applied.metalKiller, true, 'dog-player metalKiller should apply once');
assert.ok(player.debug && player.debug.metalAbiPatch, 'metal-abi patch should run for the dog-player attacker case');

// Force the base resolver's non-metal roll to fail and the AB_METALIC patch roll
// to pass so this exercises the patch's multiplier path, not the base path.
const criticalDraws = [0.99, 0];
const modifiedCritical = DamageAbilityResolver.resolve({
  attacker: {
    side: 'dog-player',
    bcuCombatModel: { proc: { critical: { prob: 50, mult: 500 } } }
  },
  target: metalTarget('cat-enemy'),
  baseDamage: 100,
  targetType: 'actor',
  event: {},
  context: { random: () => criticalDraws.shift() ?? 0 }
});
assert.equal(modifiedCritical.finalDamage, 500, 'AB_METALIC patch must use modified CRIT.mult=500');
assert.equal(modifiedCritical.debug?.metalAbiPatch, true);
assert.equal(
  modifiedCritical.appliedDetails.find((item) => item.key === 'critical')?.mult,
  500,
  'AB_METALIC patch diagnostics expose the modified critical multiplier'
);

// Runtime wiring: the patch is self-installing, but only if something imports it.
// It must stay in the battle-core boot group or the browser never applies it.
{
  const { readFileSync } = await import('node:fs');
  const group = readFileSync('js/boot/groups/battleCorePatches.js', 'utf8');
  assert.ok(group.includes('DamageAbilityResolverMetalAbiPatch.js'),
    'battleCorePatches boot group must import DamageAbilityResolverMetalAbiPatch.js (runtime wiring)');
}

console.log('check-bcu-metal-abi-double-apply: OK');
