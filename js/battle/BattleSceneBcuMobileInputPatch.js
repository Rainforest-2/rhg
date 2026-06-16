import { installBcuDomTouchPolicy } from '../input/BcuDomTouchPolicy.js';

export function installBattleSceneBcuMobileInputPatch(root = globalThis.document) {
  if (root) installBcuDomTouchPolicy(root);
}

installBattleSceneBcuMobileInputPatch();
