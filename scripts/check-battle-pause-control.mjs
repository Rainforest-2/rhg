#!/usr/bin/env node
// Deterministic check for the in-battle pause/option control + sound settings.
//
// Guards:
//  1. AudioSettings exposes the persisted BGM/SE/mute keys, defaults and subscribe API.
//  2. BattlePauseMenu renders the BGM/SE on/off buttons, resume and abort actions,
//     uses the stage-map font, animates open/close, and references the mirrored
//     option atlas.
//  3. The PreviewApp pause/page-transition patches install the shared pause gate,
//     abort routine and battle/formation transition classes, and are imported from main.js.
//  4. The real BCU sprites the UI crops still exist at the expected imgcut
//     regions, and the runtime-facing atlas copy is byte-identical to the source.
//  5. Every touched JS module passes `node --check`.
//
// Exits nonzero on the first failure.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('../', import.meta.url);
const failures = [];
function check(cond, message) { if (!cond) failures.push(message); }
async function read(rel) { return readFile(new URL(rel, ROOT), 'utf8'); }

// 1. AudioSettings
const audio = await read('js/audio/AudioSettings.js');
for (const key of [
  'wanko-battle.audio.bgm-volume',
  'wanko-battle.audio.se-volume',
  'wanko-battle.audio.muted'
]) check(audio.includes(key), `AudioSettings: missing storage key ${key}`);
for (const api of ['getEffectiveBgmVolume', 'getEffectiveSeVolume', 'setBgmVolume', 'setSeVolume', 'setMuted', 'subscribe', 'snapshot']) {
  check(audio.includes(api), `AudioSettings: missing API ${api}()`);
}
check(/bgm:\s*0\.7/.test(audio) && /se:\s*0\.8/.test(audio), 'AudioSettings: expected BGM=0.7 / SE=0.8 defaults');
check(audio.includes('if (raw == null) return fallback;'), 'AudioSettings: missing localStorage-null fallback for default BGM/SE volumes');
check(/export const AudioSettings/.test(audio), 'AudioSettings: missing singleton export');

// 2. BattlePauseMenu UI
const menu = await read('js/ui/BattlePauseMenu.js');
check(menu.includes("'./public/assets/ui/battle-option-atlas.png'") || menu.includes('battle-option-atlas.png'), 'BattlePauseMenu: must reference mirrored option atlas');
for (const piece of ['BcuStageFont', 'stage_font.otf', 'bcu-pause-sound-grid', 'bcu-pause-bgm', 'bcu-pause-se', 'bi-music-note-beamed', 'bi-volume-up-fill', 'bcu-pause-btn resume', 'bcu-pause-btn abort', 'setBgmVolume', 'setSeVolume', 'setMuted', 'is-opening', 'is-closing']) {
  check(menu.includes(piece), `BattlePauseMenu: missing "${piece}"`);
}
check(menu.includes('メインメニューに戻る'), 'BattlePauseMenu: missing メインメニューに戻る abort affordance');
check(/from '\.\.\/audio\/AudioSettings\.js'/.test(menu), 'BattlePauseMenu: must import AudioSettings');
check(!menu.includes('type="range"'), 'BattlePauseMenu: BGM/SE controls should be Battle Cats-style icon toggles, not range sliders');

// 3. PreviewApp pause/page transition patch wiring
const patch = await read('js/preview/PreviewAppBattlePauseOverlayPatch.js');
for (const piece of ['syncSimulationPause', '__pauseMenuOpen', 'simulationPausedByVisibility', 'openPauseMenu', 'closePauseMenu', 'abortBattleFromPause', 'returnToFormationFromBattleResult', 'BattlePauseMenu']) {
  check(patch.includes(piece), `PausePatch: missing "${piece}"`);
}
check(/installPreviewAppBattlePauseOverlayPatch\(\);\s*$/.test(patch.trim() + '\n'), 'PausePatch: must self-install at module load');
const transitionPatch = await read('js/preview/PreviewAppPageTransitionPatch.js');
for (const piece of ['bcu-battle-enter', 'bcu-battle-leave', 'applyFormationToBattleWithPageTransition', 'returnToFormationWithPageTransition']) {
  check(transitionPatch.includes(piece), `PageTransitionPatch: missing "${piece}"`);
}
check(/installPreviewAppPageTransitionPatch\(\);\s*$/.test(transitionPatch.trim() + '\n'), 'PageTransitionPatch: must self-install at module load');
const main = await read('js/main.js');
check(main.includes('PreviewAppBattlePauseOverlayPatch.js'), 'main.js: must import the pause overlay patch');
check(main.includes('PreviewAppPageTransitionPatch.js'), 'main.js: must import the page transition patch');

// 4. Real BCU sprite regions + atlas integrity
const imgcut = await read('public/assets/bcu/000001/org/page/img002.imgcut');
check(imgcut.includes('445,1,58,58,オプションボタン'), 'img002.imgcut: オプションボタン region (445,1,58,58) changed — update sprite math in BattlePauseMenu');
check(imgcut.includes('185,317,254,55,'), 'img002.imgcut: メインメニューに戻る region (185,317,254,55) changed — update sprite math in BattlePauseMenu');
const src = await readFile(new URL('public/assets/bcu/000001/org/page/img002.png', ROOT));
const copy = await readFile(new URL('public/assets/ui/battle-option-atlas.png', ROOT));
check(Buffer.compare(src, copy) === 0, 'battle-option-atlas.png: not byte-identical to source img002.png — re-copy it');

// 5. node --check on touched modules
const touched = [
  'js/audio/AudioSettings.js',
  'js/ui/BattlePauseMenu.js',
  'js/preview/PreviewAppBattlePauseOverlayPatch.js',
  'js/preview/PreviewAppPageTransitionPatch.js',
  'js/main.js'
];
for (const rel of touched) {
  try {
    execFileSync(process.execPath, ['--check', fileURLToPath(new URL(rel, ROOT))], { stdio: 'pipe' });
  } catch (error) {
    check(false, `node --check failed for ${rel}: ${error.stderr?.toString() || error.message}`);
  }
}

if (failures.length) {
  console.error('check-battle-pause-control: FAIL');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('check-battle-pause-control: OK (audio settings + pause/option control + sprite parity)');
