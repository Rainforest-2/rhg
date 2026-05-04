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
  constructor(uiLog) { this.loader = new BcuAssetLoader(); this.statsLoader = new BattleStatsLoader(); this.bgLoader = new StageBackgroundLoader(uiLog); this.log = uiLog || (() => {}); this.mode = 'battle'; this.groundY = BATTLE_CONFIG.groundY; this.actors = []; this.castle = { ...BATTLE_CONFIG.castle, layers: [] }; this.stage = { ...BATTLE_CONFIG.stage, background: null, backgroundLoadFailed: false }; this.loadFailed = false; this.failureReason = ''; this.battleState = 'running'; this.timeMs = 0; this.debugEvents = []; }
  pushEvent(event) { this.debugEvents.push(event); if (this.debugEvents.length > 10) this.debugEvents.shift(); console.debug('[BattleEvent]', event); }
  findAsset(id) { return PREVIEW_ASSETS.find((a) => a.id === id); }
  async loadCompositeLayers(asset) { const loaded = []; const missing = []; for (const layer of (asset.layers || [])) { try { loaded.push({ id: layer.id, name: layer.name || layer.id, anchor: layer.anchor || 'bottom-center', offsetX: layer.offsetX || 0, offsetY: layer.offsetY || 0, image: await loadImage(`${layer.baseDir}${layer.image}`) }); } catch (_e) { missing.push(`${layer.baseDir}${layer.image}`); } } return { loaded, missing }; }

  async loadStats(actorDef) { try { const s = actorDef.statsType === 'unit' ? await this.statsLoader.loadUnitStats(actorDef.statsId, 'f', actorDef.formRow || 0) : await this.statsLoader.loadEnemyStats(actorDef.statsId); if (s.source.mappingStatus === 'invalid') this.log('warn', `stats mapping invalid: ${actorDef.assetId} fallback=${s.source.fallbackFields.join(',')}`); return s; } catch (e) { this.log('warn', `stats fallback for ${actorDef.assetId}: ${e instanceof Error ? e.message : String(e)}`); return { hp: 100, knockbacks: 1, speed: 5, damage: 5, attackWaitFrames: 30, detectionRange: 100, costOrReward: 0, respawnFrames: 0, attackType: 0, attackStartupFrames: 8, rawValues: [], source: { file: 'fallback', row: -1, type: actorDef.statsType, provisional: true, mappingStatus: 'invalid', fallbackFields: ['all'] } }; } }

  async loadActor(actorDef) {
    const assetDef = this.findAsset(actorDef.assetId); if (!assetDef) throw new Error(`Battle asset not found: ${actorDef.assetId}`);
    const set = await this.loader.loadAssetSet(assetDef); set.errors.forEach((e) => this.log('error', e)); set.missing.forEach((m) => this.log('warn', `missing file: ${m}`));
    const animations = {};
    for (const animId of [actorDef.idleAnimId, actorDef.moveAnimId, actorDef.attackAnimId, actorDef.knockbackAnimId]) {
      const ad = assetDef.animations.find((a) => a.id === animId);
      if (!ad) { this.log('warn', `missing animation definition: ${animId} for ${actorDef.assetId}`); continue; }
      const result = await this.loader.loadAnimation(assetDef, ad);
      if (result.anim) animations[animId] = result.anim;
      else this.log('warn', `missing animation file: ${animId} for ${actorDef.assetId}`);
    }
    if (!animations[actorDef.idleAnimId]) animations[actorDef.idleAnimId] = { tracks: [], maxFrame: 1 };
    if (!animations[actorDef.moveAnimId]) animations[actorDef.moveAnimId] = animations[actorDef.idleAnimId];
    if (!animations[actorDef.attackAnimId]) animations[actorDef.attackAnimId] = animations[actorDef.idleAnimId];
    if (!animations[actorDef.knockbackAnimId]) { animations[actorDef.knockbackAnimId] = animations[actorDef.idleAnimId]; this.log('warn', `knockback anim fallback for ${actorDef.assetId}`); }

    const stats = await this.loadStats(actorDef);
    if (stats.source.fallbackFields.includes('attackStartupFrames')) {
      const attackAnim = animations[actorDef.attackAnimId];
      if (attackAnim?.maxFrame > 0) stats.attackStartupFrames = Math.max(1, Math.floor(attackAnim.maxFrame * 0.3));
    }
    const actor = new BattleActor({ assetDef, side: actorDef.side, x: actorDef.x, y: actorDef.y, facing: actorDef.facing, direction: actorDef.direction, renderFlipX: actorDef.renderFlipX, scale: actorDef.scale, currentAnimId: actorDef.moveAnimId, sprite: set.image && set.imgcut ? new BcuSpriteSheet(set.image, set.imgcut) : null, model: set.model ? new BcuModelInstance(set.model) : null, stats, animations, attackAnimId: actorDef.attackAnimId, moveAnimId: actorDef.moveAnimId, knockbackAnimId: actorDef.knockbackAnimId, fps: BATTLE_CONFIG.tuning.fps });
    actor.moveSpeed = stats.speed * BATTLE_CONFIG.tuning.speedToPxPerSecond;
    actor.detectionRangePx = stats.detectionRange * BATTLE_CONFIG.tuning.rangeToPx;
    actor.setAnimation(actor.moveAnimId, 'move', true);
    return actor;
  }

  async init() { /* keep as before */ try { this.loadFailed = false; this.failureReason = ''; this.battleState = 'running'; this.timeMs = 0; this.debugEvents = []; try { this.stage.background = await this.bgLoader.load(BATTLE_CONFIG.stage); this.stage.backgroundLoadFailed = false; } catch (e) { this.stage.background = null; this.stage.backgroundLoadFailed = true; this.log('warn', `battle background fallback: ${e instanceof Error ? e.message : String(e)}`); } const dog = await this.loadActor(BATTLE_CONFIG.actors.dogPlayerBasic); const cat = await this.loadActor(BATTLE_CONFIG.actors.catEnemyBasic); this.actors = [dog, cat]; const castleAsset = this.findAsset(BATTLE_CONFIG.castle.assetId); if (!castleAsset) throw new Error(`Battle asset not found: ${BATTLE_CONFIG.castle.assetId}`); const cr = await this.loadCompositeLayers(castleAsset); if (cr.missing.length) this.log('warn', `battle castle missing: ${cr.missing.join(', ')}`); this.castle.assetDef = castleAsset; this.castle.layers = cr.loaded; this.castle.missing = cr.missing; this.log('info', 'BattleScene initialized'); } catch (e) { this.loadFailed = true; this.failureReason = e instanceof Error ? e.message : String(e); this.log('error', `BattleScene load failed: ${this.failureReason}`); } }

  updateBattleState(dog, cat) { const prev = this.battleState; if (dog.isAlive() && cat.isAlive()) this.battleState = 'running'; else if (!dog.isAlive() && !cat.isAlive()) this.battleState = 'draw'; else this.battleState = dog.isAlive() ? 'dog-win' : 'cat-win'; if (prev !== this.battleState && this.battleState !== 'running') this.pushEvent({ type: 'battleEnd', timeMs: this.timeMs, state: this.battleState }); }
  inRange(a, b) { return Math.abs(a.x - b.x) <= Math.min(a.detectionRangePx, b.detectionRangePx); }

  tickKnockback(actor, dt, target) { actor.knockbackPositionElapsedMs += dt; const t = Math.min(1, actor.knockbackPositionElapsedMs / Math.max(1, actor.knockbackPositionDurationMs)); actor.x = actor.knockbackFromX + (actor.knockbackToX - actor.knockbackFromX) * (t * (2 - t)); if (t >= 1) { const prev = actor.state; actor.setState(this.inRange(actor, target) ? 'attack-wait' : 'move'); actor.setAnimation(actor.state === 'move' ? actor.moveAnimId : actor.idleAnimId, actor.state === 'move' ? 'move' : 'move', true); this.pushEvent({ type: 'knockbackEnd', timeMs: this.timeMs, actor: actor.assetDef.label, state: actor.state, prevState: prev, hp: actor.hp }); } }

  tick(dt) { if (this.loadFailed) return; this.timeMs += dt; const dog = this.actors.find((a) => a.side === 'dog-player'); const cat = this.actors.find((a) => a.side === 'cat-enemy'); if (!dog || !cat) return; for (const a of this.actors) a.tick(dt); this.updateBattleState(dog, cat); if (this.battleState !== 'running') return;
    const aliveAtFrameStart = new Map(this.actors.map((a) => [a, a.isAlive()]));
    const queue = [];
    for (const attacker of [dog, cat]) {
      const target = attacker === dog ? cat : dog; if (!attacker.isAlive()) continue;
      if (attacker.state === 'knockback') { this.tickKnockback(attacker, dt, target); continue; }
      if (!this.inRange(attacker, target)) {
        if (attacker.state !== 'move') this.pushEvent({ type: 'stateChange', timeMs: this.timeMs, actor: attacker.assetDef.label, state: 'move', hp: attacker.hp });
        attacker.setState('move'); attacker.setAnimation(attacker.moveAnimId, 'move'); attacker.x += attacker.direction * attacker.moveSpeed * (dt / 1000); continue;
      }
      if (attacker.state === 'move') { attacker.setState('attack'); attacker.setAnimation(attacker.attackAnimId, 'attack', true); this.pushEvent({ type: 'attackStart', timeMs: this.timeMs, actor: attacker.assetDef.label, state: attacker.state, hp: attacker.hp }); }
      if (attacker.state === 'attack') {
        const prev = attacker.attackElapsedMs; attacker.attackElapsedMs += dt;
        if (!attacker.hasHitInCurrentAttack && aliveAtFrameStart.get(attacker) && prev < attacker.attackStartupMs && attacker.attackElapsedMs >= attacker.attackStartupMs) {
          queue.push({ attacker, target, damage: attacker.damage, hitTimeMs: this.timeMs, attackCycleId: attacker.attackCycleId });
          attacker.hasHitInCurrentAttack = true;
          this.pushEvent({ type: 'hitQueued', timeMs: this.timeMs, actor: attacker.assetDef.label, target: target.assetDef.label, damage: attacker.damage, state: attacker.state });
        }
        const attackEndMs = Math.max(attacker.attackStartupMs, attacker.attackAnimDurationMs);
        if (attacker.attackElapsedMs >= attackEndMs) { attacker.setState('attack-wait'); attacker.setAnimation(attacker.idleAnimId || attacker.moveAnimId, 'move'); this.pushEvent({ type: 'stateChange', timeMs: this.timeMs, actor: attacker.assetDef.label, state: 'attack-wait', hp: attacker.hp, interpretation: 'provisional' }); }
      } else if (attacker.state === 'attack-wait') {
        attacker.attackWaitElapsedMs += dt;
        if (!this.inRange(attacker, target)) { attacker.setState('move'); attacker.setAnimation(attacker.moveAnimId, 'move'); }
        else if (attacker.attackWaitElapsedMs >= attacker.attackWaitMs) { attacker.setState('attack'); attacker.setAnimation(attacker.attackAnimId, 'attack', true); this.pushEvent({ type: 'attackStart', timeMs: this.timeMs, actor: attacker.assetDef.label, state: attacker.state, hp: attacker.hp }); }
      }
    }
    for (const e of queue) {
      if (!aliveAtFrameStart.get(e.attacker)) continue;
      const result = e.target.takeDamage(e.damage);
      this.pushEvent({ type: 'damageApplied', timeMs: this.timeMs, actor: e.attacker.assetDef.label, target: e.target.assetDef.label, damage: e.damage, hp: e.target.hp });
      if (result.knockedBack) this.pushEvent({ type: 'knockbackStart', timeMs: this.timeMs, actor: e.target.assetDef.label, state: e.target.state, hp: e.target.hp });
      if (result.dead) this.pushEvent({ type: 'dead', timeMs: this.timeMs, actor: e.target.assetDef.label, hp: e.target.hp });
    }
    this.updateBattleState(dog, cat);
  }
}
