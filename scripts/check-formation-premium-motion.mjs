import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Deterministic, browser-free wiring check for the premium non-battle motion pass:
// every transient class the JS applies must have a matching CSS rule, and the
// CSS/patch must be registered in index.html / installUiPatches.js in the right order.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const premiumCss = read('css/nyanko-premium-polish.css');
const uiPolishCss = read('css/ui-polish.css');
const settingsCss = read('css/game-settings.css');
const motionPatch = read('js/ui/FormationPremiumMotionPatch.js');
const tuningPatch = read('js/ui/FormationEditorBcuUnitLevelPatch.js');
const formationEditor = read('js/ui/FormationEditor.js');
const indexHtml = read('index.html');
const installUiPatches = read('js/boot/installUiPatches.js');

// 1. index.html loads the premium sheet after every other stylesheet.
const linkOrder = [...indexHtml.matchAll(/href="\.\/css\/([^"]+)"/g)].map((m) => m[1]);
assert.ok(linkOrder.includes('nyanko-premium-polish.css'), 'premium css linked in index.html');
assert.equal(linkOrder.at(-1), 'nyanko-premium-polish.css', 'premium css must be the last stylesheet so its equal-specificity rules win');

// 2. The premium motion patch installs last so its prototype wrappers are outermost.
const importOrder = [...installUiPatches.matchAll(/import\('\.\.\/ui\/([^']+)'\)/g)].map((m) => m[1]);
assert.equal(importOrder.at(-1), 'FormationPremiumMotionPatch.js', 'premium motion patch must be the last ui patch import');

// 3. Transient classes toggled by FormationPremiumMotionPatch exist in the premium sheet.
for (const cls of ['is-page-enter', 'is-catalog-enter', 'is-view-enter', 'is-opening', 'is-closing']) {
  assert.ok(motionPatch.includes(`'${cls}'`), `motion patch toggles ${cls}`);
  assert.ok(premiumCss.includes(`.${cls}`), `premium css styles ${cls}`);
}
assert.ok(motionPatch.includes("dataset.pageDir"), 'page slide direction is recorded');
assert.ok(premiumCss.includes("[data-page-dir='back']"), 'premium css styles the backward page slide');

// 4. Long-press charge + tuning overlay motion live in the tuning patch's injected style.
for (const cls of ['is-charging', 'is-charge-fired', 'formation-slot-charge']) {
  assert.ok(tuningPatch.includes(`'${cls}'`) || tuningPatch.includes(`classList.add('${cls}')`), `tuning patch toggles ${cls}`);
}
for (const rule of [
  '.formation-slot.is-charging',
  '.formation-slot.is-charge-fired',
  '@keyframes formationSlotChargeSweep',
  '@property --formation-slot-charge',
  '.formation-tuning-overlay.is-opening',
  '.formation-tuning-overlay.is-closing',
  '@keyframes formationTuningSpring',
  '@keyframes formationTuningRise'
]) {
  assert.ok(tuningPatch.includes(rule), `tuning patch style defines ${rule}`);
}

// 5. The charge sweep duration is driven by the same LONG_PRESS_MS constant as the timer.
assert.match(tuningPatch, /const LONG_PRESS_MS = \d+/, 'long press duration is a named constant');
assert.ok(tuningPatch.includes('}, LONG_PRESS_MS)'), 'long press timer uses the constant');
assert.ok(tuningPatch.includes('--formation-slot-charge-ms', tuningPatch.indexOf('startChargeVisual')), 'charge visual receives the duration var');

// 6. Settled re-renders must not re-pop the tuning panel (steppers update without entrance motion).
assert.ok(tuningPatch.includes('.formation-tuning-overlay.is-open .formation-tuning-panel{animation:none}'), 'settled tuning panel suppresses entrance animation');
assert.ok(tuningPatch.includes("panel.dataset.motionFixSeen = '1'"), 'tuning render marks panel as seen for the regression-fix patch');
assert.ok(!uiPolishCss.includes('.formation-panel,.formation-stage-dialog'), 'formation containers must not receive generic gameUiEnter transforms');
assert.ok(premiumCss.includes('@keyframes pmDialogStillIn{from{opacity:0}to{opacity:1}}'), 'stage dialog opens without translating the container');
assert.ok(premiumCss.includes('@keyframes pmDialogStillOut{from{opacity:1}to{opacity:0}}'), 'stage dialog closes without translating the container');
assert.ok(tuningPatch.includes('.formation-tuning-overlay.is-closing{background:rgba(0,0,0,0)!important'), 'tuning close must not flash a dark backdrop');

// 7. Typing in tuning inputs stays live (no focus-stealing re-render) and commits on change.
assert.ok(tuningPatch.includes('{ live: true }'), 'input events use the live path');
assert.ok(tuningPatch.includes("addEventListener('change'"), 'change events commit typed values');
assert.ok(tuningPatch.includes('function updateTuningDynamic'), 'live path patches DOM in place');

// 8. Regressions found during 2026-06-12 browser review must stay fixed:
//    - global style.css `button{width:100%;padding:9px 10px}` must not leak into
//      tuning preset chips or the close button (full-width bars / clipped text)
//    - the phone-landscape action rail must pin one column or the <=980px
//      4-column rule turns it into overflowing micro-chips
//    - brush fonts are preloaded so font-display:block never blanks the first open
assert.ok(tuningPatch.includes('.formation-tuning-presets{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr))'), 'preset chips use their own grid, not global full-width buttons');
assert.ok(/formation-tuning-close\{[^}]*display:inline-flex;align-items:center;justify-content:center;padding:0 12px/.test(tuningPatch), 'close button overrides global button padding and centers its label');
assert.ok(formationEditor.includes("formation-settings-group"), 'settings overlay renders grouped rows');
assert.ok(formationEditor.includes("formation-setting-state"), 'settings overlay renders explicit switch state');
assert.ok(settingsCss.includes('.formation-settings-group'), 'settings css styles grouped rows');
assert.ok(settingsCss.includes('@media (max-width:520px)'), 'settings css has a compact mobile layout');
const phonePatch = read('js/ui/FormationPhoneLandscapeLayoutPatch.js');
assert.ok(/formation-action-rail\{[^}]*grid-template-columns:1fr!important;grid-template-rows:/.test(phonePatch), 'phone landscape rail pins a single column');
assert.ok((indexHtml.match(/rel="preload" as="font"/g) || []).length >= 2, 'tuning brush fonts are preloaded');

// 9. Reduced-motion users get instant states everywhere.
assert.ok(premiumCss.includes('@media (prefers-reduced-motion: reduce)'), 'premium css guards reduced motion');
assert.ok(tuningPatch.includes('@media (prefers-reduced-motion: reduce)'), 'tuning patch style guards reduced motion');
assert.ok(motionPatch.includes('prefers-reduced-motion'), 'motion patch checks reduced motion before animating');

console.log('check-formation-premium-motion: OK');
