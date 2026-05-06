import { PREVIEW_ASSETS } from '../data/previewAssets.js';
import { BcuAssetLoader } from '../bcu/BcuAssetLoader.js';
import { BcuSpriteSheet } from '../bcu/BcuSpriteSheet.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BattleActor } from './BattleActor.js';

export const TEMPLATE_LOAD_LEVEL = { STATS:'stats', RENDER_CORE:'render-core', SPAWN_READY:'spawn-ready', FULL_VISUAL:'full-visual' };
const LEVEL_RANK = { 'stats':1, 'render-core':2, 'spawn-ready':3, 'full-visual':4 };

export class BattleActorFactory {
  constructor(statsLoader, tuning) { this.loader = new BcuAssetLoader(); this.statsLoader = statsLoader; this.tuning = tuning; this.templates = new Map(); this.upgradePromises = new Map(); }
  findAsset(id) { return PREVIEW_ASSETS.find((a) => a.id === id); }
  resolveAssetDef(unitDef){ return unitDef?.assetDef || this.findAsset(unitDef?.assetId); }
  preloadTemplateStats(unitDef){ return this.preloadTemplate(unitDef,{level:TEMPLATE_LOAD_LEVEL.STATS}); }
  preloadTemplateRenderCore(unitDef){ return this.preloadTemplate(unitDef,{level:TEMPLATE_LOAD_LEVEL.RENDER_CORE}); }
  warmupTemplateVisuals(unitDef, animIds=null){ return this.preloadTemplate(unitDef,{level:TEMPLATE_LOAD_LEVEL.FULL_VISUAL,animIds}); }
  async ensureTemplateAnimation(slotId, animId){ const t=this.templates.get(slotId); if(!t?.unitDef||!animId) return null; return this.preloadTemplate(t.unitDef,{level:TEMPLATE_LOAD_LEVEL.FULL_VISUAL,animIds:[animId]}); }
  async preloadTemplate(unitDef, options = {}) {
    const level = options.level || TEMPLATE_LOAD_LEVEL.FULL_VISUAL;
    const key = `${unitDef.slotId}:${level}:${(options.animIds||[]).join(',')}`;
    if (this.upgradePromises.has(key)) return this.upgradePromises.get(key);
    const p = this._preloadTemplateUpgrade(unitDef, level, options).finally(()=>this.upgradePromises.delete(key));
    this.upgradePromises.set(key,p);
    return await p;
  }
  async _preloadTemplateUpgrade(unitDef, level, options={}){
    let tpl = this.templates.get(unitDef.slotId);
    const assetDef = tpl?.assetDef || this.resolveAssetDef(unitDef);
    if(!assetDef) throw new Error(`asset definition missing for ${unitDef.slotId} assetId=${unitDef.assetId}`);
    if(!tpl){ tpl={ unitDef, assetDef, sprite:null, modelData:null, animations:{}, stats:null, statsSourceSummary:null, loadingLevel:TEMPLATE_LOAD_LEVEL.STATS, loadedAnimations:new Set() }; this.templates.set(unitDef.slotId,tpl); }
    if(!tpl.stats){ tpl.stats = unitDef.statsType === 'unit' ? await this.statsLoader.loadUnitStats(unitDef.statsId, 'f', unitDef.formRow || 0) : await this.statsLoader.loadEnemyStats(unitDef.statsId); tpl.statsSourceSummary=this.statsLoader.describeStats?.(tpl.stats)||null; }
    if(LEVEL_RANK[level] >= LEVEL_RANK[TEMPLATE_LOAD_LEVEL.RENDER_CORE] && LEVEL_RANK[tpl.loadingLevel] < LEVEL_RANK[TEMPLATE_LOAD_LEVEL.RENDER_CORE]){
      const set = await this.loader.loadAssetSet(assetDef);
      tpl.sprite = set.image && set.imgcut ? new BcuSpriteSheet(set.image, set.imgcut) : null;
      tpl.modelData = set.model;
      for (const id of [unitDef.idleAnimId, unitDef.moveAnimId].filter(Boolean)) {
        const d=assetDef.animations?.find(a=>a.id===id); if(!d) continue; const r=await this.loader.loadAnimation(assetDef,d); if(r?.anim){tpl.animations[id]=r.anim;tpl.loadedAnimations.add(id);} }
      tpl.loadingLevel = TEMPLATE_LOAD_LEVEL.RENDER_CORE;
    }
    if(LEVEL_RANK[level] >= LEVEL_RANK[TEMPLATE_LOAD_LEVEL.SPAWN_READY]){
      const targets = new Set([unitDef.attackAnimId, ...(options.animIds||[])].filter(Boolean));
      for (const id of targets) { if(tpl.loadedAnimations.has(id)) continue; const d=assetDef.animations?.find(a=>a.id===id); if(!d) continue; const r=await this.loader.loadAnimation(assetDef,d); if(r?.anim){tpl.animations[id]=r.anim;tpl.loadedAnimations.add(id);} }
      tpl.loadingLevel = TEMPLATE_LOAD_LEVEL.SPAWN_READY;
    }
    if(LEVEL_RANK[level] >= LEVEL_RANK[TEMPLATE_LOAD_LEVEL.FULL_VISUAL]){
      const targets = new Set([unitDef.knockbackAnimId, ...(options.animIds||[])].filter(Boolean));
      for (const id of targets) { if(tpl.loadedAnimations.has(id)) continue; const d=assetDef.animations?.find(a=>a.id===id); if(!d) continue; const r=await this.loader.loadAnimation(assetDef,d); if(r?.anim){tpl.animations[id]=r.anim;tpl.loadedAnimations.add(id);} }
      tpl.loadingLevel = TEMPLATE_LOAD_LEVEL.FULL_VISUAL;
    }
    return tpl;
  }
  createActor(templateId, overrides = {}) { const t = this.templates.get(templateId); if(!t||LEVEL_RANK[t.loadingLevel] < LEVEL_RANK[TEMPLATE_LOAD_LEVEL.RENDER_CORE]) throw new Error(`template not render-ready: ${templateId}`); const u=t.unitDef; const bodyWidth = this.tuning.combatBodyWidthPx ?? 44; const bodyHeight = this.tuning.combatBodyHeightPx ?? 72; const a = new BattleActor({ assetDef:t.assetDef,sprite:t.sprite,model:t.modelData?new BcuModelInstance(t.modelData):null,stats:t.stats,animations:t.animations,attackAnimId:u.attackAnimId,moveAnimId:u.moveAnimId,idleAnimId:u.idleAnimId,knockbackAnimId:u.knockbackAnimId,fps:this.tuning.fps,collisionRadius:u.collisionRadius,attackWaitMultiplier:this.tuning.attackWaitMultiplier ?? 1,attackPhaseTimeMultiplier:this.tuning.attackPhaseTimeMultiplier ?? 1,attackAnimationSpeedMultiplier:this.tuning.attackAnimationSpeedMultiplier ?? 1,minAttackWaitMs:this.tuning.minAttackWaitMs ?? 0,postAttackIdleHoldMs:this.tuning.postAttackIdleHoldMs ?? 0,combatBodyWidthPx:bodyWidth,combatBodyHeightPx:bodyHeight,combatBodyYOffsetPx:this.tuning.combatBodyYOffsetPx ?? 0,combatPositionOffsetPx:Number.isFinite(u.combatPositionOffsetPx)?u.combatPositionOffsetPx:0,combatPositionSource:u.combatPositionSource||'screen-combat-point',combatEdgeInsetPx:Number.isFinite(u.combatEdgeInsetPx)?u.combatEdgeInsetPx:0,combatPositionMode:u.combatPositionMode||this.tuning.combatPositionMode||'screen-combat-point', ...overrides }); a.moveSpeed=t.stats.speed*this.tuning.speedToPxPerSecond; a.detectionRangePx=t.stats.detectionRange*this.tuning.rangeToPx; a.attackWidthPx=(t.stats.width||0)*(this.tuning.rangeToPx||1); a.refreshAttackProfile?.(); a.slotId=u.slotId; a.templateId=templateId; a.unitId=u.assetId; a.statsSourceSummary=t.statsSourceSummary||this.statsLoader.describeStats?.(t.stats)||null; return a; }
}
