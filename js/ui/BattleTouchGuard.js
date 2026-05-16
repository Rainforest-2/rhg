const INTERACTIVE_SCROLL_SELECTOR = [
  '.formation-ui',
  '.formation-catalog-scroll',
  '.formation-stage-overlay',
  '.app-loading-overlay',
  '.app-loading-card',
  '.stage-selector',
  '.modal',
  '[data-scrollable]'
].join(',');

const BATTLE_TOUCH_TARGET_SELECTOR = [
  '#preview-canvas',
  '.prod-ui .cards',
  '.prod-ui .lineup-cards',
  '.prod-card-stack',
  '.prod-ui .prod-card'
].join(',');

function debugState() {
  if (!globalThis.__BATTLE_TOUCH_GUARD_DEBUG__) {
    globalThis.__BATTLE_TOUCH_GUARD_DEBUG__ = {
      installed: false,
      prevented: 0,
      allowedScrollable: 0,
      ignoredInactive: 0,
      lastEvent: null
    };
  }
  return globalThis.__BATTLE_TOUCH_GUARD_DEBUG__;
}

function isBattleInputActive() {
  const app = globalThis.__APP__ || globalThis.app || null;
  const scene = app?.battleScene || app?.scene || null;
  return !!(app?.sceneReady && scene && scene.battleState === 'running');
}

function shouldAllowScrollableTarget(target) {
  return !!target?.closest?.(INTERACTIVE_SCROLL_SELECTOR);
}

function shouldGuardTarget(target) {
  return !!target?.closest?.(BATTLE_TOUCH_TARGET_SELECTOR);
}

function record(kind, event, detail = {}) {
  const debug = debugState();
  debug.lastEvent = {
    kind,
    type: event?.type || null,
    target: event?.target?.className || event?.target?.id || event?.target?.nodeName || null,
    battleInputActive: isBattleInputActive(),
    timestamp: Date.now(),
    ...detail
  };
  return debug;
}

function preventBattleDefault(event) {
  const target = event.target;
  const debug = debugState();

  if (shouldAllowScrollableTarget(target)) {
    debug.allowedScrollable += 1;
    record('allowed-scrollable', event);
    return;
  }

  if (!isBattleInputActive()) {
    debug.ignoredInactive += 1;
    record('ignored-inactive', event);
    return;
  }

  if (!shouldGuardTarget(target)) return;

  event.preventDefault?.();
  debug.prevented += 1;
  record('prevented', event, {
    bcuAndroidReference: 'BCU Android receives battle gestures inside BattleView; browser page scroll/selection must be blocked only for battle canvas/card input targets.'
  });
}

export function installBattleTouchGuard(root = document) {
  const debug = debugState();
  if (debug.installed) return debug;
  debug.installed = true;

  root.addEventListener('touchstart', preventBattleDefault, { capture: true, passive: false });
  root.addEventListener('touchmove', preventBattleDefault, { capture: true, passive: false });
  root.addEventListener('gesturestart', preventBattleDefault, { capture: true, passive: false });
  root.addEventListener('contextmenu', preventBattleDefault, { capture: true });
  root.addEventListener('selectstart', preventBattleDefault, { capture: true });
  root.addEventListener('dragstart', preventBattleDefault, { capture: true });

  return debug;
}
