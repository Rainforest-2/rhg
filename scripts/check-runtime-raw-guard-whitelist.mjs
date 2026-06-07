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

function assertAllowed(url) {
  const provider = createProvider();
  assert.equal(isRawBcuUrl(url), true, `${url} should be detected as raw BCU URL`);
  assert.equal(isWhitelistedRawBcuUrl(url), true, `${url} should be whitelisted`);
  assert.doesNotThrow(() => assertRuntimeUrlAllowed(url, 'fetch', provider));
  assert.equal(provider.diagnostics.blockedRawReads.length, 0, `${url} should not be blocked`);
  assert.equal(provider.diagnostics.rawOnlyReads.length, 0, `${url} should not be treated as raw-only fallback`);
  assert.equal(provider.diagnostics.rawWhitelistReads.length, 1, `${url} should record one whitelist read`);
  assert.equal(provider.diagnostics.rawWhitelistReads[0].url, String(url));
}

function assertBlocked(url) {
  const provider = createProvider();
  assert.equal(isRawBcuUrl(url), true, `${url} should be detected as raw BCU URL`);
  assert.equal(isWhitelistedRawBcuUrl(url), false, `${url} should not be whitelisted`);
  assert.throws(() => assertRuntimeUrlAllowed(url, 'fetch', provider), /Raw BCU URL blocked in fetch/);
  assert.equal(provider.diagnostics.blockedRawReads.length, 1, `${url} should record one blocked read`);
  assert.equal(provider.diagnostics.rawWhitelistReads.length, 0, `${url} should not record whitelist reads`);
}

for (const url of [
  'public/assets/bcu/lang/Difficulty.txt',
  './public/assets/bcu/lang/Difficulty.txt',
  '/public/assets/bcu/lang/Difficulty.txt',
  './public/assets/bcu/lang/Difficulty.txt?v=20260607',
  './public/assets/bcu/lang/Difficulty.txt#hash',
  'https://example.com/public/assets/bcu/lang/Difficulty.txt',
  'https://example.com/public/assets/bcu/lang/Difficulty.txt?v=1#hash'
]) {
  assertAllowed(url);
}

for (const url of [
  './public/assets/bcu/lang/StageName.txt',
  './public/assets/bcu/org/enemy/000/enemy_icon_000.png',
  './public/assets/bcu/anything.txt',
  '/public/assets/bcu/lang/Difficulty.json',
  'https://example.com/public/assets/bcu/lang/StageName.txt'
]) {
  assertBlocked(url);
}

assert.equal(isRawBcuUrl('./public/assets/generated/bcu-stage-index.json'), false);
assert.doesNotThrow(() => assertRuntimeUrlAllowed('./public/assets/generated/bcu-stage-index.json', 'fetch', createProvider()));

console.log('OK: runtime raw guard allows only BCU Difficulty.txt whitelist');
