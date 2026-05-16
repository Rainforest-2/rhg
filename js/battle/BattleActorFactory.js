import { PREVIEW_ASSETS } from '../data/previewAssets.js';
import { BcuAssetLoader } from '../bcu/BcuAssetLoader.js';
import { BcuSpriteSheet } from '../bcu/BcuSpriteSheet.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BattleActor } from './BattleActor.js';
import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';
import { bcuRangeToWorld, bcuSpeedToWorldPerSecond, bcuWidthToWorld } from './BattleWorldUnits.js';
import { ActorStatsModel } from './ActorStatsModel.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';

export const TEMPLATE_LOAD_LEVEL = { STATS:'stats', RENDER_CORE:'render-core', SPAWN_READY:'spawn-ready', FULL_VISUAL:'full-visual' };
const LEVEL_RANK = { 'stats':1, 'render-core':2, 'spawn-ready':3, 'full-visual':4 };
const BCU_TIMER_FPS = 1000 / 33;

export class BattleActorFactory {
  constructor(statsLoader, tuning) { this.loader = new BcuAssetLoader(); this.statsLoader = statsLoader; this.tuning = tuning || {}; this.templates = new Map(); this.upgradePromises = new Map(); }
  findAsset(id) { return PREVIEW_ASSETS.find((a) => a.id === id); }
  resolveAssetDef(unitDef){ return unitDef?.assetDef || this.findAsset(unitDef?.assetId); }
  preloadTemplateStats(unitDef){ return this.preloadTemplate(unitDef,{level:TEMPLATE_LOAD_LEVEL.STATS}); }
  preloadTemplateRenderCore(unitDef){ return this.preloadTemplate(unitDef,{level:TEMPLATE_LOAD_LEVEL.RENDER_CORE}); }
  warmupTemplateVisuals(unitDef, animIds=null){ return this.preloadTemplate(unitDef,{level:TEMPLATE_LOAD_LEVEL.FULL_VISUAL,animIds}); }
  async ensureTemplateAnimation(slotId, animId){ const t=this.templates.get(slotId); if(!t?.unitDef||!animId) return null; return this.preloadTemplate(t.unitDef,{level:TEMPLATE_LOAD_LEVEL.FULL_VISUAL,animIds:[animId]}); }
  getTimingParity(){ const cfg=this.tuning?.timingParity||{}; const enabled=cfg.enabled!==false; return { enabled, source: cfg.source || (enabled?'bcu-getItv-parity-default':'disabled'), disableAttackWaitMultiplier: enabled ? cfg.disableAttackWaitMultiplier !== false : false, disableMinAttackWait: enabled ? cfg.disableMinAttackWait !== false : false, disablePostAttackIdleHold: enabled ? cfg.disablePostAttackIdleHold !== false : false, disableMinAttackAnim: enabled ? cfg.disableMinAttackAnim !== false : false, disableMinAttackStartup: enabled ? cfg.disableMinAttackStartup !== false : false, disableAttackPhaseMultiplier: enabled ? cfg.disableAttackPhaseMultiplier !== false : false, disableAttackAnimationSpeedMultiplier: enabled ? cfg.disableAttackAnimationSpeedMultiplier !== false : false }; }
  async preloadTemplate(unitDef, options = {}) {
    const level = options.level || TEMPLATE_LOAD_LEVEL.FULL_VISUAL;
    const key = `${unitDef.slotId}:${level}:${(options.animIds||[]).join(',')}`;
    if (this.upgradePromises.has(key)) return this.upgradePromises.get(key);
    const p = this._preloadTemplateUpgrade(unitDef, level, options).finally(()=>this.upgradePromises.delete(key));
    this.upgradePromises.set(key,p);
    return await p;
  }
  async loadRequiredAnimation(tpl, assetDef, animId, role, semanticKey) {
    if (!animId || tpl.loadedAnimations.has(animId)) return;
    const d = assetDef.animations?.find(a=>a.id===animId);
    if (!d) throw new Error(`actor-animation definition missing: ${semanticKey || assetDef.id} role=${role} animId=${animId}`);
    const r = await this.loader.loadAnimation(assetDef,d);
    if (r?.anim) {
      tpl.animations[animId]=r.anim;
      tpl.loadedAnimations.add(animId);
      return;
    }
    const provider = (() => { try { return getBcuAssetDatabase()?.semanticProvider; } catch { return null; } })();
    const entry = provider?.getActorEntry?.(semanticKey);
    const internalPath = `${role}.maanim`;
    const detail = {
      kind: 'actor-animation',
      semanticKey,
      role,
      bundlePath: entry?.bundleRef?.bundlePath || null,
      internalPath,
      missingEntries: [internalPath],
      originalErrorName: null,
      originalErrorMessage: (r?.errors || []).join('; ') || r?.status || 'missing',
      message: `Required actor animation missing: ${semanticKey || assetDef.id} ${internalPath}`
    };
    provider?.diagnostics?.bundleErrors?.push?.(detail);
    throw new Error(detail.message);
  }
  async _preloadTemplateUpgrade(unitDef, level, options={}){
    let tpl = this.templates.get(unitDef.slotId);
    const assetDef = tpl?.assetDef || this.resolveAssetDef(unitDef);
    if(!assetDef) throw new Error(`asset definition missing for ${unitDef.slotId} assetId=${unitDef.assetId}`);
    if(!tpl){ tpl={ unitDef, assetDef, sprite:null, modelData:null, animations:{}, stats:null, baseStats:null, statsSourceSummary:null, baseStatsSourceSummary:null, loadingLevel:TEMPLATE_LOAD_LEVEL.STATS, loadedAnimations:new Set() }; this.templates.set(unitDef.slotId,tpl); }
    if(!tpl.stats){
      const baseStats = unitDef.statsType === 'unit' ? await this.statsLoader.loadUnitStats(unitDef.statsId, 'f', unitDef.formRow || 0) : await this.statsLoader.loadEnemyStats(unitDef.statsId);
      tpl.baseStats = baseStats;
      tpl.stats = unitDef.statsType === 'enemy' && unitDef.stageStatModifiers ? this.statsLoader.applyStageEnemyMagnification(baseStats, unitDef.stageStatModifiers) : baseStats;
      tpl.baseStatsSourceSummary=this.statsLoader.describeStats?.(tpl.baseStats)||null;
      tpl.statsSourceSummary=this.statsLoader.describeStats?.(tpl.stats)||null;
      tpl.actorStatsModel = tpl.stats?.actorStatsModel || null;
      tpl.statsModelDebug = tpl.stats?.statsModelDebug || (tpl.actorStatsModel ? ActorStatsModel.describe(tpl.actorStatsModel) : null);
    }
    if(LEVEL_RANK[level] >= LEVEL_RANK[TEMPLATE_LOAD_LEVEL.RENDER_CORE] && LEVEL_RANK[tpl.loadingLevel] < LEVEL_RANK[TEMPLATE_LOAD_LEVEL.RENDER_CORE]){
      try {
        const provider = getBcuAssetDatabase()?.semanticProvider;
        const key = assetDef.semanticKey || (unitDef.statsType === 'enemy' ? `enemy:${unitDef.statsId}` : unitDef.statsType === 'unit' ? `unit:${unitDef.statsId}:f` : null);
        if (provider?.hasBundleForKey?.(key) && !assetDef.semanticKey) {
          throw new Error(`Bundled actor assetDef missing semanticKey: ${key}`);
        }
      } catch (error) {
        if (!String(error?.message || error).includes('BCU asset database is not loaded')) throw error;
      }
      const set = await this.loader.loadAssetSet(assetDef);
      tpl.assetSetSemantic = set.semantic || null;
      tpl.sprite = set.image && set.imgcut ? new BcuSpriteSheet(set.image, set.imgcut) : null;
      tpl.modelData = set.model;
      const semanticKey = assetDef.semanticKey || (unitDef.statsType === 'enemy' ? `enemy:${unitDef.statsId}` : unitDef.statsType === 'unit' ? `unit:${unitDef.statsId}:f` : null);
      await this.loadRequiredAnimation(tpl, assetDef, unitDef.idleAnimId, 'idle', semanticKey);
      await this.loadRequiredAnimation(tpl, assetDef, unitDef.moveAnimId, 'move', semanticKey);
      tpl.loadingLevel = TEMPLATE_LOAD_LEVEL.RENDER_CORE;
    }
    if(LEVEL_RANK[level] >= LEVEL_RANK[TEMPLATE_LOAD_LEVEL.SPAWN_READY]){
      const semanticKey = assetDef.semanticKey || (unitDef.statsType === 'enemy' ? `enemy:${unitDef.statsId}` : unitDef.statsType === 'unit' ? `unit:${unitDef.statsId}:f` : null);
      await this.loadRequiredAnimation(tpl, assetDef, unitDef.attackAnimId, 'attack', semanticKey);
      for (const id of (options.animIds||[]).filter(Boolean)) {
        const role = id === unitDef.moveAnimId ? 'move' : id === unitDef.idleAnimId ? 'idle' : id === unitDef.attackAnimId ? 'attack' : id === unitDef.knockbackAnimId ? 'kb' : id;
        await this.loadRequiredAnimation(tpl, assetDef, id, role, semanticKey);
      }
      tpl.loadingLevel = TEMPLATE_LOAD_LEVEL.SPAWN_READY;
    }
    if(LEVEL_RANK[level] >= LEVEL_RANK[TEMPLATE_LOAD_LEVEL.FULL_VISUAL]){
      const semanticKey = assetDef.semanticKey || (unitDef.statsType === 'enemy' ? `enemy:${unitDef.statsId}` : unitDef.statsType === 'unit' ? `unit:${unitDef.statsId}:f` : null);
      await this.loadRequiredAnimation(tpl, assetDef, unitDef.knockbackAnimId, 'kb', semanticKey);
      for (const id of (options.animIds||[]).filter(Boolean)) {
        const role = id === unitDef.moveAnimId ? 'move' : id === unitDef.idleAnimId ? 'idle' : id === unitDef.attackAnimId ? 'attack' : id === unitDef.knockbackAnimId ? 'kb' : id;
        await this.loadRequiredAnimation(tpl, assetDef, id, role, semanticKey);
      }
      tpl.loadingLevel = TEMPLATE_LOAD_LEVEL.FULL_VISUAL;
    }
    return tpl;
  }
  createActor(templateId, overrides = {}) {
    const t = this.templates.get(templateId);
    if(!t||LEVEL_RANK[t.loadingLevel] < LEVEL_RANK[TEMPLATE_LOAD_LEVEL.RENDER_CORE]) throw new Error(`template not render-ready: ${templateId}`);
    const u=t.unitDef;
    const parity=this.getTimingParity();
    const bodyWidth = this.tuning.combatBodyWidthPx ?? 44;
    const bodyHeight = this.tuning.combatBodyHeightPx ?? 72;
    const attackWaitMultiplier = parity.disableAttackWaitMultiplier ? 1 : (this.tuning.attackWaitMultiplier ?? 1);
    const attackPhaseTimeMultiplier = parity.disableAttackPhaseMultiplier ? 1 : (this.tuning.attackPhaseTimeMultiplier ?? 1);
    const attackAnimationSpeedMultiplier = parity.disableAttackAnimationSpeedMultiplier ? 1 : (this.tuning.attackAnimationSpeedMultiplier ?? 1);
    const minAttackWaitMs = parity.disableMinAttackWait ? 0 : (this.tuning.minAttackWaitMs ?? 0);
    const postAttackIdleHoldMs = parity.disablePostAttackIdleHold ? 0 : (this.tuning.postAttackIdleHoldMs ?? 0);
    const a = new BattleActor({ assetDef:t.assetDef,sprite:t.sprite,model:t.modelData?new BcuModelInstance(t.modelData):null,stats:t.stats,animations:t.animations,attackAnimId:u.attackAnimId,moveAnimId:u.moveAnimId,idleAnimId:u.idleAnimId,knockbackAnimId:u.knockbackAnimId,fps:BCU_TIMER_FPS,collisionRadius:u.collisionRadius,attackWaitMultiplier,attackPhaseTimeMultiplier,attackAnimationSpeedMultiplier,minAttackWaitMs,postAttackIdleHoldMs,combatBodyWidthPx:bodyWidth,combatBodyHeightPx:bodyHeight,combatBodyYOffsetPx:this.tuning.combatBodyYOffsetPx ?? 0,combatPositionOffsetPx:Number.isFinite(u.combatPositionOffsetPx)?u.combatPositionOffsetPx:0,combatPositionSource:u.combatPositionSource||'screen-combat-point',combatEdgeInsetPx:Number.isFinite(u.combatEdgeInsetPx)?u.combatEdgeInsetPx:0,combatPositionMode:u.combatPositionMode||this.tuning.combatPositionMode||'screen-combat-point', ...overrides });
    a.semanticKey=t.assetDef?.semanticKey || (u.statsType === 'enemy' ? `enemy:${u.statsId}` : u.statsType === 'unit' ? `unit:${u.statsId}:f` : null);
    a.sourcePack=t.assetSetSemantic?.sourcePack || null;
    a.bundlePath=t.assetSetSemantic?.bundleRef?.bundlePath || null;
    a.timingParity=parity;
    a.moveSpeedWorldPerSecond=bcuSpeedToWorldPerSecond(t.stats.speed); a.moveSpeed=a.moveSpeedWorldPerSecond; a.detectionRangeWorld=bcuRangeToWorld(t.stats.detectionRange); a.detectionRangePx=a.detectionRangeWorld; a.attackWidthWorld=bcuWidthToWorld(t.stats.width||0); a.attackWidthPx=a.attackWidthWorld; BattleCombatCoordinateRuntime.attachActor(a,{stats:t.stats,source:'BattleActorFactory.createActor'}); a.refreshAttackProfile?.(); a.slotId=u.slotId; a.templateId=templateId; a.unitId=u.assetId; a.statsSourceSummary=t.statsSourceSummary||this.statsLoader.describeStats?.(t.stats)||null; a.baseStats=t.baseStats||null; a.stageMagnification=t.stats?.stageMagnification||null; a.actorStatsModel=t.stats?.actorStatsModel||t.actorStatsModel||null; a.actorStatsModelDebug=t.stats?.statsModelDebug||t.statsModelDebug||(a.actorStatsModel?ActorStatsModel.describe(a.actorStatsModel):null); a.abilityModel=t.stats?.abilityModel||null; a.abilities=t.stats?.abilities||{}; a.traits=t.stats?.traits||[]; a.traitFlags=t.stats?.traitFlags||{}; a.abilityDebug={hasRawAbi:!!t.stats?.abilityModel?.hasRawAbi,mappingStatus:t.stats?.abilityModel?.mappingStatus||'none',attackAbilityCount:Array.isArray(t.stats?.abilityModel?.attackAbilities)?t.stats.abilityModel.attackAbilities.length:0}; a.statScalingDebug={...(a.actorStatsModelDebug||{}),baseHp:a.actorStatsModelDebug?.baseHp??t.baseStats?.hp??null,scaledHp:a.actorStatsModelDebug?.scaledHp??t.stats?.hp??null,baseDamage:a.actorStatsModelDebug?.baseDamage??t.baseStats?.damage??null,scaledDamage:a.actorStatsModelDebug?.scaledDamage??t.stats?.damage??null,stageMagnification:a.actorStatsModelDebug?.stageMagnification||t.stats?.stageMagnification||null}; return a;
  }
}
