import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMMUNITY_FEATURE_FLAG_NAMES,
  getDefaultCommunityFeatureFlags,
  resolveCommunityFeatureFlags
} from '../js/community/CommunityFeatureFlags.js';
import { CommunityHomeController } from '../js/community/CommunityHomeController.js';

class FakeElement extends EventTarget {
  constructor(tagName) { super(); this.tagName = tagName; this.children = []; this.parentNode = null; this.attributes = new Map(); this.hidden = false; this.disabled = false; this.className = ''; this.textContent = ''; }
  append(...children) { for (const child of children) this.appendChild(child); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  remove() { const siblings = this.parentNode?.children; const index = siblings?.indexOf(this) ?? -1; if (index >= 0) siblings.splice(index, 1); this.parentNode = null; }
  setAttribute(name, value = '') { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
}

class FakeDocument { createElement(tagName) { return new FakeElement(tagName); } }

test('community flags are an immutable, fail-closed Phase 2 snapshot', () => {
  const flags = getDefaultCommunityFeatureFlags();
  assert.deepEqual(Object.keys(flags), COMMUNITY_FEATURE_FLAG_NAMES);
  assert.equal(flags.communityHome, true);
  for (const name of COMMUNITY_FEATURE_FLAG_NAMES.filter((name) => name !== 'communityHome')) assert.equal(flags[name], false);
  assert.equal(Object.isFrozen(flags), true);
  assert.throws(() => { flags.communityHome = false; }, TypeError);
  const overridden = resolveCommunityFeatureFlags({ communityHome: false, communityBrowse: 'true', unknown: true });
  assert.equal(overridden.communityHome, false);
  assert.equal(overridden.communityBrowse, false);
  assert.equal('unknown' in overridden, false);
});

test('community home mounts once, fails browse closed, and releases its listener on destroy', async () => {
  const documentRef = new FakeDocument();
  const mount = documentRef.createElement('div');
  let plays = 0;
  const home = new CommunityHomeController({ documentRef, mount, browseAvailable: true, onPlay: async () => { plays += 1; } });
  const firstRoot = home.mount();
  assert.equal(home.mount(), firstRoot);
  assert.equal(mount.children.length, 1);
  assert.equal(firstRoot.children[0].children[0].textContent, 'BWS');
  assert.equal(home.playButton.disabled, false);
  const browseButton = firstRoot.children[0].children[2].children[1].children[0];
  assert.equal(browseButton.disabled, true);
  assert.equal(browseButton.getAttribute('aria-disabled'), 'true');
  assert.match(firstRoot.children[0].children[2].children[1].children[1].textContent, /準備中/);
  home.hide(); home.hide();
  assert.equal(firstRoot.hidden, true);
  home.show(); home.show();
  assert.equal(firstRoot.hidden, false);
  home.playButton.dispatchEvent(new Event('click'));
  home.playButton.dispatchEvent(new Event('click'));
  await Promise.resolve(); await Promise.resolve();
  assert.equal(plays, 1);
  const button = home.playButton;
  home.destroy();
  assert.equal(mount.children.length, 0);
  button.dispatchEvent(new Event('click'));
  await Promise.resolve();
  assert.equal(plays, 1);
});
