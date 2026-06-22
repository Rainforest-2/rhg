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

const rendererOrder = read('js/battle/BattleSceneRendererOrderPatch.js');
assert.doesNotMatch(rendererOrder, /\.map\(\(actor, index\) => \(\{ actor, index \}\)\)/, 'renderer order must not allocate wrapper objects per actor');
assert.match(rendererOrder, /debugAllocationsEnabled\(\)/, 'renderer order debug details must be gated');

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
