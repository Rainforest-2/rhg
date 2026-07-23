import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const patchPath = resolve(root, 'js/ui/CharacterModificationMobileInformationArchitecturePatch.js');
const bootPath = resolve(root, 'js/boot/groups/uiPatches.js');
const patch = readFileSync(patchPath, 'utf8');
const boot = readFileSync(bootPath, 'utf8');

test('mobile information architecture patch remains syntax-valid and presentation-only', () => {
  execFileSync(process.execPath, ['--check', patchPath], { stdio: 'pipe' });
  assert.doesNotMatch(
    patch,
    /FormationStore|CustomStageStore|BattleActorFactory|CharacterModificationResolver|CharacterModificationCodec/
  );
});

test('phone editor becomes full-bleed with no application-created top gap', () => {
  assert.match(patch, /\.cm-host-layer:not\(\.cm-host-layer-embedded\)\s*\{[\s\S]*?inset: 0 !important/);
  assert.match(patch, /padding: 0 !important/);
  assert.match(patch, /margin: 0 !important/);
  assert.match(patch, /width: 100vw !important/);
  assert.match(patch, /height: var\(--cm-available-height/);
  assert.match(patch, /border-radius: 0 !important/);
  assert.match(patch, /box-shadow: none !important/);
});

test('mobile chrome has an explicit compact hierarchy', () => {
  for (const token of [
    '--cm-mobile-header: 44px',
    '--cm-mobile-toolbar: 40px',
    '--cm-mobile-category: 36px',
    '--cm-mobile-section: 32px',
    '--cm-mobile-footer: 46px'
  ]) assert.match(patch, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  assert.match(
    patch,
    /grid-template-rows:\s*var\(--cm-mobile-header\)\s*var\(--cm-mobile-toolbar\)\s*minmax\(0, 1fr\)\s*var\(--cm-mobile-footer\)/
  );
  assert.match(patch, /grid-template-rows: var\(--cm-mobile-category\) minmax\(0, 1fr\)/);
  assert.match(patch, /grid-template-rows: var\(--cm-mobile-section\) auto minmax\(0, 1fr\)/);
});

test('toolbar, fields and footer prioritize editing over decoration', () => {
  assert.match(
    patch,
    /grid-template-columns: minmax\(72px, 1fr\) 34px 88px 72px !important/
  );
  assert.match(patch, /\.cm-subject-title small,[\s\S]*?\.cm-title\s*\{\s*display: none !important/);
  assert.match(patch, /\.cm-field\s*\{[\s\S]*?padding: 9px !important/);
  assert.match(
    patch,
    /\.cm-field:not\(\.is-read-only\)[\s\S]*?\.cm-value-block:last-child\s*\{\s*display: none !important/
  );
  assert.match(patch, /\.cm-footer-commands\s*\{[\s\S]*?display: flex !important/);
  assert.match(patch, /\.cm-command\.is-primary\s*\{[\s\S]*?flex: 1 1 auto !important/);
});

test('compact visible controls retain expanded hit zones', () => {
  assert.match(patch, /\.cm-icon-button::after/);
  assert.match(patch, /\.cm-category::after/);
  assert.match(patch, /\.cm-utility-command::after/);
  assert.match(patch, /inset: -4px/);
  assert.match(patch, /\.cm-field-reset\s*\{\s*width: 44px !important/);
});

test('low-height landscape reserves most height for the field list', () => {
  for (const token of [
    '--cm-mobile-header: 38px',
    '--cm-mobile-toolbar: 36px',
    '--cm-mobile-category: 32px',
    '--cm-mobile-section: 30px',
    '--cm-mobile-footer: 42px'
  ]) assert.match(patch, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(patch, /@media \(orientation: landscape\) and \(max-height: 520px\)/);
});

test('mobile hierarchy runs after generic interaction rules while PremiumMotion stays last', () => {
  const interaction = boot.indexOf('CharacterModificationInteractionContractPatch.js');
  const mobile = boot.indexOf('CharacterModificationMobileInformationArchitecturePatch.js');
  const reducedMotion = boot.indexOf('CharacterModificationReducedMotionContractPatch.js');
  const premium = boot.indexOf('FormationPremiumMotionPatch.js');
  assert.ok(interaction >= 0 && mobile > interaction);
  assert.ok(reducedMotion > mobile);
  assert.ok(premium > reducedMotion);
  assert.equal(
    boot.trim().split('\n').at(-1),
    "import '../../ui/FormationPremiumMotionPatch.js';"
  );
});
