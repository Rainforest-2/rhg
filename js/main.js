function showBootStatus(message) {
  let el = document.getElementById('boot-status-panel');
  if (!el) {
    el = document.createElement('section');
    el.id = 'boot-status-panel';
    el.style.cssText = 'position:fixed;inset:0;z-index:999999;display:grid;place-items:center;background:#05070d;color:#d8e2f0;font:16px/1.5 system-ui,sans-serif';
    document.body.appendChild(el);
  }
  el.textContent = message;
}

function hideBootStatus() {
  document.getElementById('boot-status-panel')?.remove();
}

async function boot() {
  try {
    showBootStatus('BCU asset database loading...');
    await import('./ui/FormationEditorPerformancePatch.js');
    await import('./ui/FormationCatalogVirtualDomPatch.js');
    await import('./ui/NyankoPresentationPatch.js');
    await import('./ui/NyankoUiBehaviorPatch.js');
    await import('./battle/bcu-runtime/BcuTraceRuntime.js');
    await import('./battle/BattleBcuStrictConfigPatch.js');
    await import('./battle/StageDefinitionNegativeSpawnPatch.js');
    await import('./battle/BattleActorBcuKbTargetPatch.js');
    await import('./battle/BattleActorProcStatusPatch.js');
    await import('./battle/BattleActorBarrierShieldPatch.js');
    await import('./battle/BattleSoulstrikePatch.js');
    await import('./battle/BattleDeterministicRandomPatch.js');
    await import('./battle/BattleWaveRuntimePatch.js');
    await import('./battle/BattleSurgeRuntimePatch.js');
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
    await import('./battle/BattleSceneStageSpawnHeaderPatch.js');
    await import('./battle/BattleSceneBcuAttackPhasePatch.js');
    await import('./battle/BattleSceneProcApplyPatch.js');
    await import('./battle/BattleSceneBcuProcRuntimePatch.js');
    await import('./battle/BattleSceneBcuStatusIconPatch.js');
    await import('./battle/BattleSceneBcuStatusEffectRenderPatch.js');
    await import('./battle/BattleSceneBcuTouchPatch.js');
    await import('./battle/BattleSceneBcuMobileInputPatch.js');
    await import('./battle/BattleSceneBcuStageBasisTickPatch.js');
    await import('./battle/BcuKnockbackRuntimePatch.js');
    await import('./battle/BcuKnockbackProcPriorityPatch.js');
    await import('./battle/BattleActorZombieRevivePatch.js');
    await import('./battle/BcuKnockbackEffectLayerPatch.js');
    await import('./battle/BcuKnockbackAnimationPatch.js');
    await import('./battle/BcuProcImmunityPatch.js');
    await import('./battle/BattleSceneAttackEffectPatch.js');
    await import('./battle/BattleProjectileEffectBcuParityPatch.js');
    await import('./battle/BattleProjectilePerformanceAndPositionPatch.js');
    await import('./battle/BattleSceneRendererBcuOriginPatch.js');
    await import('./battle/BattleSceneRendererHudPatch.js');
    await import('./battle/BattleSceneRendererBcuGlowPatch.js');
    await import('./battle/BattleSceneRendererEffectGlowPatch.js');
    await import('./ui/FormationStageNameBcuPatch.js');
    const { installBattleTouchGuard } = await import('./ui/BattleTouchGuard.js');
    installBattleTouchGuard(document);
    const { BcuBootLoader, setBcuAssetDatabase } = await import('./bcu/BcuBootLoader.js');
    const db = await BcuBootLoader.loadGame({ assetRoot: './public/assets', bcuRoot: './public/assets/bcu', locale: 'jp', preloadMode: 'metadata-and-current-battle' });
    setBcuAssetDatabase(db);
    showBootStatus('Starting preview...');
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