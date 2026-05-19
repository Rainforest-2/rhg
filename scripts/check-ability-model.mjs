import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { AbilityModel } from '../js/battle/AbilityModel.js';
import { DamageCalculator } from '../js/battle/DamageCalculator.js';

const checks = [];
const ok = (name) => checks.push({ name, ok: true });

assert.equal(existsSync(new URL('../js/battle/AbilityModel.js', import.meta.url)), true); ok('1');
assert.equal(AbilityModel.normalizeRawAbi('5.7'), 5);
assert.equal(AbilityModel.normalizeRawAbi('x'), 0); ok('2');
const bits = AbilityModel.decodeBitFlags(5);
assert.equal(bits.flags.bit0, true); assert.equal(bits.flags.bit2, true); ok('3');
const hit = AbilityModel.buildHitAbility({ hit: { abi: 5 } });
assert.equal(hit.rawAbi, 5); assert.deepEqual(hit.enabledBits, [0, 2]); ok('4');
assert.equal(Object.values(hit.semantic).some(Boolean), false); ok('5');
const model = AbilityModel.buildStatsAbilityModel({ stats: { attackHits: [{ abi: 1 }, { abi: 0 }] } });
assert.equal(model.attackAbilities.length, 2); ok('6');
const t1 = AbilityModel.normalizeTraits(['red', 'floating']); assert.equal(t1.flags.red, true); ok('7');
const t2 = AbilityModel.normalizeTraits({ red: 1, metal: 0 }); assert.deepEqual(t2.list, ['red']); ok('8');
const t3 = AbilityModel.normalizeTraits(null); assert.deepEqual(t3.list, []); ok('9');

const statsLoaderText = readFileSync(new URL('../js/battle/BattleStatsLoader.js', import.meta.url), 'utf8');
assert.match(statsLoaderText, /import \{ AbilityModel \} from '\.\/AbilityModel\.js';/); ok('10');
assert.match(statsLoaderText, /stats\.abilityModel = AbilityModel\.buildStatsAbilityModel/); ok('11');
const attackText = readFileSync(new URL('../js/battle/BattleAttackProfile.js', import.meta.url), 'utf8');
assert.match(attackText, /rawAbi:/); ok('12');
assert.match(attackText, /abilityMappingStatus:/); ok('13');
const factoryText = readFileSync(new URL('../js/battle/BattleActorFactory.js', import.meta.url), 'utf8');
assert.match(factoryText, /a\.abilityModel=/); ok('14');
const damageText = readFileSync(new URL('../js/battle/DamageCalculator.js', import.meta.url), 'utf8');
assert.match(damageText, /abilityDebug:/); ok('15');
const sceneText = readFileSync(new URL('../js/battle/BattleScene.js', import.meta.url), 'utf8');
assert.match(sceneText, /damageQueued[\s\S]*rawAbi:/); assert.match(sceneText, /baseDamageQueued[\s\S]*abilityMappingStatus:/); ok('16');
assert.match(sceneText, /abilityModel:/); ok('17');
assert.equal(existsSync(new URL('../js/battle/ProcResolver.js', import.meta.url)), true);
assert.equal(existsSync(new URL('../js/battle/KBRuntime.js', import.meta.url)), true);
assert.equal(existsSync(new URL('../js/battle/EffectRuntime.js', import.meta.url)), true);
const procText = readFileSync(new URL('../js/battle/ProcResolver.js', import.meta.url), 'utf8');
assert.match(procText, /ProcResolver\.v3-bcu-proc-roll-contract/);
assert.match(procText, /semantic-ability-true/);
assert.match(procText, /target-trait-incompatible/);
assert.doesNotMatch(procText, /target\.hp\s*=/);
ok('18');
const result = DamageCalculator.calculate({ attacker: { damage: 100 }, target: {}, targetType: 'actor', event: {} });
assert.equal(result.multiplier, 1); assert.equal(result.finalDamage, 100); ok('19');
const disallowed = ['BattleSceneRenderer','BattleCameraInputController','StageDefinitionLoader','BcuStageSpawnRuntime'];
for (const file of ['../js/battle/AbilityModel.js','../js/battle/BattleStatsLoader.js','../js/battle/BattleAttackProfile.js','../js/battle/BattleActorFactory.js','../js/battle/DamageCalculator.js']) {
  const txt = readFileSync(new URL(file, import.meta.url), 'utf8');
  for (const token of disallowed) assert.equal(txt.includes(token), false);
}
ok('20');

console.log(`check-ability-model: ${checks.length} checks passed`);
