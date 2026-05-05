import { PREVIEW_ASSETS } from '../data/previewAssets.js';
import { BcuAssetLoader } from '../bcu/BcuAssetLoader.js';
import { BcuSpriteSheet } from '../bcu/BcuSpriteSheet.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../bcu/BcuAnimator.js';
import { PreviewRenderer } from './PreviewRenderer.js';
import { PreviewUi } from './PreviewUi.js';
import { BattleScene } from '../battle/BattleScene.js';
import { BattleSceneRenderer } from '../battle/BattleSceneRenderer.js';
import { PlayerProductionBar } from '../ui/PlayerProductionBar.js';

async function loadImage(url) {
  return await new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(`Image load failed: ${url}`));
    img.src = url;
  });
}

export class PreviewApp {
  constructor() { this.assets = PREVIEW_ASSETS; this.loader = new BcuAssetLoader(); this.state = { scale: 1, showParts: false, showPivots: false, showBounds: false, rawMode: false, debugApplied: [], currentAnimLabel: '', loadedFiles: [], missingFiles: [] }; this.viewMode = 'preview'; this.battleScene = null; this.battleSceneRenderer = new BattleSceneRenderer(); this.battleLoading=false; this.battleInitPromise=null; this.lastBattleUiUpdate=0; this.lastBattleFrameErrorMessage=''; this.productionBar=null; }


  async start() {
    try {
      this.renderer = new PreviewRenderer(document.getElementById('preview-canvas'));
      this.ui = new PreviewUi(document.getElementById('control-panel'), document.getElementById('log-list'));
      this.ui.init(this.assets, { asset: (id, anim) => this.load(id, anim), anim: (id) => this.loadAnim(id), play: () => this.animator && (this.animator.playing = !this.animator.playing), restart: () => this.animator?.restart(), step: (v) => { this.animator?.step(v); this.applyAnim(); }, speed: (s) => this.animator?.setSpeed(s), scale: (s) => (this.state.scale = s), toggle: (k, v) => { this.state[k === 'raw' ? 'rawMode' : `show${k[0].toUpperCase() + k.slice(1)}`] = v; }, mode: (mode) => this.setViewMode(mode), resetBattle: () => this.resetBattle() });
      await this.load(this.assets[0].id, this.assets[0].animations[0]?.id);
      let last = performance.now();
      let firstRenderLogged = false;
      const loop = (t) => {
        const dt = t - last;
        last = t;
        if (this.viewMode === 'battle') {
          try {
            if (!this.battleLoading) this.battleScene?.tick(dt);
            this.productionBar?.update(this.battleScene);
            this.renderer.ensureCanvasSize();
            this.battleSceneRenderer.render(this.renderer, this.battleScene, { showParts: this.state.showParts, showBounds: this.state.showBounds, showPivots: this.state.showPivots, rawMode: this.state.rawMode });
            this.lastBattleFrameErrorMessage = '';
          } catch (e) {
            const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
            if (this.lastBattleFrameErrorMessage !== message) {
              this.lastBattleFrameErrorMessage = message;
              console.error('[PreviewApp] battle frame failed', e);
            }
            const c = this.renderer?.ctx;
            const w = this.renderer?.logicalW || 0;
            const h = this.renderer?.logicalH || 0;
            if (c && w > 0 && h > 0) {
              c.clearRect(0, 0, w, h);
              c.fillStyle = '#111827';
              c.fillRect(0, 0, w, h);
              c.fillStyle = '#fecaca';
              c.font = '20px ui-sans-serif';
              c.fillText('Battle render error', 24, 40);
            }
          }
        } else {
          if (this.animator) { this.animator.tick(dt); this.applyAnim(); }
          this.renderer.render(this.state);
        }
        if (!firstRenderLogged) {
          firstRenderLogged = true;
          console.log('[PreviewApp] first render');
        }
        if (this.viewMode !== 'battle') this.updateStatus();
        requestAnimationFrame(loop);
      };
      console.log('[PreviewApp] render loop started');
      requestAnimationFrame(loop);
    } catch (e) {
      const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      console.error('[PreviewApp] start failed', e);
      this.ui?.log('error', `[PreviewApp] start failed: ${message}`);
    }
  }

  async setViewMode(mode) {
    this.viewMode = mode === 'battle' ? 'battle' : 'preview';
    if (this.viewMode !== 'battle') { this.productionBar?.setVisible(false); return; }
    if (this.battleInitPromise) return await this.battleInitPromise;
    if (!this.battleScene) {
      this.battleLoading = true;
      this.battleInitPromise = (async()=>{ try { this.battleScene = new BattleScene((level, msg) => this.ui?.log(level, msg)); await this.battleScene.init(); } catch (e) { console.error('[PreviewApp] battle init failed', e); this.ui?.log('error', `battle init failed: ${e instanceof Error ? e.message : String(e)}`); } finally { this.battleLoading = false; this.battleInitPromise = null; } })();
      await this.battleInitPromise; const battleMount=document.querySelector('.canvas-panel')||document.body; if(!this.productionBar){this.productionBar=new PlayerProductionBar({scene:this.battleScene,mount:battleMount});} else {this.productionBar.bindScene(this.battleScene);} this.productionBar?.setVisible(true);
    }

    if (this.battleScene) { const battleMount=document.querySelector('.canvas-panel')||document.body; if(!this.productionBar){this.productionBar=new PlayerProductionBar({scene:this.battleScene,mount:battleMount});} else {this.productionBar.bindScene(this.battleScene);} this.productionBar?.setVisible(true); }  }


  async resetBattle() {
    if (this.viewMode !== 'battle') { this.productionBar?.setVisible(false); return; }
    this.battleScene = new BattleScene((level, msg) => this.ui?.log(level, msg));
    await this.battleScene.init();
    const battleMount=document.querySelector('.canvas-panel')||document.body;
    if(!this.productionBar){this.productionBar=new PlayerProductionBar({scene:this.battleScene,mount:battleMount});} else {this.productionBar.bindScene(this.battleScene);} this.productionBar?.setVisible(true);
    this.ui?.log('info', 'Battle reset completed');
  }

  findAsset(id) { return this.assets.find((a) => a.id === id) || this.assets[0]; }

  async probeAnimations(asset) {
    const available = new Set();
    for (const a of asset.animations) {
      const r = await this.loader.loadAnimation(asset, a);
      if (r.status === 'loaded') available.add(a.id);
      else this.ui.log('warn', `missing animation: ${a.id} (${(r.missing || []).join(', ') || r.file})`);
    }
    this.ui.setAnimationAvailability(asset, available);
    return available;
  }

  async loadCompositeLayers(asset) {
    const loaded = [];
    const missing = [];
    for (const layer of (asset.layers || [])) {
      try { loaded.push({ id: layer.id, name: layer.name || layer.id, anchor: layer.anchor || 'bottom-center', offsetX: layer.offsetX || 0, offsetY: layer.offsetY || 0, image: await loadImage(`${layer.baseDir}${layer.image}`) }); }
      catch (_e) { missing.push(`${layer.baseDir}${layer.image}`); }
    }
    const missingIds = ['bottom', 'middle', 'top'].filter((id) => !loaded.find((l) => l.id === id));
    if (missingIds.length) this.ui?.log('warn', `castle-composite missing layer ids: ${missingIds.join(', ')}`);
    return { loaded, missing };
  }

  async load(id, animId) {
    this.current = this.findAsset(id);
    this.state.assetMeta = { id: this.current.id, label: this.current.label, role: this.current.role, group: this.current.group, baseDir: this.current.baseDir || '-', renderMode: this.current.renderMode || 'animated-unit', layers: this.current.layers?.length || 0 };
    this.ui.setAssetMeta(this.state.assetMeta);
    this.ui.log('info', `load asset ${this.current.label}`);
    if ((this.current.renderMode || 'model') === 'castle-composite') {
      const cr = await this.loadCompositeLayers(this.current);
      this.state.loadedFiles = cr.loaded.map((x) => `${x.id}:${x.image.src.split('/').pop()}`);
      this.state.missingFiles = cr.missing;
      this.state.renderMode = 'castle-composite';
      this.state.modelRequired = false;
      this.state.animationRequired = false;
      this.state.compositeLayers = cr.loaded;
      this.state.sprite = null; this.state.model = null;
      this.ui.setAnimationAvailability(this.current, new Set());
      this.state.availableAnimations = new Set();
      this.ui.log('info', `loaded files: ${this.state.loadedFiles.join(', ') || 'none'}`);
      await this.loadAnim(null);
      return;
    }

    const r = await this.loader.loadAssetSet(this.current);
    r.errors.forEach((e) => this.ui.log('error', e));
    r.missing.forEach((m) => this.ui.log('warn', `missing file: ${m}`));
    this.state.loadedFiles = r.loaded;
    this.state.missingFiles = r.missing;
    this.state.renderMode = r.renderMode;
    this.state.modelRequired = r.modelRequired;
    this.state.animationRequired = r.animationRequired;
    this.state.compositeLayers = null;
    this.state.sprite = r.image && r.imgcut ? new BcuSpriteSheet(r.image, r.imgcut) : null;
    this.state.model = r.model ? new BcuModelInstance(r.model) : null;
    let available = new Set();
    if (this.current.animations?.length) available = await this.probeAnimations(this.current);
    else this.ui.setAnimationAvailability(this.current, available);
    this.state.availableAnimations = available;
    this.ui.log('info', `loaded files: ${r.loaded.join(', ') || 'none'}`);
    await this.loadAnim(animId || this.current.animations[0]?.id || null);
  }

  async loadAnim(animId) {
    const ad = this.current.animations.find((a) => a.id === animId) || this.current.animations[0];
    if (!ad) {
      this.state.currentAnimLabel = 'none';
      this.state.anim = null;
      this.animator = new BcuAnimator({ tracks: [], maxFrame: 1 });
      this.applyAnim();
      return;
    }
    this.state.currentAnimLabel = ad.file;
    const result = await this.loader.loadAnimation(this.current, ad);
    if (result.status === 'missing') this.ui.log('warn', `missing animation: ${ad.id} (${result.missing.join(', ')})`);
    result.errors.forEach((e) => this.ui.log('error', e));
    this.state.anim = result.anim;
    this.animator = new BcuAnimator(result.anim || { tracks: [], maxFrame: 1 });
    if (result.anim) {
      this.ui.log('info', `animation file: ${result.file}`);
      this.ui.log('info', `tracks: ${result.anim.tracks.length}, maxFrame: ${result.anim.maxFrame}`);
      this.ui.log('info', `mod histogram: ${Object.entries(result.anim.modificationHistogram || {}).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}`);
    }
    this.applyAnim();
  }

  applyAnim() {
    if (!this.state.model) { this.state.debugApplied = []; this.state.lastAppliedByPart = new Map(); this.ui.setDebug(this.state); return; }
    this.state.model.reset();
    this.state.debugApplied = this.animator?.apply(this.state.model) || [];
    this.state.lastAppliedByPart = new Map(this.state.debugApplied.filter((x) => x.applied).map((x) => [x.partId, x]));
    this.ui.setDebug(this.state);
  }

  updateStatus() {
    const frame = (this.animator?.frame || 0).toFixed(2), parts = this.state.sprite?.imgcut?.parts?.length || 0, m = this.state.model?.parts?.length || 0, t = this.state.anim?.tracks?.length || 0;
    const applied = (this.state.debugApplied || []).filter((x) => x.applied).length;
    this.state.debugStats = { frame, parts, modelParts: m, maxFrame: this.state.anim?.maxFrame || 0, tracks: t, appliedCount: applied, currentAnimLabel: Array.isArray(this.state.currentAnimLabel) ? this.state.currentAnimLabel.join('|') : this.state.currentAnimLabel };
    this.ui.setStatus(`frame:${frame} | parts:${parts} | model parts:${m} | tracks:${t} | applied:${applied} | ${this.animator?.playing ? 'playing' : 'paused'}`);
    this.ui.setDebug(this.state);
  }
}
