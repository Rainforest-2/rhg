import { readFileSync, existsSync } from 'node:fs';
import { DamageAbilityResolver } from '../js/battle/DamageAbilityResolver.js';
import { DamageCalculator } from '../js/battle/DamageCalculator.js';
import { BATTLE_CONFIG } from '../js/battle/BattleConfig.js';

const fail = (message) => { throw new Error(message); };
const rngPass = () => 0;
const rngFail = () => 0.99;

if (!existsSync('js/battle/DamageAbilityResolver.js')) fail('missing resolver file');

let r = DamageAbilityResolver.resolve({ baseDamage: 100, event: {}, context: { random: rngPass } });
if (r.enabled !== true || r.finalDamage !== 100 || r.multiplier !== 1) fail('default resolver should be enabled x1 with no abilities');
if (!r.notes.includes('no-bcu-damage-ability-applied')) fail('default no-op note missing');

r = DamageAbilityResolver.resolve({
  attacker: { bcuCombatModel: { proc: { critical: { prob: 100, mult: 200 } } } },
  target: { traitFlags: {} },
  baseDamage: 100,
  targetType: 'actor',
  event: {},
  context: { random: rngPass }
});
if (r.finalDamage !== 200 || !r.applied.critical) fail('critical proc did not apply from BCU proc model');

r = DamageAbilityResolver.resolve({
  attacker: { bcuCombatModel: { proc: { critical: { prob: 50, mult: 200 } } } },
  target: { traitFlags: {} },
  baseDamage: 100,
  targetType: 'actor',
  event: {},
  context: { random: rngFail }
});
if (r.finalDamage !== 100 || r.applied.critical) fail('critical probability failure should leave damage unchanged');

r = DamageAbilityResolver.resolve({
  attacker: { bcuCombatModel: { proc: { baseDestroyer: { mult: 300 } } } },
  baseDamage: 100,
  targetType: 'base',
  event: {},
  context: { random: rngPass }
});
if (r.finalDamage !== 400 || !r.applied.baseDestroyer) fail('baseDestroyer multiplier failed');

r = DamageAbilityResolver.resolve({
  attacker: { side: 'dog-player', bcuCombatModel: { kind: 'unit', proc: { critical: { prob: 0 } } } },
  target: { side: 'cat-enemy', traitFlags: { metal: true }, bcuCombatModel: { kind: 'enemy', traits: { list: ['metal'], flags: { metal: true } } } },
  baseDamage: 100,
  targetType: 'actor',
  event: {},
  context: { random: rngPass }
});
if (r.finalDamage !== 1 || !r.applied.metal) fail('metal non-critical cap failed');

let d = DamageCalculator.calculate({ attacker: { damage: 120 }, target: {}, event: {}, context: { config: BATTLE_CONFIG, random: rngPass } });
if (d.finalDamage !== 120) fail('default damage changed');

const strengthened = { damage: 120, bcuStrengthenActive: true, bcuStrengthenMultiplier: 100 };
d = DamageCalculator.calculate({ attacker: strengthened, target: {}, event: {}, context: { config: BATTLE_CONFIG, random: rngPass } });
if (d.finalDamage !== 240 || !d.applied.strengthen) fail('strengthen did not change damage');

const scene = readFileSync('js/battle/BattleScene.js', 'utf8');
const calc = readFileSync('js/battle/DamageCalculator.js', 'utf8');
if (!scene.includes('config:BATTLE_CONFIG')) fail('BattleScene missing config context');
if (!scene.includes('abilityResolver:{enabled:!!damageResult.abilityResolver?.enabled')) fail('event missing abilityResolver');
if (!scene.includes('damageCalculation?.abilityResolver') && !scene.includes('lastDamageCalculation?.abilityResolver')) fail('stats report missing abilityResolver summary');
if (calc.match(/abilityEnabledBits.*critical|rawAbi.*critical|enabledBits.*baseDestroyer|rawAbi.*baseDestroyer/)) fail('raw bits drive semantic ability');
if (!existsSync('js/battle/ProcResolver.js') || !existsSync('js/battle/KBRuntime.js') || !existsSync('js/battle/EffectRuntime.js')) fail('expected later runtime files missing');
const proc = readFileSync('js/battle/ProcResolver.js', 'utf8');
if (!proc.includes('pending-no-apply') || proc.includes('target.hp =')) fail('ProcResolver no-op contract broken');
console.log('ok: damage-ability-resolver checks passed');
