// The patch list + load order is the single source of truth in ./groups/uiPatches.js.
export async function installUiPatches(onProgress) {
  await import('./groups/uiPatches.js');
  onProgress?.(1);
}
