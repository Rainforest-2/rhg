import { BATTLE_CONFIG } from './BattleConfig.js';

export class BattleAttackProfile {
  static fromActor(actor) {
    const stats = actor?.rawStats || {};
    const fps = actor?.fps || BATTLE_CONFIG.tuning?.fps || 30;
    const phaseMultiplier = actor?.attackPhaseTimeMultiplier ?? 1;

    const rangeToPx = BATTLE_CONFIG.tuning?.rangeToPx ?? 1;
    if (Array.isArray(stats.attackHits) && stats.attackHits.length) {
      const hits = stats.attackHits;
      const firstRawAtMs = (Math.max(0, hits[0]?.preFrames || 0) / fps) * 1000 * phaseMultiplier;
      const minStartup = BATTLE_CONFIG.tuning?.minAttackStartupMs ?? 0;
      const shiftMs = Math.max(0, minStartup - firstRawAtMs);
      const isRange = !!stats.isRange;
      const targetMode = isRange ? 'range' : 'single';
      const attackBackPx = Math.max(0, (Number.isFinite(stats.width) ? stats.width : 0) * rangeToPx);
      const events = hits.map((hit, index) => {
        const rawAtMs = (Math.max(0, hit?.preFrames || 0) / fps) * 1000 * phaseMultiplier;
        return {
          key: `hit-${hit?.hitIndex ?? index}`,
          hitIndex: hit?.hitIndex ?? index,
          atMs: Math.max(0, rawAtMs + shiftMs),
          damage: Number.isFinite(hit?.damage) ? hit.damage : (actor?.damage ?? 0),
          rangeStartPx: 0,
          rangeEndPx: actor?.detectionRangePx ?? 0,
          attackBackPx,
          targetMode,
          allowBaseHit: true,
          raw: {
            preFrames: hit?.preFrames ?? 0,
            deltaFrames: hit?.deltaFrames ?? 0,
            abi: hit?.abi ?? 0,
            ldStartRaw: hit?.ldStartRaw ?? 0,
            ldRangeRaw: hit?.ldRangeRaw ?? 0,
            isLd: !!hit?.isLd,
            isOmni: !!hit?.isOmni,
            isRange: !!stats.isRange
          }
        };
      });
      const safeEvents = events.length ? events : [{ key: 'hit-0', hitIndex: 0, atMs: minStartup, damage: actor?.damage ?? 0, rangeStartPx: 0, rangeEndPx: actor?.detectionRangePx ?? 0, attackBackPx, targetMode, allowBaseHit: true, raw: { isRange } }];
      const maxEventAtMs = Math.max(...safeEvents.map((e) => e.atMs));
      const minAnim = BATTLE_CONFIG.tuning?.minAttackAnimMs ?? 0;
      const animationMs = Math.max(actor?.attackAnimDurationMs || 0, maxEventAtMs, minAnim);
      return { source: 'bcu-stats-attackHits', isRange: !!stats.isRange, events: safeEvents, animationMs, waitMs: actor?.attackWaitMs ?? 0, maxEventAtMs };
    }

    const minStartup = BATTLE_CONFIG.tuning?.minAttackStartupMs ?? 0;
    const effectiveStartupMs = Math.max(actor?.attackStartupMs || 0, minStartup);
    const minAnim = BATTLE_CONFIG.tuning?.minAttackAnimMs ?? 0;
    const attackEndMs = Math.max(actor?.attackAnimDurationMs || 0, effectiveStartupMs, minAnim);
    const fallbackIsRange = actor?.attackType === 1;
    return { source: 'actor-current-stats', isRange: fallbackIsRange, events: [{ key: 'hit-0', hitIndex: 0, atMs: effectiveStartupMs, damage: actor?.damage ?? 0, rangeStartPx: 0, rangeEndPx: actor?.detectionRangePx ?? 0, attackBackPx: 0, targetMode: fallbackIsRange ? 'range' : 'single', allowBaseHit: true, raw: { isRange: fallbackIsRange } }], animationMs: attackEndMs, waitMs: actor?.attackWaitMs ?? 0, maxEventAtMs: effectiveStartupMs };
  }

  static ensure(actor) {
    if (!actor.attackProfile) actor.attackProfile = BattleAttackProfile.fromActor(actor);
    return actor.attackProfile;
  }

  static getEventKey(event, index) {
    return event?.key || `hit-${index}`;
  }

  static getAttackEndMs(actor) {
    const profile = BattleAttackProfile.ensure(actor);
    const minAnim = BATTLE_CONFIG.tuning?.minAttackAnimMs ?? 0;
    return Math.max(profile.animationMs || 0, profile.maxEventAtMs || 0, minAnim);
  }
}
