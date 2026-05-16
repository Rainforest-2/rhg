import { BattleDebugHud } from './BattleDebugHud.js';

const INSTALL_FLAG = Symbol.for('wanko-battle.debug-hud.installed.v1');

function install() {
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
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
