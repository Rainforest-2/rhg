import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const patchPath = resolve(repoRoot, 'js/ui/CharacterModificationUsabilityPatch.js');
const bootPath = resolve(repoRoot, 'js/boot/groups/uiPatches.js');
const source = readFileSync(patchPath, 'utf8');
const boot = readFileSync(bootPath, 'utf8');

test('status tampering usability patch remains syntax-valid and UI-only', () => {
  execFileSync(process.execPath, ['--check', patchPath], { stdio: 'pipe' });
  assert.match(source, /CharacterModificationEditor/);
  assert.match(source, /CharacterModificationRenderer/);
  assert.doesNotMatch(source, /FormationStore|BattleActorFactory|CharacterModificationResolver|CustomStageStore/);
});

test('user-facing language and compact command layout are guarded', () => {
  assert.match(source, /ステータス改竄/);
  assert.match(source, /項目名で検索/);
  assert.match(source, /変更した項目だけ/);
  assert.match(source, /読み込む/);
  assert.match(source, /書き出す/);
  assert.match(source, /すべて元に戻す/);
  assert.match(source, /cm-more-menu/);
  assert.match(source, /toggle-more/);
  assert.match(source, /変更した内容をすべて元に戻しますか/);
  assert.match(source, /cm-field-title code\{display:none!important\}/);
});

test('software keyboard handling is installed and cleaned up', () => {
  assert.match(source, /visualViewport/);
  assert.match(source, /cm-keyboard-open/);
  assert.match(source, /scrollIntoView\(\{ block: 'center'/);
  assert.match(source, /addEventListener\('resize'/);
  assert.match(source, /removeEventListener\('resize'/);
  assert.match(source, /addEventListener\('focusin'/);
  assert.match(source, /removeEventListener\('focusin'/);
});

test('boot order preserves the existing character modification and landscape contracts', () => {
  const baseIndex = boot.indexOf('FormationCharacterModificationPatch.js');
  const usabilityIndex = boot.indexOf('CharacterModificationUsabilityPatch.js');
  const landscapeIndex = boot.indexOf('FormationCharacterTuningMobileLandscapePatch.js');
  const premiumIndex = boot.indexOf('FormationPremiumMotionPatch.js');
  assert.ok(baseIndex >= 0 && usabilityIndex > baseIndex);
  assert.ok(landscapeIndex > usabilityIndex);
  assert.ok(premiumIndex > landscapeIndex);
  assert.equal(boot.trim().split('\n').at(-1), "import '../../ui/FormationPremiumMotionPatch.js';");
});
