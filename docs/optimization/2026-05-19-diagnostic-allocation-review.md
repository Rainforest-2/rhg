# Diagnostic Allocation Optimization Review

Date: 2026-05-19

## Objective

Analyze safe lightweight optimization opportunities, using local BCU reference sources where relevant, before editing runtime code. The requested optimization class is diagnostic allocation cleanup only; battle logic, rendering parity, patch ordering, and wrapper chains must remain unchanged.

## Design prompt

Restated objective: identify local, reversible reductions in debug/global diagnostic allocation without changing player-visible Battle Cats Ultimate battle behavior.

Files inspected and why they matter:

- `js/main.js`: establishes patch import order and therefore the effective wrapper chain.
- `js/battle/BattleSceneBcuStatusEffectRenderPatch.js`: safe first-pass target for status effect render diagnostics; inspected to verify status effect update/draw calls.
- `js/battle/BattleSceneRendererEffectGlowPatch.js`: final effective `drawEffects` implementation after attack-effect renderer patch; inspected for render diagnostics and protected drawing calls.
- `js/battle/BattleSceneAttackEffectPatch.js`: creates hit smoke effects and an earlier `drawEffects` implementation; contains several hit-effect diagnostic objects.
- `js/battle/BattleProjectilePerformanceAndPositionPatch.js`: suppresses projectile hit smoke and verbose wave/surge trace; contains per-suppression diagnostic writes.
- `js/ui/FormationCatalogVirtualDomPatch.js`: safe first-pass UI target; inspected for `__FORMATION_VDOM_DIFF_DEBUG__`.
- `js/battle/BattleDebugStripPatch.js`: late debug-disabling wrapper; inspected because it replaces `pushEvent` and wraps `runTickPhase`.
- `js/battle/BattleSceneRenderer.js`, `js/battle/EffectRuntime.js`, `js/battle/BattleEffect.js`: adjacent data-flow checks for draw/effect debug consumers.

Reference ZIP files/classes/methods inspected:

- `references/bcu/BCU_java_util_common.zip`
  - `battle/entity/Entity.java`
    - `AnimManager.drawEff(...)`: status icons/effects draw from entity origin and advance horizontally.
    - `AnimManager.update()` / `updateAnimation()`: smoke animations are updated and cleared when done.
    - damage path around `anim.smoke = A_ATK_SMOKE` / `A_WHITE_SMOKE`, `smokeLayer`, and `smokeX`: hit smoke is behavior-bearing and must not be removed.
  - `battle/attack/ContWaveAb.java`
    - `draw(...)`: projectile wave container draws an animation at the container point and layer.
  - `battle/attack/ContWaveDef.java`
    - constructor/update/`nextWave()`: wave animation lifetime, attack timing, and chain generation are gameplay contracts.
  - `battle/attack/AttackWave.java`
    - `capture()` / `excuse()`: wave target capture and damage application are protected logic.
  - `battle/attack/ContVolcano.java`
    - `draw(...)`, `update()`, `updateAnimation()`: surge visual lifetime and repeated damage timing are protected logic.
- `references/bcu/BCU_Android-master.zip`
  - `app/src/main/java/com/mandarin/bcu/EffectList.kt`: confirms Android uses common `EffAnim` assets for effect presentation; it is UI/reference context, not battle logic.

Explicit non-goals:

- No draw-list caching, target-search indexing, status-icon dirty caching, background offscreen caching, projectile runtime consolidation, wrapper refactoring, or battle logic changes.
- No changes to wave/surge position, layer, lifetime, hit-smoke suppression constants, status effect update/draw behavior, or actor animation mutation.
- No import-order changes in `js/main.js`.

Candidate optimizations ranked by safety:

1. Remove or guard redundant projectile trace suppression diagnostics in `BattleProjectilePerformanceAndPositionPatch.js`: `lastProjectileTraceSuppressedDebug` and `globalThis.__BCU_PROJECTILE_TRACE_SUPPRESS_DEBUG__`. These are written only when already dropping verbose trace events.
2. Reduce hit-effect spawn diagnostic writes in `BattleSceneAttackEffectPatch.js`: `lastHitEffectSpawnDebug`, `__BATTLE_HIT_EFFECT_SPAWN_DEBUG__`, and optional event payload allocation. This is probably safe but touches a gameplay-adjacent effect creation method and should be smaller than changing effect payload shape.
3. Remove renderer diagnostics from `BattleSceneAttackEffectPatch.js`: `lastModelDrawDebug`, `lastRenderDebug`, `__BATTLE_EFFECT_RENDER_DEBUG__`, `errors`, and `examples`. However `BattleSceneRendererEffectGlowPatch.js` is imported later and is the effective final `drawEffects`, so this has limited runtime value unless the later patch is absent.
4. `BattleSceneRendererEffectGlowPatch.js`: no current `lastModelDrawDebug`, `lastRenderDebug`, `__BATTLE_EFFECT_RENDER_DEBUG__`, `errors`, or `examples` allocations were found; no action recommended.
5. `FormationCatalogVirtualDomPatch.js`: no current `__FORMATION_VDOM_DIFF_DEBUG__` write was found; no action recommended.
6. `BattleSceneBcuStatusEffectRenderPatch.js`: no obvious diagnostic allocation was found; do not alter the `manager.updateEffects(...)`, `getBcuStatusEffectPosition(...)`, or `effect.runtime.draw(...)` flow.

Exact code paths that must remain behaviorally unchanged:

- `BattleScene.prototype.queueAttackDamage` wrappers must call captured originals with the same `this` and compatible arguments.
- `BattleScene.prototype.runTickPhase` wrappers must preserve wrapper-chain execution and mutable `debugEvents` / `tickPhaseTrace` arrays.
- `BattleSceneRenderer.prototype.drawEffects` final implementation must still sort active effects by layer and `createdAtMs`, call `animator.apply(...)`, call `model.getBattleDrawList(...)`, draw with `drawBcuImagePart(...)`, preserve opacity/glow/transform/pivot/scale/layer/position handling, and isolate per-effect render errors.
- `BattleSceneRenderer.prototype.drawActor` must keep `model.getBattleDrawList(...)` and animation/ground-anchor behavior.
- Projectile normalization must keep `WAVE_SCREEN_OFFSET = -28`, `bcuProjectileStageObject`, `bcuSmokeYOffset = 0`, and `normalizeProjectileEffect(...)` semantics.
- Projectile hit-smoke suppression must keep the temporary `spawnHitEffect = () => null` bracket and restore the original in `finally`.
- Status effect rendering must keep `manager.updateEffects(dt, scene)`, `getBcuStatusEffectPosition(...)`, and `effect.runtime.draw(...)` when `effect.runtime && pos.rendered`.

Expected debug/global output changes, if the safest candidate is implemented:

- Game behavior should be unchanged.
- `scene.lastProjectileTraceSuppressedDebug` may stop updating for dropped verbose `bcuWaveTrace` / `bcuSurgeTrace` events.
- `globalThis.__BCU_PROJECTILE_TRACE_SUPPRESS_DEBUG__` may stop updating for dropped verbose `BcuTraceRuntime.push('wave'|'surge', ...)` calls.
- Kept trace events and all effect rendering should remain unchanged.

Static verification steps available:

- Search required protected symbols and debug globals before and after the change.
- Inspect `js/main.js` import order around `BattleSceneAttackEffectPatch.js`, `BattleProjectilePerformanceAndPositionPatch.js`, `BattleSceneRendererEffectGlowPatch.js`, and `BattleDebugStripPatch.js`.
- Inspect changed wrapper methods and confirm captured originals are still called with `.call(this, ...)`.
- Confirm no `WAVE_SCREEN_OFFSET`, projectile source set, y-offset, layer, lifetime, draw, or status effect call changed.
- Run targeted non-browser checks if they do not require missing assets or a browser:
  - `node scripts/check-battle-tick-order.mjs`
  - `node scripts/check-battle-renderer-projection.mjs`
  - `node scripts/check-renderer-coordinate-paths.mjs`

Rollback criteria:

- Any change to rendered wave/surge/smoke positioning, layer ordering, effect lifetime, actor/status effect rendering, damage timing, or wrapper order.
- Any executable check regression.
- Any new reference to a removed debug field that implies non-debug logic consumption.

## Import-order constraints from `js/main.js`

Relevant import order from `js/main.js`:

- `FormationCatalogVirtualDomPatch.js` at line 20.
- `BcuTraceRuntime.js` at line 23.
- `BattleWaveRuntimePatch.js` at line 31.
- `BattleSurgeRuntimePatch.js` at line 32.
- `BattleProjectileRuntimeBugfixPatch.js` at line 33.
- `BattleSceneBcuStatusIconPatch.js` at line 47.
- `BattleSceneBcuStatusEffectRenderPatch.js` at line 48.
- `BattleSceneAttackEffectPatch.js` at line 58.
- `BattleProjectileEffectBcuParityPatch.js` at line 59.
- `BattleProjectilePerformanceAndPositionPatch.js` at line 60.
- `BattleSceneRendererBcuGlowPatch.js` at line 64.
- `BattleSceneRendererEffectGlowPatch.js` at line 65.
- `BattleDebugStripPatch.js` at line 66.

Ordering consequences:

- `BattleSceneAttackEffectPatch.js` installs an earlier renderer `drawEffects`.
- `BattleSceneRendererEffectGlowPatch.js` is imported later and is the effective final `drawEffects`.
- `BattleProjectilePerformanceAndPositionPatch.js` wraps `queueAttackDamage`, `pushEvent`, `EffectRuntime.createEffect`, and `BcuTraceRuntime.push` after wave/surge and projectile bugfix patches.
- `BattleDebugStripPatch.js` is late and disables `pushEvent`, while preserving the existing `runTickPhase` chain.

## Current wrapper chain and data flow

### `BattleSceneBcuStatusEffectRenderPatch.js`

Current flow:

1. Wraps `BattleSceneRenderer.prototype.render`.
2. Captures `actorsForRender` once and patches `getAliveActorsForRender` only during the render call.
3. Temporarily wraps the instance `drawActor` so status effects draw after each actor render.
4. For each alive actor, calls `getActorStatusEffectManager(actor, scene)`, then `manager.updateEffects(dt, scene)`.
5. Computes position via `getBcuStatusEffectPosition(...)`.
6. Draws `effect.runtime.draw(ctx, ...)` only when `effect.runtime && pos.rendered`.
7. Restores `drawActor` and `getAliveActorsForRender` in `finally`.

Optimization status: no diagnostic allocation target found. Do not change in the first implementation pass.

### `BattleSceneRendererEffectGlowPatch.js`

Current flow:

1. Replaces `BattleSceneRenderer.prototype.drawEffects` if not already installed.
2. Filters active effects and sorts by layer, then creation time.
3. For model effects, optionally resets the model, applies the animator, gets `model.getBattleDrawList?.() || []`, and draws parts with `drawBcuImagePart(...)`, preserving opacity and glow.
4. For frame-part fallback effects, draws `currentPart` through `drawBcuImagePart(...)`.
5. Catches per-effect errors and continues the frame.

Optimization status: no current render debug global/object allocation found. This file should be left untouched for now.

### `BattleSceneAttackEffectPatch.js`

Current flow:

1. Wraps `BattleScene.prototype.init` to ensure hit effect assets load and writes init/load debug globals.
2. Defines `ensureHitEffectLoading` to load attack/white smoke effect assets and write load debug globals.
3. Replaces `spawnHitEffect`:
   - validates asset readiness;
   - enforces `maxEffects`;
   - creates a smoke runtime;
   - computes BCU smoke layer, world X, y-offset, frame duration, and duration;
   - calls `EffectRuntime.createHitEffect(...)`;
   - sets duration/frame fields;
   - pushes the effect into `this.effects`;
   - writes `lastHitEffectSpawnDebug` / `__BATTLE_HIT_EFFECT_SPAWN_DEBUG__`;
   - calls `this.pushEvent?.({...})`.
4. Installs an earlier `BattleSceneRenderer.prototype.drawEffects`, but this is superseded by `BattleSceneRendererEffectGlowPatch.js` in normal boot order.

Optimization status: hit-effect spawn diagnostic writes are a candidate, but do not change effect creation, `EffectRuntime.createHitEffect(...)`, `effects.push(...)`, `durationMs`, `frameDurationMs`, layer, world X, or y-offset.

### `BattleProjectilePerformanceAndPositionPatch.js`

Current flow:

1. Wraps `EffectRuntime.createEffect` and calls `normalizeProjectileEffect(effect, payload)`.
2. `normalizeProjectileEffect` marks wave/surge effects as projectile stage objects, sets `bcuSmokeYOffset = 0`, preserves layer source, and applies `WAVE_SCREEN_OFFSET = -28` only to wave effects.
3. Wraps `BattleScene.prototype.queueAttackDamage` to suppress hit smoke for projectile wave/surge damage by temporarily replacing `this.spawnHitEffect`, calling the original queue method, then restoring in `finally`.
4. Wraps `BattleScene.prototype.pushEvent` to drop verbose per-frame wave/surge trace events while keeping important events.
5. Wraps `BcuTraceRuntime.push` to drop verbose wave/surge trace entries while keeping important events.
6. Writes patch install metadata to `globalThis.__BCU_PROJECTILE_PERF_POSITION_PATCH__`.

Optimization status: the safest first implementation is to remove or guard only the diagnostic writes in steps 4 and 5. Do not alter suppression predicates, kept-event set, or forwarding to captured originals.

### `FormationCatalogVirtualDomPatch.js`

Current flow:

1. Replaces `FormationEditor.prototype.renderCatalogWindow`.
2. Computes virtual rows, spacer heights, and required card range.
3. Reuses existing card DOM nodes by key, updates data/text/meta, preserves loaded semantic icons when possible.
4. Removes out-of-window cards and calls `grid.replaceChildren(fragment)`.

Optimization status: no current `globalThis.__FORMATION_VDOM_DIFF_DEBUG__` write found. No action recommended.

## Selected changes and why they are safe

No runtime code was changed in this analysis-only pass.

Selected next implementation candidate:

- Remove or guard the two projectile suppression diagnostics:
  - `this.lastProjectileTraceSuppressedDebug = {...}` in `pushEventSuppressProjectileVerbose`.
  - `globalThis.__BCU_PROJECTILE_TRACE_SUPPRESS_DEBUG__ = {...}` in `pushSuppressProjectileVerbose`.

Why safe:

- The affected branches already suppress diagnostic trace/event writes.
- The objects are not used by gameplay state, renderer state, target selection, damage resolution, projectile lifetime, or effect drawing.
- Search found references only at their write sites.
- Kept events still flow through `originalPushEvent.call(this, event)` and `originalPush.call(this, channel, entry)`.

## Rejected changes and risk

- Changing `EffectRuntime.createHitEffect(...)` payload shape: rejected because `effect.effectRuntimeDebug` is read by adjacent code and because effect source/layer metadata is intertwined with filtering and diagnostics.
- Removing `this.pushEvent?.({...})` in `spawnHitEffect`: rejected for now because it would alter the event stream, even though `BattleDebugStripPatch.js` later disables event storage.
- Editing `BattleSceneRendererEffectGlowPatch.js`: rejected because the expected debug allocation target is already absent.
- Editing `BattleSceneBcuStatusEffectRenderPatch.js`: rejected because the current file mostly contains behavior-bearing update/draw flow, not diagnostics.
- Editing `FormationCatalogVirtualDomPatch.js`: rejected because the expected VDOM debug global is already absent.
- Refactoring wrapper chains or replacing wrappers with direct calls: rejected by repository contract.

## Behavior invariants

- Wave/surge/projectile visual positions, y-offsets, layers, creation times, sorting, lifetime, and hit-smoke suppression must remain unchanged.
- `WAVE_SCREEN_OFFSET` must remain `-28`.
- `normalizeProjectileEffect(...)` must continue to mutate projectile effects as it does today.
- `queueAttackDamage` wrappers must continue to call captured originals with `.call(this, ...)`.
- Status effect manager update and draw calls must run once through the existing render flow.
- Final `drawEffects` behavior must continue to be provided by `BattleSceneRendererEffectGlowPatch.js` under current import order.
- Mutable debug arrays must not be replaced with frozen arrays.

## Expected debug/global output changes

For the selected next implementation candidate:

- `globalThis.__BCU_PROJECTILE_TRACE_SUPPRESS_DEBUG__` would no longer be populated for suppressed verbose trace entries, or would be populated only under an explicit debug guard if a guard is chosen instead of removal.
- `scene.lastProjectileTraceSuppressedDebug` would no longer be populated for suppressed verbose scene events, or would be populated only under an explicit debug guard.
- `globalThis.__BCU_PROJECTILE_PERF_POSITION_PATCH__` should remain unchanged.
- Game behavior should be unchanged; debug/global inspection output may change.

## Static verification commands and searches performed

Commands/searches performed during this analysis:

- `rg --files -g 'AGENTS.md' -g 'js/main.js' -g 'js/battle/*.js' -g 'js/ui/*.js' -g 'references/bcu/*.zip' -g 'docs/optimization/*.md'`
- `rg -n "runTickPhase|queueAttackDamage|drawEffects|drawActor|BcuTraceRuntime\\.push|pushEvent|globalThis\\.__BCU_|globalThis\\.__BATTLE_|globalThis\\.__FORMATION_|lastRenderDebug|lastModelDrawDebug|lastDrawListDebug|lastHitEffectSpawnDebug|getBattleDrawList" js docs AGENTS.md`
- `sed -n '1,260p' js/main.js`
- `sed -n '1,260p' js/battle/BattleSceneBcuStatusEffectRenderPatch.js`
- `sed -n '1,360p' js/battle/BattleSceneRendererEffectGlowPatch.js`
- `sed -n '1,340p' js/battle/BattleSceneAttackEffectPatch.js`
- `sed -n '1,260p' js/ui/FormationCatalogVirtualDomPatch.js`
- `sed -n '1,300p' js/battle/BattleProjectilePerformanceAndPositionPatch.js`
- `sed -n '1,140p' js/battle/BattleDebugStripPatch.js`
- `sed -n '250,450p' js/battle/BattleSceneRenderer.js`
- `sed -n '1,140p' js/battle/EffectRuntime.js`
- `sed -n '1,120p' js/battle/BattleEffect.js`
- `unzip -l references/bcu/BCU_Android-master.zip '*Effect*'`
- `unzip -l references/bcu/BCU_java_util_common.zip '*Effect*'`
- `unzip -l references/bcu/BCU_java_util_common.zip '*Battle*'`
- `unzip -l references/bcu/BCU_java_util_common.zip '*Entity*'`
- `unzip -l references/bcu/BCU_java_util_common.zip '*Wave*'`
- `unzip -l references/bcu/BCU_java_util_common.zip '*Volcano*'`
- `unzip -p references/bcu/BCU_java_util_common.zip .../battle/entity/Entity.java | rg -n "smoke|A_ATK|damage\\("`
- `unzip -p references/bcu/BCU_java_util_common.zip .../battle/entity/Entity.java | sed -n '650,710p'`
- `unzip -p references/bcu/BCU_java_util_common.zip .../battle/entity/Entity.java | sed -n '1768,1784p'`
- `unzip -p references/bcu/BCU_java_util_common.zip .../battle/attack/ContWaveAb.java`
- `unzip -p references/bcu/BCU_java_util_common.zip .../battle/attack/AttackWave.java`
- `unzip -p references/bcu/BCU_java_util_common.zip .../battle/attack/ContWaveDef.java`
- `unzip -p references/bcu/BCU_java_util_common.zip .../battle/attack/ContVolcano.java`
- `unzip -p references/bcu/BCU_Android-master.zip BCU_Android-master/app/src/main/java/com/mandarin/bcu/EffectList.kt`
- `rg -n "drawEff|smoke|drawEffects|globalThis\\.__BATTLE_EFFECT_RENDER_DEBUG__|lastModelDrawDebug|lastRenderDebug|lastHitEffectSpawnDebug|lastProjectileTraceSuppressedDebug|__BCU_PROJECTILE_TRACE_SUPPRESS_DEBUG__|__FORMATION_VDOM_DIFF_DEBUG__" js docs`
- `rg -n "BattleSceneAttackEffectPatch|BattleSceneRendererEffectGlowPatch|BattleSceneBcuStatusEffectRenderPatch|BattleProjectilePerformanceAndPositionPatch|FormationCatalogVirtualDomPatch|BattleDebugStripPatch" js/main.js js docs AGENTS.md`
- `rg -n "lastHitEffectSpawnDebug|lastProjectileTraceSuppressedDebug|__BCU_PROJECTILE_TRACE_SUPPRESS_DEBUG__|__BATTLE_HIT_EFFECT_SPAWN_DEBUG__|__BATTLE_EFFECT_RENDER_DEBUG__" js docs`

## Executable non-browser checks

No executable checks were run in this analysis-only pass. The repository root does not contain `package.json`, so there is no root npm script entry point. Candidate targeted checks exist under `scripts/` and should be run after any runtime edit if their asset requirements are satisfied:

- `node scripts/check-battle-tick-order.mjs`
- `node scripts/check-battle-renderer-projection.mjs`
- `node scripts/check-renderer-coordinate-paths.mjs`

## Validation limits

- Browser/manual gameplay validation was not performed and is out of scope for this shell-only pass.
- The reference ZIP inspection confirms behavior contracts around smoke, status effects, wave, and surge, but no runtime parity execution was performed.
- Current conclusion is code-review/static-analysis-only.

## AGENTS.md update decision

No `AGENTS.md` update is needed. The analysis did not discover new stable guardrails, forbidden patterns, reference-source rules, or workflow constraints. The existing instructions already cover the relevant constraints: preserve import order, avoid wrapper-chain refactoring, keep projectile constants and status/effect rendering behavior unchanged, and document optimization analysis before runtime edits.

## Rollback plan

If the selected runtime cleanup is implemented and causes any regression, revert only the small diagnostic cleanup in `js/battle/BattleProjectilePerformanceAndPositionPatch.js`. The rollback should restore the previous `lastProjectileTraceSuppressedDebug` and `globalThis.__BCU_PROJECTILE_TRACE_SUPPRESS_DEBUG__` assignments without changing wrapper order or projectile behavior.
