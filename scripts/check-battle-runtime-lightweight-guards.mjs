import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

const animator = read('js/bcu/BcuAnimator.js');
assert.match(animator, /function debugAllocationsEnabled\(\)/, 'BcuAnimator must expose a debug-allocation gate');
assert.match(animator, /if \(debug\) entry\.rawInterpolationDebug =/, 'raw interpolation debug must be gated');
assert.doesNotMatch(animator, /const skipped = \[\]/, 'BcuAnimator must not allocate skipped arrays on every getValuesAtFrame call');

const animationRuntime = read('js/bcu/AnimationRuntime.js');
assert.match(animationRuntime, /const debug = this\.debugAllocationsEnabled\(\);/, 'AnimationRuntime.tickActor must gate before/after snapshots');
assert.match(animationRuntime, /debug \? this\.getActorAnimationState\(actor\) : null/, 'AnimationRuntime must skip state snapshots outside debug allocation mode');

const model = read('js/bcu/BcuModelInstance.js');
assert.match(model, /const debug = globalThis\.__BCU_DEBUG_ALLOCATIONS__ === true;/, 'BcuModelInstance must gate draw/apply debug details');
assert.doesNotMatch(model, /drawList\.filter\(\(d\) => d\.opacity > 0/, 'BcuModelInstance must not build draw debug via repeated filter passes');

const debugStrip = read('js/battle/BattleDebugStripPatch.js');
assert.match(debugStrip, /beginTickPhaseWithoutTrace/, 'BattleDebugStripPatch must replace tick phase tracing with a lightweight helper');
assert.match(debugStrip, /getLastTickPhaseOrderDisabled/, 'BattleDebugStripPatch must disable phase-order array reconstruction');

const stageBasisTick = read('js/battle/BattleSceneBcuStageBasisTickPatch.js');
assert.match(stageBasisTick, /__bcuTargetSelections\.clear\(\)/, 'StageBasis tick scratch Map must be reused');
assert.match(stageBasisTick, /__bcuDueAttackHits\.length = 0/, 'StageBasis due-hit scratch array must be reused');
assert.match(stageBasisTick, /function refreshBcuTargetableActorBuckets\(scene\)/, 'StageBasis tick must build per-frame targetable actor buckets');
assert.match(stageBasisTick, /function invalidateBcuTargetableActorBuckets\(scene\)/, 'StageBasis targetable buckets must be invalidated before damage can change targetability');
assert.doesNotMatch(stageBasisTick, /findTargetForActor\(actor\)/, 'StageBasis tick must reuse computeBcuTouchState instead of rescanning/sorting targets');

const touch = read('js/battle/BattleSceneBcuTouchPatch.js');
assert.match(touch, /function shouldCollectTouchDebug\(scene\)/, 'touch debug allocations must be explicitly gated');
assert.match(touch, /firstCandidate/, 'touch state must keep a single fallback candidate without a normal-play candidates array');
assert.match(touch, /const candidates = collectDebug \? \[\] : null;/, 'touch state must allocate the candidates array only for debug');
assert.doesNotMatch(touch, /for \(const c of candidates\)/, 'touch state must not rescan candidates after collection');

const scene = read('js/battle/BattleScene.js');
assert.match(scene, /countAliveActorsBySide\(side\)/, 'BattleScene must count alive actors without filter-length arrays');
assert.doesNotMatch(scene, /actors\.filter\(a=>a\.isAlive\(\)&&a\.side==='cat-enemy'\)\.length/, 'enemy spawn count must not allocate a filtered actors array');
assert.doesNotMatch(scene, /es\.sort\(\(a,b\)=>/, 'findTargetForActor must scan for the nearest target instead of sorting candidates');

const rendererOrder = read('js/battle/BattleSceneRendererOrderPatch.js');
assert.doesNotMatch(rendererOrder, /\.map\(\(actor, index\) => \(\{ actor, index \}\)\)/, 'renderer order must not allocate wrapper objects per actor');
assert.doesNotMatch(rendererOrder, /sourceActors\.indexOf/, 'renderer order sort must not call indexOf inside the comparator');
assert.match(rendererOrder, /debugAllocationsEnabled\(\)/, 'renderer order debug details must be gated');

const sceneRenderer = read('js/battle/BattleSceneRenderer.js');
assert.doesNotMatch(sceneRenderer, /const corners = \[\[/, 'renderer bounds must not allocate corner arrays per part');
assert.match(sceneRenderer, /__BCU_RENDER_DEBUG__ === true[^]*getCurrentGroundContactBottomLocalY/, 'ground-contact bottom rescan must be debug-gated');

const crowd = read('js/battle/BattleCrowdPerformancePatch.js');
assert.match(crowd, /function shouldCollectCrowdDebug\(scene\)/, 'crowd performance debug must be explicitly gated');
assert.doesNotMatch(crowd, /actors\.filter\(\(a\) => a\?\.isAlive\?\.\(\)\)\.length/, 'crowd performance must not count alive actors with per-call filter arrays');

const effects = read('js/battle/EffectRuntime.js');
assert.match(effects, /globalThis\.__BCU_DEBUG_ALLOCATIONS__ === true \? this\.describeEffects/, 'EffectRuntime summaries must be debug-gated');
assert.doesNotMatch(effects, /list\.filter\(\(e\) => !e\?\.finished/, 'EffectRuntime cleanup must not use repeated filter passes');

const attackResolver = read('js/battle/BattleAttackResolver.js');
assert.doesNotMatch(attackResolver, /\.slice\(\)\.sort/, 'single-target attack selection must scan instead of cloning and sorting candidates');
assert.doesNotMatch(attackResolver, /\.filter\([^]*?\.filter\([^]*?\.map\(/, 'attack capture must not build candidates with chained filter/map passes');
assert.match(attackResolver, /compareSingleTarget/, 'single-target attack selection must share one comparator for scan-based selection');

const soulstrike = read('js/battle/BattleSoulstrikePatch.js');
assert.doesNotMatch(soulstrike, /\.filter\([^]*?\.filter\([^]*?\.map\(/, 'soulstrike capture override must not rebuild candidates with chained filter/map passes');
assert.match(soulstrike, /isSoulstrikeCaptureCandidate/, 'soulstrike capture override must use a single candidate predicate');

const bossShockwave = read('js/battle/BattleBossShockwaveRuntimePatch.js');
assert.doesNotMatch(bossShockwave, /queue\.filter\(/, 'boss shockwave queue must be compacted in place');
assert.match(bossShockwave, /let writeIndex = 0/, 'boss shockwave queue must use in-place compaction');

const economy = read('js/battle/BattleEconomy.js');
assert.doesNotMatch(economy, /\[\.\.\.this\.cooldowns\.entries\(\)\]/, 'BattleEconomy tick must not clone cooldown Map entries');

const audioEngine = read('js/audio/AudioEngine.js');
assert.match(audioEngine, /SE_POOL_MAX_SIZE/, 'AudioEngine must grow the SE voice pool during dense bursts');
assert.match(audioEngine, /_createSeElement\(\)/, 'AudioEngine must centralize SE element creation');
assert.match(audioEngine, /mode = 'stolen-oldest'/, 'AudioEngine must only steal the oldest voice after the growth cap');
assert.match(audioEngine, /lastSeVoiceDebug/, 'AudioEngine must expose compact SE voice diagnostics');
assert.doesNotMatch(audioEngine, /SE_SAME_ID_MIN_INTERVAL_MS|SE_MAX_STARTS_PER_BURST_WINDOW|_canStartSe/, 'AudioEngine must not suppress SE requests with a flood throttle');

const productionBar = read('js/ui/PlayerProductionBar.js');
assert.match(productionBar, /lastMoneyDrawKey/, 'production bar money canvas must skip unchanged redraws');
assert.match(productionBar, /lastWalletDrawKey/, 'production bar wallet button must skip unchanged redraws');
assert.match(productionBar, /lastCannonDrawKey/, 'production bar cannon button must skip unchanged redraws');
assert.match(productionBar, /lastLineupSwipeDebugKey/, 'production bar lineup debug updates must be state-keyed');
assert.match(productionBar, /function getLineupRenderContext/, 'production bar must reuse lineup render context per update');
assert.match(productionBar, /const renderContext = getLineupRenderContext\(scene\)/, 'production bar update must avoid rebuilding lineup rows for every card');
assert.match(productionBar, /drawCardIfNeeded/, 'production card canvases must use a render-key cache');
assert.match(productionBar, /flashTime = ready \? time : 0/, 'cannon charging state must not redraw for full-ready flash timing');

console.log('check-battle-runtime-lightweight-guards: OK');
