// Single source of truth for the battle "renderer" boot patch group (dev + prod).
// Renderer wrappers are last so they see the final scene/effect metadata.
import '../../battle/BattleSceneRendererBcuOriginPatch.js';
import '../../battle/BattleSceneRendererHudPatch.js';
import '../../battle/BattleSceneRendererBcuGlowPatch.js';
import '../../battle/BattleSceneRendererEffectGlowPatch.js';
import '../../battle/BattleDebugStripPatch.js';
