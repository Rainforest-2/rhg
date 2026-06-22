export function createProgressReporter(onProgress, label = 'progress') {
  if (typeof onProgress !== 'function') return () => {};
  let warned = false;
  return (fraction) => {
    try {
      onProgress(fraction);
    } catch (error) {
      if (!warned) {
        warned = true;
        globalThis.console?.warn?.(`[${label}] progress callback failed`, error);
      }
    }
  };
}

export function progressInBand(start, span, fraction) {
  const value = Number(fraction);
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  return start + clamped * span;
}
