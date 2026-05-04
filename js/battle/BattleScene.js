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
  constructor(uiLog) {
    this.loader = new BcuAssetLoader(); this.statsLoader = new BattleStatsLoader(); this.bgLoader = new StageBackgroundLoader(uiLog);
    this.log = uiLog || (() => {}); this.mode = 'battle'; this.groundY = BATTLE_CONFIG.groundY; this.actors = [];
    this.castle = { ...BATTLE_CONFIG.castle, layers: [] }; this.stage = { ...BATTLE_CONFIG.stage, background: null, backgroundLoadFailed: false };
    this.loadFailed = false; this.failureReason = ''; this.battleState = 'running';
  }
  findAsset(id) { return PREVIEW_ASSETS.find((a) => a.id === id); }
  async loadCompositeLayers(asset) { const loaded = []; const missing = []; for (const layer of (asset.layers || [])) { try { loaded.push({ id: layer.id, name: layer.name || layer.id, anchor: layer.anchor || 'bottom-center', offsetX: layer.offsetX || 0, offsetY: layer.offsetY || 0, image: await loadImage(`${layer.baseDir}${layer.image}`) }); } catch (_e) { missing.push(`${layer.baseDir}${layer.image}`); } } return { loaded, missing }; }

  async loadStats(actorDef) { try { if (actorDef.statsType === 'unit') return await this.statsLoader.loadUnitStats(actorDef.statsId, 'f', actorDef.formRow || 0); if (actorDef.statsType === 'enemy') return await this.statsLoader.loadEnemyStats(actorDef.statsId); throw new Error(`Unknown stats type: ${actorDef.statsType}`); } catch (e) { this.log('warn', `stats fallback for ${actorDef.assetId}: ${e instanceof Error ? e.message : String(e)}`); return { hp: 100, knockbacks: 1, speed: 5, damage: 5, attackWaitFrames: 30, detectionRange: 100, costOrReward: 0, respawnFrames: 0, attackType: 0, attackStartupFrames: 8, rawValues: [], source: { file: 'fallback', row: -1, type: actorDef.statsType, provisional: true, note: 'fallback' } }; } }

  async loadActor(actorDef) {
    const assetDef = this.findAsset(actorDef.assetId); if (!assetDef) throw new Error(`Battle asset not found: ${actorDef.assetId}`);
    const set = await this.loader.loadAssetSet(assetDef); set.errors.forEach((e) => this.log('error', e)); set.missing.forEach((m) => this.log('warn', `missing file: ${m}`));
    const animations = {};
    for (const animId of [actorDef.idleAnimId, actorDef.moveAnimId, actorDef.attackAnimId]) {
      const ad = assetDef.animations.find((a) => a.id === animId);
      if (!ad) { this.log('warn', `missing animation definition: ${animId} for ${actorDef.assetId}`); continue; }
      const result = await this.loader.loadAnimation(assetDef, ad);
      if (result.anim) animations[animId] = result.anim;
      else this.log('warn', `missing animation file: ${animId} for ${actorDef.assetId}`);
    }
    if (!animations[actorDef.idleAnimId]) animations[actorDef.idleAnimId] = { tracks: [], maxFrame: 1 };
    if (!animations[actorDef.moveAnimId]) animations[actorDef.moveAnimId] = animations[actorDef.idleAnimId];
    if (!animations[actorDef.attackAnimId]) { this.log('warn', `attack animation fallback to anim00 for ${actorDef.assetId}`); animations[actorDef.attackAnimId] = animations[actorDef.idleAnimId]; }

    const stats = await this.loadStats(actorDef);
    const actor = new BattleActor({ assetDef, side: actorDef.side, x: actorDef.x, y: actorDef.y, facing: actorDef.facing, direction: actorDef.direction, renderFlipX: actorDef.renderFlipX, scale: actorDef.scale, currentAnimId: actorDef.moveAnimId, sprite: set.image && set.imgcut ? new BcuSpriteSheet(set.image, set.imgcut) : null, model: set.model ? new BcuModelInstance(set.model) : null, stats, animations });
    actor.moveSpeed = stats.speed * BATTLE_CONFIG.tuning.speedToPxPerSecond;
    actor.detectionRangePx = stats.detectionRange * BATTLE_CONFIG.tuning.rangeToPx;
    actor.attackWaitFrames = stats.attackWaitFrames; actor.attackStartupFrames = stats.attackStartupFrames; actor.attackType = stats.attackType;
    actor.attackCycleMs = Math.max(BATTLE_CONFIG.tuning.minAttackDurationMs, (actor.attackWaitFrames / BATTLE_CONFIG.tuning.fps) * 1000);
    actor.hitAtMs = Math.max(0, (actor.attackStartupFrames / BATTLE_CONFIG.tuning.fps) * 1000);
    actor.moveAnimId = actorDef.moveAnimId; actor.attackAnimId = actorDef.attackAnimId;
    return actor;
  }

  async init() {
    try {
      this.loadFailed = false; this.failureReason = ''; this.battleState = 'running';
      try { this.stage.background = await this.bgLoader.load(BATTLE_CONFIG.stage); this.stage.backgroundLoadFailed = false; }
      catch (e) { this.stage.background = null; this.stage.backgroundLoadFailed = true; this.log('warn', `battle background fallback: ${e instanceof Error ? e.message : String(e)}`); }
      const dog = await this.loadActor(BATTLE_CONFIG.actors.dogPlayerBasic); const cat = await this.loadActor(BATTLE_CONFIG.actors.catEnemyBasic); this.actors = [dog, cat];
      const castleAsset = this.findAsset(BATTLE_CONFIG.castle.assetId); if (!castleAsset) throw new Error(`Battle asset not found: ${BATTLE_CONFIG.castle.assetId}`);
      const cr = await this.loadCompositeLayers(castleAsset); if (cr.missing.length) this.log('warn', `battle castle missing: ${cr.missing.join(', ')}`);
      this.castle.assetDef = castleAsset; this.castle.layers = cr.loaded; this.castle.missing = cr.missing; this.log('info', 'BattleScene initialized');
    } catch (e) { this.loadFailed = true; this.failureReason = e instanceof Error ? e.message : String(e); console.error('[BattleScene] load failed', e); this.log('error', `BattleScene load failed: ${this.failureReason}`); }
  }

  updateBattleState(dog, cat) {
    if (dog.isAlive() && cat.isAlive()) { this.battleState = 'running'; return; }
    if (!dog.isAlive() && !cat.isAlive()) { this.battleState = 'draw'; return; }
    this.battleState = dog.isAlive() ? 'dog-win' : 'cat-win';
  }

  tickKnockback(actor, dt) {
    actor.knockbackElapsedMs += dt;
    const t = Math.min(1, actor.knockbackElapsedMs / Math.max(1, actor.knockbackDurationMs));
    const e = t * (2 - t);
    actor.x = actor.knockbackFromX + (actor.knockbackToX - actor.knockbackFromX) * e;
    if (t >= 1) { actor.isKnockbacking = false; actor.setState('move'); }
  }

  tick(dt) {
    if (this.loadFailed) return;
    const dog = this.actors.find((a) => a.side === 'dog-player'); const cat = this.actors.find((a) => a.side === 'cat-enemy'); if (!dog || !cat) return;
    for (const actor of this.actors) actor.tick(dt);
    this.updateBattleState(dog, cat); if (this.battleState !== 'running') return;

    for (const actor of [dog, cat]) {
      if (actor.state === 'knockback') this.tickKnockback(actor, dt);
    }
    if (dog.state === 'knockback' || cat.state === 'knockback') return;

    const dtSec = dt / 1000; const distance = Math.abs(dog.x - cat.x); const stopDistance = Math.min(dog.detectionRangePx, cat.detectionRangePx);
    if (distance > stopDistance) {
      for (const actor of [dog, cat]) if (actor.isAlive()) { actor.setState('move'); actor.setAnimation(actor.moveAnimId); actor.x += actor.direction * actor.moveSpeed * dtSec; }
      return;
    }

    if (dog.state !== 'attack') { dog.startAttack(cat); dog.setAnimation(dog.attackAnimId, true); }
    if (cat.state !== 'attack') { cat.startAttack(dog); cat.setAnimation(cat.attackAnimId, true); }

    for (const attacker of [dog, cat]) {
      const target = attacker === dog ? cat : dog;
      if (!attacker.isAlive() || !target.isAlive() || attacker.state === 'knockback') continue;
      attacker.attackElapsedMs += dt;
      if (!attacker.hasHitInCurrentAttack && attacker.attackElapsedMs >= attacker.hitAtMs) { target.takeDamage(attacker.damage); attacker.hasHitInCurrentAttack = true; }
      if (attacker.attackElapsedMs >= attacker.attackCycleMs) attacker.finishAttackCycle();
    }
    this.updateBattleState(dog, cat);
  }
}
