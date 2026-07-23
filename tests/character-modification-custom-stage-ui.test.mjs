import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const keyboardPath = resolve(repoRoot, 'js/ui/CharacterModificationKeyboardCompactPatch.js');
const customStagePath = resolve(repoRoot, 'js/ui/FormationCustomStageCharacterModificationUiPatch.js');
const bootPath = resolve(repoRoot, 'js/boot/groups/uiPatches.js');
const keyboardSource = readFileSync(keyboardPath, 'utf8');
const customStageSource = readFileSync(customStagePath, 'utf8');
const boot = readFileSync(bootPath, 'utf8');

test('custom-stage status editor UI patches remain syntax-valid and presentation-only', () => {
  execFileSync(process.execPath, ['--check', keyboardPath], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', customStagePath], { stdio: 'pipe' });
  assert.doesNotMatch(keyboardSource, /FormationStore|BattleActorFactory|CharacterModificationResolver|CustomStageStore/);
  assert.doesNotMatch(customStageSource, /FormationStore|BattleActorFactory|CharacterModificationResolver|CustomStageStore/);
});

test('custom-stage launcher is full-width, localized, and keeps its modification count', () => {
  assert.match(customStageSource, /cm-custom-stage-status-launcher/);
  assert.match(customStageSource, /ステータス改竄/);
  assert.match(customStageSource, /この敵だけ、倍率計算後の値を変更します/);
  assert.match(customStageSource, /grid-template-columns:minmax\(0,1fr\) auto auto/);
  assert.match(customStageSource, /width:100%!important/);
  assert.match(customStageSource, /cm-custom-stage-status-launcher-count/);
  assert.match(customStageSource, /resolveCustomStageSpawnModification/);
  assert.match(customStageSource, /countCharacterModificationFields/);
});

test('embedded custom-stage editor expands to the available viewport width', () => {
  assert.match(customStageSource, /formation-custom-spawn-modal-card\.cm-embedded-container/);
  assert.match(customStageSource, /width:min\(1120px,calc\(100vw - 32px\)\)!important/);
  assert.match(customStageSource, /max-width:calc\(100vw - 32px\)!important/);
  assert.match(customStageSource, /cm-dialog-embedded/);
});

test('software keyboard hides footer commands and only reveals obscured inputs', () => {
  assert.match(keyboardSource, /grid-template-rows:48px minmax\(0,1fr\) 0!important/);
  assert.match(keyboardSource, /height:0!important/);
  assert.match(keyboardSource, /cm-footer-commands/);
  assert.match(keyboardSource, /display:none!important/);
  assert.match(keyboardSource, /revealFocusedControl/);
  assert.match(keyboardSource, /hiddenBottom/);
  assert.match(keyboardSource, /editableFocused/);
  assert.doesNotMatch(keyboardSource, /scrollIntoView/);
  assert.match(keyboardSource, /aria-hidden/);
});

test('boot order preserves handler wrapping, builder ownership, and PremiumMotion last', () => {
  const usabilityIndex = boot.indexOf('CharacterModificationUsabilityPatch.js');
  const keyboardIndex = boot.indexOf('CharacterModificationKeyboardCompactPatch.js');
  const viewportIndex = boot.indexOf('CharacterModificationViewportStabilityPatch.js');
  const builderIndex = boot.indexOf('FormationCustomStageBuilderPatch.js');
  const customStageUiIndex = boot.indexOf('FormationCustomStageCharacterModificationUiPatch.js');
  const premiumIndex = boot.indexOf('FormationPremiumMotionPatch.js');
  assert.ok(usabilityIndex >= 0 && keyboardIndex > usabilityIndex);
  assert.ok(viewportIndex > keyboardIndex);
  assert.ok(builderIndex >= 0 && customStageUiIndex > builderIndex);
  assert.ok(premiumIndex > customStageUiIndex);
  assert.equal(boot.trim().split('\n').at(-1), "import '../../ui/FormationPremiumMotionPatch.js';");
});
