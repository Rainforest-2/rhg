export const BATTLE_CONFIG = {
  groundY: 590,
  tuning: {
    fps: 30,
    speedToPxPerSecond: 8,
    rangeToPx: 1,
    minAttackDurationMs: 700
  },
  // NOTE: keeping current screen positions for v0 visibility.
  // Future battle flow target: dog-player spawns from right and advances left,
  // cat-enemy spawns from left and advances right.
  actors: {
    dogPlayerBasic: {
      instanceId: 'dog-001',
      assetId: 'enemy-000',
      statsType: 'enemy',
      statsId: 0,
      side: 'dog-player',
      label: 'ワンコ',
      x: 260,
      y: 590,
      facing: -1,
      scale: 1.0,
      idleAnimId: 'anim00',
      moveAnimId: 'anim00',
      attackAnimId: 'anim02'
    },
    catEnemyBasic: {
      instanceId: 'cat-001',
      assetId: 'unit-000-f',
      statsType: 'unit',
      statsId: 0,
      formRow: 0,
      side: 'cat-enemy',
      label: 'ネコ',
      x: 900,
      y: 590,
      facing: 1,
      scale: 1.0,
      idleAnimId: 'anim00',
      moveAnimId: 'anim00',
      attackAnimId: 'anim02'
    }
  },
  castle: {
    assetId: 'castle-composite-000',
    x: 1120,
    y: 590,
    scale: 1.0
  }
};
