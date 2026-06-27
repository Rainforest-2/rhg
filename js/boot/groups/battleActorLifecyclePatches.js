// Single source of truth for the battle "actor lifecycle" boot patch group (dev + prod).
// Static imports execute top-to-bottom, so the order below IS the install order.
// BcuProcImmunityPatch wraps applyBcuProc, which the core group defines first.
import '../../battle/BcuKnockbackRuntimePatch.js';
import '../../battle/BcuKnockbackProcPriorityPatch.js';
import '../../battle/BattleActorStrengthenLethalPatch.js';
import '../../battle/BattleActorZombieRevivePatch.js';
import '../../battle/BattleActorGlassPatch.js';
import '../../battle/BattleActorDeathSoundPatch.js';
import '../../battle/BattleBcuDeathAnimationRuntimePatch.js';
import '../../battle/BcuKnockbackEffectLayerPatch.js';
import '../../battle/BcuKnockbackAnimationPatch.js';
import '../../battle/BcuProcImmunityPatch.js';
import '../../battle/BcuProcImmunityVisualPatch.js';
import '../../battle/BattleBcuPriorityEffectRuntimePatch.js';
import '../../battle/BattleSceneAttackEffectPatch.js';
import '../../battle/BattleProcHitEffectPatch.js';
import '../../battle/BattleProjectileEffectBcuParityPatch.js';
import '../../battle/BattleProjectilePerformanceAndPositionPatch.js';
import '../../battle/BattleCrowdPerformancePatch.js';
