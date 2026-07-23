import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const interactionPath = resolve(root, 'js/ui/CharacterModificationInteractionContractPatch.js');
const embeddedPath = resolve(root, 'js/ui/CharacterModificationEmbeddedViewportContractPatch.js');
const motionPath = resolve(root, 'js/ui/CharacterModificationReducedMotionContractPatch.js');
const bootPath = resolve(root, 'js/boot/groups/uiPatches.js');
const interaction = readFileSync(interactionPath, 'utf8');
const embedded = readFileSync(embeddedPath, 'utf8');
const motion = readFileSync(motionPath, 'utf8');
const boot = readFileSync(bootPath, 'utf8');

test('status editor contract patches remain syntax-valid and presentation-only', () => {
  for (const path of [interactionPath, embeddedPath, motionPath]) {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
  }
  for (const source of [interaction, embedded, motion]) {
    assert.doesNotMatch(
      source,
      /FormationStore|CustomStageStore|BattleActorFactory|CharacterModificationResolver|CharacterModificationCodec/
    );
  }
});

test('all editor actions keep 44px targets including compact landscape', () => {
  assert.match(interaction, /min-height: 44px !important/);
  assert.match(interaction, /reset-category/);
  assert.match(interaction, /orientation: landscape/);
  assert.match(interaction, /max-height: 520px/);
});

test('embedded editor follows measured visual viewport rather than host height', () => {
  assert.match(embedded, /--cm-available-height/);
  assert.match(embedded, /--cm-viewport-height/);
  assert.match(embedded, /--cm-viewport-inset-top/);
  assert.match(embedded, /margin-top: var\(--cm-viewport-inset-top, 0px\) !important/);
  assert.doesNotMatch(embedded, /position:\s*fixed/);
});

test('reduced-motion contract uses exact zero durations', () => {
  assert.match(motion, /animation-duration: 0s !important/);
  assert.match(motion, /transition-duration: 0s !important/);
  assert.doesNotMatch(motion, /\.001ms|1e-06s/);
});

test('contract order remains after design system and PremiumMotion remains last', () => {
  const design = boot.indexOf('CharacterModificationDesignSystemPatch.js');
  const embeddedContract = boot.indexOf('CharacterModificationEmbeddedViewportContractPatch.js');
  const interactionContract = boot.indexOf('CharacterModificationInteractionContractPatch.js');
  const motionContract = boot.indexOf('CharacterModificationReducedMotionContractPatch.js');
  const premium = boot.indexOf('FormationPremiumMotionPatch.js');
  assert.ok(design >= 0 && embeddedContract > design);
  assert.ok(interactionContract > embeddedContract);
  assert.ok(motionContract > interactionContract);
  assert.ok(premium > motionContract);
  assert.equal(boot.trim().split('\n').at(-1), "import '../../ui/FormationPremiumMotionPatch.js';");
});
