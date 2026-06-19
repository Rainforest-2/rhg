import assert from 'node:assert/strict';
import {
  assertRuntimeUrlAllowed,
  isRawBcuUrl,
  isWhitelistedRawBcuUrl
} from '../js/bcu/RuntimeAssetGuard.js';

function createProvider() {
  return {
    allowRawFallback: false,
    diagnostics: {
      blockedRawReads: [],
      rawOnlyReads: [],
      rawWhitelistReads: []
    }
  };
}

function assertBlocked(url) {
  const provider = createProvider();
  assert.equal(isRawBcuUrl(url), true, `${url} should be detected as raw BCU URL`);
  assert.equal(isWhitelistedRawBcuUrl(url), false, `${url} must not be whitelisted`);
  assert.throws(() => assertRuntimeUrlAllowed(url, 'fetch', provider), /Raw BCU URL blocked in fetch/);
  assert.equal(provider.diagnostics.blockedRawReads.length, 1, `${url} should record one blocked read`);
  assert.equal(provider.diagnostics.rawWhitelistReads.length, 0, `${url} should not record whitelist reads`);
}

// Stage difficulty used to be the sole whitelisted raw read. It is now bundled into lang:jp and
// resolved from the ZIP, so every raw public/assets/bcu URL — Difficulty.txt included — is blocked.
for (const url of [
  'public/assets/bcu/lang/Difficulty.txt',
  './public/assets/bcu/lang/Difficulty.txt',
  '/public/assets/bcu/lang/Difficulty.txt',
  './public/assets/bcu/lang/Difficulty.txt?v=20260607',
  './public/assets/bcu/lang/Difficulty.txt#hash',
  'https://example.com/public/assets/bcu/lang/Difficulty.txt',
  './public/assets/bcu/lang/StageName.txt',
  './public/assets/bcu/org/enemy/000/enemy_icon_000.png',
  './public/assets/bcu/anything.txt',
  '/public/assets/bcu/lang/Difficulty.json',
  'https://example.com/public/assets/bcu/lang/StageName.txt'
]) {
  assertBlocked(url);
}

// Generated (bundled-build) paths remain allowed.
assert.equal(isRawBcuUrl('./public/assets/generated/bcu-stage-index.json'), false);
assert.doesNotThrow(() => assertRuntimeUrlAllowed('./public/assets/generated/bcu-stage-index.json', 'fetch', createProvider()));

console.log('OK: runtime raw guard blocks every raw BCU URL (no whitelist)');
