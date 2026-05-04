export const BATTLE_CONFIG = {
  groundY: 590,
  tuning: {
    fps: 30,
    speedToPxPerSecond: 8,
    rangeToPx: 1,
    minAttackDurationMs: 700
  },
  actors: {
    dogPlayerBasic: {
      instanceId: 'dog-001', assetId: 'enemy-000', statsType: 'enemy', statsId: 0, side: 'dog-player', label: 'ワンコ',
      x: 980, y: 590, facing: -1, scale: 1.0, idleAnimId: 'anim00', moveAnimId: 'anim00', attackAnimId: 'anim02'
    },
    catEnemyBasic: {
      instanceId: 'cat-001', assetId: 'unit-000-f', statsType: 'unit', statsId: 0, formRow: 0, side: 'cat-enemy', label: 'ネコ',
      x: 280, y: 590, facing: 1, scale: 1.0, idleAnimId: 'anim00', moveAnimId: 'anim00', attackAnimId: 'anim02'
    }
  },
  // 現時点では既存にゃんこ城を右側に仮配置。将来的にワンコ大戦争として城所属・左右配置を再整理する。
  castle: { assetId: 'castle-composite-000', x: 1120, y: 590, scale: 1.0 }
};
