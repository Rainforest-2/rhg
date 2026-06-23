// Observable storage-failure reporting.
//
// Repository-local browser persistence (formation/lineup options, selected stage)
// uses localStorage, which can fail silently: private-mode SecurityError on read,
// QuotaExceededError on write. Swallowing those made a lost save invisible. These
// helpers turn a swallowed failure into a structured, inspectable signal (last
// error + listeners + a DOM CustomEvent) so the UI or a diagnostic can surface it.
//
// This is intentionally NOT a BCU save-format/compatibility claim: it only makes
// the repository-local persistence layer's failures observable. No side effects on
// import; everything is opt-in.

const listeners = new Set();
let lastError = null;

export function reportStorageFailure(scope, op, error) {
  lastError = {
    scope: String(scope || 'storage'),
    op: String(op || 'access'),
    name: error?.name || null,
    message: String(error?.message || error || 'unknown storage error'),
    at: Date.now()
  };
  try { console.warn(`[storage] ${lastError.scope} ${lastError.op} failed: ${lastError.message}`); } catch {}
  for (const listener of listeners) { try { listener(lastError); } catch {} }
  try {
    if (typeof globalThis.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      globalThis.dispatchEvent(new CustomEvent('wanko-storage-error', { detail: lastError }));
    }
  } catch {}
  return lastError;
}

export function clearStorageFailure(scope, op) {
  if (lastError && lastError.scope === String(scope) && (op == null || lastError.op === String(op))) lastError = null;
}

export function getLastStorageFailure() { return lastError; }

export function onStorageFailure(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}
