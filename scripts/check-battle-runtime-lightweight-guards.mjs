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

console.log('check-battle-runtime-lightweight-guards: OK');
