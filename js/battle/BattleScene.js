import { PREVIEW_ASSETS } from '../data/previewAssets.js';
import { BcuAssetLoader } from '../bcu/BcuAssetLoader.js';
import { BcuSpriteSheet } from '../bcu/BcuSpriteSheet.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BattleActor } from './BattleActor.js';
import { BattleStatsLoader } from './BattleStatsLoader.js';
import { BATTLE_CONFIG } from './BattleConfig.js';

async function loadImage(url) {
  return await new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(`Image load failed: ${url}`));
    img.src = url;
  });
}

export class BattleScene {
  constructor(uiLog) {
    this.loader = new BcuAssetLoader();
    this.statsLoader = new BattleStatsLoader();
    this.log = uiLog || (() => {});
    this.mode = 'battle';
    this.groundY = BATTLE_CONFIG.groundY;
    this.actors = [];
    this.castle = { ...BATTLE_CONFIG.castle, layers: [] };
    this.loadFailed = false;
    this.failureReason = '';
  }

  findAsset(id) { return PREVIEW_ASSETS.find((a) => a.id === id); }

  async loadCompositeLayers(asset) {
    const loaded = []; const missing = [];
    for (const layer of (asset.layers || [])) {
      try { loaded.push({ id: layer.id, name: layer.name || layer.id, anchor: layer.anchor || 'bottom-center', offsetX: layer.offsetX || 0, offsetY: layer.offsetY || 0, image: await loadImage(`${layer.baseDir}${layer.image}`) }); }
      catch (_e) { missing.push(`${layer.baseDir}${layer.image}`); }
    }
    return { loaded, missing };
  }

  async loadStats(actorDef) {
    try {
      if (actorDef.statsType === 'unit') return await this.statsLoader.loadUnitStats(actorDef.statsId, 'f', actorDef.formRow || 0);
      if (actorDef.statsType === 'enemy') return await this.statsLoader.loadEnemyStats(actorDef.statsId);
      throw new Error(`Unknown stats type: ${actorDef.statsType}`);
    } catch (e) {
      this.log('warn', `stats fallback for ${actorDef.assetId}: ${e instanceof Error ? e.message : String(e)}`);
      return {
        hp: 100, knockbacks: 1, speed: 5, damage: 5, attackIntervalFrames: 30, range: 100, rawEconomyValue: 0,
        rawValues: [], source: { file: 'fallback', row: -1, type: actorDef.statsType, provisional: true, note: 'fallback' }
      };
    }
  }

  async loadActor(actorDef) {
    const assetDef = this.findAsset(actorDef.assetId);
    if (!assetDef) throw new Error(`Battle asset not found: ${actorDef.assetId}`);
    const set = await this.loader.loadAssetSet(assetDef);
    set.errors.forEach((e) => this.log('error', e));
    set.missing.forEach((m) => this.log('warn', `missing file: ${m}`));

    const ad = assetDef.animations.find((a) => a.id === actorDef.idleAnimId) || assetDef.animations[0];
    const animResult = ad ? await this.loader.loadAnimation(assetDef, ad) : { anim: null, errors: [], missing: [] };
    animResult.errors?.forEach((e) => this.log('error', e));
    if (animResult.status === 'missing') this.log('warn', `missing animation: ${ad?.id || '-'} (${(animResult.missing || []).join(', ')})`);

    const stats = await this.loadStats(actorDef);
    const actor = new BattleActor({
      assetDef,
      side: actorDef.side,
      x: actorDef.x,
      y: actorDef.y,
      facing: actorDef.facing,
      scale: actorDef.scale,
      currentAnimId: ad?.id || actorDef.idleAnimId,
      sprite: set.image && set.imgcut ? new BcuSpriteSheet(set.image, set.imgcut) : null,
      model: set.model ? new BcuModelInstance(set.model) : null,
      anim: animResult.anim,
      stats
    });

    actor.moveSpeed = stats.speed * BATTLE_CONFIG.tuning.speedToPxPerSecond;
    actor.attackRange = stats.range * BATTLE_CONFIG.tuning.rangeToPx;
    actor.attackIntervalFrames = stats.attackIntervalFrames;
    actor.attackDurationMs = Math.max(BATTLE_CONFIG.tuning.minAttackDurationMs, (actor.attackIntervalFrames / BATTLE_CONFIG.tuning.fps) * 1000);
    return actor;
  }

  async init() {
    try {
      this.loadFailed = false;
      this.failureReason = '';
      const dog = await this.loadActor(BATTLE_CONFIG.actors.dogPlayerBasic);
      const cat = await this.loadActor(BATTLE_CONFIG.actors.catEnemyBasic);
      this.actors = [dog, cat];

      const castleAsset = this.findAsset(BATTLE_CONFIG.castle.assetId);
      if (!castleAsset) throw new Error(`Battle asset not found: ${BATTLE_CONFIG.castle.assetId}`);
      const cr = await this.loadCompositeLayers(castleAsset);
      if (cr.missing.length) this.log('warn', `battle castle missing: ${cr.missing.join(', ')}`);
      this.castle.assetDef = castleAsset;
      this.castle.layers = cr.loaded;
      this.castle.missing = cr.missing;
      this.log('info', 'BattleScene initialized');
    } catch (e) {
      this.loadFailed = true;
      this.failureReason = e instanceof Error ? e.message : String(e);
      console.error('[BattleScene] load failed', e);
      this.log('error', `BattleScene load failed: ${this.failureReason}`);
    }
  }

  tick(dt) {
    if (this.loadFailed) return;
    for (const actor of this.actors) actor.tick(dt);
  }
}
