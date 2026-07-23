import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const designPath = resolve(repoRoot, 'js/ui/CharacterModificationDesignSystemPatch.js');
const bootPath = resolve(repoRoot, 'js/boot/groups/uiPatches.js');
const design = readFileSync(designPath, 'utf8');
const boot = readFileSync(bootPath, 'utf8');

test('status editor design system remains syntax-valid and presentation-only', () => {
  execFileSync(process.execPath, ['--check', designPath], { stdio: 'pipe' });
  assert.match(design, /CharacterModificationRenderer/);
  assert.doesNotMatch(
    design,
    /FormationStore|CustomStageStore|BattleActorFactory|CharacterModificationResolver|CharacterModificationCodec/
  );
});

test('custom-stage game button styling is explicitly isolated from the shared editor', () => {
  assert.match(
    design,
    /\.formation-custom-builder \.cm-host-layer \.cm-editor button/
  );
  assert.match(
    design,
    /\.formation-custom-spawn-modal-card \.cm-host-layer \.cm-editor button/
  );
  assert.match(design, /background-image:none!important/);
  assert.match(design, /border-radius:var\(--cm-r8\)!important/);
  assert.match(design, /box-shadow:none!important/);
});

test('commercial-grade interaction and responsive constraints stay guarded', () => {
  assert.match(design, /min-height:44px!important/);
  assert.match(design, /:focus-visible/);
  assert.match(design, /scrollbar-gutter:stable/);
  assert.match(design, /@media\(max-width:700px\)/);
  assert.match(design, /@media\(max-width:420px\)/);
  assert.match(design, /orientation:landscape/);
  assert.match(design, /max-height:520px/);
  assert.match(design, /prefers-reduced-motion:reduce/);
});

test('embedded custom-stage editor gets the full shared layout and keyboard mode removes actions', () => {
  assert.match(design, /width:min\(1180px,calc\(100vw - 24px\)\)!important/);
  assert.match(design, /\.cm-host-layer-embedded\.cm-keyboard-open/);
  assert.match(
    design,
    /\.cm-host-layer\.cm-keyboard-open \.cm-footer\{display:none!important/
  );
  assert.match(design, /grid-template-columns:minmax\(180px,218px\) minmax\(0,1fr\)/);
});

test('boot order gives the shared design the final visual word without violating PremiumMotion-last', () => {
  const builder = boot.indexOf('FormationCustomStageBuilderPatch.js');
  const customStage = boot.indexOf('FormationCustomStageCharacterModificationUiPatch.js');
  const stageName = boot.indexOf('FormationStageNameBcuPatch.js');
  const designSystem = boot.indexOf('CharacterModificationDesignSystemPatch.js');
  const premium = boot.indexOf('FormationPremiumMotionPatch.js');
  assert.ok(builder >= 0 && customStage > builder);
  assert.ok(stageName > customStage);
  assert.ok(designSystem > stageName);
  assert.ok(premium > designSystem);
  assert.equal(
    boot.trim().split('\n').at(-1),
    "import '../../ui/FormationPremiumMotionPatch.js';"
  );
});
