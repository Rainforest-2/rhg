import {
  activateCharacterModificationDialog,
  announceCharacterModification,
  createCharacterModificationLiveRegion
} from './CharacterModificationAccessibility.js';

function requireElement(value, label) {
  if (!value || value.nodeType !== 1) throw new TypeError(`${label} must be a DOM element`);
  return value;
}

function createElement(tag, className) {
  const element = document.createElement(tag);
  element.className = className;
  return element;
}

function lockDocumentScroll() {
  if (typeof document === 'undefined') return () => {};
  const html = document.documentElement;
  const body = document.body;
  const record = {
    htmlOverflow: html.style.overflow,
    htmlOverscroll: html.style.overscrollBehavior,
    bodyOverflow: body?.style.overflow,
    bodyOverscroll: body?.style.overscrollBehavior
  };
  html.style.overflow = 'hidden';
  html.style.overscrollBehavior = 'none';
  if (body) {
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
  }
  return () => {
    html.style.overflow = record.htmlOverflow;
    html.style.overscrollBehavior = record.htmlOverscroll;
    if (body) {
      body.style.overflow = record.bodyOverflow;
      body.style.overscrollBehavior = record.bodyOverscroll;
    }
  };
}

function numericCssValue(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bindVisualViewport(element, {
  embedded = false,
  container = null
} = {}) {
  const viewport = globalThis.visualViewport;
  if (!element || !viewport) return () => {};
  const update = () => {
    const viewportHeight = Math.max(0, Number(viewport.height) || 0);
    const viewportTop = Math.max(0, Number(viewport.offsetTop) || 0);
    element.style.setProperty('--cm-viewport-height', `${Math.round(viewportHeight)}px`);
    element.style.setProperty('--cm-viewport-top', `${Math.round(viewportTop)}px`);
    const keyboard = Math.max(0, globalThis.innerHeight - viewportHeight - viewportTop);
    element.style.setProperty('--cm-keyboard-offset', `${Math.round(keyboard)}px`);
    if (embedded && container) {
      const rect = container.getBoundingClientRect();
      const style = globalThis.getComputedStyle?.(container);
      const paddingTop = numericCssValue(style?.paddingTop);
      const paddingBottom = numericCssValue(style?.paddingBottom);
      const contentTop = rect.top + container.clientTop + paddingTop;
      const contentHeight = Math.max(
        0,
        container.clientHeight - paddingTop - paddingBottom
      );
      const visibleTop = Math.max(contentTop, viewportTop);
      const visibleBottom = Math.min(
        contentTop + contentHeight,
        viewportTop + viewportHeight
      );
      element.style.setProperty(
        '--cm-available-height',
        `${Math.max(0, Math.round(visibleBottom - visibleTop))}px`
      );
      element.style.setProperty(
        '--cm-viewport-inset-top',
        `${Math.max(0, Math.round(visibleTop - contentTop))}px`
      );
    }
  };
  update();
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  // Desktop emulation and a subset of mobile WebViews update the layout
  // viewport before (or without) emitting visualViewport.resize. The dialog's
  // CSS variables must follow either signal so an embedded editor cannot keep
  // its pre-keyboard height.
  globalThis.addEventListener?.('resize', update);
  return () => {
    viewport.removeEventListener('resize', update);
    viewport.removeEventListener('scroll', update);
    globalThis.removeEventListener?.('resize', update);
    element.style.removeProperty('--cm-viewport-height');
    element.style.removeProperty('--cm-viewport-top');
    element.style.removeProperty('--cm-keyboard-offset');
    element.style.removeProperty('--cm-available-height');
    element.style.removeProperty('--cm-viewport-inset-top');
  };
}

const EMBEDDED_ISOLATION_EVENTS = Object.freeze([
  'click',
  'dblclick',
  'contextmenu',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'pointercancel',
  'touchstart',
  'touchmove',
  'touchend',
  'wheel'
]);

export class CharacterModificationOverlayHost {
  constructor({
    mode = 'standalone',
    mount,
    overlay = null,
    trigger = null,
    onRequestClose = null,
    manageDocumentScroll = true,
    inertBackground = true,
    label = 'キャラクター改造'
  } = {}) {
    if (typeof document === 'undefined') throw new Error('CharacterModificationOverlayHost requires a DOM');
    this.mode = mode === 'embedded' ? 'embedded' : 'standalone';
    this.mount = requireElement(mount, 'Character modification host mount');
    this.overlay = overlay ? requireElement(overlay, 'Character modification overlay') : null;
    this.trigger = trigger;
    this.onRequestClose = onRequestClose;
    this.manageDocumentScroll = manageDocumentScroll !== false;
    this.inertBackground = inertBackground !== false;
    this.label = label;
    this.isOpen = false;
    this.ownsContainer = false;
    this.hiddenChildren = [];
    this.containerWasOpen = false;
    this.cleanupAccessibility = null;
    this.cleanupViewport = null;
    this.unlockScroll = null;
    this.boundEmbeddedIsolation = (event) => event.stopPropagation();
    this.build();
  }

  build() {
    if (this.mode === 'embedded') {
      this.container = this.mount;
      this.layer = createElement('section', 'cm-host-layer cm-host-layer-embedded');
      this.dialog = createElement('div', 'cm-dialog cm-dialog-embedded');
      this.editorRoot = createElement('div', 'cm-editor-root');
      this.dialog.appendChild(this.editorRoot);
      this.layer.appendChild(this.dialog);
      this.liveRegion = createCharacterModificationLiveRegion(this.layer);
      this.layer.hidden = true;
      for (const type of EMBEDDED_ISOLATION_EVENTS) {
        this.layer.addEventListener(type, this.boundEmbeddedIsolation);
      }
      return;
    }

    if (this.overlay) {
      this.container = this.overlay;
    } else {
      this.container = createElement('section', 'cm-overlay');
      this.mount.appendChild(this.container);
      this.ownsContainer = true;
    }
    this.layer = createElement('div', 'cm-host-layer cm-host-layer-standalone');
    this.scrim = createElement('div', 'cm-backdrop');
    this.scrim.dataset.cmBackdrop = '1';
    this.dialog = createElement('div', 'cm-dialog');
    this.editorRoot = createElement('div', 'cm-editor-root');
    this.dialog.appendChild(this.editorRoot);
    this.layer.append(this.scrim, this.dialog);
    this.liveRegion = createCharacterModificationLiveRegion(this.layer);
    this.layer.hidden = true;
    this.container.appendChild(this.layer);
    this.scrim.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.requestClose('backdrop', event);
    });
  }

  setRequestCloseHandler(handler) {
    this.onRequestClose = handler;
  }

  requestClose(reason = 'close', event = null) {
    return this.onRequestClose?.(reason, event);
  }

  open({ initialFocus = '[data-cm-search]' } = {}) {
    if (this.isOpen) return this.editorRoot;
    this.isOpen = true;
    this.containerWasOpen = this.container.classList.contains('is-open');
    if (this.mode === 'embedded' || (this.mode === 'standalone' && !this.ownsContainer)) {
      this.hiddenChildren = [...this.container.children].filter((child) => child !== this.layer).map((child) => ({
        child,
        hidden: child.hidden,
        inert: child.inert,
        ariaHidden: child.getAttribute('aria-hidden')
      }));
      for (const record of this.hiddenChildren) {
        record.child.hidden = true;
        try { record.child.inert = true; } catch {}
        record.child.setAttribute('aria-hidden', 'true');
      }
      if (this.mode === 'embedded') {
        this.mount.classList.add('cm-embedded-container');
        this.mount.appendChild(this.layer);
      }
    }
    this.layer.hidden = false;
    this.layer.classList.add('is-open');
    this.container.classList.add('cm-host-active', 'is-open');
    this.cleanupViewport = bindVisualViewport(this.layer, {
      embedded: this.mode === 'embedded',
      container: this.mode === 'embedded' ? this.mount : null
    });
    if (this.manageDocumentScroll) this.unlockScroll = lockDocumentScroll();
    this.cleanupAccessibility = activateCharacterModificationDialog({
      dialog: this.dialog,
      trigger: this.trigger,
      initialFocus,
      onEscape: (reason, event) => this.requestClose(reason, event),
      onBack: (reason, event) => this.requestClose(reason, event),
      backgroundRoot: this.mode === 'standalone'
        ? this.mount
        : (this.mount.parentElement || this.mount),
      inertBackground: this.inertBackground,
      label: this.label
    });
    return this.editorRoot;
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.cleanupAccessibility?.();
    this.cleanupAccessibility = null;
    this.cleanupViewport?.();
    this.cleanupViewport = null;
    this.unlockScroll?.();
    this.unlockScroll = null;
    this.layer.classList.remove('is-open', 'is-busy');
    this.layer.hidden = true;
    this.dialog.removeAttribute('aria-busy');
    this.container.classList.remove('cm-host-active');
    if (!this.containerWasOpen) this.container.classList.remove('is-open');
    if (this.mode === 'embedded' || (this.mode === 'standalone' && !this.ownsContainer)) {
      for (const record of this.hiddenChildren) {
        record.child.hidden = record.hidden;
        try { record.child.inert = record.inert; } catch {}
        if (record.ariaHidden == null) record.child.removeAttribute('aria-hidden');
        else record.child.setAttribute('aria-hidden', record.ariaHidden);
      }
      this.hiddenChildren = [];
      if (this.mode === 'embedded') {
        this.mount.classList.remove('cm-embedded-container');
        this.layer.remove();
      }
    }
  }

  setBusy(busy) {
    this.layer.classList.toggle('is-busy', !!busy);
    this.dialog.setAttribute('aria-busy', busy ? 'true' : 'false');
    for (const button of this.dialog.querySelectorAll('button')) {
      if (busy) {
        button.dataset.cmWasDisabled = button.disabled ? '1' : '0';
        button.disabled = true;
      } else if (button.dataset.cmWasDisabled != null) {
        button.disabled = button.dataset.cmWasDisabled === '1';
        delete button.dataset.cmWasDisabled;
      }
    }
  }

  announce(message, options = {}) {
    announceCharacterModification(this.liveRegion, message, options);
  }

  destroy() {
    this.close();
    if (this.mode === 'embedded' && this.layer) {
      for (const type of EMBEDDED_ISOLATION_EVENTS) {
        this.layer.removeEventListener(type, this.boundEmbeddedIsolation);
      }
    }
    this.layer?.remove();
    if (this.ownsContainer) this.container?.remove();
    this.editorRoot = null;
    this.dialog = null;
    this.layer = null;
    this.container = null;
  }
}

export function createCharacterModificationHost(options = {}) {
  return new CharacterModificationOverlayHost(options);
}
