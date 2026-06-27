// Map a child progress fraction (0..1) into [start, start+span] of a parent bar.
// installBattlePatches uses this so each boot patch group advances the shared bar
// proportionally to its weight instead of jumping the whole band at once.
export function subProgress(onProgress, start, span) {
  if (typeof onProgress !== 'function') return undefined;
  return (fraction) => {
    const f = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
    onProgress(start + f * span);
  };
}
