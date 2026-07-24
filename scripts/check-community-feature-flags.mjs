import assert from 'node:assert/strict';
import { COMMUNITY_FEATURE_FLAG_NAMES, getDefaultCommunityFeatureFlags, resolveCommunityFeatureFlags } from '../js/community/CommunityFeatureFlags.js';

const defaults = getDefaultCommunityFeatureFlags();
assert.deepEqual(Object.keys(defaults), COMMUNITY_FEATURE_FLAG_NAMES);
assert.equal(defaults.communityHome, true);
for (const name of COMMUNITY_FEATURE_FLAG_NAMES.filter((name) => name !== 'communityHome')) assert.equal(defaults[name], false);
assert.equal(Object.isFrozen(defaults), true);
const resolved = resolveCommunityFeatureFlags({ communityHome: false, communityBrowse: 'true', unknown: true });
assert.equal(resolved.communityHome, false);
assert.equal(resolved.communityBrowse, false);
assert.equal('unknown' in resolved, false);
console.log('check-community-feature-flags: OK');
