import '../battle/BattleUnifiedDamageDebugPatch.js';
import '../battle/BattleCriticalEffectPatch.js';
import { BattleDebugHud } from './BattleDebugHud.js';

const INSTALL_FLAG = Symbol.for('wanko-battle.debug-hud.installed.v3');

function isDebugHudEnabled() {
  try {
    const params = new URLSearchParams(globalThis.location?.search || '');
    return params.get('debugUi') === '1' || globalThis.localStorage?.getItem?.('debugUi') === '1';
  } catch {
    return false;
  }
}

function install() {
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  globalThis.__BCU_DEBUG_HUD_INSTALL_DEBUG__ = {
    enabled: isDebugHudEnabled(),
    reason: 'BCU debug HUD is disabled unless debugUi=1 or localStorage.debugUi=1',
    timestamp: Date.now()
  };
  if (!isDebugHudEnabled()) return;
  let hud = null;
  const tick = () => {
    const app = globalThis.__APP__ || globalThis.app || null;
    if (!hud && app) {
      hud = new BattleDebugHud({ app, mount: document.body });
      globalThis.__BCU_DEBUG_HUD__ = hud;
    }
    hud?.tick?.(performance.now());
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

install();
