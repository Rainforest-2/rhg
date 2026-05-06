import { readFile } from 'node'+':fs'+'/promises';

const read = (p) => readFile(new URL(p, import.meta.url), 'utf8');
const ok = (checks) => checks.every(Boolean);

export async function verifyBcuLoadingStrategyMatchesBrowserOptimizedBcu(){
  const s=await read('./BattleScene.js'); const f=await read('./BattleActorFactory.js');
  const checks=[s.includes('background warmup')||s.includes('startBackgroundWarmup'),f.includes('TEMPLATE_LOAD_LEVEL'),f.includes('render-core')];
  return {ok:ok(checks),checks,errors:checks.map((v,i)=>v?null:`check${i}`).filter(Boolean)};
}
export async function verifyBattleCriticalPathDoesNotPreloadAllPlayables(){ const s=await read('./BattleScene.js'); const checks=[!s.includes('await this.preloadRosters()'),s.includes('getRequiredInitialTemplateDefs')||s.includes('getInitialPlayerSpawnUnit')]; return {ok:ok(checks),checks,errors:[]}; }
export async function verifyTemplateLoadLevels(){ const s=await read('./BattleActorFactory.js'); const checks=[s.includes('STATS'),s.includes('RENDER_CORE'),s.includes('FULL_VISUAL'),s.includes('template not render-ready'),s.includes('upgradePromises')]; return {ok:ok(checks),checks,errors:[]}; }
export async function verifyBcuAssetLoaderPromiseCaches(){ const s=await read('../bcu/BcuAssetLoader.js'); const t=await read('../bcu/BcuText.js'); const checks=[t.includes('textCache'),s.includes('cache.set(def.id,p)'),s.includes('Promise.allSettled'),s.includes('animationCache'),s.includes('cache.delete(def.id)')]; return {ok:ok(checks),checks,errors:[]}; }
export async function verifyBattleSpeedAndDebugControls(){ const a=await read('../preview/PreviewApp.js'); const r=await read('./BattleSceneRenderer.js'); const checks=[a.includes('battleSpeedMultiplier'),a.includes('tick(dt*this.battleSpeedMultiplier)'),a.includes('showPivots')&&a.includes('showParts')&&a.includes('showBounds')&&a.includes('rawMode'),r.includes('showPivots')]; return {ok:ok(checks),checks,errors:[]}; }
