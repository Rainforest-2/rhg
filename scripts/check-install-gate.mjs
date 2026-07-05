// Deterministic guard for the mobile "add to home screen" install gate.
//  - iOS/Android browser visitors are gated until they launch from the home
//    screen (standalone); desktop and standalone (installed) users are never
//    gated, so an installed web-app opener sees no prompt.
//  - The game boot must abort while the gate is active.
import assert from 'node:assert';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

const gate = read('js/install-gate.js');
const index = read('index.html');
const main = read('js/main.js');

// Platform detection: both mobile families + desktop exclusion.
assert.match(gate, /iphone\|ipad\|ipod/i, 'install gate must detect iOS');
assert.match(gate, /android/i, 'install gate must detect Android');
assert.match(gate, /const isMobile = isIOS \|\| isAndroid;/, 'install gate must gate on mobile only (desktop unaffected)');

// Standalone / installed detection so an installed web-app opener is NOT gated.
assert.match(gate, /display-mode: standalone/, 'install gate must detect standalone display-mode');
assert.match(gate, /navigator\.standalone/, 'install gate must detect iOS navigator.standalone');
assert.match(gate, /if \(!isMobile \|\| isStandalone \|\| bypass\) return;/, 'install gate must no-op for desktop, standalone (installed), or bypass');

// Gate must both block play (flag) and offer the Android native prompt path.
assert.match(gate, /__INSTALL_GATE_ACTIVE__ = true/, 'install gate must set the boot-abort flag when active');
assert.match(gate, /beforeinstallprompt/, 'install gate should capture the Android install prompt');

// Load order: the gate script runs before main.js so the flag is set first.
assert.match(index, /install-gate\.js/, 'index.html must load the install gate');
const gateIdx = index.indexOf('install-gate.js');
const mainIdx = index.indexOf('js/main.js');
assert.ok(gateIdx > -1 && mainIdx > -1 && gateIdx < mainIdx, 'install-gate.js must be included before main.js');

// Boot must abort while the gate is up.
assert.match(main, /if \(globalThis\.__INSTALL_GATE_ACTIVE__\) return;/, 'main.js boot must abort when the install gate is active');

console.log('check-install-gate: OK');
