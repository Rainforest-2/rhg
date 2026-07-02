// Locks the battle lineup swipe gesture to its BCU Android source:
//   BCU_Android BattleView.kt
//     checkSlideUpDown(): guard battleEnd/lineupChanging/isOneLineup/
//       ubase.health==0/dragFrame==0/performed; minDistance = height * 0.15;
//       v = dy / dragFrame; v < 0 -> ACTION_LINEUP_CHANGE_UP else DOWN
//     isInSlideRange(): tan(50deg) >= abs(dx) / abs(dy)
//   BattleSimulation.kt touch listener: slide-range drags are excluded from
//     horizontal camera panning and routed to checkSlideUpDown().
// The live owner is js/ui/PlayerProductionBar.js (no separate gesture module).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('js/ui/PlayerProductionBar.js', 'utf8');

assert.match(src, /ANDROID_LINEUP_SLIDE_ANGLE_DEG = 50/,
  'slide angle must stay 50deg (BattleView.isInSlideRange tan(Math.toRadians(50.0)))');
assert.match(src, /ANDROID_LINEUP_SLIDE_DISTANCE_RATIO = 0\.15/,
  'slide min distance must stay height * 0.15 (BattleView.checkSlideUpDown)');
assert.match(src, /ANDROID_LINEUP_SLIDE_TAN >= Math\.abs\(dx\) \/ Math\.abs\(dy\)/,
  'slide range must compare tan(50deg) >= |dx|/|dy| (BattleView.isInSlideRange)');
assert.match(src, /\(dy \/ st\.dragFrame\) < 0 \? 'up' : 'down'/,
  'direction must use v = dy/dragFrame, v<0 => up (BattleView.checkSlideUpDown)');
assert.match(src, /ANDROID_LINEUP_SLIDE_DISTANCE_RATIO;/,
  'minDistance must be derived from the 0.15 ratio constant');
// BCU guard set: battleEnd / lineupChanging / isOneLineup / ubase dead / performed.
assert.match(src, /battleState !== 'running' \|\| this\.scene\?\.lineupChanging \|\| !this\.scene\?\.hasBackLineup\?\.\(\) \|\| !scenePlayerBaseAlive\(this\.scene\)/,
  'guards must mirror BattleView.checkSlideUpDown (battleEnd/lineupChanging/isOneLineup/ubase.health==0)');
assert.match(src, /st\.performed \|\| !st\.isSliding \|\| st\.dragFrame === 0/,
  'performed/dragFrame guards must mirror BattleView.checkSlideUpDown');

// The one-shot latch: once performed, later moves of the same drag are consumed.
assert.match(src, /st\.performed = true;\s*\n\s*st\.vertical = true;/,
  'performed/vertical latch must be set on a successful slide (BattleSimulation vertical flag)');

console.log('check-bcu-lineup-slide-gesture-parity: OK');
