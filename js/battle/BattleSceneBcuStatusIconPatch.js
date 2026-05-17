import { BattleScene } from './BattleScene.js';
import { resolveStatusIcons } from './bcu-runtime/BcuStatusIconResolver.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-status-icon-trace-patch.v1');

export function installBattleSceneBcuStatusIconPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase !== 'function') return;
  proto.runTickPhase = function runTickPhaseWithBcuStatusIconTrace(phase, fn = () => {}) {
    if (phase !== 'effect-spawn') return originalRunTickPhase.call(this, phase, fn);
    return originalRunTickPhase.call(this, phase, () => {
      const result = fn();
      for (const actor of this.actors || []) resolveStatusIcons(actor, this);
      return result;
    });
  };
}

installBattleSceneBcuStatusIconPatch();

