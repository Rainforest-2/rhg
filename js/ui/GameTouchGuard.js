const GUARDED_SELECTOR = [
  '.canvas-panel',
  '#preview-canvas',
  '.prod-ui',
  '.prod-ui .cards',
  '.prod-card-stack',
  '.prod-card'
].join(',');

const BLOCKED_EVENTS = [
  'touchmove',
  'gesturestart',
  'contextmenu',
  'selectstart',
  'dragstart'
];

function touchGuardDebug() {
  if (!globalThis.__BCU_TOUCH_GUARD_DEBUG__) {
    globalThis.__BCU_TOUCH_GUARD_DEBUG__ = {
      source: 'GameTouchGuard',
      bcuAndroidReference: 'BCU_Android BattleSimulation/BattleView consume MotionEvent inside View; web must suppress page scroll/callout/zoom inside battle surfaces.',
      prevented: []
    };
  }
  return globalThis.__BCU_TOUCH_GUARD_DEBUG__;
}

function isGuardedTarget(target) {
  return !!target?.closest?.(GUARDED_SELECTOR);
}

function shouldPrevent(event) {
  if (!isGuardedTarget(event.target)) return false;
  if (event.target?.closest?.('.formation-ui, .formation-stage-overlay')) return false;
  return true;
}

export function installGameTouchGuard(root = document) {
  if (!root || root.__BCU_GAME_TOUCH_GUARD__) return;
  Object.defineProperty(root, '__BCU_GAME_TOUCH_GUARD__', { value: true });
  const handler = (event) => {
    if (!shouldPrevent(event)) return;
    event.preventDefault();
    const debug = touchGuardDebug();
    debug.lastPrevented = {
      type: event.type,
      target: event.target?.className || event.target?.id || event.target?.nodeName || null,
      cancelable: event.cancelable !== false,
      time: Date.now()
    };
    debug.prevented.unshift(debug.lastPrevented);
    debug.prevented.splice(20);
  };
  for (const type of BLOCKED_EVENTS) {
    root.addEventListener(type, handler, { capture: true, passive: false });
  }
  touchGuardDebug().installed = true;
}
