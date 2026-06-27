// Single source of truth for the deployed asset root.
//
// GitHub Pages serves this app under https://<user>.github.io/rhg/, so every
// runtime asset/font/bundle/index URL must be prefixed with the Vite base
// (import.meta.env.BASE_URL === '/rhg/' in the Pages build and in `vite dev` /
// `vite preview`, which all run with base '/rhg/'). Vite statically replaces
// import.meta.env.BASE_URL at build time.
//
// Node check-scripts (scripts/check-*.mjs) import runtime modules directly,
// outside Vite, where import.meta.env is undefined; they fall back to '/assets',
// which matches the historical hardcoded asset root, so deterministic checks see
// the same paths they always did.
function resolveBase() {
  try {
    if (import.meta && import.meta.env && import.meta.env.BASE_URL) {
      return import.meta.env.BASE_URL;
    }
  } catch {}
  return '/';
}

// e.g. '/rhg/assets' (browser) or '/assets' (node checks). No trailing slash.
export const ASSET_BASE = `${resolveBase()}assets`.replace(/\/{2,}/g, '/').replace(/\/$/, '');

// Resolve an asset path relative to the deployed asset root.
//   assetUrl('ui/game-icon.png') -> '/rhg/assets/ui/game-icon.png'
export function assetUrl(rel = '') {
  return `${ASSET_BASE}/${String(rel).replace(/^\/+/, '')}`;
}
