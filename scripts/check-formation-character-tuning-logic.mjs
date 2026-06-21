import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FormationStore, DOG_DEFAULT_MAGNIFICATION_PERCENT } from '../js/battle/FormationStore.js';
import { resolveBcuUnitLevelConfig } from '../js/battle/bcu-runtime/BcuUnitLevelRuntime.js';

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => { memory.set(key, String(value)); },
  removeItem: (key) => { memory.delete(key); }
};

FormationStore.reset();
let formation = FormationStore.setCatUnitLevel('cat-unit-000-f', { level: 30, plusLevel: 12 });
assert.equal(formation.options.bcuCatUnitLevels['cat-unit-000-f'].level, 30);
assert.equal(formation.options.bcuCatUnitLevels['cat-unit-000-f'].plusLevel, 12);

const resolved = resolveBcuUnitLevelConfig({
  requested: { ...formation.options.bcuCatUnitLevels['cat-unit-000-f'] },
  metadata: { maxLevel: 20, maxPlusLevel: 10, rarity: 0, levelCurve: { lvs: Array(20).fill(20), source: 'test' } },
  source: 'test'
});
assert.equal(resolved.level, 20, 'individual normal level clamps to BCU maxLevel');
assert.equal(resolved.plusLevel, 10, 'individual plus level clamps to BCU maxPlusLevel');
assert.equal(resolved.effectiveLevel, 30);

formation = FormationStore.setDogUnitMagnification('dog-enemy-000', 250);
assert.equal(formation.options.dogUnitMagnifications['dog-enemy-000'].percent, 250);
formation = FormationStore.setDogUnitMagnification('dog-enemy-000', DOG_DEFAULT_MAGNIFICATION_PERCENT);
assert.equal(formation.options.dogUnitMagnifications['dog-enemy-000'], undefined, '100% dog magnification is stored as default/cleared');

formation = FormationStore.setOrbEquipment('cat-unit-000-f', [
  [1, 1, 4],
  [2, 2, 3],
  [3, 4, 2]
]);
assert.deepEqual(formation.options.bcuOrbEquipment['cat-unit-000-f'], [[1, 1, 4]], 'formation orb equipment stores one orb slot');

const tuningPatch = readFileSync(new URL('../js/ui/FormationEditorBcuUnitLevelPatch.js', import.meta.url), 'utf8');
assert.ok(tuningPatch.includes('const ORB_TRAIT_OPTIONS'), 'orb trait UI uses explicit display options');
assert.ok(!tuningPatch.includes("label: 'エヴァ'"), 'orb trait UI must not offer Eva');
assert.ok(!tuningPatch.includes("label: '魔女'"), 'orb trait UI must not offer Witch');
assert.ok(!tuningPatch.includes("label: '白'"), 'orb trait UI must not offer traitless/white orbs');
assert.ok(tuningPatch.includes("{ traitIndex: 11, label: '悪魔' }"), 'demon orb trait keeps its original BCU bit index');
assert.ok(tuningPatch.includes('1 << traitOption.traitIndex'), 'orb save path uses BCU trait bit index, not display ordinal');
assert.ok(tuningPatch.includes('function normalizeDraftOrb'), 'orb UI normalizes invalid type/trait combinations');
assert.ok(tuningPatch.includes('selectedOrbTraitIndex(orb) === 3'), 'metal orb trait has a dedicated restriction');
assert.ok(tuningPatch.includes('orbTypeOption(orb.typeCode).type !== ORB_ID.RES'), 'metal orbs must be damage-reduction only');

console.log('check-formation-character-tuning-logic: OK');
