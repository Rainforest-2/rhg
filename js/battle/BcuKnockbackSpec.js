export const BCU_KNOCKBACK_SPEC_VERSION = '0.12.1-bcu-entity-kb-constants';

// BCU Data.java:
// INT_KB=0, INT_HB=1, INT_SW=2, INT_ASS=3, INT_WARP=4
// KB_TIME={11,23,47,11,-1}; KB_DIS={165,345,705,55,-1}
// Entity.AnimManager.kbAnim() adds +1 frame for all non-warp interrupts.
export const BCU_KNOCKBACK_SPECS = {
  HP_KB: {
    type: 'HP_KB',
    bcuType: 'INT_HB',
    distanceBcu: 345,
    statusFrames: 23,
    motionFrames: 24,
    retreatFrames: 23,
    intangibleFrames: 24,
    firstFrameTargetable: false,
    targetableFromFrame: Infinity,
    speedEquivalent: 30,
    kbeffType: 'INT_HB'
  },
  CANNON: {
    type: 'CANNON',
    bcuType: 'INT_ASS',
    distanceBcu: 55,
    statusFrames: 11,
    motionFrames: 12,
    retreatFrames: 11,
    intangibleFrames: 12,
    firstFrameTargetable: false,
    targetableFromFrame: Infinity,
    speedEquivalent: 10,
    kbeffType: 'INT_ASS'
  },
  SNIPE: {
    type: 'SNIPE',
    bcuType: 'INT_ASS',
    distanceBcu: 55,
    statusFrames: 11,
    motionFrames: 12,
    retreatFrames: 11,
    intangibleFrames: 12,
    firstFrameTargetable: false,
    targetableFromFrame: Infinity,
    speedEquivalent: 10,
    kbeffType: 'INT_ASS'
  },
  PROC_KB_WHITE: {
    type: 'PROC_KB_WHITE',
    bcuType: 'INT_KB',
    distanceBcu: 165,
    statusFrames: 11,
    motionFrames: 12,
    retreatFrames: 11,
    intangibleFrames: 12,
    firstFrameTargetable: false,
    targetableFromFrame: Infinity,
    speedEquivalent: 30,
    kbeffType: null
  },
  BOSS_SHOCKWAVE: {
    type: 'BOSS_SHOCKWAVE',
    bcuType: 'INT_SW',
    distanceBcu: 705,
    statusFrames: 47,
    motionFrames: 48,
    retreatFrames: 47,
    intangibleFrames: 48,
    firstFrameTargetable: false,
    targetableFromFrame: Infinity,
    speedEquivalent: 30,
    kbeffType: 'INT_SW'
  }
};

export function getBcuKnockbackSpec(type) { return BCU_KNOCKBACK_SPECS[type] || null; }
export function convertBcuDistanceToWorld(distanceBcu, tuning = {}) { return Number(distanceBcu) || 0; }
export function convertBcuDistanceToPx(distanceBcu, tuning = {}) { return convertBcuDistanceToWorld(distanceBcu, tuning); }
export function getDefaultSpecTypeForKind(kind) {
  const k = String(kind || 'hp');
  if (k === 'final' || k === 'hp') return 'HP_KB';
  if (k === 'proc') return 'PROC_KB_WHITE';
  if (k === 'assist') return 'CANNON';
  if (k === 'bossShockwave') return 'BOSS_SHOCKWAVE';
  return 'HP_KB';
}
