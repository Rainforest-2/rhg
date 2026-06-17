// Wires the BCU-style pause/option control into PreviewApp.
//
// Responsibilities:
//  - construct the BattlePauseMenu (option button + paused modal) on app start,
//  - gate the BattleSimulationClock so the manual pause menu and the existing
//    tab-visibility pause coexist (resuming one must not override the other),
//  - keep the floating option button visible only while a battle is running,
//  - "戦闘を中止": leave the battle and return to the formation screen, reusing
//    returnToFormationFromBattleResult() when that patch is present.
//
// Self-installing like PreviewAppBattleResultOverlayPatch; imported from main.js.

import { PreviewApp } from './PreviewApp.js';
import { BattlePauseMenu } from '../ui/BattlePauseMenu.js';

const APP_PATCH_FLAG = Symbol.for('wanko-preview.battle-pause-overlay.v1');

// The clock must stay paused while EITHER the pause menu is open OR the tab is
// hidden; it may only run when neither holds. Centralizing the decision here is
// what lets the two pause sources coexist.
function syncSimulationPause(app) {
  const shouldPause = !!app.__pauseMenuOpen || !!app.simulationPausedByVisibility;
  if (shouldPause) app.simulationClock?.pause('pause-gate');
  else app.simulationClock?.resume(performance.now(), 'pause-gate');
}

function battleIsActive(app) {
  if (!app || !app.sceneReady || app.sceneTransitioning || !app.battleScene) return false;
  const state = app.battleScene.battleState;
  // Running, or pre-result with no terminal state recorded yet. The option
  // button must vanish on the victory/defeat result screen.
  return state === 'running' || state == null;
}

function installPauseWatcher(app) {
  if (app.__battlePauseWatcherInstalled) return;
  app.__battlePauseWatcherInstalled = true;
  const tick = () => {
    const active = battleIsActive(app);
    // If the battle ends (result screen) while the menu is open, close it so the
    // pause gate clears and the next battle is not stuck paused.
    if (!active && app.__pauseMenuOpen) app.closePauseMenu();
    app.pauseMenu?.setActive(active);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function installPreviewAppBattlePauseOverlayPatch() {
  const proto = PreviewApp?.prototype;
  if (!proto || proto[APP_PATCH_FLAG]) return;
  proto[APP_PATCH_FLAG] = true;

  const originalStart = proto.start;
  proto.start = async function startWithBattlePauseOverlay(...args) {
    const result = await originalStart.apply(this, args);
    try {
      if (!this.pauseMenu) {
        const mount = document.querySelector('.canvas-panel') || document.body;
        this.pauseMenu = new BattlePauseMenu({
          mount,
          onOpenRequest: () => this.openPauseMenu(),
          onResume: () => this.closePauseMenu(),
          onAbort: () => this.abortBattleFromPause()
        });
      }
      installPauseWatcher(this);
    } catch (error) {
      console.error('[BattlePauseOverlayPatch] init failed', error);
    }
    return result;
  };

  // Route the existing visibility pause/resume through the shared gate so it no
  // longer fights the manual pause menu (a focus event must not resume a battle
  // the player explicitly paused).
  proto.pauseSimulationByVisibility = function pauseSimulationByVisibilityGated(reason = 'hidden') {
    this.simulationPausedByVisibility = true;
    syncSimulationPause(this);
    this.battleScene?.pushEvent?.({ type: 'simulationPausedByVisibility', reason });
  };
  proto.resumeSimulationByVisibility = function resumeSimulationByVisibilityGated(reason = 'visible') {
    this.simulationPausedByVisibility = false;
    syncSimulationPause(this);
    this.battleScene?.pushEvent?.({ type: 'simulationResumedByVisibility', reason });
  };

  proto.openPauseMenu = function openPauseMenu() {
    if (this.__pauseMenuOpen || !battleIsActive(this)) return;
    this.__pauseMenuOpen = true;
    syncSimulationPause(this);
    this.pauseMenu?.open();
    this.battleScene?.pushEvent?.({ type: 'battlePauseOpened', source: 'PreviewAppBattlePauseOverlayPatch' });
  };

  proto.closePauseMenu = function closePauseMenu() {
    if (!this.__pauseMenuOpen) return;
    this.__pauseMenuOpen = false;
    this.pauseMenu?.close();
    syncSimulationPause(this);
    this.battleScene?.pushEvent?.({ type: 'battlePauseClosed', source: 'PreviewAppBattlePauseOverlayPatch' });
  };

  proto.abortBattleFromPause = function abortBattleFromPause() {
    this.__pauseMenuOpen = false;
    this.pauseMenu?.close();
    this.pauseMenu?.setActive(false);
    // Prefer the result-overlay patch's canonical "leave battle" routine; fall
    // back to the same visibility toggles it performs if that patch is absent.
    if (typeof this.returnToFormationFromBattleResult === 'function') {
      this.returnToFormationFromBattleResult();
    } else {
      this.sceneReady = false;
      if (this.battleScene) this.battleScene.battleState = 'ended-returned-to-formation';
      this.productionBar?.setVisible(false);
      this.speedControl?.setVisible(false);
      this.formationEditor?.setVisible(true);
    }
    syncSimulationPause(this);
    this.battleScene?.pushEvent?.({ type: 'battleAbortedFromPause', source: 'PreviewAppBattlePauseOverlayPatch' });
  };
}

installPreviewAppBattlePauseOverlayPatch();
