import { BcuTraceRuntime } from '../battle/bcu-runtime/BcuTraceRuntime.js';

const PREVENT_SELECTORS = ['#preview-canvas', '.canvas-panel', '.prod-ui', '.prod-ui .cards', '.prod-card'];
const SCROLL_SELECTORS = ['.formation-ui', '.formation-catalog-scroll', '.stage-selector', '.stage-selector-panel', '.app-loading-overlay', '.error-overlay', 'modal'];

function matchesAny(target, selectors) {
  return selectors.some((sel) => target?.closest?.(sel));
}

export function shouldPreventBcuTouchDefault(target) {
  if (matchesAny(target, SCROLL_SELECTORS)) return false;
  return matchesAny(target, PREVENT_SELECTORS);
}

export function installBcuDomTouchPolicy(root = document) {
  if (!root || root.__bcuDomTouchPolicyInstalled) return;
  root.__bcuDomTouchPolicyInstalled = true;
  root.addEventListener('touchmove', (event) => {
    const prevent = shouldPreventBcuTouchDefault(event.target);
    BcuTraceRuntime.push('input', {
      source: 'BcuDomTouchPolicy',
      bcuReference: 'BCU Android input separated from Web DOM touch policy',
      type: 'touchmove-policy',
      preventDefaultTarget: prevent ? event.target?.className || event.target?.id || event.target?.tagName || null : null
    });
    if (prevent) event.preventDefault();
  }, { passive: false });
}

