import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const patchPath = 'js/ui/FormationStageDefaultCrownFastPathPatch.js';
const patch = readFileSync(patchPath, 'utf8');
const patchGroup = readFileSync('js/boot/groups/uiPatches.js', 'utf8');

assert.ok(patch.includes("Symbol.for('wanko-ui.formation-stage-default-crown-fast-path.v1')"));
assert.ok(patch.includes("encoding: 'single-crown-fast-path'"));
assert.ok(patch.includes("const query = String(filter.q || '').normalize('NFKC').trim()"));
assert.ok(patch.includes('Math.trunc(rawStar) > 1'), '★2以上 must keep using the full crown index');
assert.ok(patch.includes('if (!fullIndex || hasExplicitCrownFilter(this)) return render.apply(this, args)'));
assert.ok(patch.includes('this.__bcuStageCrownIndex = SINGLE_CROWN_INDEX'));
assert.ok(patch.includes('finally {\n      this.__bcuStageCrownIndex = fullIndex;'), 'the real index must be restored even when render throws');

const difficultyImport = patchGroup.indexOf("import '../../ui/FormationStageDifficultyPatch.js';");
const fastPathImport = patchGroup.indexOf("import '../../ui/FormationStageDefaultCrownFastPathPatch.js';");
const filterControlImport = patchGroup.indexOf("import '../../ui/FormationStageDifficultyFilterControlPatch.js';");
assert.ok(difficultyImport >= 0 && fastPathImport > difficultyImport,
  'fast path must wrap the installed difficulty renderer');
assert.ok(filterControlImport > fastPathImport,
  'filter controls must install after the default-view fast path');

console.log('check-event-stage-selector-performance: OK');
