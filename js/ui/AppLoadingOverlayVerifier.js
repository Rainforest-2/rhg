import { AppLoadingOverlay } from './AppLoadingOverlay.js';
import { GAME_VERSION } from '../AppVersion.js';

function createNode() {
  return {
    className: '',
    children: [],
    _message: '',
    _error: '',
    _width: '',
    innerHTML: '',
    classList: { add() {}, remove() {} },
    appendChild(node) { this.children.push(node); },
    querySelector(selector) {
      if (selector === '.app-loading-message') return { set textContent(v) { this._v = v; }, get textContent() { return this._v || ''; } };
      if (selector === '.app-loading-progress-bar') return { style: { set width(v) { this._width = v; }, get width() { return this._width || ''; } } };
      if (selector === '.app-loading-error') return { set textContent(v) { this._v = v; }, get textContent() { return this._v || ''; } };
      return createNode();
    },
    querySelectorAll() { return []; }
  };
}

export async function verifyAppLoadingOverlayContract() {
  globalThis.document = { createElement: () => createNode() };
  const mount = { child: null, appendChild(el) { this.child = el; } };
  const overlay = new AppLoadingOverlay({ mount });
  overlay.show();
  overlay.setProgress({ phase: 'formation', message: 'Loading formation editor', value: 0.35 });
  overlay.setError(new Error('boom'));
  overlay.hide();
  const html = mount.child?.innerHTML || '';
  return { ok: !!mount.child && html.includes(`v${GAME_VERSION}`) && html.includes('app-loading-error'), hidden: true };
}
