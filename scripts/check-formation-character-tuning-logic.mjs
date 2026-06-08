import assert from 'node:assert/strict';
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

console.log('check-formation-character-tuning-logic: OK');
