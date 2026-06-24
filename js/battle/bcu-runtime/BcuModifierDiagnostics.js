// Observable modifier-registry load-failure reporting.
//
// Battle stat modifiers — Nyanko combos and talents (PCoin) — load from the
// bundled core-db at boot (see BcuComboRegistryLoader / BcuTalentRegistryLoader).
// A read/parse failure leaves the registry empty, so a player who configured
// combos/talents would silently fight without them. The boot installers used to
// only push to __BATTLE_BOOT_PATCH_ERRORS__, a dead-letter array nothing
// battle-facing reads — so the failure was invisible.
//
// These helpers turn a swallowed modifier-registry failure into a structured,
// inspectable signal (per-registry status + listeners + a DOM CustomEvent) so the
// battle UI or a diagnostic can surface "your combos/talents failed to load"
// instead of degrading invisibly.
//
// This makes NO BCU save/lineup compatibility claim: it only records whether the
// bundled modifier tables loaded. No side effects on import; everything is opt-in.

const REGISTRIES = Object.freeze(['combo', 'talent']);
const listeners = new Set();
const status = new Map(); // registry -> { registry, ok, name, message, at }

function normalizeRegistry(registry) {
  const key = String(registry || '').toLowerCase();
  return REGISTRIES.includes(key) ? key : null;
}

/**
 * Record the load result for a modifier registry. On failure it notifies
 * listeners and dispatches a `wanko-modifier-registry-error` DOM event so the
 * battle UI can warn that configured combos/talents are not applied.
 *
 * @param {'combo'|'talent'} registry
 * @param {boolean} ok  true when the registry loaded, false on read/parse failure.
 * @param {*} [error]   the failure cause (only used when `ok` is false).
 * @returns {object|null} the recorded status, or null for an unknown registry.
 */
export function reportModifierRegistryResult(registry, ok, error = null) {
  const key = normalizeRegistry(registry);
  if (!key) return null;
  const record = {
    registry: key,
    ok: ok === true,
    name: ok ? null : (error?.name || null),
    message: ok ? null : String(error?.message || error || 'unknown modifier registry error'),
    at: Date.now()
  };
  status.set(key, record);
  if (!record.ok) {
    try { console.warn(`[modifier] ${key} registry load failed; ${key} modifiers disabled: ${record.message}`); } catch {}
    for (const listener of listeners) { try { listener(record); } catch {} }
    try {
      if (typeof globalThis.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        globalThis.dispatchEvent(new CustomEvent('wanko-modifier-registry-error', { detail: record }));
      }
    } catch {}
  }
  return record;
}

/** Last recorded status for a registry, or null if it has not reported yet. */
export function getModifierRegistryStatus(registry) {
  const key = normalizeRegistry(registry);
  return key ? (status.get(key) || null) : null;
}

/** True when the registry reported a load failure (modifiers disabled). */
export function isModifierRegistryFailed(registry) {
  const record = getModifierRegistryStatus(registry);
  return !!record && record.ok === false;
}

/** All registries that reported a load failure. */
export function getFailedModifierRegistries() {
  return [...status.values()].filter((r) => r && r.ok === false);
}

/** Subscribe to modifier-registry load failures. Returns an unsubscribe fn. */
export function onModifierRegistryFailure(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reset all recorded statuses (test/diagnostic seam). */
export function clearModifierRegistryStatus() { status.clear(); }

export { REGISTRIES as MODIFIER_REGISTRIES };
