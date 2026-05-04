import { PREVIEW_ASSETS } from '../data/previewAssets.js';
import { BcuAssetLoader } from '../bcu/BcuAssetLoader.js';
import { BcuSpriteSheet } from '../bcu/BcuSpriteSheet.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BattleActor } from './BattleActor.js';
import { BattleStatsLoader } from './BattleStatsLoader.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import { StageBackgroundLoader } from './StageBackgroundLoader.js';

async function loadImage(url) { return await new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error(`Image load failed: ${url}`)); img.src = url; }); }

export class BattleScene {
  constructor(uiLog) { this.loader = new BcuAssetLoader(); this.statsLoader = new BattleStatsLoader(); this.bgLoader = new StageBackgroundLoader(uiLog); this.log = uiLog || (() => {}); this.groundY = BATTLE_CONFIG.groundY; this.actors = []; this.castle = { ...BATTLE_CONFIG.castle, layers: [] }; this.stage = { ...BATTLE_CONFIG.stage, background: null, backgroundLoadFailed: false }; this.loadFailed = false; this.failureReason = ''; this.battleState = 'running'; this.timeMs = 0; this.debugEvents = []; }
  pushEvent(event) { this.debugEvents.push(event); if (this.debugEvents.length > 10) this.debugEvents.shift(); }
  findAsset(id) { return PREVIEW_ASSETS.find((a) => a.id === id); }
  async loadCompositeLayers(asset) { const loaded = []; const missing = []; for (const layer of (asset.layers || [])) { try { loaded.push({ id: layer.id, name: layer.name || layer.id, anchor: layer.anchor || 'bottom-center', offsetX: layer.offsetX || 0, offsetY: layer.offsetY || 0, image: await loadImage(`${layer.baseDir}${layer.image}`) }); } catch (_e) { missing.push(`${layer.baseDir}${layer.image}`); } } return { loaded, missing }; }

  async loadStats(actorDef) {
    const s = actorDef.statsType === 'unit' ? await this.statsLoader.loadUnitStats(actorDef.statsId, 'f', actorDef.formRow || 0) : await this.statsLoader.loadEnemyStats(actorDef.statsId);
    const fields = s.source?.fallbackFields || [];
    const nonFatalOnly = fields.length > 0 && fields.every((f) => f === 'attackType' || f === 'attackStartupFrames');
    if (fields.includes('all') || !nonFatalOnly) this.log('warn', `stats fallback ${actorDef.assetId}: ${fields.join(',')} status=${s.source.mappingStatus}`);
    else if (fields.length) console.debug('[BattleScene] non-fatal stats fallback', actorDef.assetId, fields, s.source.mappingStatus);
    return s;
  }

  async loadActor(actorDef) {
    const assetDef = this.findAsset(actorDef.assetId); if (!assetDef) throw new Error(`Battle asset not found: ${actorDef.assetId}`);
    const set = await this.loader.loadAssetSet(assetDef);
    const animations = {};
    for (const animId of [actorDef.idleAnimId, actorDef.moveAnimId, actorDef.attackAnimId, actorDef.knockbackAnimId]) { const ad = assetDef.animations.find((a) => a.id === animId); if (!ad) continue; const result = await this.loader.loadAnimation(assetDef, ad); if (result.anim) animations[animId] = result.anim; }
    const stats = await this.loadStats(actorDef);
    if (stats.source.fallbackFields.includes('attackStartupFrames')) { const attackAnim = animations[actorDef.attackAnimId]; stats.attackStartupFrames = attackAnim?.maxFrame > 0 ? Math.max(1, Math.floor(attackAnim.maxFrame * 0.3)) : 8; }
    const actor = new BattleActor({ assetDef, side: actorDef.side, x: actorDef.x, y: actorDef.y, facing: actorDef.facing, direction: actorDef.direction, renderFlipX: actorDef.renderFlipX, scale: actorDef.scale, currentAnimId: actorDef.moveAnimId, sprite: set.image && set.imgcut ? new BcuSpriteSheet(set.image, set.imgcut) : null, model: set.model ? new BcuModelInstance(set.model) : null, stats, animations, attackAnimId: actorDef.attackAnimId, moveAnimId: actorDef.moveAnimId, idleAnimId: actorDef.idleAnimId, knockbackAnimId: actorDef.knockbackAnimId, fps: BATTLE_CONFIG.tuning.fps, collisionRadius: actorDef.collisionRadius || BATTLE_CONFIG.tuning.defaultCollisionRadius });
    actor.moveSpeed = stats.speed * BATTLE_CONFIG.tuning.speedToPxPerSecond;
    actor.detectionRangePx = stats.detectionRange * BATTLE_CONFIG.tuning.rangeToPx;
    actor.attackWaitMs = Math.max(BATTLE_CONFIG.tuning.minAttackWaitMs, actor.attackWaitMs);
    actor.nextAttackReadyMs = actor.attackWaitMs;
    actor.attackAnimDurationMs = Math.max(BATTLE_CONFIG.tuning.minAttackAnimMs, actor.attackAnimDurationMs);
    actor.knockbackPositionDistance = BATTLE_CONFIG.tuning.knockbackPositionDistance;
    actor.setAnimation(actor.moveAnimId, 'move', true);
    return actor;
  }

  async init() {
    this.loadFailed = false; this.failureReason = ''; this.battleState = 'running'; this.timeMs = 0; this.debugEvents = [];
    this.stage = { ...BATTLE_CONFIG.stage, background: null, backgroundLoadFailed: false };
    try { this.stage.background = await this.bgLoader.load(BATTLE_CONFIG.stage); this.stage.backgroundLoadFailed = false; }
    catch (e) { this.stage.background = null; this.stage.backgroundLoadFailed = true; this.log('warn', `battle background fallback: ${e instanceof Error ? e.message : String(e)}`); }
    try {
      const dog = await this.loadActor(BATTLE_CONFIG.actors.dogPlayerBasic); const cat = await this.loadActor(BATTLE_CONFIG.actors.catEnemyBasic); this.actors = [dog, cat];
      const castleAsset = this.findAsset(BATTLE_CONFIG.castle.assetId); if (!castleAsset) throw new Error(`Battle asset not found: ${BATTLE_CONFIG.castle.assetId}`);
      const cr = await this.loadCompositeLayers(castleAsset); this.castle.assetDef = castleAsset; this.castle.layers = cr.loaded;
      this.log('info', 'BattleScene initialized');
    } catch (e) {
      this.loadFailed = true; this.failureReason = e instanceof Error ? e.message : String(e); console.error('[BattleScene] load failed', e); this.log('error', `BattleScene load failed: ${this.failureReason}`);
    }
  }

  updateBattleState(dog, cat) { if (dog.isAlive() && cat.isAlive()) this.battleState = 'running'; else if (!dog.isAlive() && !cat.isAlive()) this.battleState = 'draw'; else this.battleState = dog.isAlive() ? 'dog-win' : 'cat-win'; }
  getDistanceInfo(a, b) { const centerDistance = a.getCenterDistanceTo(b); const bodyDistance = a.getBodyDistanceTo(b); const attackReach = Math.min(a.detectionRangePx, b.detectionRangePx); return { centerDistance, bodyDistance, attackReach }; }
  inRange(a, b) { const { bodyDistance, attackReach } = this.getDistanceInfo(a, b); return bodyDistance <= attackReach; }

  tickKnockback(actor, dt, target) { actor.knockbackPositionElapsedMs += dt; const t = Math.min(1, actor.knockbackPositionElapsedMs / Math.max(1, actor.knockbackPositionDurationMs)); actor.x = actor.knockbackFromX + (actor.knockbackToX - actor.knockbackFromX) * (t * (2 - t)); if (t >= 1) { actor.setState(this.inRange(actor, target) ? 'attack-wait' : 'move'); actor.setAnimation(actor.state === 'move' ? actor.moveAnimId : actor.idleAnimId, 'move', true); } }

  tick(dt) {
    if (this.loadFailed) return;
    const effectiveDt = dt * BATTLE_CONFIG.tuning.battleTimeScale;
    this.timeMs += effectiveDt;
    const dog = this.actors.find((a) => a.side === 'dog-player'); const cat = this.actors.find((a) => a.side === 'cat-enemy'); if (!dog || !cat) return;
    dog.debugDistance = this.getDistanceInfo(dog, cat); cat.debugDistance = this.getDistanceInfo(cat, dog);
    for (const a of this.actors) a.tick(effectiveDt);
    this.updateBattleState(dog, cat); if (this.battleState !== 'running') return;
    const aliveAtFrameStart = new Map(this.actors.map((a) => [a, a.isAlive()])); const queue = [];
    for (const attacker of [dog, cat]) {
      const target = attacker === dog ? cat : dog; if (!attacker.isAlive()) continue;
      if (attacker.state === 'knockback') { this.tickKnockback(attacker, effectiveDt, target); continue; }
      const { bodyDistance, attackReach } = this.getDistanceInfo(attacker, target);
      const stopBodyDistance = Math.max(BATTLE_CONFIG.tuning.minVisualGapPx, attackReach);
      if (bodyDistance > attackReach) { attacker.setState('move'); attacker.setAnimation(attacker.moveAnimId, 'move'); attacker.x += attacker.direction * attacker.moveSpeed * (effectiveDt / 1000); const after = this.getDistanceInfo(attacker, target); if (after.bodyDistance < BATTLE_CONFIG.tuning.minVisualGapPx) attacker.x -= attacker.direction * (BATTLE_CONFIG.tuning.minVisualGapPx - after.bodyDistance); continue; }
      if (bodyDistance <= stopBodyDistance && attacker.state === 'move') { attacker.setState('attack'); attacker.setAnimation(attacker.attackAnimId, 'attack', true); this.pushEvent({ type: 'attackStart', timeMs: this.timeMs, actor: attacker.assetDef.label, target: target.assetDef.label }); }
      if (attacker.state === 'attack') { const prev = attacker.attackElapsedMs; attacker.attackElapsedMs += effectiveDt; const crossedHitFrame = !attacker.hasHitInCurrentAttack && aliveAtFrameStart.get(attacker) && (attacker.attackStartupMs <= 0 ? attacker.attackElapsedMs > 0 : (prev < attacker.attackStartupMs && attacker.attackElapsedMs >= attacker.attackStartupMs)); if (crossedHitFrame) { queue.push({ attacker, target, damage: attacker.damage }); attacker.hasHitInCurrentAttack = true; this.pushEvent({ type: 'hitQueued', timeMs: this.timeMs, actor: attacker.assetDef.label, target: target.assetDef.label, damage: attacker.damage }); } const attackEndMs = Math.max(attacker.attackAnimDurationMs, attacker.attackStartupMs); if (attacker.attackElapsedMs >= attackEndMs) { attacker.setState('attack-wait'); attacker.setAnimation(attacker.idleAnimId, 'move'); } }
      else if (attacker.state === 'attack-wait') { attacker.attackWaitElapsedMs += effectiveDt; if (bodyDistance > attackReach) { attacker.setState('move'); attacker.setAnimation(attacker.moveAnimId, 'move'); } else if (attacker.attackWaitElapsedMs >= attacker.nextAttackReadyMs) { attacker.setState('attack'); attacker.setAnimation(attacker.attackAnimId, 'attack', true); this.pushEvent({ type: 'attackStart', timeMs: this.timeMs, actor: attacker.assetDef.label, target: target.assetDef.label }); } }
    }
    for (const e of queue) { if (!aliveAtFrameStart.get(e.attacker)) continue; const before = e.target.hp; const result = e.target.takeDamage(e.damage); this.pushEvent({ type: 'damageApplied', timeMs: this.timeMs, actor: e.attacker.assetDef.label, target: e.target.assetDef.label, damage: e.damage, targetHpBefore: before, targetHpAfter: e.target.hp, knockedBack: result.knockedBack, dead: result.dead }); }
    this.updateBattleState(dog, cat);
  }
}
