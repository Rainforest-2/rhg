import { BATTLE_CONFIG } from './BattleConfig.js';

export class BattleAttackProfile {
  static fromActor(actor) {
    const stats = actor?.rawStats || {};
    const fps = actor?.fps || BATTLE_CONFIG.tuning?.fps || 30;
    const phaseMultiplier = actor?.attackPhaseTimeMultiplier ?? 1;
    // screen-x mode uses these px projected fields; BCU mode fields remain reserved for later migration.
    const toPx = (v) => actor?.battleCoordinate?.lengthToPx?.(v) ?? (v * (BATTLE_CONFIG.tuning?.rangeToPx ?? 1));
    if (Array.isArray(stats.attackHits) && stats.attackHits.length) {
      const hits = stats.attackHits;
      const minStartup = BATTLE_CONFIG.tuning?.minAttackStartupMs ?? 0;
      const firstRawAtMs = (Math.max(0, hits[0]?.preFrames || 0) / fps) * 1000 * phaseMultiplier;
      const shiftMs = Math.max(0, minStartup - firstRawAtMs);
      const attackBackBcu = Math.max(0, Number.isFinite(stats.width) ? stats.width : 0);
      const targetMode = stats.isRange ? 'range' : 'single';
      const events = hits.map((hit, index) => {
        const ldStartRaw = Number.isFinite(hit?.ldStartRaw) ? hit.ldStartRaw : 0;
        const ldRangeRaw = Number.isFinite(hit?.ldRangeRaw) ? hit.ldRangeRaw : 0;
        const longPointBcu = ldStartRaw + ldRangeRaw;
        const attackKind = hit?.isOmni ? 'omni' : (hit?.isLd ? 'ld' : 'normal');
        return { key:`hit-${hit?.hitIndex ?? index}`, hitIndex:hit?.hitIndex ?? index, atMs:Math.max(0, (Math.max(0, hit?.preFrames || 0) / fps) * 1000 * phaseMultiplier + shiftMs), damage:Number.isFinite(hit?.damage)?hit.damage:(actor?.damage??0), targetMode, allowBaseHit:true, attackKind, rangeStartBcu:0, rangeEndBcu:actor?.detectionRangeBcu ?? stats.detectionRange ?? 0, attackBackBcu, shortPointBcu:ldStartRaw, longPointBcu, rangeEndPxDebug:toPx(actor?.detectionRangeBcu ?? stats.detectionRange ?? 0), attackBackPxDebug:toPx(attackBackBcu), shortPointPxDebug:toPx(ldStartRaw), longPointPxDebug:toPx(longPointBcu), raw:{ldStartRaw,ldRangeRaw,attackKind,isRange:!!stats.isRange} };
      });
      const maxEventAtMs = Math.max(...events.map(e=>e.atMs));
      const minAnim = BATTLE_CONFIG.tuning?.minAttackAnimMs ?? 0;
      return { source:'bcu-stats-attackHits', isRange:!!stats.isRange, events, animationMs:Math.max(actor?.attackAnimDurationMs||0,maxEventAtMs,minAnim), waitMs:actor?.attackWaitMs??0, maxEventAtMs };
    }
    const startup = Math.max(actor?.attackStartupMs||0, BATTLE_CONFIG.tuning?.minAttackStartupMs ?? 0);
    const isRange = actor?.attackType === 1;
    return { source:'actor-current-stats', isRange, events:[{ key:'hit-0', hitIndex:0, atMs:startup, damage:actor?.damage??0, targetMode:isRange?'range':'single', allowBaseHit:true, attackKind:'normal', rangeStartBcu:0, rangeEndBcu:actor?.detectionRangeBcu ?? stats.detectionRange ?? 0, attackBackBcu:actor?.attackWidthBcu ?? stats.width ?? 0, shortPointBcu:0, longPointBcu:0, rangeEndPxDebug: actor?.detectionRangePx ?? toPx(stats.detectionRange ?? 0), attackBackPxDebug: actor?.attackWidthPx ?? toPx(stats.width ?? 0), shortPointPxDebug:0, longPointPxDebug:0 }], animationMs:Math.max(actor?.attackAnimDurationMs||0,startup,BATTLE_CONFIG.tuning?.minAttackAnimMs??0), waitMs:actor?.attackWaitMs??0, maxEventAtMs:startup };
  }
  static ensure(actor){ if(!actor.attackProfile) actor.attackProfile = BattleAttackProfile.fromActor(actor); return actor.attackProfile; }
  static getEventKey(event, index){ return event?.key || `hit-${index}`; }
  static getAttackEndMs(actor){ const p=BattleAttackProfile.ensure(actor); return Math.max(p.animationMs||0,p.maxEventAtMs||0,BATTLE_CONFIG.tuning?.minAttackAnimMs??0); }
}
