export const BCU_KNOCKBACK_SPEC_VERSION = '0.11.7';

export const BCU_KNOCKBACK_SPECS = {
  HP_KB: { type:'HP_KB', bcuType:'INT_HB', distanceBcu:345, motionFrames:24, intangibleFrames:23, firstFrameTargetable:true, targetableFromFrame:24, retreatFrames:23, speedEquivalent:30, kbeffType:'INT_HB' },
  CANNON: { type:'CANNON', bcuType:'INT_ASS', distanceBcu:55, motionFrames:12, intangibleFrames:11, firstFrameTargetable:true, targetableFromFrame:12, retreatFrames:11, speedEquivalent:10, kbeffType:'INT_ASS' },
  SNIPE: { type:'SNIPE', bcuType:'INT_ASS', distanceBcu:55, motionFrames:12, intangibleFrames:11, firstFrameTargetable:true, targetableFromFrame:12, retreatFrames:11, speedEquivalent:10, kbeffType:'INT_ASS' },
  PROC_KB_WHITE: { type:'PROC_KB_WHITE', bcuType:'INT_KB', distanceBcu:165, motionFrames:12, intangibleFrames:11, firstFrameTargetable:true, targetableFromFrame:12, retreatFrames:11, speedEquivalent:30, kbeffType:null },
  BOSS_SHOCKWAVE: { type:'BOSS_SHOCKWAVE', bcuType:'INT_SW', distanceBcu:704, motionFrames:47, intangibleFrames:47, firstFrameTargetable:false, targetableFromFrame:47, retreatFrames:47, speedEquivalent:30, kbeffType:'INT_SW' }
};

export function getBcuKnockbackSpec(type) { return BCU_KNOCKBACK_SPECS[type] || null; }

export function convertBcuDistanceToPx(distanceBcu, tuning = {}) {
  const scale = tuning?.knockback?.knockbackDistanceToPx ?? tuning?.rangeToPx ?? 0.27;
  return (Number(distanceBcu) || 0) * scale;
}
