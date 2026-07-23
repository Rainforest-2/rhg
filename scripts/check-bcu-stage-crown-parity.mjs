// Deterministic parity check: stage crown (星/冠) difficulty magnification.
//
// BCU EStage.java: mul = st.getCont().stars[star] * 0.01f; enemy HP/ATK magnification *= mul.
// ★1 (star 0) is always 100 -> mul 1.0 -> no change. Higher crowns scale enemy stats up.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  BCU_DEFAULT_CROWN_STARS,
  BCU_MAX_CROWN_STAR,
  clampCrownIndex,
  crownDataHasStar,
  crownStarIndexFromUiStar,
  crownStarsForData,
  normalizeCrownStar,
  resolveCrownMagnificationPercent,
  applyCrownToMagnification,
  applyCrownToEnemyRow,
  applyCrownToEnemyRows,
  resolveMapCrownData
} from '../js/battle/bcu-runtime/BcuStageCrownRuntime.js';
import { StageRuntime } from '../js/battle/StageRuntime.js';

const INDEX_PATH = 'public/assets/generated/bcu-stage-crown-index.json';
assert.ok(existsSync(INDEX_PATH), 'crown index must be generated (run build-bcu-stage-crown-index.mjs)');
const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
assert.ok(index.count > 0 && Array.isArray(index.entries), 'crown index has entries');
for (const entry of index.entries) {
  assert.ok(entry.crownCount >= 2 && entry.crownCount <= 4, `crown index only lists 2..4 crown maps (got ${entry.crownCount})`);
  assert.equal(entry.stars.length, entry.crownCount, 'stars length matches crownCount');
  assert.equal(entry.stars[0], 100, '★1 magnification is always 100');
}
const legend = index.entries.find((entry) =>
  String(entry.name).includes('伝説の始まり')
    && JSON.stringify(entry.stars) === JSON.stringify([100, 150, 200, 300]));
assert.ok(legend, 'real four-crown legend map is present in the generated index');

const difficultyPatchSource = readFileSync('js/ui/FormationStageDifficultyPatch.js', 'utf8');
const filterPatchSource = readFileSync('js/ui/FormationStageDifficultyFilterControlPatch.js', 'utf8');
const performancePatchSource = readFileSync('js/ui/FormationEditorPerformancePatch.js', 'utf8');
assert.ok(difficultyPatchSource.includes('data-stage-crown-star'), 'stage selector exposes a four-star crown selector');
assert.ok(!difficultyPatchSource.includes("data-stage-difficulty-min='1'"), 'stage selector no longer exposes raw 1..12 difficulty lower-bound input');
assert.ok(filterPatchSource.includes('stageCrownStars'), 'DOM fallback filters by crown stars');
assert.ok(performancePatchSource.includes('crownDataHasStar'), 'virtual map list filters by crown availability');

assert.deepEqual([...BCU_DEFAULT_CROWN_STARS], [100, 150, 200, 300]);
assert.equal(BCU_MAX_CROWN_STAR, 4, 'stage selector crown UI is four-star, not raw 12-level difficulty');
assert.equal(normalizeCrownStar(null), 1, 'empty UI crown defaults to ★1');
assert.equal(normalizeCrownStar(12), 4, 'UI crown clamps above ★4');
assert.equal(crownStarIndexFromUiStar(1), 0, '★1 UI star maps to BCU star index 0');
assert.equal(crownStarIndexFromUiStar(4), 3, '★4 UI star maps to BCU star index 3');
const stars = [100, 150, 200, 300];
assert.equal(resolveCrownMagnificationPercent(0, stars), 100, '★1 -> 100%');
assert.equal(resolveCrownMagnificationPercent(1, stars), 150, '★2 -> 150%');
assert.equal(resolveCrownMagnificationPercent(2, stars), 200, '★3 -> 200%');
assert.equal(resolveCrownMagnificationPercent(3, stars), 300, '★4 -> 300%');
assert.equal(resolveCrownMagnificationPercent(9, stars), 300, 'over-max crown clamps to highest');
assert.equal(resolveCrownMagnificationPercent(2, [100]), 100, 'single-crown map always ★1=100%');
assert.equal(clampCrownIndex(9, stars), 3, 'clampCrownIndex caps at last index');
assert.equal(clampCrownIndex(-3, stars), 0, 'clampCrownIndex floors at 0');

assert.equal(applyCrownToMagnification(100, 100), 100, '★1 leaves magnification unchanged');
assert.equal(applyCrownToMagnification(100, 300), 300, '★4 triples a 100% row');
assert.equal(applyCrownToMagnification(400, 150), 600, '★2 scales a 400% row to 600%');

const row = { enemyId: 5, magnification: 100, hpMagnification: 100, attackMagnification: 100 };
assert.strictEqual(applyCrownToEnemyRow(row, 100), row, '★1 returns the same row reference (no scaling)');
const crowned = applyCrownToEnemyRow(row, 300);
assert.equal(crowned.hpMagnification, 300, 'row HP magnification tripled at ★4');
assert.equal(crowned.attackMagnification, 300, 'row ATK magnification tripled at ★4');
assert.equal(crowned.crownMagnificationPercent, 300, 'crowned row records the crown percent');
assert.equal(row.hpMagnification, 100, 'original row is not mutated');

const rows = [{ magnification: 100 }, { magnification: 200 }];
assert.strictEqual(applyCrownToEnemyRows(rows, 100), rows, '★1 returns the same array reference');
const crownedRows = applyCrownToEnemyRows(rows, 150);
assert.deepEqual(crownedRows.map((entry) => entry.magnification), [150, 300], '★2 scales every row by 1.5');

// Exact identity is the generated asset pack plus local Map_option.csv map id.
const exactLegend = resolveMapCrownData(index, {
  name: legend.name,
  packId: legend.packId,
  mapId: legend.mapId
});
assert.equal(exactLegend.crownCount, 4, 'exact real pack/local-map owner resolves four crowns');
assert.deepEqual(exactLegend.stars, [100, 150, 200, 300]);
assert.equal(exactLegend.source, 'crown-index-byKey');
assert.equal(exactLegend.resolvedPackId, legend.packId);
assert.equal(exactLegend.resolvedMapId, legend.mapId);
assert.deepEqual(crownStarsForData(exactLegend), [1, 2, 3, 4]);
assert.equal(crownDataHasStar(exactLegend, 4), true);

// An unowned fallback is valid only when every pack revision of that local id
// agrees. Conflicting revisions must remain explicit and fail closed to ★1.
const legendCandidates = index.byMapId?.[String(legend.mapId)]?.entries
  || index.entries.filter((entry) => Number(entry.mapId) === Number(legend.mapId));
const legendSignatures = new Set(legendCandidates.map((entry) => JSON.stringify(entry.stars)));
const unownedLegend = resolveMapCrownData(index, {
  name: legend.name,
  mapId: legend.mapId
});
if (legendSignatures.size === 1) {
  assert.equal(unownedLegend.crownCount, 4, 'unowned local-id fallback is safe when all revisions agree');
  assert.deepEqual(unownedLegend.stars, [100, 150, 200, 300]);
} else {
  assert.equal(unownedLegend.source, 'crown-index-ambiguous', 'conflicting local-id revisions fail closed without a pack owner');
  assert.deepEqual(unownedLegend.stars, [100]);
  assert.match(unownedLegend.unresolvedReason, /conflicting-crown-signatures/);
}

const missing = resolveMapCrownData(index, { name: 'no-such-map-xyzzy' });
assert.deepEqual(missing.stars, [100], 'absent map defaults to single ★1 crown');
assert.deepEqual(crownStarsForData(missing), [1], 'maps without difficulty changes are searchable only as ★1');
assert.equal(crownDataHasStar(missing, 1), true, 'single-crown maps match ★1');
assert.equal(crownDataHasStar(missing, 2), false, 'single-crown maps do not match ★2');

const stageDef = {
  stageLen: 4000,
  enemyBaseHp: 10000,
  enemyRows: [
    { enemyId: 10, rowIndex: 0, magnification: 100, hpMagnification: 100, attackMagnification: 100 },
    { enemyId: 11, rowIndex: 1, magnification: 100, hpMagnification: 200, attackMagnification: 50 }
  ]
};
const star1 = new StageRuntime(stageDef, { crownMagnificationPercent: 100 });
assert.equal(star1.crownMagnificationPercent, 100);
assert.equal(star1.enemyRows[0].hpMagnification, 100, '★1 leaves enemy HP magnification at base');

const star4 = new StageRuntime(stageDef, { crownMagnificationPercent: 300, crownStarIndex: 3 });
assert.equal(star4.crownMagnificationPercent, 300);
assert.equal(star4.crownStarIndex, 3);
assert.equal(star4.enemyRows[0].hpMagnification, 300, '★4 triples enemy 0 HP magnification');
assert.equal(star4.enemyRows[1].hpMagnification, 600, '★4 triples enemy 1 HP magnification (200 -> 600)');
assert.equal(star4.enemyRows[1].attackMagnification, 150, '★4 triples enemy 1 ATK magnification (50 -> 150)');
assert.equal(stageDef.enemyRows[0].hpMagnification, 100, 'crown scaling does not mutate the stage definition rows');

console.log('check-bcu-stage-crown-parity: OK');
