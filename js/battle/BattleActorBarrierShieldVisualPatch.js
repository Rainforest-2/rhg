import { BattleActor } from './BattleActor.js';
import { spawnBcuBarrierShieldVisual } from './bcu-runtime/BcuBarrierShieldEffectRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.actor-barrier-shield-visual-patch.v1');

function resolveScene(actor, meta = {}) {
  return meta?.scene || actor?.scene || globalThis.__APP__?.battleScene || globalThis.__APP__?.scene || null;
}

function spawnEvents(scene, actor, events = []) {
  const effects = [];
  if (!scene || !actor || !events.length) return effects;
  for (const event of events) {
    const effect = spawnBcuBarrierShieldVisual(scene, actor, event, { source: 'BattleActorBarrierShieldVisualPatch.takeDamage' });
    if (effect) effects.push(effect);
  }
  return effects;
}

export function installBattleActorBarrierShieldVisualPatch() {
  const proto = BattleActor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalTakeDamage = proto.takeDamage;
  if (typeof originalTakeDamage !== 'function') {
    throw new Error('BattleActor.takeDamage missing; cannot install BCU barrier/shield visual patch');
  }

  proto.takeDamage = function takeDamageWithBcuBarrierShieldVisual(amount, meta = {}) {
    const result = originalTakeDamage.call(this, amount, meta);
    const events = result?.bcuBarrierShieldEvents || meta?.bcuBarrierShieldEvents || [];
    if (events.length) {
      const scene = resolveScene(this, meta);
      const effects = spawnEvents(scene, this, events);
      this.lastBcuBarrierShieldVisualPatchDebug = {
        source: 'BattleActorBarrierShieldVisualPatch.takeDamage',
        sceneFound: !!scene,
        eventCount: events.length,
        effectCount: effects.length,
        effectIds: effects.map((effect) => effect?.id || null),
        bcuReference: 'BCU Entity.damaged triggers AnimManager.getEff(BREAK_* / SHIELD_*) at the damage gate; drawEff renders these priority effects at p.y - 25*siz and scale 0.75.'
      };
    }
    return result;
  };
}

installBattleActorBarrierShieldVisualPatch();
