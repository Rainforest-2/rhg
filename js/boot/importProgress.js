// Run an ordered list of dynamic-import thunks, reporting fractional progress
// (0..1) after each resolves. Each thunk keeps its own `import('./relative')` so
// specifiers resolve against the calling module, and the array order IS the import
// order — installers that depend on load order stay correct. Errors propagate (the
// caller isolates groups), so progress only advances past a module that loaded.
export async function importWithProgress(thunks, onProgress) {
  const total = Array.isArray(thunks) ? thunks.length : 0;
  for (let i = 0; i < total; i += 1) {
    await thunks[i]();
    if (typeof onProgress === 'function') onProgress((i + 1) / total);
  }
}

// Map a child progress fraction (0..1) into [start, start+span] of a parent bar.
export function subProgress(onProgress, start, span) {
  if (typeof onProgress !== 'function') return undefined;
  return (fraction) => {
    const f = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
    onProgress(start + f * span);
  };
}
