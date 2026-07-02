import assert from 'node:assert/strict';
import test from 'node:test';

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    for (const name of names) this.values.add(name);
  }

  remove(...names) {
    for (const name of names) this.values.delete(name);
  }

  toggle(name, force) {
    const enabled = force === undefined ? !this.values.has(name) : !!force;
    if (enabled) this.values.add(name);
    else this.values.delete(name);
    return enabled;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeNode {
  constructor() {
    this.className = '';
    this.dataset = {};
    this.style = {};
    this.textContent = '';
    this.children = [];
    this.classList = new FakeClassList();
  }

  set innerHTML(_value) {}

  addEventListener() {}

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  remove() {}

  querySelector() {
    return new FakeNode();
  }

  querySelectorAll() {
    return [];
  }
}

const documentStub = {
  body: new FakeNode(),
  head: new FakeNode(),
  createElement() {
    return new FakeNode();
  },
  querySelector() {
    return new FakeNode();
  }
};

globalThis.document = documentStub;

const { AppLoadingOverlay } = await import('../js/ui/AppLoadingOverlay.js');

test('AppLoadingOverlay show resets progress for reused overlay instances', () => {
  const mount = new FakeNode();
  const overlay = new AppLoadingOverlay({ mount });

  overlay.show();
  overlay.setProgress({ phase: 'ready', value: 1.0 });
  assert.equal(overlay.lastProgressValue, 1);

  overlay.show();
  assert.equal(overlay.lastProgressValue, 0);

  overlay.setProgress({ phase: 'battle-scene', value: 0.05 });
  assert.equal(overlay.lastProgressValue, 0.05);
});
