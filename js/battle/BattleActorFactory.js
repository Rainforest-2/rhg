import { PREVIEW_ASSETS } from '../data/previewAssets.js';
import { BcuAssetLoader } from '../bcu/BcuAssetLoader.js';
import { BcuSpriteSheet } from '../bcu/BcuSpriteSheet.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BattleActor } from './BattleActor.js';

export class BattleActorFactory {
  constructor(statsLoader, tuning) { this.loader = new BcuAssetLoader(); this.statsLoader = statsLoader; this.tuning = tuning; this.templates = new Map(); }
  findAsset(id) { return PREVIEW_ASSETS.find((a) => a.id === id); }
  async preloadTemplate(unitDef) { if (this.templates.has(unitDef.slotId)) return this.templates.get(unitDef.slotId); const assetDef = this.findAsset(unitDef.assetId); const set = await this.loader.loadAssetSet(assetDef); const animations = {}; for (const animId of [unitDef.idleAnimId, unitDef.moveAnimId, unitDef.attackAnimId, unitDef.knockbackAnimId]) { const ad = assetDef.animations.find((a) => a.id === animId); if (!ad) continue; const r = await this.loader.loadAnimation(assetDef, ad); if (r.anim) animations[animId] = r.anim; }
    const stats = unitDef.statsType === 'unit' ? await this.statsLoader.loadUnitStats(unitDef.statsId, 'f', unitDef.formRow || 0) : await this.statsLoader.loadEnemyStats(unitDef.statsId);
    const tpl = { unitDef, assetDef, sprite: set.image && set.imgcut ? new BcuSpriteSheet(set.image, set.imgcut) : null, modelData: set.model, animations, stats };
    this.templates.set(unitDef.slotId, tpl); return tpl; }
  createActor(templateId, overrides = {}) { const t = this.templates.get(templateId); const u=t.unitDef; const a = new BattleActor({ assetDef:t.assetDef,sprite:t.sprite,model:t.modelData?new BcuModelInstance(t.modelData):null,stats:t.stats,animations:t.animations,attackAnimId:u.attackAnimId,moveAnimId:u.moveAnimId,idleAnimId:u.idleAnimId,knockbackAnimId:u.knockbackAnimId,fps:this.tuning.fps,collisionRadius:u.collisionRadius,attackWaitMultiplier:this.tuning.attackWaitMultiplier ?? 1,attackPhaseTimeMultiplier:this.tuning.attackPhaseTimeMultiplier ?? 1,attackAnimationSpeedMultiplier:this.tuning.attackAnimationSpeedMultiplier ?? 1, ...overrides }); a.moveSpeed=t.stats.speed*this.tuning.speedToPxPerSecond; a.detectionRangePx=t.stats.detectionRange*this.tuning.rangeToPx; a.slotId=u.slotId; a.templateId=templateId; a.unitId=u.assetId; return a; }
}
