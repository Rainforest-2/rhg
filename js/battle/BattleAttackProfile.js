import { BATTLE_CONFIG } from './BattleConfig.js';

export class BattleAttackProfile {
  static fromActor(actor) {
    const minStartup = BATTLE_CONFIG.tuning?.minAttackStartupMs ?? 0;
    const effectiveStartupMs = Math.max(actor?.attackStartupMs || 0, minStartup);
    const minAnim = BATTLE_CONFIG.tuning?.minAttackAnimMs ?? 0;
    const attackEndMs = Math.max(actor?.attackAnimDurationMs || 0, effectiveStartupMs, minAnim);
    return {
      source: 'actor-current-stats',
      isRange: actor?.attackType === 1,
      events: [{ key: 'hit-0', hitIndex: 0, atMs: effectiveStartupMs, damage: actor?.damage ?? 0, rangeStartPx: 0, rangeEndPx: actor?.detectionRangePx ?? 0, targetMode: 'single' }],
      animationMs: attackEndMs,
      waitMs: actor?.attackWaitMs ?? 0,
      maxEventAtMs: effectiveStartupMs
    };
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
