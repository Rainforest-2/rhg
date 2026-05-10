# AGENTS.md

## Project

This repository is a browser-based JavaScript battle preview / game implementation that is being migrated toward BCU-compatible stage, battle, rendering, animation, production, and catalog behavior.

Treat the current repository contents as the implementation target. Treat BCU common and BCU PC code only as reference implementations. Do not assume previous task reports are accurate unless the current repository code confirms them.

## Critical operating rules

1. Read the relevant source files before editing.
2. Do not infer behavior from filenames alone.
3. Do not rely on docs as proof of implementation. Verify code paths.
4. Do not perform broad rewrites when a narrow patch is sufficient.
5. Do not create a PR unless explicitly requested.
6. Do not delete, move, rename, or regenerate files under `public/assets/bcu/**`.
7. Do not add package dependencies unless explicitly requested.
8. Preserve browser ES module compatibility.
9. Preserve existing Node check scripts and extend them rather than creating many new scripts.
10. Keep the app bootable. If a change touches imports, exports, or entry boot code, add or update checks that catch missing exports.
11. When adding BCU parity behavior, preserve raw/source/debug fields so differences remain inspectable.
12. If BCU parity is not fully implemented, mark it as partial/no-op/skipped in code diagnostics and docs. Do not present partial behavior as complete.

## Primary reference files

Always read these first when relevant:

- `AGENTS.md`
- `docs/bcu-migration-status.md`
- `index.html`
- `js/main.js`
- `js/AppVersion.js`
- `scripts/check-battle-scene-stage-runtime-wiring.mjs`
- `scripts/check-bcu-stage-spawn-runtime.mjs`
- `scripts/check-stage-asset-tracing.mjs`

## Current implementation reality

A ZIP-based re-analysis found that this codebase already contains several BCU-oriented components, including:

- `js/battle/StageDefinitionLoader.js`
- `js/battle/BcuStageSpawnRuntime.js`
- `js/battle/BcuStageEnemyResolver.js`
- `js/battle/BattleSpawnResolver.js`
- `js/battle/BattleCamera.js`
- `js/battle/BcuCastleAssetLoader.js`
- `js/battle/StageBackgroundLoader.js`
- `js/battle/BattleAttackTimeline.js`
- `js/battle/DamageCalculator.js`
- `js/battle/DamageAbilityResolver.js`
- `js/battle/AbilityModel.js`
- `js/battle/BattleFrameClock.js`
- `js/battle/BcuKnockbackSpec.js`
- `js/battle/BcuKbeffRuntime.js`
- `js/battle/BcuKbeffLoader.js`

The same re-analysis found that several planned facade/runtime files are absent or incomplete in the latest ZIP and must not be assumed to exist:

- `js/battle/StageRuntime.js`
- `js/battle/ProcResolver.js`
- `js/battle/KBRuntime.js`
- `js/battle/EffectRuntime.js`
- `js/bcu/AnimationRuntime.js`
- `js/battle/ProductionRuntime.js`
- `js/battle/CharacterCatalogRuntime.js`

Before implementing a task, re-check whether these files now exist in the working tree. If they do, inspect the body and extend rather than duplicating.

## BCU reference priorities

When comparing with BCU, use these reference concepts:

### BCU common

Primary stage/spawn references:

- `util/stage/Stage.java`
- `util/stage/SCDef.java`
- `util/stage/EStage.java`
- `battle/StageBasis.java`

Primary stats/attack/proc references:

- `battle/data/DataUnit.java`
- `battle/data/DataEnemy.java`
- `battle/data/DataEntity.java`
- `battle/data/DataAtk.java`
- `battle/attack/*`
- `battle/entity/*`
- `util/unit/*`

Primary animation references:

- `util/anim/ImgCut.java`
- `util/anim/MaModel.java`
- `util/anim/MaAnim.java`
- `util/anim/EAnimD.java`
- `util/anim/EPart.java`

### BCU PC

Primary renderer/UI references:

- `src/main/java/page/battle/BattleBox.java`
- `src/main/java/jogl/GLBattleBox.java`
- `src/main/java/page/awt/BattleBoxDef.java`
- `src/main/java/page/info/StageViewPage.java`
- `src/main/java/page/info/edit/StageEditPage.java`
- `src/main/java/page/info/edit/StageEditTable.java`
- `src/main/java/page/view/BGViewPage.java`
- `src/main/java/page/view/CastleViewPage.java`
- `src/main/java/page/view/EffectViewPage.java`
- `src/main/java/page/anim/AnimBox.java`
- `src/main/java/page/basis/LineUpBox.java`

## Global test commands

After every task that touches runtime code, run:

```bash
node scripts/check-battle-scene-stage-runtime-wiring.mjs
node scripts/check-bcu-stage-spawn-runtime.mjs
node scripts/check-stage-asset-tracing.mjs
```

If a command cannot be run, report the exact reason and do not claim the task is complete.

## Browser manual checks

When a change affects boot, UI, rendering, camera, battle runtime, formation, or generated catalog, include a manual checklist. At minimum:

- App opens without blank screen.
- Browser console has no missing export/module import error.
- `?debugBattle=1` shows the relevant diagnostics.
- Existing stage/castle/background/spawn/camera/debug diagnostics still appear.
- Touch/wheel controls still work on mobile/tablet where relevant.

## Code style and architecture rules

### BattleScene

`BattleScene.js` is a monolith. Do not replace it wholesale. Prefer extracting helpers/facades and making minimal call-site changes.

Allowed `BattleScene.js` edits:

- Init order fixes.
- Stage runtime wiring.
- Spawn runtime call wiring.
- Tick phase wrapper fixes.
- Attack/damage/KB/effect facade connection.
- Production request debug wiring.

Forbidden `BattleScene.js` edits:

- Full rewrite.
- Combining render and simulation.
- Moving renderer logic into scene.
- Reintroducing config-driven enemy schedule as the default stage runtime path.

### Renderer

Renderers read state and draw. They must not advance battle state.

Forbidden in render path:

- Calling `tick()`.
- Calling `animator.tick()`.
- Calling `DamageCalculator.calculate()`.
- Calling `ProcResolver.resolve()`.
- Mutating `stageLen`, `actor.x`, `base.x`, `spawnWorldX`, or camera state.

### Coordinates

- Stage length, actor positions, base positions, spawn positions, combat bodies, and effects are world-space state.
- Canvas/UI/HUD positions are screen-space state.
- Camera transforms are the only bridge between world X and screen X.
- Zoom/pan must not mutate `stageLen`, `actor.x`, `base.x`, or `spawnWorldX`.

### Assets

- Treat `./public/assets/bcu/...` paths as candidate paths unless asset existence is explicitly verified.
- Do not remove a catalog entry only because a candidate asset is missing.
- Keep fallback reasons and candidate reports visible in debug diagnostics.

### BCU partial behavior

When adding a partial implementation, name it honestly:

- `debug-opt-in`
- `no-op-contract`
- `candidate-path`
- `raw-only-unverified`
- `partial-parity`
- `not-implemented`

Do not label partial behavior as complete BCU parity.

---

# Implementation roadmap

## Priority 0 — Boot Safety Task

### Purpose

Prevent blank screens caused by ES module import/export errors or failed startup. The app must show a visible boot error overlay instead of silently rendering a dark empty page.

### Change files

- `index.html`
- `js/main.js`
- `js/AppVersion.js`
- `scripts/check-battle-scene-stage-runtime-wiring.mjs`
- `docs/bcu-migration-status.md`

### Do not touch

- `public/assets/bcu/**`
- Battle runtime files unless an import/export mismatch is found.

### Required changes

1. Add a tiny inline boot-error overlay script in `index.html` before the module script.
2. Convert static boot imports in `js/main.js` to dynamic imports inside an async `boot()` function.
3. On boot failure, call `globalThis.__WAN_BOOT_ERROR__?.(error)` and rethrow.
4. Bump `GAME_VERSION` in `js/AppVersion.js`.
5. Add Node assertions for:
   - `index.html` contains `__WAN_BOOT_ERROR__` and `boot-error-panel`.
   - `js/main.js` uses dynamic imports.
   - `CharacterCatalog.js` exports expected names if relevant.
   - `PreviewApp.js` can be dynamically imported.
   - `BattleSceneStageRuntimeWiring.js` can be dynamically imported.

### Pseudocode

```js
async function boot() {
  try {
    await import('./battle/BattleSceneStageRuntimeWiring.js');
    const { PreviewApp } = await import('./preview/PreviewApp.js');
    await new PreviewApp().start();
  } catch (error) {
    console.error('[main] boot failed', error);
    globalThis.__WAN_BOOT_ERROR__?.(error);
    throw error;
  }
}

boot();
```

### Acceptance

- App never fails as a silent dark blank page for boot errors.
- Missing export/import errors are visible in the page.
- All global Node checks pass.

---

## Priority 1 — Task A: Stage CSV / StageRuntime / SpawnRuntime parity repair

This is the highest-priority gameplay task.

### Purpose

Make stage parsing and enemy spawning follow the BCU `Stage.java` / `SCDef.java` / `EStage.java` model more closely. Introduce a real `StageRuntime.js` so stage battle-time state is not hidden inside `BattleScene` objects.

### Change files

- `js/battle/StageDefinitionLoader.js`
- New: `js/battle/StageRuntime.js`
- `js/battle/BcuStageSpawnRuntime.js`
- `js/battle/BattleSpawnResolver.js`
- `js/battle/BattleScene.js` with minimal call-site edits only
- `js/battle/DebugBattleInspector.js`
- `scripts/check-bcu-stage-spawn-runtime.mjs`
- `scripts/check-battle-scene-stage-runtime-wiring.mjs`
- `docs/bcu-migration-status.md`

### Do not touch

- `BattleScene.js` outside init/spawn wiring unless necessary.
- Renderer/camera/damage/animation/production files.
- `public/assets/bcu/**`.

### BCU behavior to model

From BCU:

- Stage castle row contains castle and no-continue information.
- Header contains stage length, enemy base HP, min/max spawn, bg ID, max enemy count capped at 50, time limit.
- Enemy row maps to `SCDef.Line` indexes:
  - `E=0`
  - `N=1`
  - `S0=2`
  - `R0=3`
  - `R1=4`
  - `C0=5`
  - `L0=6`
  - `L1=7`
  - `B=8`
  - `M=9`
  - `S1=10`
  - `C1=11`
  - `G=12`
  - `M1=13`
  - `KC=14`
  - `SC=15`
- Enemy ID is `rawEnemyId - 2`.
- Spawn and respawn frame values are multiplied by 2.
- `M1` falls back to `M` when absent or zero.
- `C0 > 100 && M == 100` means magnification becomes `C0` and `C0` becomes `100`.
- `maxEnemyCount` must be capped to 50.
- `EStage` owns `num`, `rem`, `first`, `killCounter`-like runtime arrays.
- First spawn can use S0/S1 range.
- Respawn uses R0/R1 and adds one frame in strict BCU parity.
- Spawn requires health window, group/will allowance, rem condition, count not exhausted, kill counter zero.

### Required `StageRuntime.js`

Add a class or frozen object factory that holds:

```js
{
  source: 'StageRuntime',
  definition,
  stageLen,
  bgId,
  castleId,
  cannonId,
  noContinue,
  enemyBaseHp,
  maxEnemyCount,
  maxEnemyCountRaw,
  timeLimit,
  enemyRows,
  enemyBaseWorldX,
  playerBaseWorldX,
  enemyBaseFrontX,
  playerBaseFrontX,
  enemySpawnWorldX,
  playerSpawnWorldX,
  bossSpawnWorldX,
  killCounterByRowIndex,
  debug
}
```

### Required parser work

Do not add a large parser rewrite without tests. Refactor `StageDefinitionLoader.parse()` toward SCDef-indexed parsing, preserving existing returned fields.

Add source/debug fields for:

- `castleId`
- `cannonId`
- `noContinue`
- `bgId`
- `stageLen`
- `enemyBaseHp`
- `maxEnemyCountRaw`
- `maxEnemyCount`
- `timeLimit`
- per-row raw values and normalized SCDef fields

### Required spawn runtime work

Update `BcuStageSpawnRuntime` so it can use `StageRuntime` context.

Must support or expose as partial:

- finite count
- `count=0` infinite
- first spawn S0/S1 range
- respawn R0/R1 range
- optional strict respawn `+1`
- `baseHpTrigger` lower bound `C0`
- upper bound `C1` if present
- `bossFlag`
- `magnification`
- `attackMagnification`
- `killCounter`
- `group` hook
- `maxEnemyCount`
- retry on missing template / failed spawn
- spawn source debug

### Spawn world X rules

Preserve BCU-compatible defaults but make source explicit:

1. event `worldX`
2. event `spawnWorldX`
3. boss flag + `bossSpawnWorldX`
4. BCU enemy spawn `700`
5. enemy base front fallback
6. legacy fallback

Do not silently return `700` without source/debug.

### Acceptance

- `StageRuntime.js` exists and is used.
- `StageDefinitionLoader` exposes SCDef-indexed normalized rows.
- `maxEnemyCount` is capped at 50 while raw value is preserved.
- `BcuStageSpawnRuntime` is not hardwired to anonymous `700` without debug/source.
- `killCounter` and `group` are at least hookable and visible in debug.
- Stage definition -> runtime -> background/base/spawn order is visible in code/debug.
- Existing global Node checks pass.

---

## Priority 2 — Attack order fix

### Purpose

Ensure attack due-hit, target capture, damage resolve, and `markHitResolved` happen in the correct order.

### Change files

- `js/battle/BattleScene.js`
- `js/battle/BattleAttackTimeline.js`
- `js/battle/DebugBattleInspector.js`
- `scripts/check-battle-scene-stage-runtime-wiring.mjs`

### Required behavior

Correct order per hit:

1. Get due hit event.
2. Capture targets.
3. Queue/resolve damage attempt.
4. Apply damage result.
5. Then call `BattleAttackTimeline.markHitResolved(actor, key)`.

Do not mark a hit as resolved before damage attempt is processed.

### Acceptance

- Multi-hit events resolve independently by key/hitIndex.
- A failed/no-target damage attempt still gets a deliberate resolved/skipped debug record.
- Node check asserts `markHitResolved` occurs after damage attempt logic in the relevant flow.

---

## Priority 3 — ProcResolver no-op contract

### Purpose

Add a safe non-damage proc facade. This is not full BCU proc parity.

### Change files

- New: `js/battle/ProcResolver.js`
- `js/battle/AbilityModel.js`
- `js/battle/DamageCalculator.js`
- `js/battle/DebugBattleInspector.js`
- `scripts/check-battle-scene-stage-runtime-wiring.mjs`
- `docs/bcu-migration-status.md`

### Required behavior

`ProcResolver.resolve()` returns:

```js
{
  source: 'ProcResolver.v1-noop-contract',
  applied: [],
  pending: [],
  skipped: [],
  notes: [],
  debug: { eventRawAbi, abilityMappingStatus, semantic, candidates }
}
```

Classify, but do not apply:

- freeze
- slow
- weaken
- knockbackProc
- warp
- curse
- toxic
- wave
- miniWave
- surge
- miniSurge
- barrierBreaker
- shieldPierce
- zombieKiller
- soulstrike

### Forbidden

- Do not mutate target state.
- Do not reduce HP.
- Do not spawn wave/surge effects.
- Do not perform status effects.

### Acceptance

- `DamageCalculator.calculate()` includes a `proc` result.
- Raw ABI remains `raw-only-unverified` unless explicitly mapped.
- Debug inspector shows proc skipped/not implemented status.

---

## Priority 4 — KBRuntime / EffectRuntime facade task

### Purpose

Make KB/death/effect lifecycle inspectable without moving all existing logic out of `BattleActor` and `BattleScene` in one pass.

### Change files

- New: `js/battle/KBRuntime.js`
- New: `js/battle/EffectRuntime.js`
- `js/battle/BattleActor.js`
- `js/battle/BattleEffect.js`
- `js/battle/BattleScene.js` minimal connection only
- `js/battle/DebugBattleInspector.js`
- `scripts/check-battle-scene-stage-runtime-wiring.mjs`

### KBRuntime responsibilities

- Describe actor KB/death state.
- Safely call existing `actor.resolvePostDamage()`.
- Safely call existing `actor.startKnockback()`.
- Safely call existing `actor.stepKnockbackFrame()`.
- Determine cleanup via existing actor methods.

### EffectRuntime responsibilities

- Create world-coordinate hit effects.
- Tick effects.
- Cleanup finished effects.
- Describe active/finished effects.
- Keep wave/surge unsupported catalog as `implemented:false`.

### Acceptance

- Existing KB behavior is not rewritten.
- Effects store world coordinates and source/debug.
- Debug inspector shows `kbRuntime` and `effectRuntime`.
- Node checks verify no renderer/camera import in these runtimes.

---

## Priority 5 — AnimationRuntime facade task

### Purpose

Add debug/contract facade over `BcuAnimator` and `BcuModelInstance` without changing parser schema or renderer responsibilities.

### Change files

- New: `js/bcu/AnimationRuntime.js`
- `js/bcu/BcuAnimator.js`
- `js/bcu/BcuModelInstance.js`
- `js/battle/BattleActor.js`
- `js/battle/DebugBattleInspector.js`
- `scripts/check-battle-scene-stage-runtime-wiring.mjs`

### Required behavior

- `AnimationRuntime.tickActor(actor, dtMs)` advances animation only through actor animator.
- `AnimationRuntime.applyActorModel(actor)` applies tracks and records debug.
- `AnimationRuntime.buildActorDrawList(actor)` builds draw list summary.
- Renderer must not call `animator.tick()` or `model.reset()`.

### Forbidden

- Do not decide attack hit timing from animation frame.
- Do not mutate combat body based on visual draw list automatically.
- Do not import renderer/camera/damage/attack timeline into `AnimationRuntime`.

---

## Priority 6 — ProductionRuntime task

### Purpose

Define production/economy/UI contract without implementing full BCU wallet/worker parity yet.

### Change files

- New: `js/battle/ProductionRuntime.js`
- `js/battle/BattleEconomy.js`
- `js/battle/BattleScene.js` minimal request debug only
- `js/ui/PlayerProductionBar.js`
- `js/battle/DebugBattleInspector.js`
- `scripts/check-battle-scene-stage-runtime-wiring.mjs`

### Required behavior

- UI reads status and sends requests only.
- UI must not call `economy.tick()` or `economy.produce()`.
- `BattleEconomy.produce()` must keep boolean return compatibility.
- `ProductionRuntime` must not spawn actors.
- Cost/cooldown source debug must be preserved.

### Acceptance

- Debug inspector shows economy, roster status, cooldowns, formation summary.
- Node checks confirm UI-only contract.

---

## Priority 7 — CharacterCatalogRuntime and generated roster task

### Purpose

Add bounded generated playable roster support and make it selectable in FormationEditor.

### Change files

- New: `js/battle/CharacterCatalogRuntime.js`
- `js/battle/PlayableCharacterRegistry.js`
- `js/battle/CharacterCatalog.js`
- `js/data/previewAssets.js`
- `js/ui/FormationEditor.js`
- `css/style.css`
- `js/battle/DebugBattleInspector.js`
- `scripts/check-battle-scene-stage-runtime-wiring.mjs`

### Required behavior

- Keep manual specs unchanged.
- Add generated dog/cat specs only in bounded range, initially 13–30.
- Do not assert candidate assets exist.
- Add catalog summary and validation API.
- Add FormationEditor search and generated/manual filter.
- Ensure generated IDs can be saved into 2x5 formation.
- Ensure generated IDs can become production lineup entries.

### Required examples

These must exist and be selectable if generated range is enabled:

- `dog-enemy-013`
- `dog-enemy-030`
- `cat-unit-013-f`
- `cat-unit-030-f`

### Acceptance

- `getCharacterById('cat-unit-013-f')` returns a generated character.
- `FormationStore.sanitize()` preserves generated IDs.
- `buildProductionLineupEntryFromCharacter()` supports generated characters.
- FormationEditor displays generated cards with ID and badge.

---

## Priority 8 — Castle / background resolver split task

### Purpose

Split resolver responsibility from loader responsibility and preserve fallback diagnostics.

### Change files

- New or existing: `js/battle/CastleAssetResolver.js`
- `js/battle/BcuCastleAssetLoader.js`
- New or existing: `js/battle/StageBackgroundResolver.js`
- `js/battle/StageBackgroundLoader.js`
- `js/battle/DebugBattleInspector.js`
- `scripts/check-stage-asset-tracing.mjs`

### Acceptance

- Castle resolver tests cover `rc`, `ec`, `wc`, `sc`, invalid, and out-of-range fallback.
- Background resolver tests cover valid bg ID, invalid bg ID, image/imgcut/csv candidates.
- Debug inspector shows requested/resolved/fallback/candidateReport.

---

## Priority 9 — Camera/background renderer parity task

### Purpose

Keep current camera contract, but make background movement/projection explicit and testable.

### Change files

- `js/battle/BattleCamera.js`
- `js/battle/BattleSceneRenderer.js`
- `js/preview/BattleCameraInputController.js`
- `js/battle/DebugBattleInspector.js`
- `scripts/check-battle-scene-stage-runtime-wiring.mjs`

### Acceptance

- Background, actor, base, and effect projection use the same camera source or explicitly documented background transform.
- `stageLen` remains immutable during zoom/pan.
- Renderer never mutates camera or runtime state.

---

## Priority 10 — Economy BCU parity task

### Purpose

After `ProductionRuntime` exists, implement or explicitly model gaps for BCU wallet/worker/max deploy/will.

### References

- BCU `StageBasis` money/work level/update logic.
- BCU lineup/production UI in PC code.

### Acceptance

- Worker/wallet state is represented or explicitly marked partial.
- Max deploy/will gap is visible in debug.
- Current simple economy remains stable if full parity is deferred.

---

# Required reporting format for every Codex run

After each implementation, report:

- Files changed.
- New files added.
- Functions/classes changed.
- Whether `BattleScene.js` was touched.
- Whether any public asset path was touched.
- Assertions added.
- Commands run and results.
- What is complete.
- What remains partial/unverified.
- Browser manual checks still needed.
- Suggested next task.

# Definition of done

A task is complete only when:

1. Relevant code exists.
2. Callers and callees are connected.
3. Debug/status/check coverage exists.
4. Existing checks pass.
5. Docs are updated honestly.
6. Browser manual checks are listed if not performed.

A task is partial when:

- It is a facade only.
- It is no-op/skipped/candidate-path behavior.
- It lacks full BCU parity.
- It has not been browser-tested.

A task is not complete when:

- Docs claim completion but code is missing.
- An expected export is absent.
- UI cannot select/apply the new data.
- Runtime values are not passed through.
- Fallbacks are silent.
- The browser can boot to a blank screen without visible error.

# First task to run

Run Priority 0 first if blank-screen safety is not already implemented.

Otherwise run Priority 1:

`Task A: Stage CSV / StageRuntime / SpawnRuntime parity repair`

This task is first because stage parsing, runtime state, castle/bg/stageLen flow, spawn timing, base-front spawn position, and BCU CSV row interpretation are the foundation for every later battle behavior.
