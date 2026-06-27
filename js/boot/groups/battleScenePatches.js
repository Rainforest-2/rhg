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
import '../../battle/BattleSceneStageSpawnHeaderPatch.js';
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
import '../../battle/BattleSceneCustomStageBaseHpPatch.js';
