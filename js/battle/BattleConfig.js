export const BATTLE_CONFIG = {
  groundY: 590,
  tuning: { fps: 30, speedToPxPerSecond: 8, rangeToPx: 1, minAttackDurationMs: 700 },
  stage: { id: 0, imagePath: './public/assets/bcu/000001/org/img/bg/bg000.png', imgcutPath: './public/assets/bcu/000001/org/battle/bg/bg00.imgcut', csvPath: './public/assets/bcu/000001/org/battle/bg/bg.csv', cropName: '背景bg', groundY: 590, backgroundMode: 'cover-crop' },
  actors: {
    dogPlayerBasic: {
      instanceId: 'dog-001', assetId: 'enemy-000', statsType: 'enemy', statsId: 0, side: 'dog-player', label: 'ワンコ',
      x: 980, y: 590, direction: -1, facing: -1, renderFlipX: true, scale: 1.0,
      idleAnimId: 'anim00', moveAnimId: 'anim00', attackAnimId: 'anim02', knockbackAnimId: 'anim03'
    },
    catEnemyBasic: {
      instanceId: 'cat-001', assetId: 'unit-000-f', statsType: 'unit', statsId: 0, formRow: 0, side: 'cat-enemy', label: 'ネコ',
      x: 280, y: 590, direction: 1, facing: 1, renderFlipX: true, scale: 1.0,
      idleAnimId: 'anim00', moveAnimId: 'anim00', attackAnimId: 'anim02', knockbackAnimId: 'anim03'
    }
  },
  castle: { assetId: 'castle-composite-000', x: 1120, y: 590, scale: 1.0 }
};
