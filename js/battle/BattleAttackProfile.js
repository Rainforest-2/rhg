import { BATTLE_CONFIG } from './BattleConfig.js';
import { AbilityModel } from './AbilityModel.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';

function getActorAbilityModel(actor, stats = {}) {
  return stats?.abilityModel || actor?.abilityModel || actor?.rawStats?.abilityModel || actor?.stats?.abilityModel || null;
}

export class BattleAttackProfile {
  static getFrameMs(_fps = 30) { return BCU_BATTLE_TIMER_PERIOD_MS; }
  static framesToMs(frames = 0) { return Math.max(0, Number(frames) || 0) * this.getFrameMs(); }
  static getTimingParity(actor = null) {
    const cfg = actor?.timingParity || BATTLE_CONFIG.tuning?.timingParity || {};
    const enabled = cfg?.enabled !== false;
    return { enabled, source: cfg?.source || (enabled ? 'bcu-getItv-parity-default' : 'disabled'), disableAttackPhaseMultiplier: enabled ? cfg?.disableAttackPhaseMultiplier !== false : false, disableMinAttackStartup: enabled ? cfg?.disableMinAttackStartup !== false : false, disableMinAttackAnim: enabled ? cfg?.disableMinAttackAnim !== false : false };
  }
  static buildBcuTiming({ fps = 30, animationMs = 0, waitMs = 0, maxEventAtMs = 0, rawLongPreFrames = null, rawTbaFrames = null, timingParity = null } = {}) {
    const frameMs = this.getFrameMs(fps); const animMs = Math.max(0, Number(animationMs) || 0); const longPreMs = Math.max(0, Number(maxEventAtMs) || 0); const tbaMs = Math.max(0, Number(waitMs) || 0); const postMs = Math.max(0, animMs - longPreMs); const tbaMinusOneMs = Math.max(0, tbaMs - frameMs); const bcuAttackIntervalMs = Math.max(animMs, longPreMs + Math.max(tbaMinusOneMs, postMs)); const intervalFrames = frameMs > 0 ? bcuAttackIntervalMs / frameMs : 0;
    return { source: 'bcu-getItv', formula: 'max(animLen, longPre + TBA - 1)', timingParity: timingParity || null, fps, frameMs, animationMs: animMs, longPreMs, postMs, waitMs: tbaMs, tbaMinusOneMs, bcuAttackIntervalMs, bcuAttackIntervalFrames: intervalFrames, rawLongPreFrames: Number.isFinite(rawLongPreFrames) ? rawLongPreFrames : Math.round(longPreMs / frameMs), rawTbaFrames: Number.isFinite(rawTbaFrames) ? rawTbaFrames : Math.round(tbaMs / frameMs), animationFrames: frameMs > 0 ? animMs / frameMs : null };
  }

  static fromActor(actor) {
    const stats = actor?.rawStats || {};
    const fps = actor?.fps || BATTLE_CONFIG.tuning?.fps || 30;
    const frameMs = this.getFrameMs(fps);
    const timingParity = this.getTimingParity(actor);
    const phaseMultiplier = timingParity.disableAttackPhaseMultiplier ? 1 : (actor?.attackPhaseTimeMultiplier ?? 1);
    const toPx = (v) => actor?.battleCoordinate?.lengthToPx?.(v) ?? (v * (BATTLE_CONFIG.tuning?.rangeToPx ?? 1));
    const abilityModel = getActorAbilityModel(actor, stats);

    if (Array.isArray(stats.attackHits) && stats.attackHits.length) {
      const hits = stats.attackHits;
      const minStartup = timingParity.disableMinAttackStartup ? 0 : (BATTLE_CONFIG.tuning?.minAttackStartupMs ?? 0);
      const firstRawAtMs = Math.max(0, hits[0]?.preFrames || 0) * frameMs * phaseMultiplier;
      const shiftMs = Math.max(0, minStartup - firstRawAtMs);
      const attackBackBcu = Math.max(0, Number.isFinite(stats.width) ? stats.width : 0);
      const targetMode = stats.isRange ? 'range' : 'single';
      const events = hits.map((hit, index) => {
        const ldStartRaw = Number.isFinite(hit?.ldStartRaw) ? hit.ldStartRaw : 0;
        const ldRangeRaw = Number.isFinite(hit?.ldRangeRaw) ? hit.ldRangeRaw : 0;
        const longPointBcu = ldStartRaw + ldRangeRaw;
        const attackKind = hit?.isOmni ? 'omni' : (hit?.isLd ? 'ld' : 'normal');
        const ability = abilityModel ? AbilityModel.getHitAbility(abilityModel, hit?.hitIndex ?? index) : null;
        return { key:`hit-${hit?.hitIndex ?? index}`, hitIndex:hit?.hitIndex ?? index, atMs:Math.max(0, Math.max(0, hit?.preFrames || 0) * frameMs * phaseMultiplier + shiftMs), damage:Number.isFinite(hit?.damage)?hit.damage:(actor?.damage??0), targetMode, allowBaseHit:true, attackKind, rawAbi:Number.isFinite(hit?.abi)?hit.abi:0, bcuHitAbi:Number.isFinite(hit?.abi)?Math.trunc(hit.abi):1, ability, abilities:ability?.semantic||{}, abilityFlags:ability?.flags||{}, abilityMappingStatus:ability?.mappingStatus||'none', abilityEnabledBits:Array.isArray(ability?.enabledBits)?ability.enabledBits:[], bcuProc:hit?.bcuProc||hit?.proc||null, summon:hit?.summon||hit?.bcuSummon||hit?.bcuProc?.SUMMON||hit?.bcuProc?.summon||hit?.proc?.SUMMON||hit?.proc?.summon||null, rangeStartBcu:0, rangeEndBcu:actor?.detectionRangeBcu ?? stats.detectionRange ?? 0, attackBackBcu, shortPointBcu:ldStartRaw, longPointBcu, rangeEndPxDebug:toPx(actor?.detectionRangeBcu ?? stats.detectionRange ?? 0), attackBackPxDebug:toPx(attackBackBcu), shortPointPxDebug:toPx(ldStartRaw), longPointPxDebug:toPx(longPointBcu), abilityModelSource: abilityModel?.source || abilityModel?.mappingStatus || null, raw:{ldStartRaw,ldRangeRaw,attackKind,isRange:!!stats.isRange} };
      });
      const maxEventAtMs = Math.max(...events.map(e=>e.atMs));
      const minAnim = timingParity.disableMinAttackAnim ? 0 : (BATTLE_CONFIG.tuning?.minAttackAnimMs ?? 0);
      const animationMs = Math.max(actor?.attackAnimDurationMs||0,maxEventAtMs,minAnim);
      const waitMs = actor?.attackWaitMs??0;
      const rawLongPreFrames = Math.max(...hits.map((h) => Math.max(0, Number(h?.preFramesAbsolute ?? h?.preFrames ?? 0) || 0)));
      const rawTbaFrames = Number.isFinite(stats.tbaFrames) ? stats.tbaFrames : (Number.isFinite(actor?.attackWaitFrames) ? actor.attackWaitFrames : null);
      const bcuTiming = this.buildBcuTiming({ fps, animationMs, waitMs, maxEventAtMs, rawLongPreFrames, rawTbaFrames, timingParity });
      return { source:'bcu-stats-attackHits', isRange:!!stats.isRange, events, animationMs, waitMs, maxEventAtMs, timingParity, bcuTiming, bcuAttackIntervalMs:bcuTiming.bcuAttackIntervalMs, bcuAttackIntervalFrames:bcuTiming.bcuAttackIntervalFrames, abilityModelStatus: abilityModel?.mappingStatus || null };
    }

    const startup = Math.max(actor?.attackStartupMs||0, timingParity.disableMinAttackStartup ? 0 : (BATTLE_CONFIG.tuning?.minAttackStartupMs ?? 0));
    const isRange = actor?.attackType === 1;
    const animationMs = Math.max(actor?.attackAnimDurationMs||0,startup,timingParity.disableMinAttackAnim ? 0 : (BATTLE_CONFIG.tuning?.minAttackAnimMs??0));
    const waitMs = actor?.attackWaitMs??0;
    const rawTbaFrames = Number.isFinite(actor?.attackWaitFrames) ? actor.attackWaitFrames : null;
    const bcuTiming = this.buildBcuTiming({ fps, animationMs, waitMs, maxEventAtMs: startup, rawLongPreFrames: Number.isFinite(actor?.attackStartupFrames) ? actor.attackStartupFrames : null, rawTbaFrames, timingParity });
    const ability = abilityModel ? AbilityModel.getHitAbility(abilityModel, 0) : null;
    return { source:'actor-current-stats', isRange, events:[{ key:'hit-0', hitIndex:0, atMs:startup, damage:actor?.damage??0, targetMode:isRange?'range':'single', allowBaseHit:true, attackKind:'normal', rawAbi:0, bcuHitAbi:1, ability, abilities:ability?.semantic||{}, abilityFlags:ability?.flags||{}, abilityMappingStatus:ability?.mappingStatus||'none', abilityEnabledBits:Array.isArray(ability?.enabledBits)?ability.enabledBits:[], bcuProc:stats?.bcuProcOverride||stats?.bcuProcObject||null, summon:stats?.summon||stats?.bcuSummon||stats?.bcuProcOverride?.SUMMON||stats?.bcuProcObject?.SUMMON||null, rangeStartBcu:0, rangeEndBcu:actor?.detectionRangeBcu ?? stats.detectionRange ?? 0, attackBackBcu:actor?.attackWidthBcu ?? stats.width ?? 0, shortPointBcu:0, longPointBcu:0, rangeEndPxDebug: actor?.detectionRangePx ?? toPx(stats.detectionRange ?? 0), attackBackPxDebug: actor?.attackWidthPx ?? toPx(stats.width ?? 0), shortPointPxDebug:0, longPointPxDebug:0, abilityModelSource: abilityModel?.source || abilityModel?.mappingStatus || null }], animationMs, waitMs, maxEventAtMs:startup, timingParity, bcuTiming, bcuAttackIntervalMs:bcuTiming.bcuAttackIntervalMs, bcuAttackIntervalFrames:bcuTiming.bcuAttackIntervalFrames, abilityModelStatus: abilityModel?.mappingStatus || null };
  }
  static ensure(actor){ if(!actor.attackProfile) actor.attackProfile = BattleAttackProfile.fromActor(actor); return actor.attackProfile; }
  static getEventKey(event, index){ return event?.key || `hit-${index}`; }
  static getAttackEndMs(actor){ const p=BattleAttackProfile.ensure(actor); const parity = this.getTimingParity(actor); return Math.max(p.animationMs||0,p.maxEventAtMs||0,parity.disableMinAttackAnim ? 0 : (BATTLE_CONFIG.tuning?.minAttackAnimMs??0)); }
  static getBcuAttackIntervalMs(actor){ const p=BattleAttackProfile.ensure(actor); return Math.max(0, p.bcuAttackIntervalMs ?? p.bcuTiming?.bcuAttackIntervalMs ?? this.getAttackEndMs(actor)); }
}
