const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(',');

function isVisible(element) {
  if (!element || typeof element.getBoundingClientRect !== 'function') return false;
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
  const style = globalThis.getComputedStyle?.(element);
  if (style?.display === 'none' || style?.visibility === 'hidden') return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function getCharacterModificationFocusableElements(root) {
  if (!root?.querySelectorAll) return [];
  return [...root.querySelectorAll(FOCUSABLE_SELECTOR)].filter(isVisible);
}

export function createCharacterModificationLiveRegion(root, { assertive = false } = {}) {
  if (!root || typeof document === 'undefined') return null;
  let region = root.querySelector?.('[data-cm-live-region]');
  if (region) return region;
  region = document.createElement('div');
  region.className = 'cm-sr-only';
  region.dataset.cmLiveRegion = '1';
  region.setAttribute('role', assertive ? 'alert' : 'status');
  region.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
  region.setAttribute('aria-atomic', 'true');
  root.appendChild(region);
  return region;
}

export function announceCharacterModification(liveRegion, message, { assertive = false } = {}) {
  if (!liveRegion) return;
  liveRegion.setAttribute('role', assertive ? 'alert' : 'status');
  liveRegion.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
  liveRegion.textContent = '';
  globalThis.setTimeout?.(() => {
    if (liveRegion.isConnected) liveRegion.textContent = String(message || '');
  }, 20);
}

function inertSiblings(dialogRoot, backgroundRoot) {
  if (!dialogRoot || !backgroundRoot?.children) return () => {};
  const records = [];
  for (const child of backgroundRoot.children) {
    if (child === dialogRoot || child.contains?.(dialogRoot)) continue;
    records.push({
      child,
      inert: child.inert,
      ariaHidden: child.getAttribute('aria-hidden')
    });
    try { child.inert = true; } catch {}
    child.setAttribute('aria-hidden', 'true');
  }
  return () => {
    for (const record of records) {
      try { record.child.inert = record.inert; } catch {}
      if (record.ariaHidden == null) record.child.removeAttribute('aria-hidden');
      else record.child.setAttribute('aria-hidden', record.ariaHidden);
    }
  };
}

export function activateCharacterModificationDialog({
  dialog,
  trigger = null,
  initialFocus = null,
  onEscape = null,
  onBack = null,
  backgroundRoot = null,
  inertBackground = false,
  label = 'キャラクター改造'
} = {}) {
  if (!dialog || typeof document === 'undefined') return () => {};
  const returnTarget = trigger?.isConnected ? trigger : document.activeElement;
  const previousRole = dialog.getAttribute('role');
  const previousModal = dialog.getAttribute('aria-modal');
  const previousLabel = dialog.getAttribute('aria-label');
  const previousTabIndex = dialog.getAttribute('tabindex');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  if (!dialog.getAttribute('aria-labelledby') && !dialog.getAttribute('aria-label')) {
    dialog.setAttribute('aria-label', label);
  }
  if (!dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;

  const restoreBackground = inertBackground ? inertSiblings(dialog, backgroundRoot) : () => {};
  const keydown = (event) => {
    if (!dialog.isConnected) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      (onEscape || onBack)?.('escape', event);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = getCharacterModificationFocusableElements(dialog);
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  const click = (event) => {
    const back = event.target?.closest?.('[data-cm-back]');
    if (!back || !dialog.contains(back)) return;
    event.preventDefault();
    onBack?.('back', event);
  };
  const focusin = (event) => {
    const control = event.target;
    if (!control?.matches?.('input,select,textarea,[contenteditable="true"]')) return;
    globalThis.setTimeout?.(() => {
      if (!control.isConnected || !dialog.contains(control)) return;
      try { control.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch {}
    }, 180);
  };

  document.addEventListener('keydown', keydown, true);
  dialog.addEventListener('click', click);
  dialog.addEventListener('focusin', focusin);
  const focusTarget = typeof initialFocus === 'string'
    ? dialog.querySelector(initialFocus)
    : initialFocus;
  globalThis.requestAnimationFrame?.(() => {
    const first = focusTarget || getCharacterModificationFocusableElements(dialog)[0] || dialog;
    try { first.focus({ preventScroll: true }); } catch {}
  });

  return () => {
    document.removeEventListener('keydown', keydown, true);
    dialog.removeEventListener('click', click);
    dialog.removeEventListener('focusin', focusin);
    restoreBackground();
    if (previousRole == null) dialog.removeAttribute('role'); else dialog.setAttribute('role', previousRole);
    if (previousModal == null) dialog.removeAttribute('aria-modal'); else dialog.setAttribute('aria-modal', previousModal);
    if (previousLabel == null) dialog.removeAttribute('aria-label'); else dialog.setAttribute('aria-label', previousLabel);
    if (previousTabIndex == null) dialog.removeAttribute('tabindex'); else dialog.setAttribute('tabindex', previousTabIndex);
    globalThis.requestAnimationFrame?.(() => {
      if (returnTarget?.isConnected && typeof returnTarget.focus === 'function') {
        try { returnTarget.focus({ preventScroll: true }); } catch {}
      }
    });
  };
}
