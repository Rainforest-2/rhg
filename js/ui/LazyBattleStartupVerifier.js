import { PreviewApp } from '../preview/PreviewApp.js';

export async function verifyLazyBattleStartupContract() {
  const resetSrc = PreviewApp.prototype.resetBattle?.toString?.() || '';
  const applySrc = PreviewApp.prototype.applyFormationToBattle?.toString?.() || '';
  const startSrc = PreviewApp.prototype.start?.toString?.() || '';
  const app = new PreviewApp();

  const checks = {
    hasApplyFormationToBattle: typeof PreviewApp.prototype.applyFormationToBattle === 'function',
    hasResetKeepFormationVisibleOption: resetSrc.includes('keepFormationVisible = false'),
    startDoesNotAwaitResetBattle: !startSrc.includes('await this.resetBattle'),
    initialBattleSceneNull: app.battleScene === null,
    initialSceneReadyFalse: app.sceneReady === false,
    applyHidesFormationAfterSuccess: applySrc.includes('formationEditor?.setVisible(false)'),
    applyKeepsFormationOnFailure: applySrc.includes('formationEditor?.setVisible(true)'),
  };

  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  return { ok: failed.length === 0, checks, failed };
}
