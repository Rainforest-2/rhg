import { CharacterModificationRenderer } from './character-modification/CharacterModificationRenderer.js';

const PATCH_FLAG = Symbol.for('rhg.character-modification-keyboard-compact.v1');
const STYLE_ID = 'character-modification-keyboard-compact-style';

function scheduleFrame(callback) {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(callback);
  }
  return globalThis.setTimeout?.(callback, 0);
}

function revealFocusedControl(renderer, target) {
  const scroller = renderer?.fieldList;
  if (!scroller?.isConnected || !scroller.contains(target)) return;
  const scrollerRect = scroller.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const margin = 8;
  const visibleTop = scrollerRect.top + margin;
  const visibleBottom = scrollerRect.bottom - margin;
  if (targetRect.top < visibleTop) {
    scroller.scrollTop -= visibleTop - targetRect.top;
  } else if (targetRect.bottom > visibleBottom) {
    scroller.scrollTop += targetRect.bottom - visibleBottom;
  }
}

function revealAfterKeyboardReflow(renderer, target) {
  // visualViewport resize, host height, grid rows and the field scroller do not
  // settle in the same frame on iOS/WebKit. Re-check across three frames so the
  // final geometry, rather than the pre-keyboard geometry, drives scrollTop.
  let remaining = 3;
  const run = () => {
    revealFocusedControl(renderer, target);
    remaining -= 1;
    if (remaining > 0) scheduleFrame(run);
  };
  scheduleFrame(run);
}

function installStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.cm-host-layer.cm-keyboard-open .cm-editor{
  grid-template-rows:48px minmax(0,1fr) 0!important;
}
.cm-host-layer.cm-keyboard-open .cm-toolbar{
  display:none!important;
}
.cm-host-layer.cm-keyboard-open .cm-footer{
  display:grid!important;
  height:0!important;
  min-height:0!important;
  max-height:0!important;
  padding:0!important;
  border:0!important;
  gap:0!important;
  overflow:hidden!important;
  visibility:hidden!important;
  pointer-events:none!important;
}
.cm-host-layer.cm-keyboard-open .cm-footer-commands,
.cm-host-layer.cm-keyboard-open .cm-status{
  display:none!important;
}
.cm-host-layer.cm-keyboard-open .cm-field-list{
  scroll-padding-block:8px!important;
}
`;
  document.head.appendChild(style);
}

function installCharacterModificationKeyboardCompactPatch() {
  installStyles();
  const proto = CharacterModificationRenderer?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalMount = proto.mount;
  proto.mount = function mountWithCompactKeyboardLayout() {
    const result = originalMount.call(this);
    const viewport = globalThis.visualViewport;
    const previousViewportHandler = this.cmViewportHandler;
    const previousFocusHandler = this.cmFocusHandler;

    viewport?.removeEventListener('resize', previousViewportHandler);
    viewport?.removeEventListener('scroll', previousViewportHandler);
    this.root?.removeEventListener('focusin', previousFocusHandler);

    const setKeyboardState = (keyboardOpen) => {
      this.editor?.classList.toggle('cm-keyboard-open', keyboardOpen);
      this.root?.closest('.cm-host-layer')?.classList.toggle('cm-keyboard-open', keyboardOpen);
      if (this.footer) {
        try { this.footer.inert = keyboardOpen; } catch {}
        if (keyboardOpen) this.footer.setAttribute('aria-hidden', 'true');
        else this.footer.removeAttribute('aria-hidden');
      }
    };

    this.cmViewportHandler = () => {
      const layoutHeight = globalThis.innerHeight || document.documentElement.clientHeight || 0;
      const viewportTop = Math.max(0, Number(viewport?.offsetTop) || 0);
      const visibleHeight = Math.max(0, Number(viewport?.height) || layoutHeight);
      const hiddenBottom = Math.max(0, layoutHeight - viewportTop - visibleHeight);
      const active = document.activeElement;
      const editableFocused = !!(
        active
        && this.root?.contains(active)
        && active.matches?.('input,select,textarea')
      );
      const keyboardOpen = editableFocused
        && hiddenBottom >= Math.max(48, layoutHeight * 0.16);
      setKeyboardState(keyboardOpen);
      if (keyboardOpen) revealAfterKeyboardReflow(this, active);
    };

    this.cmFocusHandler = (event) => {
      const target = event.target;
      if (!target?.matches?.('input,select,textarea')) return;
      revealAfterKeyboardReflow(this, target);
      if (target.matches('input[type="number"]')) scheduleFrame(() => target.select?.());
    };

    viewport?.addEventListener('resize', this.cmViewportHandler);
    viewport?.addEventListener('scroll', this.cmViewportHandler);
    this.root?.addEventListener('focusin', this.cmFocusHandler);
    this.cmViewportHandler();
    return result;
  };

  const originalDestroy = proto.destroy;
  proto.destroy = function destroyCompactKeyboardLayout() {
    if (this.footer) {
      try { this.footer.inert = false; } catch {}
      this.footer.removeAttribute('aria-hidden');
    }
    return originalDestroy.call(this);
  };
}

installCharacterModificationKeyboardCompactPatch();

export { installCharacterModificationKeyboardCompactPatch };
