export const BATTLE_CONFIG = {
  groundY: 590,
  tuning: {
    fps: 30,
    speedToPxPerSecond: 3.6,
    rangeToPx: 0.6,
    battleTimeScale: 0.65,
    minAttackWaitMs: 450,
    minAttackAnimMs: 500,
    knockbackPositionDistance: 50,
    defaultCollisionRadius: 42,
    dogCollisionRadius: 46,
    catCollisionRadius: 42,
    minVisualGapPx: 18
  },
  stage: { id: 0, imagePath: './public/assets/bcu/000001/org/img/bg/bg000.png', imgcutPath: './public/assets/bcu/000001/org/battle/bg/bg00.imgcut', csvPath: './public/assets/bcu/000001/org/battle/bg/bg.csv', cropName: '背景bg', groundY: 590, backgroundMode: 'cover-crop' },
  actors: {
    dogPlayerBasic: {
      instanceId: 'dog-001', assetId: 'enemy-000', statsType: 'enemy', statsId: 0, side: 'dog-player', label: 'ワンコ',
      x: 980, y: 590, direction: -1, facing: -1, renderFlipX: true, scale: 1.0,
      idleAnimId: 'anim00', moveAnimId: 'anim00', attackAnimId: 'anim02', knockbackAnimId: 'anim03', collisionRadius: 46
    },
    catEnemyBasic: {
      instanceId: 'cat-001', assetId: 'unit-000-f', statsType: 'unit', statsId: 0, formRow: 0, side: 'cat-enemy', label: 'ネコ',
      x: 280, y: 590, direction: 1, facing: 1, renderFlipX: true, scale: 1.0,
      idleAnimId: 'anim00', moveAnimId: 'anim00', attackAnimId: 'anim02', knockbackAnimId: 'anim03', collisionRadius: 42
    }
  },
  bases: {
    dogBase: {
      id: 'dog-base', side: 'dog-player', label: 'ワンコ軍 拠点', x: 1120, y: 590, maxHp: 1000, collisionRadius: 80,
      visualKind: 'castle-composite', visualAssetId: 'castle-composite-000', scale: 1.0,
      note: 'temporary visual: using nyanko castle composite as dog-player base placeholder'
    },
    catBase: {
      id: 'cat-base', side: 'cat-enemy', label: 'ネコ軍 拠点', x: 120, y: 590, maxHp: 1000, collisionRadius: 80,
      visualKind: 'simple-placeholder', visualAssetId: null, scale: 1.0,
      note: 'temporary placeholder until enemy base asset is selected'
    }
  }
};
