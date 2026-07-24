// Single source of truth for the battle "scene" boot patch group (dev + prod).
// Static imports execute top-to-bottom, so the order below IS the install order.
import '../../battle/BattleSceneBcuTimerPatch.js';
import '../../battle/BattleSceneBcuLineupPatch.js';
import '../../battle/BattleSceneBcuStageSpawnPatch.js';
import '../../battle/BattleSceneBcuCastleGuardPatch.js';
import '../../battle/BattleSceneBcuCatCannonPatch.js';
import '../../battle/BattleSceneBcuSpiritPatch.js';
// After spirit so the button-delay requestPlayerSpawn gate is the outermost wrapper.
import '../../battle/BattleSceneBcuButtonDelayPatch.js';
import '../../battle/BattleSceneCustomStageBattlePatch.js';
// Replace the custom battle's private percent-only C0/KC input with the canonical
// normal-vs-trail health-domain resolver without duplicating its multi-CSV scheduler.
import '../../battle/BattleSceneCustomStageTrailParityPatch.js';
import '../../battle/BattleSceneStageSpawnHeaderPatch.js';
// Official default-pack HP-gated rows consume their authored first-delay RNG draw,
// but BCU EStage.assign resets a positive stored timer to zero before the first tick.
import '../../battle/BattleSceneOfficialHpGateInitialDelayPatch.js';
import '../../battle/BattleSceneBcuAttackPhasePatch.js';
import '../../battle/BattleSceneProcApplyPatch.js';
import '../../battle/BattleSceneBcuWaveInvalidApplyPatch.js';
import '../../battle/BattleSceneBcuProcRuntimePatch.js';
import '../../battle/BattleSceneBcuSummonPatch.js';
import '../../battle/BattleSceneBcuStageBasisPhaseBridgePatch.js';
import '../../battle/BattleBountyRuntimePatch.js';
import '../../battle/BattleSceneBcuStatusIconPatch.js';
import '../../battle/BattleSceneBcuStatusEffectRenderPatch.js';
import '../../battle/BattleSceneBcuStageBasisTickPatch.js';
// Ranking wraps the final phased tick and must observe resolved deaths before cleanup.
import '../../battle/BattleSceneBcuRankingRuntimePatch.js';
import '../../battle/BattleSceneCustomStageBaseHpPatch.js';
import '../../battle/BattleSceneBcuEnemyEntityBasePatch.js';
