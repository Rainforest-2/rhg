export class BattleCombatCoordinateRuntime {
  static numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  static numberOrDefault(value, fallback = 0) {
    const n = this.numberOrNull(value);
    return Number.isFinite(n) ? n : fallback;
  }

  static getEntityPosBcu(entity) {
    if (!entity) return null;
    if (typeof entity.getBattlePosBcu === 'function') {
      const raw = entity.getBattlePosBcu();
      const v = this.numberOrNull(raw);
      if (Number.isFinite(v)) return v;
    }
    if (Number.isFinite(entity.posBcu)) return entity.posBcu;
    if (Number.isFinite(entity.combatX)) return entity.combatX;
    if (Number.isFinite(entity.x)) return entity.x;
    return null;
  }

  // The renderer draws an actor sprite at `actor.x + visualRenderOffsetWorldPx + visualCrowdFanoutPx
  // + kbVisualOffsetX` (BattleSceneRenderer.drawActor / drawHpBar). Battle effects spawned onto a
  // logical entity position (posBcu / x) therefore drift from the visible sprite by exactly the
  // model-alignment + crowd + knockback offsets. Anchor hit/proc effects to this visual world X so
  // they land on the enemy the player sees, not the bare combat anchor.
  static getEntityVisualWorldX(entity) {
    const base = this.getEntityPosBcu(entity);
    const x = Number.isFinite(base) ? base : 0;
    const align = Number.isFinite(entity?.visualRenderOffsetWorldPx) ? entity.visualRenderOffsetWorldPx : 0;
    const crowd = Number.isFinite(entity?.visualCrowdFanoutPx) ? entity.visualCrowdFanoutPx : 0;
    const kb = Number.isFinite(entity?.kbVisualOffsetX) ? entity.kbVisualOffsetX : 0;
    return x + align + crowd + kb;
  }

  static getEntityRangeBcu(entity) {
    const v = entity?.detectionRangeBcu ?? entity?.rawRangeBcu ?? entity?.rawStats?.range ?? entity?.rawStats?.detectionRange;
    return this.numberOrDefault(v, 0);
  }

  static getEntityWidthBcu(entity) {
    const v = entity?.attackWidthBcu ?? entity?.rawWidthBcu ?? entity?.rawStats?.width;
    return this.numberOrDefault(v, 0);
  }

  static attachActor(actor, { stats = null, source = 'BattleCombatCoordinateRuntime.attachActor' } = {}) {
    if (!actor) return null;

    const rangeBcu = this.numberOrDefault(stats?.detectionRange ?? stats?.range ?? actor.detectionRangeBcu ?? actor.detectionRangePx, 0);
    const widthBcu = this.numberOrDefault(stats?.width ?? actor.attackWidthBcu ?? actor.attackWidthPx, 0);

    actor.rawRangeBcu = this.numberOrDefault(stats?.range ?? stats?.detectionRange ?? rangeBcu, rangeBcu);
    actor.detectionRangeBcu = rangeBcu;
    actor.attackWidthBcu = widthBcu;
    actor.rawWidthBcu = widthBcu;
    actor.combatCoordinateSource = source;
    actor.combatCoordinateMode = 'x-live-mirror-debug';

    if (!Number.isFinite(actor.posBcu) && Number.isFinite(actor.x)) {
      actor.posBcu = actor.x;
    }

    actor.getBattlePosBcu = function getBattlePosBcu() {
      if (this.combatCoordinateMode === 'x-live-mirror-debug' && Number.isFinite(this.x)) return this.x;
      if (Number.isFinite(this.posBcu)) return this.posBcu;
      if (Number.isFinite(this.x)) return this.x;
      return null;
    };

    actor.getBattleRangeBcu = function getBattleRangeBcu() {
      return Number.isFinite(this.detectionRangeBcu) ? this.detectionRangeBcu : 0;
    };

    actor.getBattleWidthBcu = function getBattleWidthBcu() {
      return Number.isFinite(this.attackWidthBcu) ? this.attackWidthBcu : 0;
    };

    actor.combatCoordinateDebug = this.describeActor(actor);
    return actor;
  }

  static describeActor(actor) {
    if (!actor) return null;
    const posBcu = this.getEntityPosBcu(actor);
    const rangeBcu = this.getEntityRangeBcu(actor);
    const widthBcu = this.getEntityWidthBcu(actor);
    const dir = Number.isFinite(actor.direction) ? actor.direction : 1;
    const rangeFrontBcu = Number.isFinite(posBcu) ? posBcu + dir * rangeBcu : null;
    const rangeBackBcu = Number.isFinite(posBcu) ? posBcu - dir * widthBcu : null;
    return {
      id: actor.instanceId || actor.slotId || actor.label || null,
      side: actor.side || null,
      x: Number.isFinite(actor.x) ? actor.x : null,
      posBcu,
      direction: dir,
      detectionRangePx: Number.isFinite(actor.detectionRangePx) ? actor.detectionRangePx : null,
      detectionRangeBcu: rangeBcu,
      attackWidthPx: Number.isFinite(actor.attackWidthPx) ? actor.attackWidthPx : null,
      attackWidthBcu: widthBcu,
      rangeBackBcu,
      rangeFrontBcu,
      source: actor.combatCoordinateSource || null,
      mode: actor.combatCoordinateMode || null
    };
  }

  static describeDistance(attacker, target) {
    const a = this.getEntityPosBcu(attacker);
    const b = this.getEntityPosBcu(target);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return { attackerPosBcu: Number.isFinite(a) ? a : null, targetPosBcu: Number.isFinite(b) ? b : null, distanceBcu: null };
    }
    return { attackerPosBcu: a, targetPosBcu: b, distanceBcu: Math.abs(b - a) };
  }
}
