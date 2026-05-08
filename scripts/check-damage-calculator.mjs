import fs from 'node:fs';
import assert from 'node:assert/strict';
import { DamageCalculator } from '../js/battle/DamageCalculator.js';

const results = [];
const ok = (name, pass, detail='') => { results.push({name, pass, detail}); if (!pass) throw new Error(`${name}${detail ? `: ${detail}` : ''}`); };

ok('DamageCalculator.js exists', fs.existsSync('js/battle/DamageCalculator.js'));
let r = DamageCalculator.calculate({ event: { damage: 100 } });
assert.equal(r.finalDamage, 100); ok('event.damage preferred', true);
r = DamageCalculator.calculate({ attacker: { damage: 123 } });
assert.equal(r.finalDamage, 123); ok('attacker.damage fallback', true);
r = DamageCalculator.calculate({ event: { damage: -9 } });
assert.equal(r.finalDamage, 0); ok('damage non-negative', true);
r = DamageCalculator.calculate({ event: { damage: 12.6 } });
assert.equal(r.finalDamage, 13); ok('damage rounded integer', true);
r = DamageCalculator.calculate({ event: { damage: 10 } });
assert.equal(r.multiplier, 1); ok('default multiplier 1', true);
assert.equal(r.applied.baseDestroyer, false); assert.equal(r.applied.critical, false); assert.equal(r.applied.metal, false); assert.equal(r.applied.resistant, false); assert.equal(r.applied.massiveDamage, false); assert.equal(r.applied.tough, false); ok('default applied flags off', true);
r = DamageCalculator.calculate({ event: { damage: 50 }, targetType: 'base' });
assert.equal(r.finalDamage, 50); ok('base target default unchanged', true);
r = DamageCalculator.calculate({ attacker: { stageMagnification: { attackMagnification: 150 } }, event: { damage: 10 } });
ok('stage magnification note included', r.modifiers.notes.includes('stage-magnification-already-applied-to-stats'));
assert.deepEqual(DamageCalculator.getTargetTraits({ traits: ['red'] }), ['red']);
assert.deepEqual(DamageCalculator.getTargetTraits({ traitFlags: { red: true, black: false } }), ['red']);
assert.deepEqual(DamageCalculator.getTargetTraits(null), []); ok('getTargetTraits safe', true);
assert.deepEqual(DamageCalculator.getAttackerAbilities({ abilities: { strong: true } }), { strong: true });
assert.deepEqual(DamageCalculator.getAttackerAbilities(null), {}); ok('getAttackerAbilities safe', true);

const sceneText = fs.readFileSync('js/battle/BattleScene.js', 'utf8');
ok('BattleScene imports DamageCalculator', sceneText.includes("import { DamageCalculator } from './DamageCalculator.js';"));
ok('queueAttackDamage uses calculate', sceneText.includes('DamageCalculator.calculate({'));
ok('damageQueued has base/final/multiplier', sceneText.includes("type:'damageQueued'") && sceneText.includes('baseDamage:damageResult.baseDamage') && sceneText.includes('finalDamage:damageResult.finalDamage') && sceneText.includes('damageMultiplier:damageResult.multiplier'));
ok('baseDamageQueued has base/final/multiplier', sceneText.includes("type:'baseDamageQueued'") && sceneText.includes('baseDamage:damageResult.baseDamage') && sceneText.includes('finalDamage:damageResult.finalDamage') && sceneText.includes('damageMultiplier:damageResult.multiplier'));
ok('getStatsSourceReport includes damageCalculation', sceneText.includes('damageCalculation:actor.lastDamageCalculation?'));

ok('forbidden runtime files not added', !['js/battle/ProcResolver.js','js/battle/AbilityModel.js','js/battle/KBRuntime.js','js/battle/EffectRuntime.js'].some((p) => fs.existsSync(p)));

console.log('check-damage-calculator: OK');
for (const row of results) console.log(` - ${row.name}`);
