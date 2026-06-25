import { importWithProgress } from './importProgress.js';

export async function installUiPatches(onProgress) {
  // Formation patches must run before PreviewApp constructs FormationEditor.
  await importWithProgress([
    () => import('../ui/FormationEditorPerformancePatch.js'),
    () => import('../ui/FormationCatalogVirtualDomPatch.js'),
    () => import('../ui/NyankoPresentationPatch.js'),
    () => import('../ui/FormationJapaneseBootPatch.js'),
    () => import('../ui/NyankoUiBehaviorPatch.js'),
    () => import('../ui/ProductionCardDogIconFitPatch.js'),
    () => import('../ui/FormationEditorBcuUnitLevelPatch.js'),
    () => import('../ui/FormationCharacterTuningMobileLandscapePatch.js'),
    () => import('../ui/FormationCustomStageBattlePatch.js'),
    () => import('../ui/FormationStageDifficultyPatch.js'),
    // Depends on FormationStageDifficultyPatch's scoped flag; it used to poll from index.html.
    () => import('../ui/FormationStageDifficultyFilterControlPatch.js'),
    () => import('../ui/FormationUiRegressionFixPatch.js'),
    () => import('../ui/FormationPhoneLandscapeLayoutPatch.js'),
    () => import('../ui/FormationCustomStageBattleHpPatch.js'),
    () => import('../ui/FormationCustomStageBattleApplyHpConfigPatch.js'),
    () => import('../ui/FormationStageNameBcuPatch.js'),
    // Must stay last: its motion wrappers need to run outermost around the patched prototype.
    () => import('../ui/FormationPremiumMotionPatch.js')
  ], onProgress);
}
