// Regression guard for the battle unit-card rail centering.
//
// style.css centers .prod-ui .cards with `left:50%` + `transform:translateX(-50%)`.
// ui-polish.css once applied the shared gameUiEnter entrance animation
// (fill-mode: both) to the rail; its 100% keyframe transform
// `translateY(0) scale(1)` permanently replaced translateX(-50%), shifting the
// rail right by half its own width. The rail must keep a dedicated keyframe
// set whose every frame preserves translateX(-50%).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const styleCss = await readFile(new URL('../css/style.css', import.meta.url), 'utf8');
const polishCss = await readFile(new URL('../css/ui-polish.css', import.meta.url), 'utf8');

// base rule still centers the rail
assert.match(styleCss, /\.prod-ui \.cards\{[^}]*left:50%[^}]*transform:translateX\(-50%\)/, 'style.css must center .prod-ui .cards with left:50% + translateX(-50%)');

// the shared entrance animation must not target the card rail
const sharedAnimRule = polishCss.match(/^.*animation:gameUiEnter.*$/m)?.[0] || '';
assert.ok(!sharedAnimRule.includes('.prod-ui .cards'), 'ui-polish.css must not apply gameUiEnter (transform overrides translateX(-50%)) to .prod-ui .cards');

// the rail-specific animation keyframes must preserve translateX(-50%) in every frame
const railAnimRule = polishCss.match(/\.prod-ui \.cards\{animation:([A-Za-z][\w-]*)/);
if (railAnimRule) {
  const name = railAnimRule[1];
  const kf = polishCss.match(new RegExp(`@keyframes ${name}\\{([\\s\\S]*?)\\}\\s*(?:@|$|\\.|\\n)`));
  assert.ok(kf, `@keyframes ${name} must exist`);
  const frames = kf[1].match(/transform:[^};]*/g) || [];
  assert.ok(frames.length > 0, `@keyframes ${name} must declare transforms`);
  for (const frame of frames) {
    assert.ok(frame.includes('translateX(-50%)'), `every ${name} keyframe transform must include translateX(-50%) (got: ${frame})`);
  }
}

console.log('check-battle-card-rail-centering: PASS');
