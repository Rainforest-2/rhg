// Single source of truth for the battle "core" boot patch group (dev + prod).
// Static imports execute top-to-bottom, so the order below IS the install order.
// queueAttackDamage wrappers are order-sensitive: diagnostic capture first, then
// BCU hit effects, then damage/proc/lifecycle runtime wrappers.
import '../../battle/BattleUnifiedDamageDebugPatch.js';
import '../../battle/BattleCriticalEffectPatch.js';
// BCU AB_METALIC (metal-by-ability) crit-cap for dog-player attackers; sole
// wrapper of DamageAbilityResolver.resolve, so its position is order-free.
import '../../battle/DamageAbilityResolverMetalAbiPatch.js';
import '../../battle/BattleBcuStrictConfigPatch.js';
import '../../battle/StageDefinitionNegativeSpawnPatch.js';
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
