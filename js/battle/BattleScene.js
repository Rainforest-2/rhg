import { PREVIEW_ASSETS } from '../data/previewAssets.js';
import { BcuAssetLoader } from '../bcu/BcuAssetLoader.js';
import { BcuSpriteSheet } from '../bcu/BcuSpriteSheet.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BattleActor } from './BattleActor.js';

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
    this.log = uiLog || (() => {});
    this.mode = 'battle';
    this.groundY = 590;
    this.actors = [];
    this.castle = { x: 1120, y: this.groundY, scale: 1, layers: [] };
    this.loadFailed = false;
    this.failureReason = '';
  }

  findAsset(id) {
    return PREVIEW_ASSETS.find((a) => a.id === id);
  }

  async loadCompositeLayers(asset) {
    const loaded = [];
    const missing = [];
    for (const layer of (asset.layers || [])) {
      try {
        loaded.push({
          id: layer.id,
          name: layer.name || layer.id,
          anchor: layer.anchor || 'bottom-center',
          offsetX: layer.offsetX || 0,
          offsetY: layer.offsetY || 0,
          image: await loadImage(`${layer.baseDir}${layer.image}`)
        });
      } catch (_e) {
        missing.push(`${layer.baseDir}${layer.image}`);
      }
    }
    return { loaded, missing };
  }

  async loadActor(assetId, side, x, y, facing) {
    const assetDef = this.findAsset(assetId);
    if (!assetDef) throw new Error(`Battle asset not found: ${assetId}`);
    const set = await this.loader.loadAssetSet(assetDef);
    set.errors.forEach((e) => this.log('error', e));
    set.missing.forEach((m) => this.log('warn', `missing file: ${m}`));
    const ad = assetDef.animations.find((a) => a.id === 'anim00') || assetDef.animations[0];
    const animResult = ad ? await this.loader.loadAnimation(assetDef, ad) : { anim: null, errors: [], missing: [] };
    animResult.errors?.forEach((e) => this.log('error', e));
    if (animResult.status === 'missing') this.log('warn', `missing animation: ${ad?.id || '-'} (${(animResult.missing || []).join(', ')})`);

    return new BattleActor({
      assetDef,
      side,
      x,
      y,
      facing,
      scale: 1,
      currentAnimId: ad?.id || 'anim00',
      sprite: set.image && set.imgcut ? new BcuSpriteSheet(set.image, set.imgcut) : null,
      model: set.model ? new BcuModelInstance(set.model) : null,
      anim: animResult.anim
    });
  }

  async init() {
    try {
      this.loadFailed = false;
      this.failureReason = '';
      const dog = await this.loadActor('enemy-000', 'dog-player', 260, this.groundY, 1);
      const cat = await this.loadActor('unit-000-f', 'cat-enemy', 900, this.groundY, -1);
      this.actors = [dog, cat];

      const castleAsset = this.findAsset('castle-composite-000');
      if (!castleAsset) throw new Error('Battle asset not found: castle-composite-000');
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
