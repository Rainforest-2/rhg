import { PREVIEW_ASSETS } from '../data/previewAssets.js';
import { BcuAssetLoader } from '../bcu/BcuAssetLoader.js';
import { BcuSpriteSheet } from '../bcu/BcuSpriteSheet.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../bcu/BcuAnimator.js';
import { PreviewRenderer } from './PreviewRenderer.js';
import { PreviewUi } from './PreviewUi.js';
import { BattleScene } from '../battle/BattleScene.js';
import { BattleSceneRenderer } from '../battle/BattleSceneRenderer.js';
import { preloadBcuStatusEffectDefinitions } from '../battle/bcu-runtime/BcuStatusEffectManager.js';
import { PlayerProductionBar } from '../ui/PlayerProductionBar.js';
import { BattleSpeedControl } from '../ui/BattleSpeedControl.js';
import { FormationEditor } from '../ui/FormationEditor.js';
import { AppLoadingOverlay } from '../ui/AppLoadingOverlay.js';
import { BattleSimulationClock } from './BattleSimulationClock.js';
import { BattleCameraInputController } from './BattleCameraInputController.js';
import { getDefaultStage } from '../battle/StageRegistry.js';
import { audioEngine } from '../audio/AudioEngine.js';
import { BATTLE_PRELOAD_SE_IDS } from '../audio/BattleSoundEffects.js';

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}


function formatFormationForLog(f) {
  if (Array.isArray(f?.slots)) return f.slots.join(',');
  if (Array.isArray(f?.pages)) return f.pages.flat().filter(Boolean).join(',');
  return '(empty)';
}

const APPLY_BATTLE_SUBSYSTEMS = new Set(['boot','stage-definition','stage-runtime','background','enemy-castle','player-castle','actor-template','actor-animation','effect-kbeff','production-roster','camera','renderer','raw-guard','unknown']);

function errorReport(error) {
  const cause = error?.cause;
  return {
    name: error?.name || null,
    message: error?.message || String(error || ''),
    stack: error?.stack || null,
    cause: cause ? { name: cause?.name || null, message: cause?.message || String(cause || ''), stack: cause?.stack || null } : null,
    originalErrorName: error?.originalErrorName || error?.detail?.originalErrorName || cause?.name || null,
    originalErrorMessage: error?.originalErrorMessage || error?.detail?.originalErrorMessage || cause?.message || null
  };
}

function inferFailedSubsystem(error) {
  const explicit = error?.failedSubsystem || error?.detail?.failedSubsystem || error?.detail?.kind;
  const normalized = { stage: 'stage-definition', castle: 'enemy-castle', icon: 'production-roster', actor: 'actor-template', kbeff: 'effect-kbeff' }[explicit] || explicit;
  if (APPLY_BATTLE_SUBSYSTEMS.has(normalized)) return normalized;
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('stage')) return 'stage-definition';
  if (message.includes('background')) return 'background';
  if (message.includes('castle')) return 'enemy-castle';
  if (message.includes('camera')) return 'camera';
  if (message.includes('raw bcu')) return 'raw-guard';
  return 'unknown';
}

async function loadImage(url) {
  return await new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(`Image load failed: ${url}`));
    img.src = url;
  });
}

export class PreviewApp {
  constructor(options = {}) { this.bcuDb = options.bcuDb || globalThis.__BCU_DB__ || null; this.assets = PREVIEW_ASSETS; this.loader = new BcuAssetLoader(); this.state = { scale: 1, showParts: false, showPivots: false, showBounds: false, rawMode: false, debugApplied: [], currentAnimLabel: '', loadedFiles: [], missingFiles: [] }; this.selectedStageId=options.selectedStageId || getDefaultStage()?.stageKey || getDefaultStage()?.stageId || null; this.battleSpeedMultiplier=1; this.battleScene = null; this.battleSceneRenderer = new BattleSceneRenderer(); this.battleLoading=false; this.battleInitPromise=null; this.sceneReady=false; this.sceneTransitioning=false; this.lastBattleUiUpdate=0; this.lastBattleFrameErrorMessage=''; this.productionBar=null; this.speedControl=null; this.formationEditor=null; this.loadingOverlay=null; this.simulationClock=new BattleSimulationClock({ fixedStepMs: 33, maxSubStepsPerFrame: 1, catchUpMode: 'bcu-no-catchup' }); this.simulationPausedByVisibility=false; this.maxFrameDtMs=100; this.cameraInputController=null; }

  async start() {
    this.loadingOverlay = new AppLoadingOverlay({ mount: document.body });
    this.bindVisibilityHandlers();
    this.simulationClock.maxFrameDtMs = this.maxFrameDtMs;
    try {
      this.renderer = new PreviewRenderer(document.getElementById('preview-canvas'));
      const devUiEnabled = new URLSearchParams(location.search).get('debugUi') === '1' || localStorage.getItem('debugUi') === '1';
      const controlPanel = document.getElementById('control-panel');
      const logPanel = document.getElementById('log-panel');
      if (!devUiEnabled) { controlPanel?.setAttribute('hidden', ''); logPanel?.setAttribute('hidden', ''); }
      else { controlPanel?.removeAttribute('hidden'); logPanel?.removeAttribute('hidden'); }
      this.ui = new PreviewUi(controlPanel, document.getElementById('log-list'));
      this.ui.init(this.assets, {});
      this.cameraInputController = new BattleCameraInputController(this.renderer.canvas, () => this.battleScene?.camera);
      this.cameraInputController.attach();
      const battleMount=document.querySelector('.canvas-panel')||document.body;
      this.formationEditor = new FormationEditor({ mount:battleMount, selectedStageId:this.selectedStageId, onStageChanged:(stageId)=>{this.selectedStageId=stageId;this.ui?.log('info',`Stage selected: ${stageId}`);}, onFormationChanged:(f)=>{this.ui?.log('info',`Formation saved: ${formatFormationForLog(f)}`);}, onApplyBattle: async ()=>{ await this.applyFormationToBattle(); }, onSettingChanged:(key)=>{ if(key==='bcu-speed-control') this.speedControl?.setVisible(this.speedControl?.visible); } });
      this.formationEditor.setVisible(true);
      this.speedControl = new BattleSpeedControl({ mount: battleMount, onChange: (mult) => { this.battleSpeedMultiplier = mult; } });
      this.speedControl.setVisible(false);
      this.productionBar?.setVisible(false);
      this.sceneReady = false;
      this.battleScene = null;
      const loop = (t) => { /* legacy: tick(dt*this.battleSpeedMultiplier) now handled via BattleSimulationClock fixed-step */
        this.renderer.ensureCanvasSize();
        if (this.sceneTransitioning || !this.sceneReady || !this.battleScene) {
          this.renderPlaceholder();
        } else {
          const r=this.simulationClock.step(t,this.battleSpeedMultiplier,(stepDt)=>this.battleScene.tick(stepDt));
          if(r.dropped){this.battleScene?.pushEvent?.({type:'simulationDtDropped',rawDt:r.rawDt,clampedDt:r.clampedDt});}
          this.productionBar?.update(this.battleScene);
          this.battleSceneRenderer.render(this.renderer, this.battleScene, { showParts: this.state.showParts, showBounds: this.state.showBounds, showPivots: this.state.showPivots, rawMode: this.state.rawMode });
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch (e) { console.error('[PreviewApp] start failed', e); this.loadingOverlay?.setError(e); this.loadingOverlay?.show(); this.ui?.log('error', `[PreviewApp] start failed: ${e instanceof Error ? e.message : String(e)}`); }
  }


  bindVisibilityHandlers() {
    if (this._visibilityBound) return;
    this._visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pauseSimulationByVisibility('hidden');
      else this.resumeSimulationByVisibility('visible');
    });
    window.addEventListener('blur', () => this.pauseSimulationByVisibility('blur'));
    window.addEventListener('focus', () => this.resumeSimulationByVisibility('focus'));
  }
  pauseSimulationByVisibility(reason='hidden') {
    this.simulationPausedByVisibility = true;
    this.simulationClock.pause(reason);
    this.battleScene?.pushEvent?.({ type:'simulationPausedByVisibility', reason });
  }
  resumeSimulationByVisibility(reason='visible') {
    this.simulationPausedByVisibility = false;
    this.simulationClock.resume(performance.now());
    this.battleScene?.pushEvent?.({ type:'simulationResumedByVisibility', reason });
  }

  renderPlaceholder() {
    const c=this.renderer?.ctx,w=this.renderer?.logicalW||0,h=this.renderer?.logicalH||0;
    if(!c||w<=0||h<=0) return;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0b1220');
    g.addColorStop(1, '#111827');
    c.clearRect(0,0,w,h);
    c.fillStyle=g;
    c.fillRect(0,0,w,h);
    c.fillStyle='#e2e8f0';
    c.font='bold 22px ui-sans-serif';
    c.fillText(this.sceneTransitioning ? '戦闘準備中...' : '編成を選んで いざ出撃!! を押してください',24,48);
    c.fillStyle='#94a3b8';
    c.font='16px ui-sans-serif';
    c.fillText('出撃時にステージ・背景・キャラ素材を読み込みます。',24,76);
  }

  buildApplyBattleReport({ ok, phase, error = null, failedSubsystem = null, timings = {} } = {}) {
    const provider = this.bcuDb?.semanticProvider || globalThis.__BCU_DB__?.semanticProvider || null;
    const scene = this.battleScene || null;
    const camera = scene?.camera || null;
    const diagnostics = provider?.diagnostics || {};
    return {
      ok: !!ok,
      phase: phase || (ok ? 'ready' : 'unknown'),
      sceneReady: !!this.sceneReady,
      hasBattleScene: !!scene,
      hasCamera: !!camera,
      cameraState: camera?.getState?.() || null,
      selectedStageId: this.selectedStageId || scene?.stage?.selectedStageId || null,
      stageKey: scene?.stage?.stageKey || null,
      semanticMode: this.bcuDb?.semanticMode || provider?.mode || null,
      timings,
      failedSubsystem: failedSubsystem || (error ? inferFailedSubsystem(error) : null),
      error: error ? errorReport(error) : null,
      diagnostics: {
        bundleErrors: diagnostics.bundleErrors || [],
        missingBundles: diagnostics.missingBundles || [],
        blockedRawReads: diagnostics.blockedRawReads || [],
        rawFallbacks: diagnostics.rawFallbacks || [],
        lastActorLoad: diagnostics.lastActorLoad || null,
        lastStageLoad: diagnostics.lastStageLoad || null,
        lastBackgroundLoad: diagnostics.lastBackgroundLoad || null,
        lastCastleLoad: diagnostics.lastCastleLoad || null,
        lastKbeffLoad: diagnostics.lastKbeffLoad || null
      }
    };
  }

  publishApplyBattleReport(report) {
    globalThis.__LAST_APPLY_BATTLE_REPORT__ = report;
    return report;
  }

  async applyFormationToBattle() {
    console.info('applyFormationToBattle:start');
    const attemptStart = performance.now();
    this.loadingOverlay?.show();
    this.loadingOverlay?.startTimer();
    this.loadingOverlay?.setProgress({ phase: 'battle-scene', message: '戦闘画面を準備中…', value: 0.05 });
    try {
      console.info('applyFormationToBattle:before-resetBattle');
      await this.resetBattle({ keepFormationVisible: false, showOverlay: true });
      console.info('applyFormationToBattle:after-resetBattle');
      this.formationEditor?.setVisible(false);
      this.productionBar?.setVisible(true);
      this.speedControl?.setVisible(true);
      this.sceneReady = !!(this.battleScene && this.battleScene.camera);
      this.publishApplyBattleReport(this.buildApplyBattleReport({
        ok: this.sceneReady,
        phase: this.sceneReady ? 'ready' : 'camera',
        failedSubsystem: this.sceneReady ? null : 'camera',
        timings: { applyMs: performance.now() - attemptStart, ...(this.battleScene?.loadTimings || {}) }
      }));
      console.info('applyFormationToBattle:ready');
      this.loadingOverlay?.hide();
    } catch (e) {
      this.formationEditor?.setVisible(true);
      this.productionBar?.setVisible(false);
      this.speedControl?.setVisible(false);
      this.sceneReady = false;
      this.publishApplyBattleReport(this.buildApplyBattleReport({
        ok: false,
        phase: e?.phase || e?.detail?.kind || 'apply-failed',
        error: e,
        failedSubsystem: inferFailedSubsystem(e),
        timings: { applyMs: performance.now() - attemptStart }
      }));
      this.loadingOverlay?.setError(e);
      console.error('[PreviewApp] applyFormationToBattle failed detail', {
        name: e?.name,
        message: e?.message,
        stack: e?.stack,
        cause: e?.cause,
        error: e
      });
      throw e;
    }
  }

  async resetBattle({ keepFormationVisible = false, showOverlay = true } = {}) {
    const overlay = showOverlay ? this.loadingOverlay : null;
    if (this.sceneTransitioning && this.battleInitPromise) return await this.battleInitPromise;
    this.sceneTransitioning = true; this.sceneReady = false; this.battleLoading = true;
    this.battleInitPromise = (async()=>{
      console.info('resetBattle:start');
      const t0=performance.now();
      overlay?.show();
      overlay?.startTimer();
      overlay?.setProgress({ phase: 'battle-scene', message: '戦闘画面を準備中…', value: 0.05 });
      await nextFrame();
      const nextScene = new BattleScene((level, msg) => this.ui?.log(level, msg), { selectedStageId: this.selectedStageId || undefined, bcuDb: this.bcuDb });
      await nextScene.init({ onProgress: (p) => overlay?.setProgress(p) });
      console.info('battleScene:init:ok');

      overlay?.setProgress({ phase: 'battle-audio', message: '戦闘音声を保存中…', value: 0.83 });
      const audioPreloadStart = performance.now();
      try {
        const musicIds = audioEngine.getBattleTrackIds(nextScene.stage?.runtime);
        const audioPreload = await audioEngine.prepareTracks([...musicIds, ...BATTLE_PRELOAD_SE_IDS], {
          onProgress: (p) => overlay?.setProgress({
            phase: 'battle-audio',
            message: p.total > 1 ? `戦闘音声を保存中… ${p.index}/${p.total}` : '戦闘音声を保存中…',
            value: 0.83 + (p.total ? Math.min(0.035, (p.index / p.total) * 0.035) : 0)
          })
        });
        nextScene.loadTimings = nextScene.loadTimings || {};
        nextScene.loadTimings.audioPreloadMs = performance.now() - audioPreloadStart;
        nextScene.loadTimings.audioPreload = audioPreload;
        nextScene.pushEvent?.({
          type: 'battleAudioPreloaded',
          loaded: audioPreload.loaded,
          total: audioPreload.total,
          ids: audioPreload.ids,
          musicIds,
          seIds: BATTLE_PRELOAD_SE_IDS,
          cacheName: audioPreload.cacheName,
          source: audioPreload.source
        });
        this.ui?.log('info', `Battle audio preloaded: ${audioPreload.loaded}/${audioPreload.total} (music ${musicIds.length}, se ${BATTLE_PRELOAD_SE_IDS.length})`);
      } catch (error) {
        nextScene.loadTimings = nextScene.loadTimings || {};
        nextScene.loadTimings.audioPreloadMs = performance.now() - audioPreloadStart;
        nextScene.loadTimings.audioPreloadError = errorReport(error);
        console.warn('[PreviewApp] battle audio preload failed', error);
        this.ui?.log('warn', `Battle audio preload failed: ${error?.message || String(error)}`);
      }

      overlay?.setProgress({ phase: 'status-effects', message: '状態効果アイコンを準備中…', value: 0.84 });
      const statusPreloadStart = performance.now();
      try {
        const statusPreload = await preloadBcuStatusEffectDefinitions(nextScene);
        nextScene.loadTimings = nextScene.loadTimings || {};
        nextScene.loadTimings.statusEffectPreloadMs = performance.now() - statusPreloadStart;
        nextScene.loadTimings.statusEffectPreload = statusPreload;
        if (statusPreload?.ok) {
          this.ui?.log('info', `Status effect icons preloaded: ${statusPreload.loaded}/${statusPreload.total} in ${Math.round(statusPreload.elapsedMs || nextScene.loadTimings.statusEffectPreloadMs)}ms`);
        } else {
          this.ui?.log('warn', `Status effect icon preload incomplete: ${statusPreload?.loaded || 0}/${statusPreload?.total || 0}`);
        }
      } catch (error) {
        nextScene.loadTimings = nextScene.loadTimings || {};
        nextScene.loadTimings.statusEffectPreloadMs = performance.now() - statusPreloadStart;
        nextScene.loadTimings.statusEffectPreloadError = errorReport(error);
        console.warn('[PreviewApp] status effect icon preload failed', error);
        this.ui?.log('warn', `Status effect icon preload failed: ${error?.message || String(error)}`);
      }

      const elapsed=performance.now()-t0;
      const lt = nextScene.loadTimings || {};
      const bgText = lt.backgroundDeferred ? 'timeout/pending' : `${Math.round(lt.backgroundMs || 0)}ms`;
      const statusText = Number.isFinite(lt.statusEffectPreloadMs) ? `${Math.round(lt.statusEffectPreloadMs)}ms` : 'skipped';
      this.ui?.log('info',`Battle load timings: total=${Math.round(lt.totalMs||elapsed)}ms stage=${Math.round(lt.stageDefinitionMs||0)}ms stats=${Math.round(lt.productionStatsMs||0)}ms criticalTemplates=${Math.round(lt.criticalTemplatesMs||0)}ms background=${bgText} bases=${Math.round(lt.basesMs||0)}ms statusEffects=${statusText} warmup=async`);
      this.battleScene = nextScene;
      overlay?.setProgress({ phase: 'production', message: '出撃キャラを準備中…', value: 0.9, elapsedMs:elapsed });
      const battleMount=document.querySelector('.canvas-panel')||document.body;
      if(!this.productionBar){this.productionBar=new PlayerProductionBar({scene:nextScene,mount:battleMount});} else {this.productionBar.bindScene(nextScene);}
      this.productionBar?.setVisible(true);
      // Each battle starts at the BCU default speed (1x, gray).
      this.battleSpeedMultiplier = 1;
      this.speedControl?.reset();
      this.speedControl?.setVisible(true);
      this.sceneReady = true;
      this.formationEditor?.setVisible(keepFormationVisible);
      overlay?.setProgress({ phase: 'ready', message: '戦闘開始！', value: 1.0 });
      await new Promise((resolve) => setTimeout(resolve, 180));
      this.ui?.log('info', 'Battle reset completed');
    })();
    try {
      await this.battleInitPromise;
      if (!keepFormationVisible) this.formationEditor?.setVisible(false);
    } catch (e) {
      this.formationEditor?.setVisible(true);
      throw e;
    } finally { this.sceneTransitioning = false; this.battleLoading=false; this.battleInitPromise=null; if(showOverlay) overlay?.hide(); }
  }

  findAsset(id) { return this.assets.find((a) => a.id === id) || this.assets[0]; }
  async probeAnimations(asset) { const available = new Set(); for (const a of asset.animations) { const r = await this.loader.loadAnimation(asset, a); if (r.status === 'loaded') available.add(a.id); else this.ui.log('warn', `missing animation: ${a.id} (${(r.missing || []).join(', ') || r.file})`);} this.ui.setAnimationAvailability(asset, available); return available; }
  async loadCompositeLayers(asset) { const loaded = []; const missing = []; for (const layer of (asset.layers || [])) { try { loaded.push({ id: layer.id, name: layer.name || layer.id, anchor: layer.anchor || 'bottom-center', offsetX: layer.offsetX || 0, offsetY: layer.offsetY || 0, image: await loadImage(`${layer.baseDir}${layer.image}`) }); } catch (_e) { missing.push(`${layer.baseDir}${layer.image}`); } } const missingIds = ['bottom', 'middle', 'top'].filter((id) => !loaded.find((l) => l.id === id)); if (missingIds.length) this.ui?.log('warn', `castle-composite missing layer ids: ${missingIds.join(', ')}`); return { loaded, missing }; }
  async load(id, animId) { this.current = this.findAsset(id); this.state.assetMeta = { id: this.current.id, label: this.current.label, role: this.current.role, group: this.current.group, baseDir: this.current.baseDir || '-', renderMode: this.current.renderMode || 'animated-unit', layers: this.current.layers?.length || 0 }; this.ui.setAssetMeta(this.state.assetMeta); this.ui.log('info', `load asset ${this.current.label}`); if ((this.current.renderMode || 'model') === 'castle-composite') { const cr = await this.loadCompositeLayers(this.current); this.state.loadedFiles = cr.loaded.map((x) => `${x.id}:${x.image.src.split('/').pop()}`); this.state.missingFiles = cr.missing; this.state.renderMode = 'castle-composite'; this.state.modelRequired = false; this.state.animationRequired = false; this.state.compositeLayers = cr.loaded; this.state.sprite = null; this.state.model = null; this.ui.setAnimationAvailability(this.current, new Set()); this.state.availableAnimations = new Set(); this.ui.log('info', `loaded files: ${this.state.loadedFiles.join(', ') || 'none'}`); await this.loadAnim(null); return; } const r = await this.loader.loadAssetSet(this.current); r.errors.forEach((e) => this.ui.log('error', e)); r.missing.forEach((m) => this.ui.log('warn', `missing file: ${m}`)); this.state.loadedFiles = r.loaded; this.state.missingFiles = r.missing; this.state.renderMode = r.renderMode; this.state.modelRequired = r.modelRequired; this.state.animationRequired = r.animationRequired; this.state.compositeLayers = null; this.state.sprite = r.image && r.imgcut ? new BcuSpriteSheet(r.image, r.imgcut) : null; this.state.model = r.model ? new BcuModelInstance(r.model) : null; let available = new Set(); if (this.current.animations?.length) available = await this.probeAnimations(this.current); else this.ui.setAnimationAvailability(this.current, available); this.state.availableAnimations = available; this.ui.log('info', `loaded files: ${r.loaded.join(', ') || 'none'}`); await this.loadAnim(animId || this.current.animations[0]?.id || null); }
  async loadAnim(animId) { const ad = this.current.animations.find((a) => a.id === animId) || this.current.animations[0]; if (!ad) { this.state.currentAnimLabel = 'none'; this.state.anim = null; this.animator = new BcuAnimator({ tracks: [], maxFrame: 1 }); this.applyAnim(); return; } this.state.currentAnimLabel = ad.file; const result = await this.loader.loadAnimation(this.current, ad); if (result.status === 'missing') this.ui.log('warn', `missing animation: ${ad.id} (${result.missing.join(', ')})`); result.errors.forEach((e) => this.ui.log('error', e)); this.state.anim = result.anim; this.animator = new BcuAnimator(result.anim || { tracks: [], maxFrame: 1 }); if (result.anim) { this.ui.log('info', `animation file: ${result.file}`); this.ui.log('info', `tracks: ${result.anim.tracks.length}, maxFrame: ${result.anim.maxFrame}`); this.ui.log('info', `mod histogram: ${Object.entries(result.anim.modificationHistogram || {}).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}`);} this.applyAnim(); }
  applyAnim() { if (!this.state.model) { this.state.debugApplied = []; this.state.lastAppliedByPart = new Map(); this.ui.setDebug(this.state); return; } this.state.model.reset(); this.state.debugApplied = this.animator?.apply(this.state.model) || []; this.state.lastAppliedByPart = new Map(this.state.debugApplied.filter((x) => x.applied).map((x) => [x.partId, x])); this.ui.setDebug(this.state); }
  updateStatus() { const frame = (this.animator?.frame || 0).toFixed(2), parts = this.state.sprite?.imgcut?.parts?.length || 0, m = this.state.model?.parts?.length || 0, t = this.state.anim?.tracks?.length || 0; const applied = (this.state.debugApplied || []).filter((x) => x.applied).length; this.state.debugStats = { frame, parts, modelParts: m, maxFrame: this.state.anim?.maxFrame || 0, tracks: t, appliedCount: applied, currentAnimLabel: Array.isArray(this.state.currentAnimLabel) ? this.state.currentAnimLabel.join('|') : this.state.currentAnimLabel }; this.ui.setStatus(`frame:${frame} | parts:${parts} | model parts:${m} | tracks:${t} | applied:${this.state.debugApplied?.length || 0} | applied:${applied} | ${this.animator?.playing ? 'playing' : 'paused'}`); this.ui.setDebug(this.state); }
}
