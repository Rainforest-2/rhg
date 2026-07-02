// Single source of truth for the deployed asset root. The same build is served
// at / on Cloudflare Pages and at /rhg/ on GitHub Pages, so browser runtime URLs
// are resolved from the current document instead of from a host name or a fixed
// Vite base.
function resolveAssetBase() {
  if (typeof document !== 'undefined' && document.baseURI) {
    return new URL('assets', document.baseURI).href.replace(/\/$/, '');
  }
  try {
    if (import.meta && import.meta.env && import.meta.env.BASE_URL) {
      return `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}assets`.replace(/\/$/, '');
    }
  } catch {}
  return './assets';
}

// e.g. 'https://rhg.pages.dev/assets', 'https://<user>.github.io/rhg/assets',
// or './assets' in direct Node imports. No trailing slash.
export const ASSET_BASE = resolveAssetBase();

// Resolve an asset path relative to the deployed asset root.
//   assetUrl('ui/game-icon.png') -> '<current deployment>/assets/ui/game-icon.png'
export function assetUrl(rel = '') {
  return `${ASSET_BASE}/${String(rel).replace(/^\/+/, '')}`;
}
