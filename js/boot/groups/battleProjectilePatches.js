// Single source of truth for the battle "projectile" boot patch group (dev + prod).
// Projectile runtimes feed later StageBasis and renderer wrappers, so they load here.
import '../../battle/BattleWaveRuntimePatch.js';
import '../../battle/BattleSceneBcuWaveOnBlockedHitPatch.js';
import '../../battle/BattleSurgeRuntimePatch.js';
import '../../battle/BattleBlastRuntimePatch.js';
import '../../battle/BattleBaseProjectileProcPatch.js';
import '../../battle/BattleProjectileRuntimeBugfixPatch.js';
import '../../battle/BattleSceneStageRuntimeWiring.js';
import '../../battle/BattleSceneRendererOrderPatch.js';
import '../../battle/BattleSceneUnitLayerPatch.js';
