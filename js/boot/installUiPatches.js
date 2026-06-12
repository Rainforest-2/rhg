export async function installUiPatches() {
  // Formation patches must run before PreviewApp constructs FormationEditor.
  await import('../ui/FormationEditorPerformancePatch.js');
  await import('../ui/FormationCatalogVirtualDomPatch.js');
  await import('../ui/NyankoPresentationPatch.js');
  await import('../ui/FormationJapaneseBootPatch.js');
  await import('../ui/NyankoUiBehaviorPatch.js');
  await import('../ui/ProductionCardDogIconFitPatch.js');
  await import('../ui/FormationEditorBcuUnitLevelPatch.js');
  await import('../ui/FormationCharacterTuningMobileLandscapePatch.js');
  await import('../ui/FormationCustomStageBattlePatch.js');
  await import('../ui/FormationStageDifficultyPatch.js');
  // Depends on FormationStageDifficultyPatch's scoped flag; it used to poll from index.html.
  await import('../ui/FormationStageDifficultyFilterControlPatch.js');
  await import('../ui/FormationUiRegressionFixPatch.js');
  await import('../ui/FormationPhoneLandscapeLayoutPatch.js');
  await import('../ui/FormationCustomStageBattleHpPatch.js');
  await import('../ui/FormationCustomStageBattleApplyHpConfigPatch.js');
  await import('../ui/FormationStageNameBcuPatch.js');
  // Must stay last: its motion wrappers need to run outermost around the patched prototype.
  await import('../ui/FormationPremiumMotionPatch.js');
}
