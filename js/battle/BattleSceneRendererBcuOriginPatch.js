import { BATTLE_CONFIG } from './BattleConfig.js';
import { BattleSceneRenderer } from './BattleSceneRenderer.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-model-origin-rendering.v1');

function isBcuActor(actor) {
  return !!(
    actor?.model?.getBattleDrawList ||
    actor?.assetDef?.semanticKey ||
    actor?.semanticKey ||
    actor?.sprite?.imgcut ||
    actor?.sourcePack ||
    actor?.bundlePath
  );
}

export function installBattleSceneRendererBcuOriginPatch() {
  const proto = BattleSceneRenderer?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalGetActorGroundAnchorLocalY = proto.getActorGroundAnchorLocalY;
  proto.getActorGroundAnchorLocalY = function getActorGroundAnchorLocalYBcuOrigin(actor, drawList) {
    if (isBcuActor(actor) && BATTLE_CONFIG.visualLayout?.bcuEntityRender?.enabled) {
      actor.lastGroundAnchorLocalY = 0;
      // Inspect-only detail: allocating this object per actor per frame is pure GC
      // pressure during normal play; the returned anchor (0) is unchanged either way.
      if (this._scene?.debugBattleEnabled || globalThis.__BCU_RENDER_DEBUG__ === true || globalThis.__BCU_DEBUG_ALLOCATIONS__ === true) {
        actor.lastGroundAnchorDebug = {
          source: 'BattleSceneRendererBcuOriginPatch',
          mode: 'bcu-model-origin',
          anchor: 0,
          reason: 'BCU EAnim draws mamodel at entity origin; no bounds-based foot alignment',
          ignoredPreviousStableAnchor: Number.isFinite(actor?.stableGroundAnchorLocalY) ? actor.stableGroundAnchorLocalY : null
        };
      }
      return 0;
    }
    return typeof originalGetActorGroundAnchorLocalY === 'function'
      ? originalGetActorGroundAnchorLocalY.call(this, actor, drawList)
      : 0;
  };

  const alignCfg = BATTLE_CONFIG.tuning?.visualOriginAlignment;
  if (alignCfg && BATTLE_CONFIG.visualLayout?.bcuEntityRender?.enabled) {
    alignCfg.enabled = false;
    alignCfg.disabledBy = 'BattleSceneRendererBcuOriginPatch';
    alignCfg.disabledReason = 'BCU model rendering uses the mamodel origin directly; bounds/front alignment is non-BCU and breaks effect-heavy models such as enemy076.';
  }
}

installBattleSceneRendererBcuOriginPatch();
