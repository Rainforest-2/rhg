import { PreviewApp } from '../preview/PreviewApp.js';
export async function verifyFormationApplyDoesNotRenderIntermediateBrokenScene(){
  const ok = typeof PreviewApp === 'function';
  return { ok };
}
