// Single source of truth for the UI boot patch group (dev + prod).
// Static imports execute top-to-bottom, so the order below IS the install order.
// Formation patches must run before PreviewApp constructs FormationEditor.
// Migrate the custom-stage-battle config to schema v2 (typed refs) before any UI patch reads it.
import '../../custom-stage/CustomStageBoot.js';
import '../../ui/FormationEditorPerformancePatch.js';
import '../../ui/FormationCatalogVirtualDomPatch.js';
import '../../ui/NyankoPresentationPatch.js';
import '../../ui/FormationJapaneseBootPatch.js';
import '../../ui/NyankoUiBehaviorPatch.js';
import '../../ui/ProductionCardDogIconFitPatch.js';
import '../../ui/FormationEditorBcuUnitLevelPatch.js';
import '../../ui/FormationCharacterModificationPatch.js';
import '../../ui/CharacterModificationUsabilityPatch.js';
import '../../ui/CharacterModificationViewportStabilityPatch.js';
import '../../ui/FormationCharacterTuningMobileLandscapePatch.js';
import '../../ui/FormationCustomStageBattlePatch.js';
import '../../ui/FormationStageDifficultyPatch.js';
// Depends on FormationStageDifficultyPatch's scoped flag; it used to poll from index.html.
import '../../ui/FormationStageDifficultyFilterControlPatch.js';
import '../../ui/FormationUiRegressionFixPatch.js';
import '../../ui/FormationPhoneLandscapeLayoutPatch.js';
import '../../ui/FormationPhonePortraitLayoutPatch.js';
import '../../ui/FormationCustomStageBattleHpPatch.js';
import '../../ui/FormationCustomStageBattleApplyHpConfigPatch.js';
import '../../ui/FormationCustomStageBuilderPatch.js';
import '../../ui/FormationStageNameBcuPatch.js';
// Must stay last: its motion wrappers need to run outermost around the patched prototype.
import '../../ui/FormationPremiumMotionPatch.js';
