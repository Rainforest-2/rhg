
const PREVENT_SELECTORS = ['#preview-canvas', '.canvas-panel', '.prod-ui', '.prod-ui .cards', '.prod-card'];
const SCROLL_SELECTORS = ['.formation-ui', '.formation-catalog-scroll', '.stage-selector', '.stage-selector-panel', '.app-loading-overlay', '.error-overlay', 'modal'];

function matchesAny(target, selectors) {
  return selectors.some((sel) => target?.closest?.(sel));
}

export function shouldPreventBcuTouchDefault(target) {
  if (matchesAny(target, SCROLL_SELECTORS)) return false;
  return matchesAny(target, PREVENT_SELECTORS);
}

// Text fields must keep their native long-press (selection / paste / callout). Everything
// else is a game/UI surface where a long-press should NOT pop the image "save photo" menu
// or a text selection.
const EDITABLE_SELECTOR = 'input,textarea,select,[contenteditable=""],[contenteditable="true"]';
function isEditableTarget(target) {
  return !!target?.closest?.(EDITABLE_SELECTOR);
}

export function installBcuDomTouchPolicy(root = document) {
  if (!root || root.__bcuDomTouchPolicyInstalled) return;
  root.__bcuDomTouchPolicyInstalled = true;
  root.addEventListener('touchmove', (event) => {
    const prevent = shouldPreventBcuTouchDefault(event.target);
    if (prevent) event.preventDefault();
  }, { passive: false });
  // Suppress the native long-press image context menu (Android "save image"/selection) and
  // the iOS callout/drag everywhere except editable fields, so a hold never interrupts the
  // app's own long-press gestures (e.g. formation slot tuning) with a browser popup.
  root.addEventListener('contextmenu', (event) => {
    if (!isEditableTarget(event.target)) event.preventDefault();
  }, { capture: true });
  root.addEventListener('dragstart', (event) => {
    if (!isEditableTarget(event.target)) event.preventDefault();
  }, { capture: true });
}

