import { PREVIEW_ASSETS } from '../data/previewAssets.js';
import { BcuAssetLoader } from '../bcu/BcuAssetLoader.js';
import { BcuSpriteSheet } from '../bcu/BcuSpriteSheet.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BattleActor } from './BattleActor.js';
import { BattleBase } from './BattleBase.js';
import { BattleStatsLoader } from './BattleStatsLoader.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import { StageBackgroundLoader } from './StageBackgroundLoader.js';

async function loadImage(url) { return await new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error(`Image load failed: ${url}`)); img.src = url; }); }

export class BattleScene {
  constructor(uiLog) { this.loader = new BcuAssetLoader(); this.statsLoader = new BattleStatsLoader(); this.bgLoader = new StageBackgroundLoader(uiLog); this.log = uiLog || (() => {}); this.groundY = BATTLE_CONFIG.groundY; this.actors = []; this.bases = []; this.stage = { ...BATTLE_CONFIG.stage, background: null, backgroundLoadFailed: false }; this.loadFailed = false; this.failureReason = ''; this.battleState = 'running'; this.timeMs = 0; this.debugEvents = []; }
  pushEvent(event) { this.debugEvents.push(event); if (this.debugEvents.length > 10) this.debugEvents.shift(); }
  findAsset(id) { return PREVIEW_ASSETS.find((a) => a.id === id); }
  async loadCompositeLayers(asset) { const loaded = []; for (const layer of (asset.layers || [])) { try { loaded.push({ id: layer.id, name: layer.name || layer.id, offsetX: layer.offsetX || 0, offsetY: layer.offsetY || 0, image: await loadImage(`${layer.baseDir}${layer.image}`) }); } catch {} } return loaded; }

  async loadStats(actorDef) { const s = actorDef.statsType === 'unit' ? await this.statsLoader.loadUnitStats(actorDef.statsId, 'f', actorDef.formRow || 0) : await this.statsLoader.loadEnemyStats(actorDef.statsId); const fields = s.source?.fallbackFields || []; const nonFatalOnly = fields.length > 0 && fields.every((f) => f === 'attackType' || f === 'attackStartupFrames'); if (fields.includes('all') || !nonFatalOnly) this.log('warn', `stats fallback ${actorDef.assetId}: ${fields.join(',')} status=${s.source.mappingStatus}`); else if (fields.length) console.debug('[BattleScene] non-fatal stats fallback', actorDef.assetId, fields, s.source.mappingStatus); return s; }
  async loadActor(actorDef) { const assetDef = this.findAsset(actorDef.assetId); if (!assetDef) throw new Error(`Battle asset not found: ${actorDef.assetId}`); const set = await this.loader.loadAssetSet(assetDef); const animations = {}; for (const animId of [actorDef.idleAnimId, actorDef.moveAnimId, actorDef.attackAnimId, actorDef.knockbackAnimId]) { const ad = assetDef.animations.find((a) => a.id === animId); if (!ad) continue; const result = await this.loader.loadAnimation(assetDef, ad); if (result.anim) animations[animId] = result.anim; } const stats = await this.loadStats(actorDef); if (stats.source.fallbackFields.includes('attackStartupFrames')) { const attackAnim = animations[actorDef.attackAnimId]; stats.attackStartupFrames = attackAnim?.maxFrame > 0 ? Math.max(1, Math.floor(attackAnim.maxFrame * 0.3)) : 8; } const actor = new BattleActor({ assetDef, side: actorDef.side, x: actorDef.x, y: actorDef.y, facing: actorDef.facing, direction: actorDef.direction, renderFlipX: actorDef.renderFlipX, scale: actorDef.scale, currentAnimId: actorDef.moveAnimId, sprite: set.image && set.imgcut ? new BcuSpriteSheet(set.image, set.imgcut) : null, model: set.model ? new BcuModelInstance(set.model) : null, stats, animations, attackAnimId: actorDef.attackAnimId, moveAnimId: actorDef.moveAnimId, idleAnimId: actorDef.idleAnimId, knockbackAnimId: actorDef.knockbackAnimId, fps: BATTLE_CONFIG.tuning.fps, collisionRadius: actorDef.collisionRadius || BATTLE_CONFIG.tuning.defaultCollisionRadius }); actor.moveSpeed = stats.speed * BATTLE_CONFIG.tuning.speedToPxPerSecond; actor.detectionRangePx = stats.detectionRange * BATTLE_CONFIG.tuning.rangeToPx; actor.attackWaitMs = Math.max(BATTLE_CONFIG.tuning.minAttackWaitMs, actor.attackWaitMs); actor.nextAttackReadyMs = actor.attackWaitMs; actor.attackAnimDurationMs = Math.max(BATTLE_CONFIG.tuning.minAttackAnimMs, actor.attackAnimDurationMs); actor.knockbackPositionDistance = BATTLE_CONFIG.tuning.knockbackPositionDistance; actor.setAnimation(actor.moveAnimId, 'move', true); return actor; }
  async loadBase(baseDef) { const base = new BattleBase(baseDef); if (base.visualKind === 'castle-composite' && base.visualAssetId) { const asset = this.findAsset(base.visualAssetId); if (asset) base.layers = await this.loadCompositeLayers(asset); } return base; }

  findEnemyActors(actor) { return this.actors.filter((a) => a.side !== actor.side && a.isAlive()); }
  findEnemyBase(actor) { return this.bases.find((b) => b.side !== actor.side && b.isAlive()); }
  findTargetForActor(actor) { const enemies = this.findEnemyActors(actor); if (enemies.length) { enemies.sort((a, b) => actor.getCenterDistanceTo(a) - actor.getCenterDistanceTo(b)); return { targetType: 'actor', target: enemies[0] }; } const base = this.findEnemyBase(actor); return base ? { targetType: 'base', target: base } : null; }

  async init() {
    this.loadFailed = false; this.failureReason = ''; this.battleState = 'running'; this.timeMs = 0; this.debugEvents = []; this.bases = [];
    this.stage = { ...BATTLE_CONFIG.stage, background: null, backgroundLoadFailed: false };
    try { this.stage.background = await this.bgLoader.load(BATTLE_CONFIG.stage); this.stage.backgroundLoadFailed = false; } catch (e) { this.stage.background = null; this.stage.backgroundLoadFailed = true; this.log('warn', `battle background fallback: ${e instanceof Error ? e.message : String(e)}`); }
    try { const dog = await this.loadActor(BATTLE_CONFIG.actors.dogPlayerBasic); const cat = await this.loadActor(BATTLE_CONFIG.actors.catEnemyBasic); this.actors = [dog, cat]; this.bases = [await this.loadBase(BATTLE_CONFIG.bases.dogBase), await this.loadBase(BATTLE_CONFIG.bases.catBase)]; this.log('info', 'BattleScene initialized'); } catch (e) { this.loadFailed = true; this.failureReason = e instanceof Error ? e.message : String(e); console.error('[BattleScene] load failed', e); this.log('error', `BattleScene load failed: ${this.failureReason}`); }
  }

  updateBattleState() { const dogBase = this.bases.find((b) => b.side === 'dog-player'); const catBase = this.bases.find((b) => b.side === 'cat-enemy'); if (!dogBase || !catBase) return; if (dogBase.destroyed && catBase.destroyed) { this.battleState = 'draw'; return; } if (dogBase.destroyed) { this.battleState = 'cat-win'; return; } if (catBase.destroyed) { this.battleState = 'dog-win'; return; } const aliveActors = this.actors.filter((a) => a.isAlive()).length; this.battleState = aliveActors === 0 ? 'stalemate' : 'running'; }
  getDistanceInfo(a, b) { const centerDistance = a.getCenterDistanceTo(b); const bodyDistance = a.getBodyDistanceTo(b); const attackReach = a.detectionRangePx; return { centerDistance, bodyDistance, attackReach }; }
  canAttack(attacker, target) { return attacker.getBodyDistanceTo(target) <= attacker.detectionRangePx; }
  tickKnockback(actor, dt, target) { actor.knockbackPositionElapsedMs += dt; const t = Math.min(1, actor.knockbackPositionElapsedMs / Math.max(1, actor.knockbackPositionDurationMs)); actor.x = actor.knockbackFromX + (actor.knockbackToX - actor.knockbackFromX) * (t * (2 - t)); if (t >= 1) { actor.setState(this.canAttack(actor, target) ? 'attack-wait' : 'move'); actor.setAnimation(actor.state === 'move' ? actor.moveAnimId : actor.idleAnimId, 'move', true); } }

  tick(dt) {
    if (this.loadFailed) return;
    const effectiveDt = dt * BATTLE_CONFIG.tuning.battleTimeScale;
    this.timeMs += effectiveDt;
    for (const a of this.actors) a.tick(effectiveDt);
    this.updateBattleState(); if (this.battleState !== 'running') return;
    const aliveAtFrameStart = new Map(this.actors.map((a) => [a, a.isAlive()])); const queue = [];
    for (const actor of this.actors) {
      if (!actor.isAlive()) continue; const selection = this.findTargetForActor(actor); if (!selection) { actor.setState('move'); actor.setAnimation(actor.idleAnimId, 'move'); continue; }
      const { target, targetType } = selection; actor.currentTargetType = targetType; actor.currentTargetLabel = target.label;
      actor.debugDistance = this.getDistanceInfo(actor, target);
      if (actor.state === 'knockback') { this.tickKnockback(actor, effectiveDt, target); continue; }
      const bodyDistance = actor.getBodyDistanceTo(target); const stopBodyDistance = Math.max(BATTLE_CONFIG.tuning.minVisualGapPx, actor.detectionRangePx);
      if (!this.canAttack(actor, target)) { actor.setState('move'); actor.setAnimation(actor.moveAnimId, 'move'); actor.x += actor.direction * actor.moveSpeed * (effectiveDt / 1000); const after = actor.getBodyDistanceTo(target); if (after < BATTLE_CONFIG.tuning.minVisualGapPx) actor.x -= actor.direction * (BATTLE_CONFIG.tuning.minVisualGapPx - after); continue; }
      if (bodyDistance <= stopBodyDistance && actor.state === 'move') { actor.setState('attack'); actor.setAnimation(actor.attackAnimId, 'attack', true); this.pushEvent({ type: 'attackStart', timeMs: this.timeMs, actor: actor.assetDef.label, target: target.label, targetType }); }
      if (actor.state === 'attack') { const prev = actor.attackElapsedMs; actor.attackElapsedMs += effectiveDt; const crossedHitFrame = !actor.hasHitInCurrentAttack && aliveAtFrameStart.get(actor) && (actor.attackStartupMs <= 0 ? actor.attackElapsedMs > 0 : (prev < actor.attackStartupMs && actor.attackElapsedMs >= actor.attackStartupMs)); if (crossedHitFrame) { queue.push({ attacker: actor, target, targetType, damage: actor.damage }); actor.hasHitInCurrentAttack = true; this.pushEvent({ type: 'hitQueued', timeMs: this.timeMs, actor: actor.assetDef.label, target: target.label, targetType, damage: actor.damage }); } const attackEndMs = Math.max(actor.attackAnimDurationMs, actor.attackStartupMs); if (actor.attackElapsedMs >= attackEndMs) { actor.setState('attack-wait'); actor.setAnimation(actor.idleAnimId, 'move'); } }
      else if (actor.state === 'attack-wait') { actor.attackWaitElapsedMs += effectiveDt; if (!this.canAttack(actor, target)) { actor.setState('move'); actor.setAnimation(actor.moveAnimId, 'move'); } else if (actor.attackWaitElapsedMs >= actor.nextAttackReadyMs) { actor.setState('attack'); actor.setAnimation(actor.attackAnimId, 'attack', true); } }
    }
    for (const e of queue) { if (!e.attacker.isAlive()) continue; const result = e.target.takeDamage(e.damage); this.pushEvent({ type: 'damageApplied', timeMs: this.timeMs, actor: e.attacker.assetDef.label, target: e.target.label, targetType: e.targetType, damage: e.damage, dead: result?.dead || result?.destroyed || false }); }
    this.updateBattleState();
  }
}
