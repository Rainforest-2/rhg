import { installBcuDomTouchPolicy } from '../input/BcuDomTouchPolicy.js';
import { BcuTraceRuntime } from './bcu-runtime/BcuTraceRuntime.js';

export function installBattleSceneBcuMobileInputPatch(root = globalThis.document) {
  if (root) installBcuDomTouchPolicy(root);
  BcuTraceRuntime.push('input', {
    source: 'BattleSceneBcuMobileInputPatch',
    bcuReference: 'BattleView.checkSlideUpDown/BattleSimulation MotionEvent/SBCtrl.actions',
    mode: 'DOM policy installed; gesture runtime available',
    unresolved: 'Existing production UI lineup hooks were not replaced in this patch'
  });
}

installBattleSceneBcuMobileInputPatch();
