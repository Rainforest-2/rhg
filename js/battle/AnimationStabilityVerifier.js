import { BattleScene } from './BattleScene.js';
import { BattleBodyResolver } from './BattleBodyResolver.js';
import { BattleSceneRenderer } from './BattleSceneRenderer.js';

const TARGETS = ['dog-wanko', 'cat-basic', 'cat-tank', 'cat-battle', 'cat-kimo'];

function getDrawList(actor) {
  if (!actor?.model) return [];
  return typeof actor.model.getBattleDrawList === 'function' ? actor.model.getBattleDrawList() : (actor.model.getDrawList?.() || []);
}

function sampleActor(scene, actor) {
  const renderer = new BattleSceneRenderer();
  const drawList = getDrawList(actor);
  renderer.initializeActorStableGroundAnchor(actor, drawList);
  BattleBodyResolver.initializeStableRenderAlignment(actor, drawList, scene?.config?.tuning?.visualOriginAlignment || {});
  renderer.getActorGroundAnchorLocalY(actor, drawList);
  BattleBodyResolver.applyStableRenderAlignment(actor);
  return {
    x: actor.x,
    combatX: BattleBodyResolver.getActorCombatPositionX(actor),
    stableOffset: actor.stableRenderOffsetWorldPx,
    stableGround: actor.stableGroundAnchorLocalY,
    rawBounds: renderer.getBattleDrawListLocalBounds(actor, drawList)
  };
}

export async function verifyAttackRenderStability() {
  const scene = new BattleScene();
  await scene.init();
  const actors = scene.actors.filter((a) => TARGETS.includes(a.slotId));
  const results = [];
  for (const a of actors) {
    const before = sampleActor(scene, a);
    const x0 = a.x;
    const combat0 = BattleBodyResolver.getActorCombatPositionX(a);
    a.setState('attack');
    a.setAnimation(a.attackAnimId, 'attack', true);
    a.applyCurrentAnimationFrame?.();
    const frames = Math.max(8, Math.ceil((a.attackAnimDurationMs || 600) / 33.333) + 4);
    for (let i = 0; i < frames; i += 1) {
      a.tick(33.333);
      sampleActor(scene, a);
    }
    a.setState('attack-wait');
    a.setAnimation(a.idleAnimId, 'attack-wait', true);
    a.applyCurrentAnimationFrame?.();
    const after = sampleActor(scene, a);
    results.push({
      slotId: a.slotId,
      stableOffsetDelta: Math.abs((after.stableOffset || 0) - (before.stableOffset || 0)),
      stableGroundDelta: Math.abs((after.stableGround || 0) - (before.stableGround || 0)),
      actorXDelta: Math.abs((a.x || 0) - x0),
      combatXDelta: Math.abs((BattleBodyResolver.getActorCombatPositionX(a) || 0) - combat0)
    });
  }
  const ok = results.every((r) => r.stableOffsetDelta <= 1 && r.stableGroundDelta <= 1 && r.actorXDelta <= 0.0001 && r.combatXDelta <= 0.0001);
  return { ok, targets: results.length, results };
}

export async function printAttackRenderStability() {
  const r = await verifyAttackRenderStability();
  for (const row of r.results) console.log(`[stability] ${row.slotId} offsetΔ=${row.stableOffsetDelta} groundΔ=${row.stableGroundDelta} xΔ=${row.actorXDelta} combatΔ=${row.combatXDelta}`);
  console.log(`[stability] ok=${r.ok} targets=${r.targets}`);
}
