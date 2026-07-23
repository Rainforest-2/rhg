import { PREVIEW_ASSETS } from '../data/previewAssets.js';
import { BcuAssetLoader } from '../bcu/BcuAssetLoader.js';
import { BcuSpriteSheet } from '../bcu/BcuSpriteSheet.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BattleActor } from './BattleActor.js';
import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';
import { bcuRangeToWorld, bcuSpeedToWorldPerSecond, bcuWidthToWorld } from './BattleWorldUnits.js';
import { ActorStatsModel } from './ActorStatsModel.js';
import { applyBcuUnitLevelToStats } from './bcu-runtime/BcuUnitLevelRuntime.js';
import { applyBcuComboModifiersToStats } from './bcu-runtime/BcuComboStatModifier.js';
import { applyTreasureToStats } from './bcu-runtime/BcuTreasureModifier.js';
import { applyTalentToStats } from './bcu-runtime/BcuTalentInfoData.js';
import { attachBcuProcObjectSummonsToAttackHits } from './bcu-runtime/BcuSummonRuntime.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';
import { applyCharacterModification } from '../character-modification/CharacterModificationResolver.js';
import { rebuildModifiedDerivedModels } from '../character-modification/CharacterModificationDerivedModel.js';
import { canonicalStringify, getCharacterModificationHash } from '../character-modification/CharacterModificationHash.js';
import { isEmptyCharacterModification } from '../character-modification/CharacterModificationSchema.js';

export const TEMPLATE_LOAD_LEVEL = { STATS:'stats', RENDER_CORE:'render-core', SPAWN_READY:'spawn-ready', FULL_VISUAL:'full-visual' };
const LEVEL_RANK = { 'stats':1, 'render-core':2, 'spawn-ready':3, 'full-visual':4 };
const BCU_TIMER_FPS = 1000 / 33;

function hashCacheContext(value) {
  const text = canonicalStringify(value);
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

function resolveModificationHash(unitDef = {}) {
  const modification = unitDef.characterModification;
  if (isEmptyCharacterModification(modification)) return 'none';
  const computed = getCharacterModificationHash(modification);
  return typeof computed === 'string' && computed ? computed : 'none';
}

function animationDefinitionIdentity(assetDef = {}) {
  return (Array.isArray(assetDef.animations) ? assetDef.animations : [])
    .map((definition) => ({
      id: definition?.id ?? null,
      file: definition?.file ?? null,
      role: definition?.role ?? null,
      internalPath: definition?.internalPath ?? null,
      bundleKey: definition?.bundleRef?.bundleKey ?? null,
      bundlePath: definition?.bundleRef?.bundlePath ?? null
    }))
    .sort((a, b) => canonicalStringify(a).localeCompare(canonicalStringify(b)));
}

export function buildTemplateCacheIdentity(unitDef = {}) {
  const slotId = String(unitDef.slotId || 'unknown-slot');
  const statsContext = {
    statsType: unitDef.statsType ?? null,
    statsId: unitDef.statsId ?? null,
    formRow: unitDef.formRow ?? unitDef.form ?? null,
    characterId: unitDef.characterId ?? null,
    sourceSlotId: unitDef.sourceSlotId ?? null,
    unitLevel: unitDef.bcuUnitLevel ?? null,
    combo: unitDef.bcuComboModifiers ?? null,
    treasure: unitDef.bcuTreasure ?? null,
    talentLevels: unitDef.bcuTalentLevels ?? null,
    equippedOrbs: unitDef.bcuEquippedOrbs ?? null,
    stageStatModifiers: unitDef.stageStatModifiers ?? null,
    procObject: unitDef.bcuProcObject ?? null
  };
  const animationContext = {
    assetId: unitDef.assetId ?? null,
    semanticKey: unitDef.assetDef?.semanticKey ?? null,
    assetDefinitionId: unitDef.assetDef?.id ?? null,
    assetBundleKey: unitDef.assetDef?.bundleRef?.bundleKey ?? null,
    assetBundlePath: unitDef.assetDef?.bundleRef?.bundlePath ?? null,
    imageFile: unitDef.assetDef?.image ?? null,
    imgcutFile: unitDef.assetDef?.imgcut ?? null,
    modelFile: unitDef.assetDef?.model ?? null,
    animationDefinitions: animationDefinitionIdentity(unitDef.assetDef),
    idleAnimId: unitDef.idleAnimId ?? null,
    moveAnimId: unitDef.moveAnimId ?? null,
    attackAnimId: unitDef.attackAnimId ?? null,
    knockbackAnimId: unitDef.knockbackAnimId ?? null
  };
  return `${slotId}::stats:${hashCacheContext(statsContext)}::mod:${resolveModificationHash(unitDef)}::anim:${hashCacheContext(animationContext)}`;
}

export function resolveNormalTemplateStats(statsLoader, unitDef, baseStats) {
  if (unitDef.statsType === 'enemy' && unitDef.stageStatModifiers) {
    let s = statsLoader.applyStageEnemyMagnification(baseStats, unitDef.stageStatModifiers);
    if (unitDef.bcuProcObject || s?.bcuProcObject || s?.customEntity) s = attachBcuProcObjectSummonsToAttackHits(s, unitDef.bcuProcObject || s?.bcuProcObject || s?.customEntity);
    return s;
  }
  if (unitDef.statsType === 'unit') {
    // BCU applies level magnification, then the construction-time multipliers
    // (combo C_ATK/C_DEF and treasure getAtkMulti/getDefMulti). Combo and
    // treasure are multiplicative on the leveled base, so order is commutative.
    let s = unitDef.bcuUnitLevel ? applyBcuUnitLevelToStats(baseStats, unitDef.bcuUnitLevel) : baseStats;
    if (unitDef.bcuComboModifiers) s = applyBcuComboModifiersToStats(s, unitDef.bcuComboModifiers);
    if (unitDef.bcuTreasure?.trea) s = applyTreasureToStats(s, unitDef.bcuTreasure.trea);
    // Talent (PCoin) attack/HP multipliers are construction-time (commutative
    // with combo/treasure); applied when both definitions and selected levels exist.
    if (unitDef.bcuTalentInfo && unitDef.bcuTalentLevels) s = applyTalentToStats(s, unitDef.bcuTalentInfo, unitDef.bcuTalentLevels);
      if (unitDef.bcuProcObject || s.bcuProcObject || s.customEntity) s = attachBcuProcObjectSummonsToAttackHits(s, unitDef.bcuProcObject || s.bcuProcObject || s.customEntity);
      // Equipped orbs are surfaced for the resolver (orb damage is per-trait, per-hit).
    if (unitDef.bcuEquippedOrbs) s = { ...s, bcuEquippedOrbs: unitDef.bcuEquippedOrbs };
    return s;
  }
  if (unitDef.bcuProcObject || baseStats?.bcuProcObject || baseStats?.customEntity) {
    return attachBcuProcObjectSummonsToAttackHits(baseStats, unitDef.bcuProcObject || baseStats?.bcuProcObject || baseStats?.customEntity);
  }
  return baseStats;
}

export function resolveTemplateStats(statsLoader, unitDef, baseStats) {
  const normalStats = resolveNormalTemplateStats(statsLoader, unitDef, baseStats);
  const modification = unitDef.characterModification;
  if (isEmptyCharacterModification(modification)) return normalStats;
  const modificationHash = resolveModificationHash(unitDef);
  const context = {
    kind: unitDef.statsType,
    source: unitDef.characterModificationSource || 'unit-definition',
    modificationHash,
    unitDef,
    normalStats
  };
  const modifiedStats = applyCharacterModification(normalStats, modification, context);
  return rebuildModifiedDerivedModels(modifiedStats, context);
}

export class BattleActorFactory {
  constructor(statsLoader, tuning) { this.loader = new BcuAssetLoader(); this.statsLoader = statsLoader; this.tuning = tuning || {}; this.templates = new Map(); this.templateKeysBySlot = new Map(); this.upgradePromises = new Map(); }
  findAsset(id) { return PREVIEW_ASSETS.find((a) => a.id === id); }
  resolveAssetDef(unitDef){ return unitDef?.assetDef || this.findAsset(unitDef?.assetId); }
  getTemplateId(unitDefOrId) {
    if (unitDefOrId && typeof unitDefOrId === 'object') return buildTemplateCacheIdentity(unitDefOrId);
    const id = String(unitDefOrId || '');
    if (this.templates.has(id)) return id;
    const keys = this.templateKeysBySlot.get(id);
    if (keys?.size !== 1) return id;
    return keys.values().next().value;
  }
  getTemplate(unitDefOrId) { return this.templates.get(this.getTemplateId(unitDefOrId)); }
  hasTemplate(unitDefOrId) { return this.templates.has(this.getTemplateId(unitDefOrId)); }
  registerTemplateKey(unitDef, templateId) {
    const slotId = String(unitDef?.slotId || '');
    if (!slotId) return;
    const keys = this.templateKeysBySlot.get(slotId) || new Set();
    keys.add(templateId);
    this.templateKeysBySlot.set(slotId, keys);
  }
  preloadTemplateStats(unitDef){ return this.preloadTemplate(unitDef,{level:TEMPLATE_LOAD_LEVEL.STATS}); }
  preloadTemplateRenderCore(unitDef){ return this.preloadTemplate(unitDef,{level:TEMPLATE_LOAD_LEVEL.RENDER_CORE}); }
  warmupTemplateVisuals(unitDef, animIds=null){ return this.preloadTemplate(unitDef,{level:TEMPLATE_LOAD_LEVEL.FULL_VISUAL,animIds}); }
  async ensureTemplateAnimation(unitDefOrId, animId){ const t=this.getTemplate(unitDefOrId); if(!t?.unitDef||!animId) return null; return this.preloadTemplate(t.unitDef,{level:TEMPLATE_LOAD_LEVEL.FULL_VISUAL,animIds:[animId]}); }
  getTimingParity(){ const cfg=this.tuning?.timingParity||{}; const enabled=cfg.enabled!==false; return { enabled, source: cfg.source || (enabled?'bcu-getItv-parity-default':'disabled'), disableAttackWaitMultiplier: enabled ? cfg.disableAttackWaitMultiplier !== false : false, disableMinAttackWait: enabled ? cfg.disableMinAttackWait !== false : false, disablePostAttackIdleHold: enabled ? cfg.disablePostAttackIdleHold !== false : false, disableMinAttackAnim: enabled ? cfg.disableMinAttackAnim !== false : false, disableMinAttackStartup: enabled ? cfg.disableMinAttackStartup !== false : false, disableAttackPhaseMultiplier: enabled ? cfg.disableAttackPhaseMultiplier !== false : false, disableAttackAnimationSpeedMultiplier: enabled ? cfg.disableAttackAnimationSpeedMultiplier !== false : false }; }
  async preloadTemplate(unitDef, options = {}) {
    const level = options.level || TEMPLATE_LOAD_LEVEL.FULL_VISUAL;
    const templateId = buildTemplateCacheIdentity(unitDef);
    const key = `${templateId}:${level}:${(options.animIds||[]).join(',')}`;
    if (this.upgradePromises.has(key)) return this.upgradePromises.get(key);
    const p = this._preloadTemplateUpgrade(unitDef, templateId, level, options).finally(()=>this.upgradePromises.delete(key));
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
  async _preloadTemplateUpgrade(unitDef, templateId, level, options={}){
    let tpl = this.templates.get(templateId);
    const assetDef = tpl?.assetDef || this.resolveAssetDef(unitDef);
    if(!assetDef) throw new Error(`asset definition missing for ${unitDef.slotId} assetId=${unitDef.assetId}`);
    if(!tpl){ tpl={ templateId, unitDef, assetDef, sprite:null, modelData:null, animations:{}, stats:null, baseStats:null, statsSourceSummary:null, baseStatsSourceSummary:null, loadingLevel:TEMPLATE_LOAD_LEVEL.STATS, loadedAnimations:new Set() }; this.templates.set(templateId,tpl); this.registerTemplateKey(unitDef, templateId); }
    if(!tpl.stats){
      const baseStats = unitDef.statsType === 'unit' ? await this.statsLoader.loadUnitStats(unitDef.statsId, 'f', unitDef.formRow || 0) : await this.statsLoader.loadEnemyStats(unitDef.statsId);
      tpl.baseStats = baseStats;
      tpl.stats = resolveTemplateStats(this.statsLoader, unitDef, baseStats);
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
  createActor(unitDefOrTemplateId, overrides = {}) {
    const templateId = this.getTemplateId(unitDefOrTemplateId);
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
    a.currentLayer=Number.isFinite(t.stats?.currentLayer)?t.stats.currentLayer:(Number.isFinite(t.stats?.layer)?t.stats.layer:(Number.isFinite(u.currentLayer)?u.currentLayer:0));
    a.bcuRenderLayerSource=t.stats?.characterModificationDebug?.appliedFields?.includes?.('stats.layer')?'character-modification-absolute':'template-stats-or-unit-definition';
    a.moveSpeedWorldPerSecond=bcuSpeedToWorldPerSecond(t.stats.speed); a.moveSpeed=a.moveSpeedWorldPerSecond; a.detectionRangeWorld=bcuRangeToWorld(t.stats.detectionRange); a.detectionRangePx=a.detectionRangeWorld; a.attackWidthWorld=bcuWidthToWorld(t.stats.width||0); a.attackWidthPx=a.attackWidthWorld; BattleCombatCoordinateRuntime.attachActor(a,{stats:t.stats,source:'BattleActorFactory.createActor'}); a.refreshAttackProfile?.(); a.slotId=u.slotId; a.templateId=templateId; a.unitId=u.assetId; a.characterModification=t.stats?.characterModification||null; a.characterModificationHash=t.stats?.characterModificationHash||null; a.characterModificationSource=t.stats?.characterModificationSource||null; a.statsSourceSummary=t.statsSourceSummary||this.statsLoader.describeStats?.(t.stats)||null; a.baseStats=t.baseStats||null; a.stageMagnification=t.stats?.stageMagnification||null; a.bcuUnitLevel=t.stats?.bcuUnitLevel||null; a.actorStatsModel=t.stats?.actorStatsModel||t.actorStatsModel||null; a.actorStatsModelDebug=t.stats?.statsModelDebug||t.statsModelDebug||(a.actorStatsModel?ActorStatsModel.describe(a.actorStatsModel):null); a.abilityModel=t.stats?.abilityModel||null; a.abilities=t.stats?.abilities||{}; a.traits=t.stats?.traits||[]; a.traitFlags=t.stats?.traitFlags||{}; a.abilityDebug={hasRawAbi:!!t.stats?.abilityModel?.hasRawAbi,mappingStatus:t.stats?.abilityModel?.mappingStatus||'none',attackAbilityCount:Array.isArray(t.stats?.abilityModel?.attackAbilities)?t.stats.abilityModel.attackAbilities.length:0}; a.statScalingDebug={...(a.actorStatsModelDebug||{}),baseHp:a.actorStatsModelDebug?.baseHp??t.baseStats?.hp??null,scaledHp:a.actorStatsModelDebug?.scaledHp??t.stats?.hp??null,baseDamage:a.actorStatsModelDebug?.baseDamage??t.baseStats?.damage??null,scaledDamage:a.actorStatsModelDebug?.scaledDamage??t.stats?.damage??null,stageMagnification:a.actorStatsModelDebug?.stageMagnification||t.stats?.stageMagnification||null,bcuUnitLevel:t.stats?.bcuUnitLevel||null}; return a;
  }
}
