export const BCU_STAGEBASIS_PHASES = [
  'deployDupe',
  'layer-sort',
  'buttonDelay',
  'tempe-add',
  's_stop-inten',
  'enemy-spawn',
  'respawn',
  'elu-update',
  'spirit-cooldown',
  'cannon-money',
  'est-update',
  'sniper-update',
  'tempe-update',
  'shake',
  'updateEntities',
  'canon-update',
  'effects-update',
  'attack-capture',
  'attack-excuse',
  'base-postUpdate',
  'entity-postUpdate',
  'delay-apply',
  'boss-shockwave',
  'dead-remove',
  'lineupChanging-update'
];

export function getBcuStageBasisPhaseIndex(phase) {
  return BCU_STAGEBASIS_PHASES.indexOf(phase);
}

