import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildBcuStageCatalog } from '../js/ui/BcuStageCatalogBuilder.js';
import { parseBcuStageDifficultyLang, formatBcuStageDifficulty, stageDifficultyKeyFromStageOption, resolveStageDifficulty, buildScopedDifficultyFilterCandidates } from '../js/bcu/BcuStageDifficultyRuntime.js';

const parsed = parseBcuStageDifficultyLang('000-000-000\t1\n000-000-001\t2\n001-012-003\t7\n');
assert.equal(parsed.diagnostics.parsed, 3);
assert.equal(parsed.table.get('stage:0-0-0').diff, 1);
assert.equal(parsed.table.get('stage:1-12-3').diff, 7);
assert.equal(formatBcuStageDifficulty(1), '★1');
assert.equal(formatBcuStageDifficulty(-1), '---');
assert.equal(stageDifficultyKeyFromStageOption({ stageId: 'stageRN000_01' }), 'stage:0-0-1');
assert.equal(stageDifficultyKeyFromStageOption({ stageId: 'stageRNA012_03' }), 'stage:13-12-3');
assert.equal(stageDifficultyKeyFromStageOption({ stageId: 'stageEX004_02' }), 'stage:4-4-2');
assert.equal(stageDifficultyKeyFromStageOption({ stageKey: 'stage:1-12-3' }), 'stage:1-12-3');
assert.equal(stageDifficultyKeyFromStageOption({ mapColcId: 1, mapNo: 12, stageNo: 3 }), 'stage:1-12-3');
assert.equal(resolveStageDifficulty({ mapColcId: 1, mapNo: 12, stageNo: 3 }, { table: parsed.table }).diff, 7);
assert.equal(resolveStageDifficulty({ stageId: 'unknown' }, { table: parsed.table }).diff, -1);

const sourcePath = 'public/assets/bcu/lang/Difficulty.txt';
assert.ok(fs.existsSync(sourcePath), 'repo contains actual BCU lang/Difficulty.txt source');
const real = parseBcuStageDifficultyLang(fs.readFileSync(sourcePath, 'utf8'), { source: sourcePath });
assert.ok(real.diagnostics.parsed > 1000, 'real Difficulty.txt parses many rows');
assert.equal(resolveStageDifficulty({ mapColcId: 0, mapNo: 0, stageNo: 0 }, { table: real.table }).diff, 1, 'representative legend stage resolves to real difficulty');
assert.equal(resolveStageDifficulty({ mapColcId: 13, mapNo: 0, stageNo: 0 }, { table: real.table }).diff, 10, 'representative A/stageRNA stage resolves to real difficulty');
assert.equal(resolveStageDifficulty({ mapColcId: 1, mapNo: 0, stageNo: 0 }, { table: real.table }).diff, 2, 'representative event stage resolves to real difficulty');
const missing = resolveStageDifficulty({ mapColcId: 999, mapNo: 999, stageNo: 999 }, { table: real.table });
assert.equal(missing.diff, -1, 'nonexistent stage resolves to missing difficulty');
assert.equal(missing.fallbackReason, 'difficulty-key-not-found-in-source-table', 'missing difficulty reports fallback reason');

const stageIndex = JSON.parse(fs.readFileSync('public/assets/generated/bcu-stage-index.json', 'utf8'));
const catalog = buildBcuStageCatalog(stageIndex.entries, { bcuDb: null });
const eventCategory = catalog.getCategory('event');
const legendCategory = catalog.getCategory('legend');
assert.ok(eventCategory?.maps?.length > 0, 'event category has maps');
assert.ok(legendCategory?.maps?.length > 0, 'legend category has maps');
const eventMapCandidates = buildScopedDifficultyFilterCandidates(eventCategory.maps, { kind: 'map', table: real.table });
const legendMapCandidates = buildScopedDifficultyFilterCandidates(legendCategory.maps, { kind: 'map', table: real.table });
assert.equal(eventMapCandidates.length, eventCategory.maps.length, 'event map filter candidates come from current event category only');
assert.equal(legendMapCandidates.length, legendCategory.maps.length, 'legend map filter candidates come from current legend category only');
assert.notEqual(eventMapCandidates.length, legendMapCandidates.length, 'category switch changes filter candidate set');
const eventKeys = new Set(eventMapCandidates.map((c) => c.item.key));
assert.ok(legendMapCandidates.some((c) => !eventKeys.has(c.item.key)), 'legend candidates are not mixed into event scope');
const firstEventMap = eventCategory.maps.find((m) => m.stages?.length > 2);
const stageCandidates = buildScopedDifficultyFilterCandidates(firstEventMap.stages, { kind: 'stage', table: real.table });
assert.equal(stageCandidates.length, firstEventMap.stages.length, 'stage-level candidates come from the current map only');
assert.ok(stageCandidates.every((c) => c.item.mapKey === firstEventMap.key), 'stage-level candidates do not include stages from other maps');

console.log('check-bcu-stage-difficulty-parity: OK');
