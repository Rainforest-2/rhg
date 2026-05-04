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
  async loadStats(actorDef) { const s = actorDef.statsType === 'unit' ? await this.statsLoader.loadUnitStats(actorDef.statsId, 'f', actorDef.formRow || 0) : await this.statsLoader.loadEnemyStats(actorDef.statsId); if (s.source.fallbackFields.length) this.log('warn', `stats fallback ${actorDef.assetId}: ${s.source.fallbackFields.join(',')} status=${s.source.mappingStatus}`); return s; }

  async loadActor(actorDef) {
    const assetDef = this.findAsset(actorDef.assetId); const set = await this.loader.loadAssetSet(assetDef);
    const animations = {};
    for (const animId of [actorDef.idleAnimId, actorDef.moveAnimId, actorDef.attackAnimId, actorDef.knockbackAnimId]) {
      const ad = assetDef.animations.find((a) => a.id === animId); if (!ad) continue; const result = await this.loader.loadAnimation(assetDef, ad); if (result.anim) animations[animId] = result.anim;
    }
    const stats = await this.loadStats(actorDef);
    if (stats.source.fallbackFields.includes('attackStartupFrames')) {
      const attackAnim = animations[actorDef.attackAnimId];
      stats.attackStartupFrames = attackAnim?.maxFrame > 0 ? Math.max(1, Math.floor(attackAnim.maxFrame * 0.3)) : 8;
    }
    const actor = new BattleActor({ assetDef, side: actorDef.side, x: actorDef.x, y: actorDef.y, facing: actorDef.facing, direction: actorDef.direction, renderFlipX: actorDef.renderFlipX, scale: actorDef.scale, currentAnimId: actorDef.moveAnimId, sprite: set.image && set.imgcut ? new BcuSpriteSheet(set.image, set.imgcut) : null, model: set.model ? new BcuModelInstance(set.model) : null, stats, animations, attackAnimId: actorDef.attackAnimId, moveAnimId: actorDef.moveAnimId, idleAnimId: actorDef.idleAnimId, knockbackAnimId: actorDef.knockbackAnimId, fps: BATTLE_CONFIG.tuning.fps });
    actor.moveSpeed = stats.speed * BATTLE_CONFIG.tuning.speedToPxPerSecond;
    actor.detectionRangePx = stats.detectionRange * BATTLE_CONFIG.tuning.rangeToPx;
    actor.attackWaitMs = Math.max(BATTLE_CONFIG.tuning.minAttackWaitMs, actor.attackWaitMs);
    actor.attackPostHitWaitMs = actor.attackWaitMs;
    actor.nextAttackReadyMs = actor.attackWaitMs;
    actor.attackAnimDurationMs = Math.max(BATTLE_CONFIG.tuning.minAttackAnimMs, actor.attackAnimDurationMs);
    actor.knockbackPositionDistance = BATTLE_CONFIG.tuning.knockbackPositionDistance;
    actor.setAnimation(actor.moveAnimId, 'move', true);
    return actor;
  }

  async init() { this.timeMs = 0; this.debugEvents = []; const dog = await this.loadActor(BATTLE_CONFIG.actors.dogPlayerBasic); const cat = await this.loadActor(BATTLE_CONFIG.actors.catEnemyBasic); this.actors = [dog, cat]; const castleAsset = this.findAsset(BATTLE_CONFIG.castle.assetId); const cr = await this.loadCompositeLayers(castleAsset); this.castle.assetDef = castleAsset; this.castle.layers = cr.loaded; }
  updateBattleState(dog, cat) { if (dog.isAlive() && cat.isAlive()) this.battleState = 'running'; else if (!dog.isAlive() && !cat.isAlive()) this.battleState = 'draw'; else this.battleState = dog.isAlive() ? 'dog-win' : 'cat-win'; }
  inRange(a, b) { return Math.abs(a.x - b.x) <= Math.min(a.detectionRangePx, b.detectionRangePx); }
  tickKnockback(actor, dt, target) { actor.knockbackPositionElapsedMs += dt; const t = Math.min(1, actor.knockbackPositionElapsedMs / Math.max(1, actor.knockbackPositionDurationMs)); actor.x = actor.knockbackFromX + (actor.knockbackToX - actor.knockbackFromX) * (t * (2 - t)); if (t >= 1) { actor.setState(this.inRange(actor, target) ? 'attack-wait' : 'move'); actor.setAnimation(actor.state === 'move' ? actor.moveAnimId : actor.idleAnimId, 'move', true); this.pushEvent({ type: 'knockbackEnd', timeMs: this.timeMs, actor: actor.assetDef.label, target: target.assetDef.label, actorState: actor.state, actorHp: actor.hp }); } }

  tick(dt) {
    const effectiveDt = dt * BATTLE_CONFIG.tuning.battleTimeScale;
    this.timeMs += effectiveDt;
    const dog = this.actors.find((a) => a.side === 'dog-player'); const cat = this.actors.find((a) => a.side === 'cat-enemy'); if (!dog || !cat) return;
    for (const a of this.actors) a.tick(effectiveDt);
    this.updateBattleState(dog, cat); if (this.battleState !== 'running') return;
    const aliveAtFrameStart = new Map(this.actors.map((a) => [a, a.isAlive()]));
    const queue = [];
    for (const attacker of [dog, cat]) {
      const target = attacker === dog ? cat : dog; if (!attacker.isAlive()) continue;
      if (attacker.state === 'knockback') { this.tickKnockback(attacker, effectiveDt, target); continue; }
      if (!this.inRange(attacker, target)) { attacker.setState('move'); attacker.setAnimation(attacker.moveAnimId, 'move'); attacker.x += attacker.direction * attacker.moveSpeed * (effectiveDt / 1000); continue; }
      if (attacker.state === 'move') {
        attacker.setState('attack'); attacker.setAnimation(attacker.attackAnimId, 'attack', true);
        this.pushEvent({ type: 'attackStart', timeMs: this.timeMs, actor: attacker.assetDef.label, target: target.assetDef.label, actorState: attacker.state, targetState: target.state, actorHp: attacker.hp, targetHp: target.hp, attackStartupMs: attacker.attackStartupMs, attackWaitMs: attacker.attackWaitMs, attackAnimDurationMs: attacker.attackAnimDurationMs, attackCycleId: attacker.attackCycleId });
      }
      if (attacker.state === 'attack') {
        const prev = attacker.attackElapsedMs; attacker.attackElapsedMs += effectiveDt;
        const crossedHitFrame = !attacker.hasHitInCurrentAttack && aliveAtFrameStart.get(attacker) && (attacker.attackStartupMs <= 0 ? attacker.attackElapsedMs > 0 : (prev < attacker.attackStartupMs && attacker.attackElapsedMs >= attacker.attackStartupMs));
        if (crossedHitFrame) { queue.push({ attacker, target, damage: attacker.damage, hitTimeMs: this.timeMs, attackCycleId: attacker.attackCycleId, attackElapsedMs: attacker.attackElapsedMs, attackStartupMs: attacker.attackStartupMs }); attacker.hasHitInCurrentAttack = true; this.pushEvent({ type: 'hitQueued', timeMs: this.timeMs, actor: attacker.assetDef.label, target: target.assetDef.label, damage: attacker.damage, attackElapsedMs: attacker.attackElapsedMs, attackStartupMs: attacker.attackStartupMs, attackCycleId: attacker.attackCycleId }); }
        const attackEndMs = Math.max(attacker.attackAnimDurationMs, attacker.attackStartupMs);
        if (attacker.attackElapsedMs >= attackEndMs) { attacker.setState('attack-wait'); attacker.setAnimation(attacker.idleAnimId, 'move'); }
      } else if (attacker.state === 'attack-wait') {
        attacker.attackWaitElapsedMs += effectiveDt;
        if (!this.inRange(attacker, target)) { attacker.setState('move'); attacker.setAnimation(attacker.moveAnimId, 'move'); }
        else if (attacker.attackWaitElapsedMs >= attacker.nextAttackReadyMs) { attacker.setState('attack'); attacker.setAnimation(attacker.attackAnimId, 'attack', true); this.pushEvent({ type: 'attackStart', timeMs: this.timeMs, actor: attacker.assetDef.label, target: target.assetDef.label, actorState: attacker.state, targetState: target.state, actorHp: attacker.hp, targetHp: target.hp, attackStartupMs: attacker.attackStartupMs, attackWaitMs: attacker.attackWaitMs, attackAnimDurationMs: attacker.attackAnimDurationMs, attackCycleId: attacker.attackCycleId }); }
      }
    }
    for (const e of queue) { if (!aliveAtFrameStart.get(e.attacker)) continue; const before = e.target.hp; const result = e.target.takeDamage(e.damage); this.pushEvent({ type: 'damageApplied', timeMs: this.timeMs, actor: e.attacker.assetDef.label, target: e.target.assetDef.label, damage: e.damage, targetHpBefore: before, targetHpAfter: e.target.hp, knockedBack: result.knockedBack, dead: result.dead }); }
    this.updateBattleState(dog, cat);
  }
}
