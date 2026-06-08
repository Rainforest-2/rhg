function safeBootText(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function showBootStatus(message) {
  let el = document.getElementById('boot-status-panel');
  if (!el) {
    el = document.createElement('section');
    el.id = 'boot-status-panel';
    el.style.cssText = 'position:fixed;inset:0;z-index:999999;display:grid;place-items:center';
    el.innerHTML = `<div class="boot-loading-card" role="status" aria-live="polite">
      <div class="boot-loading-kicker">WANKO BATTLE</div>
      <div class="boot-loading-title">起動準備中</div>
      <div class="boot-loading-message"></div>
      <div class="boot-loading-rail"><span></span></div>
      <div class="boot-loading-meta">BCU ASSET PIPELINE</div>
    </div>`;
    document.body.appendChild(el);
  }
  const msg = el.querySelector('.boot-loading-message');
  const title = el.querySelector('.boot-loading-title');
  if (title) title.textContent = message.includes('出撃') ? 'ゲームを開始しています' : 'アセットを準備しています';
  if (msg) msg.textContent = message;
  else el.textContent = safeBootText(message);
}

function hideBootStatus() {
  document.getElementById('boot-status-panel')?.remove();
}

async function boot() {
  try {
    showBootStatus('素材を読み込み中…');
    await import('./ui/FormationEditorPerformancePatch.js');
    await import('./ui/FormationCatalogVirtualDomPatch.js');
    await import('./ui/NyankoPresentationPatch.js');
    await import('./ui/FormationJapaneseBootPatch.js');
    await import('./ui/NyankoUiBehaviorPatch.js');
    await import('./ui/ProductionCardDogIconFitPatch.js');
    await import('./ui/FormationEditorBcuUnitLevelPatch.js');
    await import('./ui/FormationCharacterTuningMobileLandscapePatch.js');
    await import('./ui/FormationCustomStageBattlePatch.js');
    await import('./ui/FormationStageDifficultyPatch.js');
    await import('./ui/FormationUiRegressionFixPatch.js');
    await import('./ui/FormationPhoneLandscapeLayoutPatch.js');
    await import('./ui/FormationCustomStageBattleHpPatch.js');
    await import('./ui/FormationCustomStageBattleApplyHpConfigPatch.js');
    await import('./bcu/BcuExtraActorAnimationBundlePatch.js');
    await import('./battle/bcu-runtime/BcuTraceRuntime.js');
    await import('./battle/BattleBcuStrictConfigPatch.js');
    await import('./battle/StageDefinitionNegativeSpawnPatch.js');
    await import('./battle/BattleActorBcuKbTargetPatch.js');
    await import('./battle/BattleToxicEffectAssetPatch.js');
    await import('./battle/BattleSceneBcuUnitLevelPatch.js');
    await import('./battle/BcuDelayRuntimePatch.js');
    await import('./battle/BattleActorBarrierShieldPatch.js');
    await import('./battle/BattleActorBarrierShieldVisualPatch.js');
    await import('./battle/BattleSoulstrikePatch.js');
    await import('./battle/BattleActorBcuBurrowPatch.js');
    await import('./battle/BattleActorBcuBurrowDiagnosticsPatch.js');
    await import('./battle/BattleDeterministicRandomPatch.js');
    await import('./battle/BattleActorAttackNullifyPatch.js');
    await import('./battle/BattleWaveRuntimePatch.js');
    await import('./battle/BattleSceneBcuWaveOnBlockedHitPatch.js');
    await import('./battle/BattleSurgeRuntimePatch.js');
    await import('./battle/BattleBlastRuntimePatch.js');
    await import('./battle/BattleBaseProjectileProcPatch.js');
    await import('./battle/BattleProjectileRuntimeBugfixPatch.js');
    await import('./battle/BattleSceneBcuWaveRuntimePatch.js');
    await import('./battle/BattleSceneBcuSurgeRuntimePatch.js');
    await import('./battle/BattleSceneBcuStageBasisOrderPatch.js');
    await import('./battle/BattleSceneStageRuntimeWiring.js');
    await import('./battle/BattleSceneRendererOrderPatch.js');
    await import('./battle/BattleSceneUnitLayerPatch.js');
    await import('./battle/BattleSceneBcuTimerPatch.js');
    await import('./battle/BattleSceneBcuLineupPatch.js');
    await import('./battle/BattleSceneBcuStageSpawnPatch.js');
    await import('./battle/BattleSceneBcuCastleGuardPatch.js');
    await import('./battle/BattleSceneBcuSpiritPatch.js');
    await import('./battle/BattleSceneCustomStageBattlePatch.js');
    await import('./battle/BattleSceneStageSpawnHeaderPatch.js');
    await import('./battle/BattleSceneBcuAttackPhasePatch.js');
    await import('./battle/BattleSceneProcApplyPatch.js');
    await import('./battle/BattleSceneBcuWaveInvalidApplyPatch.js');
    await import('./battle/BattleSceneBcuProcRuntimePatch.js');
    await import('./battle/BattleSceneBcuStageBasisPhaseBridgePatch.js');
    await import('./battle/BattleBountyRuntimePatch.js');
    await import('./battle/BattleSceneBcuStatusIconPatch.js');
    await import('./battle/BattleSceneBcuStatusEffectRenderPatch.js');
    await import('./battle/BattleSceneBcuTouchPatch.js');
    await import('./battle/BattleSceneBcuMobileInputPatch.js');
    await import('./battle/BattleSceneBcuStageBasisTickPatch.js');
    await import('./battle/BattleSceneCustomStageBaseHpPatch.js');
    await import('./battle/BcuKnockbackRuntimePatch.js');
    await import('./battle/BcuKnockbackProcPriorityPatch.js');
    await import('./battle/BattleActorStrengthenLethalPatch.js');
    await import('./battle/BattleActorZombieRevivePatch.js');
    await import('./battle/BattleActorGlassPatch.js');
    await import('./battle/BattleBcuDeathAnimationRuntimePatch.js');
    await import('./battle/BcuKnockbackEffectLayerPatch.js');
    await import('./battle/BcuKnockbackAnimationPatch.js');
    await import('./battle/BcuProcImmunityPatch.js');
    await import('./battle/BcuProcImmunityVisualPatch.js');
    await import('./battle/BattleBcuPriorityEffectRuntimePatch.js');
    await import('./battle/BattleSceneAttackEffectPatch.js');
    await import('./battle/BattleCriticalEffectPatch.js');
    await import('./battle/BattleProcHitEffectPatch.js');
    await import('./battle/BattleProjectileEffectBcuParityPatch.js');
    await import('./battle/BattleProjectilePerformanceAndPositionPatch.js');
    await import('./battle/BattleCrowdPerformancePatch.js');
    await import('./battle/BattleSceneRendererBcuOriginPatch.js');
    await import('./battle/BattleSceneRendererHudPatch.js');
    await import('./battle/BattleSceneRendererBcuGlowPatch.js');
    await import('./battle/BattleSceneRendererEffectGlowPatch.js');
    await import('./battle/BattleDebugStripPatch.js');
    await import('./ui/FormationStageNameBcuPatch.js');
    const { installBattleTouchGuard } = await import('./ui/BattleTouchGuard.js');
    installBattleTouchGuard(document);
    const { BcuBootLoader, setBcuAssetDatabase } = await import('./bcu/BcuBootLoader.js');
    const db = await BcuBootLoader.loadGame({ assetRoot: './public/assets', bcuRoot: './public/assets/bcu', locale: 'jp', preloadMode: 'metadata-and-current-battle' });
    setBcuAssetDatabase(db);
    showBootStatus('出撃準備中…');
    await import('./preview/PreviewAppCustomStageBattleConfigPatch.js');
    await import('./preview/PreviewAppBattleResultOverlayPatch.js');
    const { PreviewApp } = await import('./preview/PreviewApp.js');
    const app = new PreviewApp({ bcuDb: db });
    globalThis.__APP__ = app;
    globalThis.app = app;
    await app.start();
    hideBootStatus();
  } catch (error) {
    hideBootStatus();
    console.error('[main] boot failed', error);
    globalThis.__WAN_BOOT_ERROR__?.(error);
    throw error;
  }
}

boot();
