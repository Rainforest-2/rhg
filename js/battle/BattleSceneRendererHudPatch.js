import { BattleSceneRenderer } from './BattleSceneRenderer.js';

const PATCH_FLAG = Symbol.for('wanko-battle.renderer-hud-debug-gate.v1');

function isDebugUiEnabled() {
  try {
    const params = new URLSearchParams(globalThis.location?.search || '');
    return params.get('debugUi') === '1' || globalThis.localStorage?.getItem?.('debugUi') === '1';
  } catch {
    return false;
  }
}

if (!BattleSceneRenderer.prototype[PATCH_FLAG]) {
  BattleSceneRenderer.prototype[PATCH_FLAG] = true;
  const originalDrawHud = BattleSceneRenderer.prototype.drawHud;
  BattleSceneRenderer.prototype.drawHud = function drawHudOnlyWhenDebugEnabled(ctx, scene, debug) {
    if (!(debug?.showBounds || scene?.debugBattleEnabled || isDebugUiEnabled())) return;
    return originalDrawHud.call(this, ctx, scene, debug);
  };
  globalThis.__BATTLE_RENDERER_HUD_PATCH_DEBUG__ = {
    installed: true,
    behavior: 'drawHud is hidden unless debugUi=1, showBounds, or scene.debugBattleEnabled is active',
    timestamp: Date.now()
  };
}
