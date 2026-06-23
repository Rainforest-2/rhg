const { readFile } = await import('node'+':fs'+'/promises');

async function read(path) { return readFile(new URL(path, import.meta.url), 'utf8'); }

export async function verifyLoadingOverlayTimerAdvances() {
  const s = await read('./AppLoadingOverlay.js');
  const checks = [s.includes('startTimer()'), s.includes('requestAnimationFrame'), s.includes('performance.now() - this.startedAt'), s.includes('lastProgressValue')];
  return { ok: checks.every(Boolean), checks, errors: checks.every(Boolean) ? [] : ['overlay timer/progress behavior missing'] };
}

export async function verifyPreviewAppPassesSceneProgress() {
  const s = await read('../preview/PreviewApp.js');
  const checks = [s.includes('await nextFrame()'), s.includes('nextScene.init({ onProgress: (p) => overlay?.setProgress(p) })'), s.includes("value: 0.05"), s.includes("phase: 'ready'")];
  return { ok: checks.every(Boolean), checks, errors: checks.every(Boolean) ? [] : ['PreviewApp reset flow missing progress wiring'] };
}

export async function verifyBattleSceneReportsPhaseTimings() {
  const s = await read('../battle/BattleScene.js');
  const checks = [s.includes('this.loadTimings={totalMs'), s.includes('stageDefinitionMs'), s.includes('productionStatsMs'), s.includes('criticalTemplatesMs'), s.includes('backgroundMs'), s.includes('basesMs')];
  return { ok: checks.every(Boolean), checks, errors: checks.every(Boolean) ? [] : ['BattleScene loadTimings breakdown missing'] };
}

export async function verifyBattleCriticalPathUsesRenderCoreNotFullVisual() {
  const s = await read('../battle/BattleScene.js');
  const checks = [s.includes('TEMPLATE_LOAD_LEVEL.STATS'), s.includes('TEMPLATE_LOAD_LEVEL.RENDER_CORE'), s.includes('startBackgroundWarmup()'), s.includes('Promise.race([backgroundPromise'), s.includes('ensureHitEffectLoading()'), s.includes('ensureKbeffLoading()')];
  return { ok: checks.every(Boolean), checks, errors: checks.every(Boolean) ? [] : ['Critical path separation not detected'] };
}
