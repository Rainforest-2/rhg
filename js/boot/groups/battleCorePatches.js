// Single source of truth for the battle "core" boot patch group (dev + prod).
// Static imports execute top-to-bottom, so the order below IS the install order.
// queueAttackDamage wrappers are order-sensitive: diagnostic capture first, then
// BCU hit effects, then damage/proc/lifecycle runtime wrappers.
import '../../battle/BattleUnifiedDamageDebugPatch.js';
import '../../battle/BattleCriticalEffectPatch.js';
// Normalize unit/enemy Metallic classification before the single base critical roll.
import '../../battle/DamageAbilityResolverMetalAbiPatch.js';
import '../../battle/BattleBcuStrictConfigPatch.js';
// Trail parsing must wrap the base parser before negative-first-spawn post-processing.
import '../../battle/StageDefinitionTrailParityPatch.js';
import '../../battle/StageDefinitionNegativeSpawnPatch.js';
// Row scheduling must wrap the core commit before the global cooldown wrapper replaces it.
import '../../battle/BcuStageRowRespawnBoundaryPatch.js';
import '../../battle/BcuStageGlobalRespawnBoundaryPatch.js';
import '../../battle/BcuEnemyEntityBaseFirstHealthSuppressionPatch.js';
import '../../battle/BattleActorBcuKbTargetPatch.js';
// BCU Entity.processProcs parity: defines BattleActor.applyBcuProc (P_STOP/P_SLOW/
// P_WEAK/P_CURSE/P_SEAL/P_WARP/P_POIATK status application + A_POISON effect spawn).
// Must load before BcuProcImmunityPatch wraps applyBcuProc in the lifecycle group.
import '../../battle/BattleActorProcStatusPatch.js';
import '../../battle/BattleToxicEffectAssetPatch.js';
import '../../battle/BattleSceneBcuUnitLevelPatch.js';
import '../../battle/BcuDelayRuntimePatch.js';
import '../../battle/BattleActorBarrierShieldPatch.js';
import '../../battle/BattleActorBarrierShieldVisualPatch.js';
import '../../battle/BattleSoulstrikePatch.js';
import '../../battle/BattleActorBcuBurrowPatch.js';
import '../../battle/BattleActorBcuBurrowDiagnosticsPatch.js';
import '../../battle/BattleDeterministicRandomPatch.js';
import '../../battle/BattleActorAttackNullifyPatch.js';