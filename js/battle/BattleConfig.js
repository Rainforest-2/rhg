export const BATTLE_CONFIG = {
  version: '0.7.4',
  groundY: 560,
  visualLayout: {
    logicalW: 1280,
    logicalH: 720,
    groundY: 560,
    backgroundVerticalAlign: 0.64,
    actorHpBarYOffset: 170,
    baseHpBarYOffset: 220,
    catBasePlaceholder: { width: 140, height: 125, labelYOffset: 12 },
    actorGroundY: 528,
    actorGlobalScale: 0.63,
    actorDepth: { enabled: true, laneCount: 13, minYOffset: -9, maxYOffset: 9, minScaleMultiplier: 0.985, maxScaleMultiplier: 1.0, randomizeOnSpawn: true }
  },
  tuning: { fps: 30, speedToPxPerSecond: 5.184, rangeToPx: 0.27, battleTimeScale: 0.65, minAttackWaitMs: 450, minAttackAnimMs: 500, minAttackStartupMs: 180, attackPhaseTimeMultiplier: 0.8, attackAnimationSpeedMultiplier: 1.25, attackWaitMultiplier: 1.2, postAttackIdleHoldMs: 650, knockbackPositionDistance: 50, damageResolveMode: 'post-tick', hpKnockbackDistancePx: 60, hpKnockbackDurationMs: 260, deathHoldMs: 650, finalKnockbackBeforeDeath: true, defaultCollisionRadius: 42, dogCollisionRadius: 46, catCollisionRadius: 42, minVisualGapPx: 18, maxAliveActors: 30, maxAliveActorsPerSide: 15, spawnSeparationPx: 32, deadRemoveAfterMs: 1000, maxEffects: 40, combatBodyRadiusMultiplier: 0.7, combatBodyHeightMultiplier: 2.2, combatBodyYOffsetPx: 0, combatBodyWidthPx: 44, combatBodyHeightPx: 72, hitEffectBodyYRatio: 0.55, hitEffectYOffsetPx: 0, combatPositionMode: 'logical', combatPointHalfWidthPx: 6, combatPointHeightPx: 72, combatPositionDebug: true },
  stage: { id: 0, imagePath: './public/assets/bcu/000001/org/img/bg/bg000.png', imgcutPath: './public/assets/bcu/000001/org/battle/bg/bg00.imgcut', csvPath: './public/assets/bcu/000001/org/battle/bg/bg.csv', cropName: '背景bg', groundY: 560, backgroundMode: 'bcu-stage0', backgroundLayout: { cropScale: 1.0, cropOffsetX: 0, cropOffsetY: 130, tileX: true, cropTopFadeHeight: 160, cropTopFadeStep: 4 } },
  bases: { dogBase: { id: 'dog-base', side: 'dog-player', label: 'ワンコ軍 拠点', x: 1120, y: 560, maxHp: 1000, collisionRadius: 80, visualKind: 'castle-composite', visualAssetId: 'castle-composite-000', scale: 0.86, visualBottomToCurrentCenter: false, visualYOffsetPx: -32, combatBodyHalfWidthPx: 42, combatBodyHeightPx: 160, combatBodyYOffsetPx: -32 }, catBase: { id: 'cat-base', side: 'cat-enemy', label: 'ネコ軍 拠点', x: 120, y: 560, maxHp: 1000, collisionRadius: 80, visualKind: 'simple-placeholder', visualAssetId: null, scale: 1.0, combatBodyHalfWidthPx: 42, combatBodyHeightPx: 125, combatBodyYOffsetPx: 0 } },
  rosters: {
    dogPlayer:[{slotId:'dog-wanko',label:'ワンコ',assetId:'enemy-000',statsType:'enemy',statsId:0,cost:50,cooldownMs:2000,side:'dog-player',direction:-1,facing:-1,renderFlipX:true,collisionRadius:46,scale:1.12,idleAnimId:'anim01',moveAnimId:'anim00',attackAnimId:'anim02',knockbackAnimId:'anim03',economySource:'provisional-design'},{slotId:'dog-nyoro',label:'ニョロ',assetId:'enemy-001',statsType:'enemy',statsId:1,cost:75,cooldownMs:2800,side:'dog-player',direction:-1,facing:-1,renderFlipX:true,collisionRadius:46,scale:1.12,idleAnimId:'anim01',moveAnimId:'anim00',attackAnimId:'anim02',knockbackAnimId:'anim03',economySource:'provisional-design'},{slotId:'dog-rei',label:'例のヤツ',assetId:'enemy-002',statsType:'enemy',statsId:2,cost:100,cooldownMs:3500,side:'dog-player',direction:-1,facing:-1,renderFlipX:true,collisionRadius:46,scale:1.12,idleAnimId:'anim01',moveAnimId:'anim00',attackAnimId:'anim02',knockbackAnimId:'anim03',economySource:'provisional-design',combatPositionOffsetPx:18,combatPositionSource:'roster-combat-pos-adjustment'}],
    catEnemy:[{slotId:'cat-basic',label:'ネコ',assetId:'unit-000-f',statsType:'unit',statsId:0,formRow:0,side:'cat-enemy',direction:1,facing:1,renderFlipX:true,collisionRadius:42,scale:1.15,idleAnimId:'anim01',moveAnimId:'anim00',attackAnimId:'anim02',knockbackAnimId:'anim03'},{slotId:'cat-tank',label:'タンクネコ',assetId:'unit-001-f',statsType:'unit',statsId:1,formRow:0,side:'cat-enemy',direction:1,facing:1,renderFlipX:true,collisionRadius:50,scale:1.12,idleAnimId:'anim01',moveAnimId:'anim00',attackAnimId:'anim02',knockbackAnimId:'anim03'},{slotId:'cat-battle',label:'バトルネコ',assetId:'unit-002-f',statsType:'unit',statsId:2,formRow:0,side:'cat-enemy',direction:1,facing:1,renderFlipX:true,collisionRadius:44,scale:1.12,idleAnimId:'anim01',moveAnimId:'anim00',attackAnimId:'anim02',knockbackAnimId:'anim03'}]
  },
  economy:{dogPlayer:{startMoney:150,maxMoney:6000,incomePerSecond:60}},
  enemySpawnSchedule:[{atMs:1000,slotId:'cat-basic'},{atMs:5000,slotId:'cat-basic',repeatMs:5500},{atMs:12000,slotId:'cat-tank',repeatMs:10000},{atMs:20000,slotId:'cat-battle',repeatMs:14000}]
};
