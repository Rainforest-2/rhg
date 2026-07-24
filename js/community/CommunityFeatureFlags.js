// Phase 2 keeps feature resolution deliberately local and synchronous.  A later
// deployment-config provider can be introduced behind this module without making
// UI owners read globals, storage, query parameters, or network state directly.
export const COMMUNITY_FEATURE_FLAG_NAMES = Object.freeze([
  'communityHome',
  'communityBrowse',
  'communityAuth',
  'communityPublish',
  'communitySocial',
  'communityStats',
  'communityRestrictions',
  'communityAdmin',
  'communityFallback'
]);

const DEFAULT_FLAGS = Object.freeze({
  communityHome: true,
  communityBrowse: false,
  communityAuth: false,
  communityPublish: false,
  communitySocial: false,
  communityStats: false,
  communityRestrictions: false,
  communityAdmin: false,
  communityFallback: false
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Overrides are intentionally an explicit bootstrap/test boundary. Only literal
// booleans are accepted; unknown keys never become part of a snapshot.
export function resolveCommunityFeatureFlags(overrides = null) {
  const source = isPlainObject(overrides) ? overrides : null;
  const snapshot = {};
  for (const name of COMMUNITY_FEATURE_FLAG_NAMES) {
    const override = source?.[name];
    snapshot[name] = typeof override === 'boolean' ? override : DEFAULT_FLAGS[name];
  }
  return Object.freeze(snapshot);
}

export function getDefaultCommunityFeatureFlags() {
  return resolveCommunityFeatureFlags();
}

// This is the sole optional global read. It exists only for an explicit bootstrap
// override (tests and emergency rollback); normal production startup supplies none.
export function readCommunityFeatureFlagBootstrapOverride(globalRef = globalThis) {
  try {
    const candidate = globalRef?.__RHG_COMMUNITY_FEATURE_FLAGS__;
    return isPlainObject(candidate) ? candidate : null;
  } catch {
    return null;
  }
}
