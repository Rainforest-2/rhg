// iOS Safari does not reliably recompute 100dvh after the URL bar (toolbar) is
// toggled mid-session: once you hide then show (or show then hide) the toolbar,
// the dvh box can stay at a stale height while the actually-visible area changed.
// The app shell is sized with 100dvh and the battle HUD buttons (wallet upgrade +
// cat-cannon) are pinned to its bottom, so a stale-tall shell leaves its bottom
// above the real visible bottom and the buttons float up with a gap beneath them.
// Initial load is unaffected because dvh is correct before any toggle.
//
// visualViewport.height always reports the live visible height, so we publish it
// as --bcu-app-vh and let .app-shell prefer it over 100dvh (see css/style.css).
// This tracks the true visible area through every toolbar toggle without assuming
// any direction or pushing elements around. On engines without visualViewport the
// var is never set and the 100dvh fallback stands unchanged.

const APP_VH_PROP = '--bcu-app-vh';

function publishAppVh() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  if (!vv || !root) return;
  root.style.setProperty(APP_VH_PROP, `${Math.round(vv.height)}px`);
}

export function installSafeAreaViewportTracker() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__bcuSafeAreaViewportTrackerInstalled) return;
  window.__bcuSafeAreaViewportTrackerInstalled = true;
  const vv = window.visualViewport;
  if (!vv) return; // No visualViewport API: keep the 100dvh behaviour as-is.
  const onChange = () => publishAppVh();
  vv.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  publishAppVh();
}

installSafeAreaViewportTracker();
