# Claude Review Prompt

You are the reviewer for this repository.

Do not edit code, documentation, tests, workflows, or generated files directly. Read the previous Codex output, verification results, git status, git diff, `.ai/state.md`, and the relevant repository context, then identify the next smallest implementation task for Codex.

Focus on concrete, actionable defects. Prefer one narrow fix that can be implemented and verified in the next Codex pass. Do not ask for broad rewrites, speculative refactors, style-only churn, or unrelated cleanup.

Passing verification is not enough to stop the loop. Every round must include fresh audit work. Prioritize unaudited production code areas listed in `.ai/state.md` over re-reviewing the previous Codex patch, while still checking the previous patch for regressions.

When auditing UI-facing code, include a product-quality review, not only a correctness review. Check whether the interface is clear, dense enough for repeated use, visually consistent with the existing app, responsive across practical viewport sizes, and free of overlapping, clipped, misleading, or awkward text. If the next task is UI work, ask Codex for a small, concrete refinement that improves the actual usable screen, not a decorative redesign.

When you choose the next task, include any required `.ai/state.md` bookkeeping in that task so Codex records:
- the production area audited this round,
- the remaining unaudited major areas,
- any unresolved uncertainty.

Keep uncertainty visible. If a behavior, asset rule, data source, or UI acceptance claim cannot be proven from the inspected evidence, record it as unresolved instead of converting it into a silent fallback or an unverified parity claim.

The `Critical` and `High` sections must contain only actionable blockers. If there are none, write exactly `None`.

Use severities consistently:
- `Critical`: a confirmed defect that can break core runtime behavior, data integrity, loading, or verification in normal use.
- `High`: a confirmed defect that blocks convergence, hides failures, or creates a likely user-visible regression.
- `Medium`: a concrete defect or hazardous inconsistency that is scoped and fixable, but not currently blocking.
- `Low`: observations, cleanup candidates, and parity questions that should be recorded but not drive this round unless no stronger task exists.

The loop may stop only when all of these are true:
- at least 5 Claude -> Codex -> verification rounds have completed,
- `Critical` is exactly `None`,
- `High` is exactly `None`,
- `.ai/state.md` has no actionable entries under `## Unaudited Major Areas`,
- the latest verification passed.

Your output must use exactly this structure:

# Review
## Critical
## High
## Medium
## Low
## Next Codex Task
## Verification Commands
## Stop Condition


# Runtime Context
Round: 2 of 10
Repository: /workspaces/rhg

## Current AI State
# Current Status

## Discovered Issues
- No critical issues recorded yet.
- Fixed `js/input/BcuBattleInputAdapter.js` inherited-property action lookup: `in` treated `Object.prototype` names such as `toString` as known actions instead of falling through to slot index/null behavior.
- Fixed `js/audio/BattleSoundEventPatch.js` `throttle()` time source so the `performance` global is only referenced when defined, matching `AudioEngine._now()` fallback behavior.
- Fixed `js/boot/installBattlePatches.js` `runDirectImports` error recording so direct import failures append to a guaranteed boot error array before progress advances.
- Audited `js/bcu-render`; the chain is orphaned (no importer of `BcuEntityEffectIconRuntime.js`) and its class name collides with the live inline `BcuEntityEffectIconRuntime` in `BcuStatusEffectManager.js`. Recorded as a decision item; no code removed.
- Audited `js/preview` + `js/data`; found `js/data/bcuAvailableEnemyAssets.js` orphaned (no importer of `hasBcuEnemyAsset`/`BCU_AVAILABLE_ENEMY_IDS`) and it hardcodes enemy ids 0..299 as 'available', a fabricated availability index if ever wired in. Recorded as a decision item; no code removed.
- Fixed `js/ui/AppLoadingOverlay.js` so `show()` resets `lastProgressValue` and the visible progress bar, preventing the reused overlay's progress bar from sticking at 100% on every battle load after the first.

## Current Task
- Fix the reused `AppLoadingOverlay` progress reset, add focused coverage, and record partial `js/ui` audit bookkeeping.

## Audited Areas
- `.ai/orchestrator.sh` verification command ordering and per-round logging behavior.
- `.ai` loop README wording for round log persistence.
- `js/input` — `BcuBattleInputAdapter.js` action mapping own-property fix with focused test coverage, plus read-through of `BcuDomTouchPolicy.js` and `BcuMobileGestureRuntime.js`.
- `js/audio` — read-through of `AudioEngine.js`, `MusicCatalog.js`, `AudioSettings.js`, `BattleSoundEffects.js`, `BattleSoundEventPatch.js`, `StageMusicResolver.js`; applied the `throttle()` `performance`-global guard fix.
- `js/boot` — read-through of `importProgress.js`, `installBattlePatches.js` (applied the `runDirectImports` defensive error-record fix), `installBcuPatches.js`, `installUiPatches.js`, and the `battle/install*Patches.js` shims + `groups/*` manifest imports; confirmed `installBcuBattleDataRegistries` passes the correct provider option key to each registry loader.
- `js/bcu-render` — full read-through of `BcuBlendRuntime.js`, `BcuEPartTransformRuntime.js`, `BcuEffAnimRuntime.js`, `BcuFakeGraphicsCanvas2D.js`. Verified the whole `js/bcu-render` chain is currently orphaned: its only battle bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` has zero importers, and the live status-icon runtime is the same-named inline class in `js/battle/bcu-runtime/BcuStatusEffectManager.js`. Also read the live status/render path (`BcuStatusEffectManager.js`, `BcuModelInstance.js`, `BcuSpriteSheet.js`, `BcuCanvasComposite.js`, `BcuStatusIconResolver.js`) and `StageRegistry.js` and found them consistent; confirmed the previous round's `installBattlePatches.js` `runDirectImports` fix has no regression.
- `js/preview` — full read-through of all 10 files (`PreviewApp.js`, `PreviewRenderer.js`, `PreviewUi.js`, `BattleSimulationClock.js`, `BattleCameraInputController.js`, `PreviewAppBattleMusicPatch.js`, `PreviewAppBattlePauseOverlayPatch.js`, `PreviewAppBattleResultOverlayPatch.js`, `PreviewAppCustomStageBattleConfigPatch.js`, `PreviewAppPageTransitionPatch.js`); found consistent. No runtime defect; the boss-music-start `<=` threshold default is recorded as a parity question below.
- `js/data` — full read-through of all 3 files (`bcuStageManifest.js`, `previewAssets.js`, `bcuAvailableEnemyAssets.js`). Confirmed `bcuStageManifest` (via `StageRegistry`) and `previewAssets` (via `BattleScene`/`BattleActorFactory`/`PreviewApp`/`DebugBattleInspector`) are imported by live code, and `bcuAvailableEnemyAssets.js` has zero importers across `js/`, `scripts/`, and `tests/` (orphaned).
- `js/ui` (partial) — read-through of `AppLoadingOverlay.js` (applied the `show()` progress-reset fix + new test), `BattleSpeedControl.js`, `BattlePauseMenu.js`, `SoundToggleControls.js`, `PlayerProductionBar.js`, `FormationStageDifficultyFilterControlPatch.js`, `BattleTouchGuard.js`.

## Unaudited Major Areas
- `js/battle`
- `js/bcu`
- `js/ui` (partial — loading-overlay/battle-HUD subset audited round-6; ~30 files remain: FormationEditor*, ProductionCardSkin, BcuStageCatalogBuilder, Nyanko*/Formation* patches, *Verifier files, etc.)
- `scripts`
- `tests`

## Unresolved
- `js/input/BcuMobileGestureRuntime.js` slide angle/threshold and up/down direction (`TAN_50`, `height * 0.15`, `dy / dragFrame < 0`) have not been confirmed against BCU touch source; audit in a later round before claiming BCU parity.
- `js/audio/StageMusicResolver.js` `parseStageMusicFromRows` indexes `rows[2 + stageIndex]` after `parseMsdRows` drops fully-non-numeric lines; confirm the MapStageData map-pattern line (row 1) always carries a finite number so filtering can never shift the stage-row index.
- `js/audio/BattleSoundEventPatch.js` `damageQueued` throttled-critical fall-through can play `HIT_0` after a throttled critical/strong-attack SE; confirm whether this rhg flood-guard behavior should stay or be changed for BCU parity.
- `js/bcu-render` chain (`BcuBlendRuntime`/`BcuEPartTransformRuntime`/`BcuEffAnimRuntime`/`BcuFakeGraphicsCanvas2D`) + the dead bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` are orphaned and duplicate the live `BcuEntityEffectIconRuntime` class name; decide whether to remove the dead scaffold or wire it in, with evidence, before claiming `js/bcu-render` clean. Keep the existing `isBcuBlendGlow` glow-value uncertainty (`glow === 1 | 2 | 3 | -1` unconfirmed vs BCU `EPart`/glow source).
- `BcuEffAnimRuntime.done()` and the inline `BcuEntityEffectIconRuntime.isDone()` never set `finished = true`; this appears intentional (status icons removed by expiry, not anim-loop completion) but is unconfirmed against BCU and currently has no consumer.
- `js/data/bcuAvailableEnemyAssets.js` is orphaned (zero importers in `js/`/`scripts/`/`tests/`) and `hasBcuEnemyAsset` asserts enemy ids 0..299 are "available" without consulting real semantic ZIP asset presence; decide whether to remove the dead module or, if a consumer is intended, replace the hardcoded `0..299` set with a real asset-presence check -- without fabricating a BCU asset index -- before claiming `js/data` clean.
- `js/preview/PreviewAppBattleMusicPatch.js` `startBattleMusic`/`updateBattleMusic` use `pct <= threshold` with a default threshold of 100 (from `StageMusicResolver` when `bossHpThresholdPercent` is non-finite), so a stage with a distinct boss-music id and no explicit threshold begins battle directly on boss music; confirm against BCU MapStageData `mush` semantics whether boss music should start immediately at 100% or only strictly below threshold before changing this.
- `js/ui/FormationStageDifficultyFilterControlPatch.js` `isFiltering` is always true because `filterState` coerces `star` through `normalizeCrownStar` to a finite value, so the stage-map list is always crown-star-filtered (default ★1) even with an empty query; confirm against intended BCU crown-difficulty default before treating as a defect.
- `js/ui/BattleLoadingProgressVerifier.js` is orphaned (no importer) and only does static source-string checks; decide whether to wire it into the safe-suite or remove it.

## Completed
- Created AI management directory and core files.
- Added workflow scaffolding for the development loop.
- Documented usage in the repository README.

## Remaining
- Continue Claude -> Codex -> verification rounds until the minimum round count, priority blocker, unaudited major area, and verification stop conditions are all satisfied.


## Current Git Snapshot
# Round 2 Git Snapshot
Date: 2026-07-01T17:24:39Z

## git status --short --untracked-files=no
[Limited to 200 lines; untracked files omitted.]
 M .ai/changelog.md
 M .ai/prompts/claude-review.md
 M .ai/review.md
 M .ai/state.md
 M js/audio/BattleSoundEventPatch.js
 M js/boot/installBattlePatches.js
 M js/ui/AppLoadingOverlay.js

## git diff --name-status
[Limited to 20 files; .ai/logs and node_modules omitted.]
M	.ai/changelog.md
M	.ai/prompts/claude-review.md
M	.ai/review.md
M	.ai/state.md
M	js/audio/BattleSoundEventPatch.js
M	js/boot/installBattlePatches.js
M	js/ui/AppLoadingOverlay.js


## Current git diff
[Excerpt: current git diff for configured project paths, excluding .ai/logs and node_modules, limited to 20 files and 12000 bytes per file; total budget 60000 bytes.]

### .ai/changelog.md
diff --git a/.ai/changelog.md b/.ai/changelog.md
index 8377b36c4..fc80d6e32 100644
--- a/.ai/changelog.md
+++ b/.ai/changelog.md
@@ -5,6 +5,7 @@
 - Record each meaningful change with context and verification notes.
 
 ## 2026-06-30
+- Recorded the round-4 `js/preview` + `js/data` audit in `.ai/state.md`, including the orphaned `bcuAvailableEnemyAssets.js` decision item and boss-music threshold parity question; no runtime code changed. Verification passed: orphan grep matched only `js/data/bcuAvailableEnemyAssets.js`, `node --check js/data/bcuAvailableEnemyAssets.js`, `npm run check`, `npm test` (51/51), and `npm run build`.
 - Added `npm run check` as the first orchestrator verification gate when the script exists.
 - Updated README and manual loop verification command lists to include `npm run check`.
 - Verification: `bash -n .ai/orchestrator.sh` passed; `npm run check` passed (`check-bcu-ability-parity-safe-suite: OK`); `npm test` passed (47/47); `grep -n "npm run check" .ai/orchestrator.sh README.md .ai/RUN_MANUALLY.md` confirmed all three references.
@@ -12,6 +13,7 @@
 ## Round 1 Codex Output
 - Corrected README round-log wording to state logs are saved every round; verification passed: corrected wording present, old phrasing absent, `npm run check`, `npm test` (47/47), and `npm run build`.
 - Fixed `BcuBattleInputAdapter` action lookup to require own string keys, added inherited-name/slot fallback tests, and updated `.ai/state.md` for the `js/input` audit. Verification passed: `node --check js/input/BcuBattleInputAdapter.js`, `node --check tests/bcu-battle-input-adapter.test.mjs`, `node --test tests/bcu-battle-input-adapter.test.mjs` (4/4), `npm run check`, and `npm test` (51/51).
+- Fixed `BattleSoundEventPatch` `throttle()` to guard the `performance` global before using `performance.now`, and updated `.ai/state.md` for the `js/audio` audit. Verification passed: `node --check js/audio/BattleSoundEventPatch.js`, `node scripts/check-battle-music-and-zombie-killer.mjs`, and `node scripts/check-bcu-battle-sound-effects-parity.mjs`.
 
 ## Round 1 Codex Output
 - Date: 2026-06-30T14:17:32Z
@@ -4556,3 +4558,65323 @@ tokens used
 
 No commit or push performed. `git status --short` hung in this environment, so I stopped that process; targeted diff/name checks confirmed the scoped changed files plus the new test.
 
+
+## Round 1 Codex Output
+- Date: 2026-06-30T23:21:57Z
+- Log: /workspaces/rhg/.ai/logs/round-1-codex.log
+
+Reading additional input from stdin...
+2026-06-30T23:19:11.660130Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/codespace/.codex/shell_snapshots/019f1ad4-5461-7393-a370-8b24b59638dc.tmp-1782861551093521148: line 2547: syntax error near unexpected token `('
+
+OpenAI Codex v0.142.4
+--------
+workdir: /workspaces/rhg
+model: gpt-5.5
+provider: openai
+approval: never
+sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
+reasoning effort: high
+reasoning summaries: none
+session id: 019f1ad4-5461-7393-a370-8b24b59638dc
+--------
+user
+Read the complete implementation task from standard input. Follow it exactly.
+
+<stdin>
+# Codex Fix Prompt
+
+You are the implementation owner for this repository.
+
+Implement only the `Next Codex Task` from `.ai/review.md`. Do not implement other review findings unless they are strictly required to complete that task.
+
+Constraints:
+- Do not make huge changes.
+- Do not make unrequested specification changes.
+- Preserve existing runtime behavior unless the task explicitly requires changing it.
+- If facts are missing or the requested behavior cannot be proven, record the uncertainty in `.ai/state.md` under an `Unresolved` heading.
+- Update `.ai/state.md` when the `Next Codex Task` includes audit bookkeeping. Keep `## Audited Areas` and `## Unaudited Major Areas` current; remove an unaudited area only after it was actually inspected.
+- Add or update focused tests when the change needs test coverage.
+- Append a concise summary of your changes and verification notes to `.ai/changelog.md`.
+- Do not commit.
+- Do not push.
+
+Before finishing, run the verification commands that are relevant to the files you changed when they are available in this environment.
+
+
+# Runtime Context
+Round: 1 of 10
+Repository: /workspaces/rhg
+
+## Claude Review
+I've completed a thorough fresh audit of the `js/audio` area (and parts of `js/preview`). Here is my review.
+
+# Review
+
+## Critical
+None
+
+## High
+None
+
+## Medium
+- **`js/audio/BattleSoundEventPatch.js:39` — `throttle()` uses an unguarded `performance` global reference.** The line is:
+  ```js
+  const now = Number(scene?.timeMs ?? performance.now?.() ?? Date.now());
+  ```
+  Optional chaining (`performance.now?.()`) only guards the *property access* `.now`; it does **not** guard the base binding `performance`. If `scene.timeMs` is nullish (e.g. a scene mock, SSR, or a frame before `timeMs` is assigned) **and** `performance` is not a defined global, evaluating `performance` throws a `ReferenceError` rather than falling through to `Date.now()`. Because `throttle()` runs inside the `pushEvent` override (`playForEvent` → `pushEvent`), an uncaught throw there breaks event dispatch for the whole battle. The sibling module already does this correctly: `AudioEngine._now()` uses `(typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()`. This is a one-line consistency/robustness fix, isolated and easy to verify. (Note: in current Node and browsers `performance` is defined, so this is latent rather than actively firing today — hence Medium, not High.)
+
+## Low
+- **`js/audio/BattleSoundEventPatch.js:50-56` — `oncePerFrame()` degenerate fallback.** When both `scene.logicFrame` and `scene.timeMs` are undefined, `frame` is `0` on every call, so each keyed SE fires exactly once for the entire battle instead of once per frame. Only affects a scene missing both fields; record as an observation, not a required fix this round.
+- **`js/audio/BattleSoundEventPatch.js:211-215` — `damageQueued` throttled-critical fall-through.** A critical/strong-attack hit that is throttled (returns `false` inside the `&&`) falls through to the `else if` chain and can play the normal `HIT_0` SE instead of staying silent. BCU plays only the crit/SATK SE for such a hit. Plausibly intentional (avoids silence under the rhg-side flood guard), but worth recording as a parity question for a later round.
+
+## Next Codex Task
+Make exactly one production change plus state bookkeeping:
+
+1. In `js/audio/BattleSoundEventPatch.js`, fix the `throttle()` time source so the `performance` global is guarded the same way `AudioEngine._now()` does. Replace:
+   ```js
+   const now = Number(scene?.timeMs ?? performance.now?.() ?? Date.now());
+   ```
+   with a form that never references `performance` unless it is defined, e.g.:
+   ```js
+   const now = Number(scene?.timeMs ?? ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()));
+   ```
+   Do not change `oncePerFrame`, the `damageQueued` chain, or any SE-id mappings — those are recorded as observations only, not this round's fix.
+
+2. Update `.ai/state.md`:
+   - **Audited Areas**: add `js/audio` — read-through of `AudioEngine.js`, `MusicCatalog.js`, `AudioSettings.js`, `BattleSoundEffects.js`, `BattleSoundEventPatch.js`, `StageMusicResolver.js`; applied the `throttle()` `performance`-global guard fix.
+   - **Unaudited Major Areas**: remove `js/audio`, leaving `js/battle`, `js/bcu`, `js/bcu-render`, `js/boot`, `js/data`, `js/preview`, `js/ui`, `scripts`, `tests`.
+   - **Discovered Issues / Current Task**: record the `BattleSoundEventPatch.js` `throttle()` guard fix.
+   - **Unresolved**: add two items for later rounds — (a) `StageMusicResolver.parseStageMusicFromRows` indexes `rows[2 + stageIndex]` after `parseMsdRows` drops fully-non-numeric lines; confirm the MapStageData map-pattern line (row 1) always carries a finite number so filtering can never shift the stage-row index; (b) the `damageQueued` throttled-critical fall-through to `HIT_0` parity question.
+
+## Verification Commands
+- `node --check js/audio/BattleSoundEventPatch.js`
+- `node scripts/check-battle-music-and-zombie-killer.mjs`
+- `node scripts/check-bcu-battle-sound-effects-parity.mjs`
+
+## Stop Condition
+Do not stop. This is round 1 of at least 5; `## Unaudited Major Areas` still lists nine areas, and no verification has run yet for this round. Continue the loop.
+
+
+## Latest Verification Output
+[Excerpt: tail 30000 bytes of 32347 total bytes.]
+s/check-bcu-delay-runtime.mjs
+
+$ node --check scripts/check-bcu-stage-line-row-parity.mjs
+
+$ node --check scripts/check-bcu-wallet-runtime-parity.mjs
+
+$ node --check scripts/check-bcu-wave-invalid-parity.mjs
+
+$ node --check scripts/check-bcu-wave-on-barrier-shield-block-parity.mjs
+
+$ node --check scripts/check-bcu-unit-level-runtime-parity.mjs
+
+$ node --check scripts/check-bcu-barrier-shield-effect-parity.mjs
+
+$ node --check scripts/check-bcu-burrow-lifecycle-parity.mjs
+
+$ node --check scripts/check-bcu-castle-guard-parity.mjs
+
+$ node --check scripts/check-bcu-spirit-bundle-manifest-parity.mjs
+
+$ node --check scripts/check-bcu-spirit-lifecycle-parity.mjs
+
+$ node --check scripts/check-bcu-spirit-cooldown-emphasize-parity.mjs
+
+$ node --check scripts/check-bcu-summon-runtime-parity.mjs
+
+$ node --check scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs
+
+$ node --check scripts/check-bcu-demon-shield-regen-timing.mjs
+
+$ node --check scripts/check-projectile-damage-parity.mjs
+
+$ node --check scripts/check-proc-immunity-resistance-parity.mjs
+
+$ node --check scripts/check-bcu-toxic-effect-parity.mjs
+
+$ node --check scripts/check-effect-bundle-aliases.mjs
+
+$ node --check scripts/check-effect-coordinate-traces.mjs
+
+$ node --check scripts/check-bcu-death-animation-parity.mjs
+
+$ node --check scripts/check-bcu-warp-lifecycle-parity.mjs
+
+$ node --check scripts/check-bcu-warp-interrupt-scene-parity.mjs
+
+$ node --check scripts/check-bcu-combo-proc-duration-parity.mjs
+
+$ node --check scripts/check-bcu-combo-speed-crit-parity.mjs
+
+$ node --check scripts/check-ability-partial-blockers.mjs
+
+$ node --check scripts/check-bcu-wave-surge-point-capture-parity.mjs
+
+$ node --check scripts/check-bcu-metal-abi-double-apply.mjs
+
+$ node --check scripts/check-actor-render-bounds-guard.mjs
+
+$ node --check scripts/check-battle-runtime-lightweight-guards.mjs
+
+$ node scripts/check-bcu-stage-difficulty-parity.mjs
+check-bcu-stage-difficulty-parity: OK
+
+$ node scripts/check-production-card-icon-source-parity.mjs
+check-production-card-icon-source-parity: OK
+
+$ node scripts/check-bcu-parser-indexes.mjs
+check-bcu-parser-indexes: OK
+
+$ node scripts/check-bcu-delay-runtime.mjs
+check-bcu-delay-runtime: OK
+
+$ node scripts/check-bcu-stage-line-row-parity.mjs
+check-bcu-stage-line-row-parity: OK
+
+$ node scripts/check-bcu-wallet-runtime-parity.mjs
+check-bcu-wallet-runtime-parity: OK
+
+$ node scripts/check-bcu-wave-invalid-parity.mjs
+check-bcu-wave-invalid-parity: OK
+
+$ node scripts/check-bcu-wave-on-barrier-shield-block-parity.mjs
+check-bcu-wave-on-barrier-shield-block-parity: OK
+
+$ node scripts/check-bcu-unit-level-runtime-parity.mjs
+check-bcu-unit-level-runtime-parity: OK
+
+$ node scripts/check-bcu-barrier-shield-effect-parity.mjs
+check-bcu-barrier-shield-effect-parity: OK
+
+$ node scripts/check-bcu-burrow-lifecycle-parity.mjs
+check-bcu-burrow-lifecycle-parity: OK
+
+$ node scripts/check-bcu-castle-guard-parity.mjs
+check-bcu-castle-guard-parity: OK
+
+$ node scripts/check-bcu-spirit-bundle-manifest-parity.mjs
+check-bcu-spirit-bundle-manifest-parity: OK spirits=21
+
+$ node scripts/check-bcu-spirit-lifecycle-parity.mjs
+check-bcu-spirit-lifecycle-parity: OK
+
+$ node scripts/check-bcu-summon-runtime-parity.mjs
+che

### .ai/prompts/claude-review.md
diff --git a/.ai/prompts/claude-review.md b/.ai/prompts/claude-review.md
index 1e5562b1e..7f49fc168 100644
--- a/.ai/prompts/claude-review.md
+++ b/.ai/prompts/claude-review.md
@@ -2,19 +2,29 @@
 
 You are the reviewer for this repository.
 
-Do not edit code, documentation, tests, workflows, or generated files directly. Read the previous Codex output, verification results, git status, git diff, `.ai/state.md`, and repository context, then identify the next smallest implementation task for Codex.
+Do not edit code, documentation, tests, workflows, or generated files directly. Read the previous Codex output, verification results, git status, git diff, `.ai/state.md`, and the relevant repository context, then identify the next smallest implementation task for Codex.
 
-Focus on concrete, actionable defects. Prefer one narrow fix that can be implemented and verified in the next Codex pass. Do not ask for broad rewrites, speculative refactors, or unrelated cleanup.
+Focus on concrete, actionable defects. Prefer one narrow fix that can be implemented and verified in the next Codex pass. Do not ask for broad rewrites, speculative refactors, style-only churn, or unrelated cleanup.
 
 Passing verification is not enough to stop the loop. Every round must include fresh audit work. Prioritize unaudited production code areas listed in `.ai/state.md` over re-reviewing the previous Codex patch, while still checking the previous patch for regressions.
 
+When auditing UI-facing code, include a product-quality review, not only a correctness review. Check whether the interface is clear, dense enough for repeated use, visually consistent with the existing app, responsive across practical viewport sizes, and free of overlapping, clipped, misleading, or awkward text. If the next task is UI work, ask Codex for a small, concrete refinement that improves the actual usable screen, not a decorative redesign.
+
 When you choose the next task, include any required `.ai/state.md` bookkeeping in that task so Codex records:
 - the production area audited this round,
 - the remaining unaudited major areas,
 - any unresolved uncertainty.
 
+Keep uncertainty visible. If a behavior, asset rule, data source, or UI acceptance claim cannot be proven from the inspected evidence, record it as unresolved instead of converting it into a silent fallback or an unverified parity claim.
+
 The `Critical` and `High` sections must contain only actionable blockers. If there are none, write exactly `None`.
 
+Use severities consistently:
+- `Critical`: a confirmed defect that can break core runtime behavior, data integrity, loading, or verification in normal use.
+- `High`: a confirmed defect that blocks convergence, hides failures, or creates a likely user-visible regression.
+- `Medium`: a concrete defect or hazardous inconsistency that is scoped and fixable, but not currently blocking.
+- `Low`: observations, cleanup candidates, and parity questions that should be recorded but not drive this round unless no stronger task exists.
+
 The loop may stop only when all of these are true:
 - at least 5 Claude -> Codex -> verification rounds have completed,
 - `Critical` is exactly `None`,


### .ai/review.md
diff --git a/.ai/review.md b/.ai/review.md
index 6add6d0c0..aaf48195a 100644
--- a/.ai/review.md
+++ b/.ai/review.md
@@ -1,4 +1,6 @@
-Confirmed: `adaptBcuBattleAction('toString', { frontLineup: 1, slot: 2 })` returns the `toString` function instead of the correct slot index `7`. The `in` operator walks the prototype chain, so any action name colliding with an `Object.prototype` member (`toString`, `valueOf`, `constructor`, `hasOwnProperty`, `__proto__`, …) is misrouted. I also verified the previous round's orchestrator stop-logic and its `none`-detection regex are sound (the `^(...)$` anchors prevent false positives). Here is the review.
+I have a confirmed, user-visible defect in the unaudited `js/ui` area. Let me verify the previous Codex patch has no regression, then write the review.
+
+The previous patch (`BattleSoundEventPatch.js` throttle guard) in the diff is exactly the recommended guarded form — correct, no regression. I have enough to write the review.
 
 # Review
 
@@ -6,42 +8,47 @@ Confirmed: `adaptBcuBattleAction('toString', { frontLineup: 1, slot: 2 })` retur
 None
 
 ## High
-None
+- **`js/ui/AppLoadingOverlay.js:86-96` — the loading progress bar is permanently stuck at 100% on every battle load after the first.** `setProgress` clamps progress monotonically: `const next = Math.max(this.lastProgressValue, …)` (line 132) and stores it back (line 133). `lastProgressValue` is initialized to `0` only in the constructor (line 63); **`show()` never resets it**. The overlay is instantiated once (`PreviewApp.js:89`) and reused for every battle load — `applyFormationToBattle` (`PreviewApp.js:217`) and `resetBattle` (`PreviewApp.js:267`) both call `show()` on the same instance. The first load ramps the bar `0.05 → 0.83 → 0.84 → 0.9 → 1.0` (`resetBattle` ends at `value: 1.0`, `PreviewApp.js:350`), leaving `lastProgressValue === 1`. Every subsequent `show()` leaves it at `1`, so `setProgress({value: 0.05})` computes `Math.max(1, 0.05) === 1` and the bar renders full for the entire load. Since retrying a stage or returning to formation and starting another battle is routine, this is a confirmed user-visible regression: the prominent progress bar shows "complete" while the battle is still loading. The step chips still update (they key off `phase`, lines 136-142), which is exactly what makes the stuck bar misleading rather than obviously broken. `BattleLoadingProgressVerifier.verifyLoadingOverlayTimerAdvances` only does a static `s.includes('lastProgressValue')` text check (and is itself orphaned — no importer), so nothing catches this.
 
 ## Medium
-- `js/input/BcuBattleInputAdapter.js:7` — `adaptBcuBattleAction` uses `if (action in BCU_BATTLE_ACTIONS)`. The `in` operator includes inherited `Object.prototype` properties, so an action string such as `toString`, `valueOf`, `constructor`, or `hasOwnProperty` is treated as a known action and returns the inherited function instead of falling through to the slot-index path. Verified: `adaptBcuBattleAction('toString', { frontLineup: 1, slot: 2 })` returns `[Function: toString]` instead of `7`; `adaptBcuBattleAction('toString')` returns the function instead of `null`. With current callers `action` is only `ACTION_LINEUP_CHANGE_UP`/`DOWN` or `null`, so it is not reachable in the live path today, but it is a latent correctness defect with a one-line, behavior-preserving fix and no test coverage on this module.
+None
 
 ## Low
-- `js/input/BcuBattleInputAdapter.js:1` — `BCU_BATTLE_ACTIONS` is a mutable export, unlike the sibling sound-id maps in `js/audio/BattleSoundEffects.js` which use `Object.freeze`. Freezing it is a cheap consistency/defensiveness improvement (optional; do only if it does not expand the task).
-- Previous round (orchestrator hardening) reviewed for regressions: `can_stop_after_round`, `review_has_priority_blockers`, and `state_has_unaudited_major_areas` ordering are correct, and the `^(none|...)$`-anchored regex does not misclassify actionable entries that merely start with "No". No action needed.
+- **`js/ui/FormationStageDifficultyFilterControlPatch.js:34-36` — `isFiltering(f)` is always true.** `filterState` sets `star: normalizeCrownStar(f.star ?? 1)`, and `normalizeCrownStar` always returns a finite integer clamped to `[MIN,MAX]` (`BcuStageCrownRuntime.js:24-28`), so `Number.isFinite(f.star)` never fails and the crown-star filter is applied even with an empty query — the map list defaults to showing only the selected crown star (★1). This is plausibly intended (a crown selector always has a value, matching BCU crown difficulty) and is covered by the passing `check-bcu-stage-difficulty-parity.mjs`; record as a parity question, do not change this round.
+- **`js/ui/BattleLoadingProgressVerifier.js` is orphaned** (no importer across `js/`, `scripts/`, `tests/`) and only performs static source-string assertions. Record as a decision item (wire into the safe-suite or remove), consistent with the round-3/round-4 orphan-scaffold handling; do not remove this round.
+- Previous round's `js/audio/BattleSoundEventPatch.js` `throttle()` guard fix reviewed for regressions: the applied form `scene?.timeMs ?? ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now())` matches `AudioEngine._now()` semantics and is correct. No action.
 
 ## Next Codex Task
-Fix the inherited-property lookup in `js/input/BcuBattleInputAdapter.js` and audit/cover the `js/input` area:
-
-1. In `js/input/BcuBattleInputAdapter.js`, replace the `in` check with an own-property check guarded on a string key, preserving all current behavior:
-   ```js
-   export function adaptBcuBattleAction(action, { frontLineup = 0, slot = null } = {}) {
-     if (typeof action === 'string' && Object.prototype.hasOwnProperty.call(BCU_BATTLE_ACTIONS, action)) {
-       return BCU_BATTLE_ACTIONS[action];
-     }
-     if (Number.isFinite(slot)) return frontLineup * 5 + slot;
-     return null;
-   }
-   ```
-2. Add `tests/bcu-battle-input-adapter.test.mjs` (picked up by `npm test`'s `node --test tests/*.test.mjs`) asserting: known actions map to `-4`/`-5`; inherited names (`toString`, `constructor`, `valueOf`, `hasOwnProperty`) with a finite `slot` fall through to `frontLineup * 5 + slot` (e.g. `'toString'` + `{frontLineup:1, slot:2}` → `7`) and with no `slot` return `null`; an unknown action with a finite `slot` returns `frontLineup * 5 + slot`; an unknown action with no `slot` returns `null`.
-3. `.ai/state.md` bookkeeping for this round's audit:
-   - Remove `js/input` from `## Unaudited Major Areas`.
-   - Add to `## Audited Areas`: `js/input` — `BcuBattleInputAdapter.js` action mapping (own-property fix + new test), plus read-through of `BcuDomTouchPolicy.js` and `BcuMobileGestureRuntime.js`.
-   - Add to `## Discovered Issues`: the `in`-vs-own-property defect fixed this round.
-   - Add to `## Unresolved`: the slide angle/threshold and up/down direction in `BcuMobileGestureRuntime.js` (`TAN_50`, `height * 0.15`, `dy/dragFrame < 0`) have not been confirmed against BCU touch source — flag for a later round.
-
-Do not change runtime behavior beyond the own-property fix. Append a summary to `.ai/changelog.md`.
+Fix the loading-overlay progress reset and add focused coverage, plus `js/ui` audit bookkeeping.
+
+1. **`js/ui/AppLoadingOverlay.js` — reset progress in `show()`.** Inside `show()` (which already calls `ensureRoot()` first, so `this.root` exists), reset the monotonic progress state and clear the stale bar so a reused overlay starts each load from empty:
+   - Add `this.lastProgressValue = 0;`
+   - Reset the visible bar: `const bar = this.root.querySelector('.app-loading-progress-bar'); if (bar) bar.style.width = '0%';`
+   
+   Do **not** change the monotonic `Math.max(...)` clamp in `setProgress` (it is correct *within* one load), the timer logic, the step-chip logic, or any other method.
+
+2. **Add `tests/app-loading-overlay-progress-reset.test.mjs`** (picked up by `npm test`'s `node --test tests/*.test.mjs`). The module imports are node-safe (`assetBase.js` falls back to `/` when `import.meta.env` is undefined; `AppVersion.js` is a constant), so a lightweight DOM stub works. Before importing `AppLoadingOverlay.js`, install a minimal `globalThis.document` stub whose `createElement` returns a generic fake node that tolerates everything `ensureRoot`/`show`/`setProgress` touch — `className`, `dataset` (object), `innerHTML` setter (no-op), `classList` with `add/remove/toggle/contains`, `style` (object), `textContent`, `addEventListener`, `appendChild`, `remove`, `querySelector` (returns another fake node), and `querySelectorAll` (returns `[]`) — plus a `body`/`head`. Then assert on the plain instance field `overlay.lastProgressValue`:
+   - `new AppLoadingOverlay({ mount })`, `show()`, `setProgress({ phase: 'ready', value: 1.0 })` → `lastProgressValue === 1`.
+   - Second `show()` → `lastProgressValue === 0` (fails before the fix).
+   - `setProgress({ phase: 'battle-scene', value: 0.05 })` → `lastProgressValue === 0.05` (was pinned at `1` before the fix).
+   
+   Keep the stub minimal; do not add jsdom or any new dependency.
+
+3. **`.ai/state.md` bookkeeping** (this round audited part of `js/ui`, not all of it — keep uncertainty honest):
+   - **Audited Areas** — add a *partial* `js/ui` entry: read-through of `AppLoadingOverlay.js` (applied the `show()` progress-reset fix + new test), `BattleSpeedControl.js`, `BattlePauseMenu.js`, `SoundToggleControls.js`, `PlayerProductionBar.js`, `FormationStageDifficultyFilterControlPatch.js`, `BattleTouchGuard.js`.
+   - **Unaudited Major Areas** — keep `js/ui` listed, annotated `js/ui (partial — loading-overlay/battle-HUD subset audited round-6; ~30 files remain: FormationEditor*, ProductionCardSkin, BcuStageCatalogBuilder, Nyanko*/Formation* patches, *Verifier files, etc.)`. Do **not** remove `js/ui`.
+   - **Discovered Issues** — record: fixed `js/ui/AppLoadingOverlay.js` so `show()` resets `lastProgressValue` (and the visible bar), preventing the reused overlay's progress bar from sticking at 100% on every battle load after the first.
+   - **Unresolved** — add: (a) `FormationStageDifficultyFilterControlPatch.isFiltering` is always true because `filterState` coerces `star` through `normalizeCrownStar` to a finite value, so the stage-map list is always crown-star-filtered (default ★1) even with an empty query; confirm against intended BCU crown-difficulty default before treating as a defect. (b) `js/ui/BattleLoadingProgressVerifier.js` is orphaned (no importer) and only does static source-string checks; decide whether to wire it into the safe-suite or remove it.
+
+4. Append a concise summary to `.ai/changelog.md`. Do not modify other runtime code, do not add new status files.
 
 ## Verification Commands
-- `node --check js/input/BcuBattleInputAdapter.js`
-- `node --test tests/bcu-battle-input-adapter.test.mjs`
+- `node --check js/ui/AppLoadingOverlay.js`
+- `node --check tests/app-loading-overlay-progress-reset.test.mjs`
+- `node --test tests/app-loading-overlay-progress-reset.test.mjs`
 - `npm run check`
 - `npm test`
+- `npm run build`
 
 ## Stop Condition
-Not satisfied. This is round 1 of at least 5; verification has not yet run for this round; and `.ai/state.md` still lists many unaudited major areas (`js/battle`, `js/bcu`, `js/bcu-render`, `js/boot`, `js/data`, `js/preview`, `js/ui`, `js/audio`, `scripts`, `tests`, and `js/input` until this task lands). Continue the loop.
+Not satisfied. `High` is non-empty this round (the `AppLoadingOverlay` progress-reset regression), and `## Unaudited Major Areas` still lists `js/battle`, `js/bcu`, `js/ui` (only partially audited), `scripts`, and `tests`; verification for this round has not run yet. Continue the loop.


### .ai/state.md
diff --git a/.ai/state.md b/.ai/state.md
index 8ec56b99f..ce69cb1cb 100644
--- a/.ai/state.md
+++ b/.ai/state.md
@@ -3,29 +3,43 @@
 ## Discovered Issues
 - No critical issues recorded yet.
 - Fixed `js/input/BcuBattleInputAdapter.js` inherited-property action lookup: `in` treated `Object.prototype` names such as `toString` as known actions instead of falling through to slot index/null behavior.
+- Fixed `js/audio/BattleSoundEventPatch.js` `throttle()` time source so the `performance` global is only referenced when defined, matching `AudioEngine._now()` fallback behavior.
+- Fixed `js/boot/installBattlePatches.js` `runDirectImports` error recording so direct import failures append to a guaranteed boot error array before progress advances.
+- Audited `js/bcu-render`; the chain is orphaned (no importer of `BcuEntityEffectIconRuntime.js`) and its class name collides with the live inline `BcuEntityEffectIconRuntime` in `BcuStatusEffectManager.js`. Recorded as a decision item; no code removed.
+- Audited `js/preview` + `js/data`; found `js/data/bcuAvailableEnemyAssets.js` orphaned (no importer of `hasBcuEnemyAsset`/`BCU_AVAILABLE_ENEMY_IDS`) and it hardcodes enemy ids 0..299 as 'available', a fabricated availability index if ever wired in. Recorded as a decision item; no code removed.
+- Fixed `js/ui/AppLoadingOverlay.js` so `show()` resets `lastProgressValue` and the visible progress bar, preventing the reused overlay's progress bar from sticking at 100% on every battle load after the first.
 
 ## Current Task
-- Fix `js/input/BcuBattleInputAdapter.js` inherited-property action lookup and record the `js/input` audit state.
+- Fix the reused `AppLoadingOverlay` progress reset, add focused coverage, and record partial `js/ui` audit bookkeeping.
 
 ## Audited Areas
 - `.ai/orchestrator.sh` verification command ordering and per-round logging behavior.
 - `.ai` loop README wording for round log persistence.
 - `js/input` — `BcuBattleInputAdapter.js` action mapping own-property fix with focused test coverage, plus read-through of `BcuDomTouchPolicy.js` and `BcuMobileGestureRuntime.js`.
+- `js/audio` — read-through of `AudioEngine.js`, `MusicCatalog.js`, `AudioSettings.js`, `BattleSoundEffects.js`, `BattleSoundEventPatch.js`, `StageMusicResolver.js`; applied the `throttle()` `performance`-global guard fix.
+- `js/boot` — read-through of `importProgress.js`, `installBattlePatches.js` (applied the `runDirectImports` defensive error-record fix), `installBcuPatches.js`, `installUiPatches.js`, and the `battle/install*Patches.js` shims + `groups/*` manifest imports; confirmed `installBcuBattleDataRegistries` passes the correct provider option key to each registry loader.
+- `js/bcu-render` — full read-through of `BcuBlendRuntime.js`, `BcuEPartTransformRuntime.js`, `BcuEffAnimRuntime.js`, `BcuFakeGraphicsCanvas2D.js`. Verified the whole `js/bcu-render` chain is currently orphaned: its only battle bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` has zero importers, and the live status-icon runtime is the same-named inline class in `js/battle/bcu-runtime/BcuStatusEffectManager.js`. Also read the live status/render path (`BcuStatusEffectManager.js`, `BcuModelInstance.js`, `BcuSpriteSheet.js`, `BcuCanvasComposite.js`, `BcuStatusIconResolver.js`) and `StageRegistry.js` and found them consistent; confirmed the previous round's `installBattlePatches.js` `runDirectImports` fix has no regression.
+- `js/preview` — full read-through of all 10 files (`PreviewApp.js`, `PreviewRenderer.js`, `PreviewUi.js`, `BattleSimulationClock.js`, `BattleCameraInputController.js`, `PreviewAppBattleMusicPatch.js`, `PreviewAppBattlePauseOverlayPatch.js`, `PreviewAppBattleResultOverlayPatch.js`, `PreviewAppCustomStageBattleConfigPatch.js`, `PreviewAppPageTransitionPatch.js`); found consistent. No runtime defect; the boss-music-start `<=` threshold default is recorded as a parity question below.
+- `js/data` — full read-through of all 3 files (`bcuStageManifest.js`, `previewAssets.js`, `bcuAvailableEnemyAssets.js`). Confirmed `bcuStageManifest` (via `StageRegistry`) and `previewAssets` (via `BattleScene`/`BattleActorFactory`/`PreviewApp`/`DebugBattleInspector`) are imported by live code, and `bcuAvailableEnemyAssets.js` has zero importers across `js/`, `scripts/`, and `tests/` (orphaned).
+- `js/ui` (partial) — read-through of `AppLoadingOverlay.js` (applied the `show()` progress-reset fix + new test), `BattleSpeedControl.js`, `BattlePauseMenu.js`, `SoundToggleControls.js`, `PlayerProductionBar.js`, `FormationStageDifficultyFilterControlPatch.js`, `BattleTouchGuard.js`.
 
 ## Unaudited Major Areas
 - `js/battle`
 - `js/bcu`
-- `js/bcu-render`
-- `js/boot`
-- `js/data`
-- `js/preview`
-- `js/ui`
-- `js/audio`
+- `js/ui` (partial — loading-overlay/battle-HUD subset audited round-6; ~30 files remain: FormationEditor*, ProductionCardSkin, BcuStageCatalogBuilder, Nyanko*/Formation* patches, *Verifier files, etc.)
 - `scripts`
 - `tests`
 
 ## Unresolved
 - `js/input/BcuMobileGestureRuntime.js` slide angle/threshold and up/down direction (`TAN_50`, `height * 0.15`, `dy / dragFrame < 0`) have not been confirmed against BCU touch source; audit in a later round before claiming BCU parity.
+- `js/audio/StageMusicResolver.js` `parseStageMusicFromRows` indexes `rows[2 + stageIndex]` after `parseMsdRows` drops fully-non-numeric lines; confirm the MapStageData map-pattern line (row 1) always carries a finite number so filtering can never shift the stage-row index.
+- `js/audio/BattleSoundEventPatch.js` `damageQueued` throttled-critical fall-through can play `HIT_0` after a throttled critical/strong-attack SE; confirm whether this rhg flood-guard behavior should stay or be changed for BCU parity.
+- `js/bcu-render` chain (`BcuBlendRuntime`/`BcuEPartTransformRuntime`/`BcuEffAnimRuntime`/`BcuFakeGraphicsCanvas2D`) + the dead bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` are orphaned and duplicate the live `BcuEntityEffectIconRuntime` class name; decide whether to remove the dead scaffold or wire it in, with evidence, before claiming `js/bcu-render` clean. Keep the existing `isBcuBlendGlow` glow-value uncertainty (`glow === 1 | 2 | 3 | -1` unconfirmed vs BCU `EPart`/glow source).
+- `BcuEffAnimRuntime.done()` and the inline `BcuEntityEffectIconRuntime.isDone()` never set `finished = true`; this appears intentional (status icons removed by expiry, not anim-loop completion) but is unconfirmed against BCU and currently has no consumer.
+- `js/data/bcuAvailableEnemyAssets.js` is orphaned (zero importers in `js/`/`scripts/`/`tests/`) and `hasBcuEnemyAsset` asserts enemy ids 0..299 are "available" without consulting real semantic ZIP asset presence; decide whether to remove the dead module or, if a consumer is intended, replace the hardcoded `0..299` set with a real asset-presence check -- without fabricating a BCU asset index -- before claiming `js/data` clean.
+- `js/preview/PreviewAppBattleMusicPatch.js` `startBattleMusic`/`updateBattleMusic` use `pct <= threshold` with a default threshold of 100 (from `StageMusicResolver` when `bossHpThresholdPercent` is non-finite), so a stage with a distinct boss-music id and no explicit threshold begins battle directly on boss music; confirm against BCU MapStageData `mush` semantics whether boss music should start immediately at 100% or only strictly below threshold before changing this.
+- `js/ui/FormationStageDifficultyFilterControlPatch.js` `isFiltering` is always true because `filterState` coerces `star` through `normalizeCrownStar` to a finite value, so the stage-map list is always crown-star-filtered (default ★1) even with an empty query; confirm against intended BCU crown-difficulty default before treating as a defect.
+- `js/ui/BattleLoadingProgressVerifier.js` is orphaned (no importer) and only does static source-string checks; decide whether to wire it into the safe-suite or remove it.
 
 ## Completed
 - Created AI management directory and core files.


### js/audio/BattleSoundEventPatch.js
diff --git a/js/audio/BattleSoundEventPatch.js b/js/audio/BattleSoundEventPatch.js
index 3bc70165e..539d3e0af 100644
--- a/js/audio/BattleSoundEventPatch.js
+++ b/js/audio/BattleSoundEventPatch.js
@@ -36,7 +36,7 @@ function soundState(scene) {
 
 function throttle(scene, key, ms) {
   const state = soundState(scene);
-  const now = Number(scene?.timeMs ?? performance.now?.() ?? Date.now());
+  const now = Number(scene?.timeMs ?? ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()));
   const last = state.last.get(key) ?? -Infinity;
   if (now - last < ms) return false;
   state.last.set(key, now);


[Diff excerpt budget reached.]



## Previous Codex Output
[Excerpt: tail 30000 bytes of 1459791 total bytes.]
ggleControls.js`, `PlayerProductionBar.js`, `FormationStageDifficultyFilterControlPatch.js`, `BattleTouchGuard.js`.
 
 ## Unaudited Major Areas
 - `js/battle`
 - `js/bcu`
-- `js/ui`
+- `js/ui` (partial — loading-overlay/battle-HUD subset audited round-6; ~30 files remain: FormationEditor*, ProductionCardSkin, BcuStageCatalogBuilder, Nyanko*/Formation* patches, *Verifier files, etc.)
 - `scripts`
 - `tests`
 
@@ -36,6 +38,8 @@
 - `BcuEffAnimRuntime.done()` and the inline `BcuEntityEffectIconRuntime.isDone()` never set `finished = true`; this appears intentional (status icons removed by expiry, not anim-loop completion) but is unconfirmed against BCU and currently has no consumer.
 - `js/data/bcuAvailableEnemyAssets.js` is orphaned (zero importers in `js/`/`scripts/`/`tests/`) and `hasBcuEnemyAsset` asserts enemy ids 0..299 are "available" without consulting real semantic ZIP asset presence; decide whether to remove the dead module or, if a consumer is intended, replace the hardcoded `0..299` set with a real asset-presence check -- without fabricating a BCU asset index -- before claiming `js/data` clean.
 - `js/preview/PreviewAppBattleMusicPatch.js` `startBattleMusic`/`updateBattleMusic` use `pct <= threshold` with a default threshold of 100 (from `StageMusicResolver` when `bossHpThresholdPercent` is non-finite), so a stage with a distinct boss-music id and no explicit threshold begins battle directly on boss music; confirm against BCU MapStageData `mush` semantics whether boss music should start immediately at 100% or only strictly below threshold before changing this.
+- `js/ui/FormationStageDifficultyFilterControlPatch.js` `isFiltering` is always true because `filterState` coerces `star` through `normalizeCrownStar` to a finite value, so the stage-map list is always crown-star-filtered (default ★1) even with an empty query; confirm against intended BCU crown-difficulty default before treating as a defect.
+- `js/ui/BattleLoadingProgressVerifier.js` is orphaned (no importer) and only does static source-string checks; decide whether to wire it into the safe-suite or remove it.
 
 ## Completed
 - Created AI management directory and core files.
diff --git a/js/ui/AppLoadingOverlay.js b/js/ui/AppLoadingOverlay.js
index 4cedf3366cfef4c991ebc28da3b16ebe58687990..6b1e2f5e494f452a645317407cf9172d05185845
--- a/js/ui/AppLoadingOverlay.js
+++ b/js/ui/AppLoadingOverlay.js
@@ -88,6 +88,9 @@
     this.root.classList.remove('is-hidden');
     this.root.classList.remove('is-error');
     if (this.root.dataset) this.root.dataset.loadingMode = 'normal';
+    this.lastProgressValue = 0;
+    const bar = this.root.querySelector('.app-loading-progress-bar');
+    if (bar) bar.style.width = '0%';
     this.startedAt = performance.now();
     this.elapsedMsOverride = null;
     this.root.querySelector('.app-loading-error').textContent = '';
diff --git a/tests/app-loading-overlay-progress-reset.test.mjs b/tests/app-loading-overlay-progress-reset.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..eb516466081d5a71dac8f21fdea2207cdebc2665
--- /dev/null
+++ b/tests/app-loading-overlay-progress-reset.test.mjs
@@ -0,0 +1,87 @@
+import assert from 'node:assert/strict';
+import test from 'node:test';
+
+class FakeClassList {
+  constructor() {
+    this.values = new Set();
+  }
+
+  add(...names) {
+    for (const name of names) this.values.add(name);
+  }
+
+  remove(...names) {
+    for (const name of names) this.values.delete(name);
+  }
+
+  toggle(name, force) {
+    const enabled = force === undefined ? !this.values.has(name) : !!force;
+    if (enabled) this.values.add(name);
+    else this.values.delete(name);
+    return enabled;
+  }
+
+  contains(name) {
+    return this.values.has(name);
+  }
+}
+
+class FakeNode {
+  constructor() {
+    this.className = '';
+    this.dataset = {};
+    this.style = {};
+    this.textContent = '';
+    this.children = [];
+    this.classList = new FakeClassList();
+  }
+
+  set innerHTML(_value) {}
+
+  addEventListener() {}
+
+  appendChild(child) {
+    this.children.push(child);
+    return child;
+  }
+
+  remove() {}
+
+  querySelector() {
+    return new FakeNode();
+  }
+
+  querySelectorAll() {
+    return [];
+  }
+}
+
+const documentStub = {
+  body: new FakeNode(),
+  head: new FakeNode(),
+  createElement() {
+    return new FakeNode();
+  },
+  querySelector() {
+    return new FakeNode();
+  }
+};
+
+globalThis.document = documentStub;
+
+const { AppLoadingOverlay } = await import('../js/ui/AppLoadingOverlay.js');
+
+test('AppLoadingOverlay show resets progress for reused overlay instances', () => {
+  const mount = new FakeNode();
+  const overlay = new AppLoadingOverlay({ mount });
+
+  overlay.show();
+  overlay.setProgress({ phase: 'ready', value: 1.0 });
+  assert.equal(overlay.lastProgressValue, 1);
+
+  overlay.show();
+  assert.equal(overlay.lastProgressValue, 0);
+
+  overlay.setProgress({ phase: 'battle-scene', value: 0.05 });
+  assert.equal(overlay.lastProgressValue, 0.05);
+});

 succeeded in 87988ms:
 .ai/changelog.md                  | 42958 ++++++++++++++++++++++++++++++++++++
 .ai/logs/round-1-claude.log       |    54 +
 .ai/logs/round-1-claude.prompt.md |   660 +-
 .ai/logs/round-1-codex.log        | 23200 +++++++++++++++++--
 .ai/logs/round-1-codex.prompt.md  |   341 +-
 .ai/logs/round-1-git.log          |    16 +-
 .ai/logs/round-1-test.log         |   190 +-
 .ai/logs/round-2-claude.log       |    54 +-
 .ai/logs/round-2-claude.prompt.md | 13012 +----------
 .ai/logs/round-2-git.log          |    43 +-
 .ai/prompts/claude-review.md      |    14 +-
 .ai/review.md                     |    63 +-
 .ai/state.md                      |    28 +-
 js/audio/BattleSoundEventPatch.js |     2 +-
 js/boot/installBattlePatches.js   |     5 +-
 js/ui/AppLoadingOverlay.js        |     3 +
 16 files changed, 65211 insertions(+), 15432 deletions(-)

 succeeded in 89726ms:
 M .ai/changelog.md
 M .ai/logs/round-1-claude.log
 M .ai/logs/round-1-claude.prompt.md
 M .ai/logs/round-1-codex.log
 M .ai/logs/round-1-codex.prompt.md
 M .ai/logs/round-1-git.log
 M .ai/logs/round-1-test.log
 M .ai/logs/round-2-claude.log
 M .ai/logs/round-2-claude.prompt.md
 M .ai/logs/round-2-git.log
 M .ai/prompts/claude-review.md
 M .ai/review.md
 M .ai/state.md
 M js/audio/BattleSoundEventPatch.js
 M js/boot/installBattlePatches.js
 M js/ui/AppLoadingOverlay.js
?? .ai/logs/round-2-codex.log
?? .ai/logs/round-2-codex.prompt.md
?? .ai/logs/round-2-test.log
?? .ai/logs/round-3-claude.log
?? .ai/logs/round-3-claude.prompt.md
?? .ai/logs/round-3-codex.log
?? .ai/logs/round-3-codex.prompt.md
?? .ai/logs/round-3-git.log
?? .ai/logs/round-3-test.log
?? .ai/logs/round-4-claude.log
?? .ai/logs/round-4-claude.prompt.md
?? .ai/logs/round-4-codex.log
?? .ai/logs/round-4-codex.prompt.md
?? .ai/logs/round-4-git.log
?? .ai/logs/round-4-test.log
?? .ai/logs/round-5-claude.log
?? .ai/logs/round-5-claude.prompt.md
?? .ai/logs/round-5-git.log
?? tests/app-loading-overlay-progress-reset.test.mjs

codex
`git status` and `git diff --stat` are hanging in this checkout, likely on the very large `.ai/changelog.md` diff. I’m stopping those diagnostic commands; the verification commands have all completed.
diff --git a/.ai/changelog.md b/.ai/changelog.md
index b6bb816dadcb610dc319e1546d8b882846e9dfd5..c413043060a0569f184f6336196251fcd1f67ce3
--- a/.ai/changelog.md
+++ b/.ai/changelog.md
@@ -28500,6 +28500,13 @@
 - next action: later round should decide whether to remove the scaffold or wire it in, without changing the glow-value set prematurely.
 
 No runtime code changed. No commit or push performed.
+
+## Round 6 Codex implementation
+
+- Fixed `js/ui/AppLoadingOverlay.js` so each `show()` call resets `lastProgressValue` and clears the visible progress bar to `0%`, while preserving the monotonic clamp inside a single load.
+- Added `tests/app-loading-overlay-progress-reset.test.mjs` with a minimal DOM stub covering reused-overlay progress reset behavior.
+- Updated `.ai/state.md` with partial `js/ui` audit bookkeeping, the fixed loading-overlay issue, and unresolved `FormationStageDifficultyFilterControlPatch` / orphaned verifier questions.
+- Verification passed: `node --check js/ui/AppLoadingOverlay.js`, `node --check tests/app-loading-overlay-progress-reset.test.mjs`, `node --test tests/app-loading-overlay-progress-reset.test.mjs`, `npm run check`, `npm test` (52/52), and `npm run build`.
 diff --git a/.ai/changelog.md b/.ai/changelog.md
 index c117753cb46ac6b56911620831eb0cfc64a145c1..2c464f435f9a0aa2b87b71a76df850c17e141140
 --- a/.ai/changelog.md
@@ -47518,4 +47525,3 @@
 - next action: decide later whether to remove it or replace it with real semantic ZIP asset-presence checks.
 
 No runtime code changed. No commit or push performed.
-
diff --git a/.ai/state.md b/.ai/state.md
index 4c2a766a61a1f8f63f2fb05addc0453dd0f4846c..ce69cb1cb4ac346c8ed277928485cf8738b5c4af
--- a/.ai/state.md
+++ b/.ai/state.md
@@ -7,9 +7,10 @@
 - Fixed `js/boot/installBattlePatches.js` `runDirectImports` error recording so direct import failures append to a guaranteed boot error array before progress advances.
 - Audited `js/bcu-render`; the chain is orphaned (no importer of `BcuEntityEffectIconRuntime.js`) and its class name collides with the live inline `BcuEntityEffectIconRuntime` in `BcuStatusEffectManager.js`. Recorded as a decision item; no code removed.
 - Audited `js/preview` + `js/data`; found `js/data/bcuAvailableEnemyAssets.js` orphaned (no importer of `hasBcuEnemyAsset`/`BCU_AVAILABLE_ENEMY_IDS`) and it hardcodes enemy ids 0..299 as 'available', a fabricated availability index if ever wired in. Recorded as a decision item; no code removed.
+- Fixed `js/ui/AppLoadingOverlay.js` so `show()` resets `lastProgressValue` and the visible progress bar, preventing the reused overlay's progress bar from sticking at 100% on every battle load after the first.
 
 ## Current Task
-- Record the fresh `js/preview` + `js/data` audit state and defer any orphaned-scaffold removal or boss-music threshold decision pending evidence.
+- Fix the reused `AppLoadingOverlay` progress reset, add focused coverage, and record partial `js/ui` audit bookkeeping.
 
 ## Audited Areas
 - `.ai/orchestrator.sh` verification command ordering and per-round logging behavior.
@@ -20,11 +21,12 @@
 - `js/bcu-render` — full read-through of `BcuBlendRuntime.js`, `BcuEPartTransformRuntime.js`, `BcuEffAnimRuntime.js`, `BcuFakeGraphicsCanvas2D.js`. Verified the whole `js/bcu-render` chain is currently orphaned: its only battle bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` has zero importers, and the live status-icon runtime is the same-named inline class in `js/battle/bcu-runtime/BcuStatusEffectManager.js`. Also read the live status/render path (`BcuStatusEffectManager.js`, `BcuModelInstance.js`, `BcuSpriteSheet.js`, `BcuCanvasComposite.js`, `BcuStatusIconResolver.js`) and `StageRegistry.js` and found them consistent; confirmed the previous round's `installBattlePatches.js` `runDirectImports` fix has no regression.
 - `js/preview` — full read-through of all 10 files (`PreviewApp.js`, `PreviewRenderer.js`, `PreviewUi.js`, `BattleSimulationClock.js`, `BattleCameraInputController.js`, `PreviewAppBattleMusicPatch.js`, `PreviewAppBattlePauseOverlayPatch.js`, `PreviewAppBattleResultOverlayPatch.js`, `PreviewAppCustomStageBattleConfigPatch.js`, `PreviewAppPageTransitionPatch.js`); found consistent. No runtime defect; the boss-music-start `<=` threshold default is recorded as a parity question below.
 - `js/data` — full read-through of all 3 files (`bcuStageManifest.js`, `previewAssets.js`, `bcuAvailableEnemyAssets.js`). Confirmed `bcuStageManifest` (via `StageRegistry`) and `previewAssets` (via `BattleScene`/`BattleActorFactory`/`PreviewApp`/`DebugBattleInspector`) are imported by live code, and `bcuAvailableEnemyAssets.js` has zero importers across `js/`, `scripts/`, and `tests/` (orphaned).
+- `js/ui` (partial) — read-through of `AppLoadingOverlay.js` (applied the `show()` progress-reset fix + new test), `BattleSpeedControl.js`, `BattlePauseMenu.js`, `SoundToggleControls.js`, `PlayerProductionBar.js`, `FormationStageDifficultyFilterControlPatch.js`, `BattleTouchGuard.js`.
 
 ## Unaudited Major Areas
 - `js/battle`
 - `js/bcu`
-- `js/ui`
+- `js/ui` (partial — loading-overlay/battle-HUD subset audited round-6; ~30 files remain: FormationEditor*, ProductionCardSkin, BcuStageCatalogBuilder, Nyanko*/Formation* patches, *Verifier files, etc.)
 - `scripts`
 - `tests`
 
@@ -36,6 +38,8 @@
 - `BcuEffAnimRuntime.done()` and the inline `BcuEntityEffectIconRuntime.isDone()` never set `finished = true`; this appears intentional (status icons removed by expiry, not anim-loop completion) but is unconfirmed against BCU and currently has no consumer.
 - `js/data/bcuAvailableEnemyAssets.js` is orphaned (zero importers in `js/`/`scripts/`/`tests/`) and `hasBcuEnemyAsset` asserts enemy ids 0..299 are "available" without consulting real semantic ZIP asset presence; decide whether to remove the dead module or, if a consumer is intended, replace the hardcoded `0..299` set with a real asset-presence check -- without fabricating a BCU asset index -- before claiming `js/data` clean.
 - `js/preview/PreviewAppBattleMusicPatch.js` `startBattleMusic`/`updateBattleMusic` use `pct <= threshold` with a default threshold of 100 (from `StageMusicResolver` when `bossHpThresholdPercent` is non-finite), so a stage with a distinct boss-music id and no explicit threshold begins battle directly on boss music; confirm against BCU MapStageData `mush` semantics whether boss music should start immediately at 100% or only strictly below threshold before changing this.
+- `js/ui/FormationStageDifficultyFilterControlPatch.js` `isFiltering` is always true because `filterState` coerces `star` through `normalizeCrownStar` to a finite value, so the stage-map list is always crown-star-filtered (default ★1) even with an empty query; confirm against intended BCU crown-difficulty default before treating as a defect.
+- `js/ui/BattleLoadingProgressVerifier.js` is orphaned (no importer) and only does static source-string checks; decide whether to wire it into the safe-suite or remove it.
 
 ## Completed
 - Created AI management directory and core files.
diff --git a/js/ui/AppLoadingOverlay.js b/js/ui/AppLoadingOverlay.js
index 4cedf3366cfef4c991ebc28da3b16ebe58687990..6b1e2f5e494f452a645317407cf9172d05185845
--- a/js/ui/AppLoadingOverlay.js
+++ b/js/ui/AppLoadingOverlay.js
@@ -88,6 +88,9 @@
     this.root.classList.remove('is-hidden');
     this.root.classList.remove('is-error');
     if (this.root.dataset) this.root.dataset.loadingMode = 'normal';
+    this.lastProgressValue = 0;
+    const bar = this.root.querySelector('.app-loading-progress-bar');
+    if (bar) bar.style.width = '0%';
     this.startedAt = performance.now();
     this.elapsedMsOverride = null;
     this.root.querySelector('.app-loading-error').textContent = '';
diff --git a/tests/app-loading-overlay-progress-reset.test.mjs b/tests/app-loading-overlay-progress-reset.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..eb516466081d5a71dac8f21fdea2207cdebc2665
--- /dev/null
+++ b/tests/app-loading-overlay-progress-reset.test.mjs
@@ -0,0 +1,87 @@
+import assert from 'node:assert/strict';
+import test from 'node:test';
+
+class FakeClassList {
+  constructor() {
+    this.values = new Set();
+  }
+
+  add(...names) {
+    for (const name of names) this.values.add(name);
+  }
+
+  remove(...names) {
+    for (const name of names) this.values.delete(name);
+  }
+
+  toggle(name, force) {
+    const enabled = force === undefined ? !this.values.has(name) : !!force;
+    if (enabled) this.values.add(name);
+    else this.values.delete(name);
+    return enabled;
+  }
+
+  contains(name) {
+    return this.values.has(name);
+  }
+}
+
+class FakeNode {
+  constructor() {
+    this.className = '';
+    this.dataset = {};
+    this.style = {};
+    this.textContent = '';
+    this.children = [];
+    this.classList = new FakeClassList();
+  }
+
+  set innerHTML(_value) {}
+
+  addEventListener() {}
+
+  appendChild(child) {
+    this.children.push(child);
+    return child;
+  }
+
+  remove() {}
+
+  querySelector() {
+    return new FakeNode();
+  }
+
+  querySelectorAll() {
+    return [];
+  }
+}
+
+const documentStub = {
+  body: new FakeNode(),
+  head: new FakeNode(),
+  createElement() {
+    return new FakeNode();
+  },
+  querySelector() {
+    return new FakeNode();
+  }
+};
+
+globalThis.document = documentStub;
+
+const { AppLoadingOverlay } = await import('../js/ui/AppLoadingOverlay.js');
+
+test('AppLoadingOverlay show resets progress for reused overlay instances', () => {
+  const mount = new FakeNode();
+  const overlay = new AppLoadingOverlay({ mount });
+
+  overlay.show();
+  overlay.setProgress({ phase: 'ready', value: 1.0 });
+  assert.equal(overlay.lastProgressValue, 1);
+
+  overlay.show();
+  assert.equal(overlay.lastProgressValue, 0);
+
+  overlay.setProgress({ phase: 'battle-scene', value: 0.05 });
+  assert.equal(overlay.lastProgressValue, 0.05);
+});

codex
## Summary
- Rows moved to code-complete-candidate: none
- Rows moved to human-visual-review-needed: none
- Rows still partial / unconfirmed: partial `js/ui` audit remains; two UI questions recorded under `Unresolved`

## BCU references inspected
- files/classes/methods: none; this was a rhg UI loading-overlay defect, not a BCU parity claim

## Changed files
- code: [AppLoadingOverlay.js](/workspaces/rhg/js/ui/AppLoadingOverlay.js)
- tests: [app-loading-overlay-progress-reset.test.mjs](/workspaces/rhg/tests/app-loading-overlay-progress-reset.test.mjs)
- docs: [.ai/state.md](/workspaces/rhg/.ai/state.md), [.ai/changelog.md](/workspaces/rhg/.ai/changelog.md)
- generated assets: none

## Verification
- `node --check js/ui/AppLoadingOverlay.js`: passed
- `node --check tests/app-loading-overlay-progress-reset.test.mjs`: passed
- `node --test tests/app-loading-overlay-progress-reset.test.mjs`: passed
- `npm run check`: passed
- `npm test`: passed, 52/52
- `npm run build`: passed

## Remaining risks
- risk: `js/ui` is still only partially audited.
- reason: task explicitly covered the loading-overlay / battle-HUD subset only.
- next action: later rounds should inspect remaining `js/ui` files and resolve the recorded crown-filter and orphaned verifier questions.

No commit or push performed. The worktree already contained unrelated `.ai`, audio, boot, and log changes; I preserved them.
diff --git a/.ai/changelog.md b/.ai/changelog.md
index b6bb816dadcb610dc319e1546d8b882846e9dfd5..c413043060a0569f184f6336196251fcd1f67ce3
--- a/.ai/changelog.md
+++ b/.ai/changelog.md
@@ -28500,6 +28500,13 @@
 - next action: later round should decide whether to remove the scaffold or wire it in, without changing the glow-value set prematurely.
 
 No runtime code changed. No commit or push performed.
+
+## Round 6 Codex implementation
+
+- Fixed `js/ui/AppLoadingOverlay.js` so each `show()` call resets `lastProgressValue` and clears the visible progress bar to `0%`, while preserving the monotonic clamp inside a single load.
+- Added `tests/app-loading-overlay-progress-reset.test.mjs` with a minimal DOM stub covering reused-overlay progress reset behavior.
+- Updated `.ai/state.md` with partial `js/ui` audit bookkeeping, the fixed loading-overlay issue, and unresolved `FormationStageDifficultyFilterControlPatch` / orphaned verifier questions.
+- Verification passed: `node --check js/ui/AppLoadingOverlay.js`, `node --check tests/app-loading-overlay-progress-reset.test.mjs`, `node --test tests/app-loading-overlay-progress-reset.test.mjs`, `npm run check`, `npm test` (52/52), and `npm run build`.
 diff --git a/.ai/changelog.md b/.ai/changelog.md
 index c117753cb46ac6b56911620831eb0cfc64a145c1..2c464f435f9a0aa2b87b71a76df850c17e141140
 --- a/.ai/changelog.md
@@ -47518,4 +47525,3 @@
 - next action: decide later whether to remove it or replace it with real semantic ZIP asset-presence checks.
 
 No runtime code changed. No commit or push performed.
-
diff --git a/.ai/state.md b/.ai/state.md
index 4c2a766a61a1f8f63f2fb05addc0453dd0f4846c..ce69cb1cb4ac346c8ed277928485cf8738b5c4af
--- a/.ai/state.md
+++ b/.ai/state.md
@@ -7,9 +7,10 @@
 - Fixed `js/boot/installBattlePatches.js` `runDirectImports` error recording so direct import failures append to a guaranteed boot error array before progress advances.
 - Audited `js/bcu-render`; the chain is orphaned (no importer of `BcuEntityEffectIconRuntime.js`) and its class name collides with the live inline `BcuEntityEffectIconRuntime` in `BcuStatusEffectManager.js`. Recorded as a decision item; no code removed.
 - Audited `js/preview` + `js/data`; found `js/data/bcuAvailableEnemyAssets.js` orphaned (no importer of `hasBcuEnemyAsset`/`BCU_AVAILABLE_ENEMY_IDS`) and it hardcodes enemy ids 0..299 as 'available', a fabricated availability index if ever wired in. Recorded as a decision item; no code removed.
+- Fixed `js/ui/AppLoadingOverlay.js` so `show()` resets `lastProgressValue` and the visible progress bar, preventing the reused overlay's progress bar from sticking at 100% on every battle load after the first.
 
 ## Current Task
-- Record the fresh `js/preview` + `js/data` audit state and defer any orphaned-scaffold removal or boss-music threshold decision pending evidence.
+- Fix the reused `AppLoadingOverlay` progress reset, add focused coverage, and record partial `js/ui` audit bookkeeping.
 
 ## Audited Areas
 - `.ai/orchestrator.sh` verification command ordering and per-round logging behavior.
@@ -20,11 +21,12 @@
 - `js/bcu-render` — full read-through of `BcuBlendRuntime.js`, `BcuEPartTransformRuntime.js`, `BcuEffAnimRuntime.js`, `BcuFakeGraphicsCanvas2D.js`. Verified the whole `js/bcu-render` chain is currently orphaned: its only battle bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` has zero importers, and the live status-icon runtime is the same-named inline class in `js/battle/bcu-runtime/BcuStatusEffectManager.js`. Also read the live status/render path (`BcuStatusEffectManager.js`, `BcuModelInstance.js`, `BcuSpriteSheet.js`, `BcuCanvasComposite.js`, `BcuStatusIconResolver.js`) and `StageRegistry.js` and found them consistent; confirmed the previous round's `installBattlePatches.js` `runDirectImports` fix has no regression.
 - `js/preview` — full read-through of all 10 files (`PreviewApp.js`, `PreviewRenderer.js`, `PreviewUi.js`, `BattleSimulationClock.js`, `BattleCameraInputController.js`, `PreviewAppBattleMusicPatch.js`, `PreviewAppBattlePauseOverlayPatch.js`, `PreviewAppBattleResultOverlayPatch.js`, `PreviewAppCustomStageBattleConfigPatch.js`, `PreviewAppPageTransitionPatch.js`); found consistent. No runtime defect; the boss-music-start `<=` threshold default is recorded as a parity question below.
 - `js/data` — full read-through of all 3 files (`bcuStageManifest.js`, `previewAssets.js`, `bcuAvailableEnemyAssets.js`). Confirmed `bcuStageManifest` (via `StageRegistry`) and `previewAssets` (via `BattleScene`/`BattleActorFactory`/`PreviewApp`/`DebugBattleInspector`) are imported by live code, and `bcuAvailableEnemyAssets.js` has zero importers across `js/`, `scripts/`, and `tests/` (orphaned).
+- `js/ui` (partial) — read-through of `AppLoadingOverlay.js` (applied the `show()` progress-reset fix + new test), `BattleSpeedControl.js`, `BattlePauseMenu.js`, `SoundToggleControls.js`, `PlayerProductionBar.js`, `FormationStageDifficultyFilterControlPatch.js`, `BattleTouchGuard.js`.
 
 ## Unaudited Major Areas
 - `js/battle`
 - `js/bcu`
-- `js/ui`
+- `js/ui` (partial — loading-overlay/battle-HUD subset audited round-6; ~30 files remain: FormationEditor*, ProductionCardSkin, BcuStageCatalogBuilder, Nyanko*/Formation* patches, *Verifier files, etc.)
 - `scripts`
 - `tests`
 
@@ -36,6 +38,8 @@
 - `BcuEffAnimRuntime.done()` and the inline `BcuEntityEffectIconRuntime.isDone()` never set `finished = true`; this appears intentional (status icons removed by expiry, not anim-loop completion) but is unconfirmed against BCU and currently has no consumer.
 - `js/data/bcuAvailableEnemyAssets.js` is orphaned (zero importers in `js/`/`scripts/`/`tests/`) and `hasBcuEnemyAsset` asserts enemy ids 0..299 are "available" without consulting real semantic ZIP asset presence; decide whether to remove the dead module or, if a consumer is intended, replace the hardcoded `0..299` set with a real asset-presence check -- without fabricating a BCU asset index -- before claiming `js/data` clean.
 - `js/preview/PreviewAppBattleMusicPatch.js` `startBattleMusic`/`updateBattleMusic` use `pct <= threshold` with a default threshold of 100 (from `StageMusicResolver` when `bossHpThresholdPercent` is non-finite), so a stage with a distinct boss-music id and no explicit threshold begins battle directly on boss music; confirm against BCU MapStageData `mush` semantics whether boss music should start immediately at 100% or only strictly below threshold before changing this.
+- `js/ui/FormationStageDifficultyFilterControlPatch.js` `isFiltering` is always true because `filterState` coerces `star` through `normalizeCrownStar` to a finite value, so the stage-map list is always crown-star-filtered (default ★1) even with an empty query; confirm against intended BCU crown-difficulty default before treating as a defect.
+- `js/ui/BattleLoadingProgressVerifier.js` is orphaned (no importer) and only does static source-string checks; decide whether to wire it into the safe-suite or remove it.
 
 ## Completed
 - Created AI management directory and core files.
diff --git a/js/ui/AppLoadingOverlay.js b/js/ui/AppLoadingOverlay.js
index 4cedf3366cfef4c991ebc28da3b16ebe58687990..6b1e2f5e494f452a645317407cf9172d05185845
--- a/js/ui/AppLoadingOverlay.js
+++ b/js/ui/AppLoadingOverlay.js
@@ -88,6 +88,9 @@
     this.root.classList.remove('is-hidden');
     this.root.classList.remove('is-error');
     if (this.root.dataset) this.root.dataset.loadingMode = 'normal';
+    this.lastProgressValue = 0;
+    const bar = this.root.querySelector('.app-loading-progress-bar');
+    if (bar) bar.style.width = '0%';
     this.startedAt = performance.now();
     this.elapsedMsOverride = null;
     this.root.querySelector('.app-loading-error').textContent = '';
diff --git a/tests/app-loading-overlay-progress-reset.test.mjs b/tests/app-loading-overlay-progress-reset.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..eb516466081d5a71dac8f21fdea2207cdebc2665
--- /dev/null
+++ b/tests/app-loading-overlay-progress-reset.test.mjs
@@ -0,0 +1,87 @@
+import assert from 'node:assert/strict';
+import test from 'node:test';
+
+class FakeClassList {
+  constructor() {
+    this.values = new Set();
+  }
+
+  add(...names) {
+    for (const name of names) this.values.add(name);
+  }
+
+  remove(...names) {
+    for (const name of names) this.values.delete(name);
+  }
+
+  toggle(name, force) {
+    const enabled = force === undefined ? !this.values.has(name) : !!force;
+    if (enabled) this.values.add(name);
+    else this.values.delete(name);
+    return enabled;
+  }
+
+  contains(name) {
+    return this.values.has(name);
+  }
+}
+
+class FakeNode {
+  constructor() {
+    this.className = '';
+    this.dataset = {};
+    this.style = {};
+    this.textContent = '';
+    this.children = [];
+    this.classList = new FakeClassList();
+  }
+
+  set innerHTML(_value) {}
+
+  addEventListener() {}
+
+  appendChild(child) {
+    this.children.push(child);
+    return child;
+  }
+
+  remove() {}
+
+  querySelector() {
+    return new FakeNode();
+  }
+
+  querySelectorAll() {
+    return [];
+  }
+}
+
+const documentStub = {
+  body: new FakeNode(),
+  head: new FakeNode(),
+  createElement() {
+    return new FakeNode();
+  },
+  querySelector() {
+    return new FakeNode();
+  }
+};
+
+globalThis.document = documentStub;
+
+const { AppLoadingOverlay } = await import('../js/ui/AppLoadingOverlay.js');
+
+test('AppLoadingOverlay show resets progress for reused overlay instances', () => {
+  const mount = new FakeNode();
+  const overlay = new AppLoadingOverlay({ mount });
+
+  overlay.show();
+  overlay.setProgress({ phase: 'ready', value: 1.0 });
+  assert.equal(overlay.lastProgressValue, 1);
+
+  overlay.show();
+  assert.equal(overlay.lastProgressValue, 0);
+
+  overlay.setProgress({ phase: 'battle-scene', value: 0.05 });
+  assert.equal(overlay.lastProgressValue, 0.05);
+});

tokens used
154,600
## Summary
- Rows moved to code-complete-candidate: none
- Rows moved to human-visual-review-needed: none
- Rows still partial / unconfirmed: partial `js/ui` audit remains; two UI questions recorded under `Unresolved`

## BCU references inspected
- files/classes/methods: none; this was a rhg UI loading-overlay defect, not a BCU parity claim

## Changed files
- code: [AppLoadingOverlay.js](/workspaces/rhg/js/ui/AppLoadingOverlay.js)
- tests: [app-loading-overlay-progress-reset.test.mjs](/workspaces/rhg/tests/app-loading-overlay-progress-reset.test.mjs)
- docs: [.ai/state.md](/workspaces/rhg/.ai/state.md), [.ai/changelog.md](/workspaces/rhg/.ai/changelog.md)
- generated assets: none

## Verification
- `node --check js/ui/AppLoadingOverlay.js`: passed
- `node --check tests/app-loading-overlay-progress-reset.test.mjs`: passed
- `node --test tests/app-loading-overlay-progress-reset.test.mjs`: passed
- `npm run check`: passed
- `npm test`: passed, 52/52
- `npm run build`: passed

## Remaining risks
- risk: `js/ui` is still only partially audited.
- reason: task explicitly covered the loading-overlay / battle-HUD subset only.
- next action: later rounds should inspect remaining `js/ui` files and resolve the recorded crown-filter and orphaned verifier questions.

No commit or push performed. The worktree already contained unrelated `.ai`, audio, boot, and log changes; I preserved them.



## Previous Verification Output
[Excerpt: tail 30000 bytes of 32427 total bytes.]
arity.mjs

$ node --check scripts/check-bcu-wallet-runtime-parity.mjs

$ node --check scripts/check-bcu-wave-invalid-parity.mjs

$ node --check scripts/check-bcu-wave-on-barrier-shield-block-parity.mjs

$ node --check scripts/check-bcu-unit-level-runtime-parity.mjs

$ node --check scripts/check-bcu-barrier-shield-effect-parity.mjs

$ node --check scripts/check-bcu-burrow-lifecycle-parity.mjs

$ node --check scripts/check-bcu-castle-guard-parity.mjs

$ node --check scripts/check-bcu-spirit-bundle-manifest-parity.mjs

$ node --check scripts/check-bcu-spirit-lifecycle-parity.mjs

$ node --check scripts/check-bcu-spirit-cooldown-emphasize-parity.mjs

$ node --check scripts/check-bcu-summon-runtime-parity.mjs

$ node --check scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs

$ node --check scripts/check-bcu-demon-shield-regen-timing.mjs

$ node --check scripts/check-projectile-damage-parity.mjs

$ node --check scripts/check-proc-immunity-resistance-parity.mjs

$ node --check scripts/check-bcu-toxic-effect-parity.mjs

$ node --check scripts/check-effect-bundle-aliases.mjs

$ node --check scripts/check-effect-coordinate-traces.mjs

$ node --check scripts/check-bcu-death-animation-parity.mjs

$ node --check scripts/check-bcu-warp-lifecycle-parity.mjs

$ node --check scripts/check-bcu-warp-interrupt-scene-parity.mjs

$ node --check scripts/check-bcu-combo-proc-duration-parity.mjs

$ node --check scripts/check-bcu-combo-speed-crit-parity.mjs

$ node --check scripts/check-ability-partial-blockers.mjs

$ node --check scripts/check-bcu-wave-surge-point-capture-parity.mjs

$ node --check scripts/check-bcu-metal-abi-double-apply.mjs

$ node --check scripts/check-actor-render-bounds-guard.mjs

$ node --check scripts/check-battle-runtime-lightweight-guards.mjs

$ node scripts/check-bcu-stage-difficulty-parity.mjs
check-bcu-stage-difficulty-parity: OK

$ node scripts/check-production-card-icon-source-parity.mjs
check-production-card-icon-source-parity: OK

$ node scripts/check-bcu-parser-indexes.mjs
check-bcu-parser-indexes: OK

$ node scripts/check-bcu-delay-runtime.mjs
check-bcu-delay-runtime: OK

$ node scripts/check-bcu-stage-line-row-parity.mjs
check-bcu-stage-line-row-parity: OK

$ node scripts/check-bcu-wallet-runtime-parity.mjs
check-bcu-wallet-runtime-parity: OK

$ node scripts/check-bcu-wave-invalid-parity.mjs
check-bcu-wave-invalid-parity: OK

$ node scripts/check-bcu-wave-on-barrier-shield-block-parity.mjs
check-bcu-wave-on-barrier-shield-block-parity: OK

$ node scripts/check-bcu-unit-level-runtime-parity.mjs
check-bcu-unit-level-runtime-parity: OK

$ node scripts/check-bcu-barrier-shield-effect-parity.mjs
check-bcu-barrier-shield-effect-parity: OK

$ node scripts/check-bcu-burrow-lifecycle-parity.mjs
check-bcu-burrow-lifecycle-parity: OK

$ node scripts/check-bcu-castle-guard-parity.mjs
check-bcu-castle-guard-parity: OK

$ node scripts/check-bcu-spirit-bundle-manifest-parity.mjs
check-bcu-spirit-bundle-manifest-parity: OK spirits=21

$ node scripts/check-bcu-spirit-lifecycle-parity.mjs
check-bcu-spirit-lifecycle-parity: OK

$ node scripts/check-bcu-summon-runtime-parity.mjs
check-bcu-summon-runtime-parity: OK

$ node scripts/check-bcu-summon-procobject-loader-parity.mjs
check-bcu-summon-procobject-loader-parity: OK

$ node scripts/check-bcu-trait-targetforms-loader-parity.mjs
check-bcu-trait-targetforms-loader-parity: OK

$ node scripts/check-bcu-modifier-realdata-sweep-parity.mjs
check-bcu-modifier-realdata-sweep-parity: OK

$ node --check scripts/check-bcu-modifier-registry-failure-visibility.mjs

$ node scripts/check-bcu-modifier-registry-failure-visibility.mjs
[battle boot] combo registry load failed; combos disabled Error: loadBcuComboRegistry: semantic provider core-db unavailable
    at loadBcuComboRegistry (file:///workspaces/rhg/js/battle/bcu-runtime/BcuComboRegistryLoader.js:44:13)
    at installBcuComboRegistry (file:///workspaces/rhg/js/battle/bcu-runtime/BcuComboRegistryLoader.js:63:11)
    at file:///workspaces/rhg/scripts/check-bcu-modifier-registry-failure-visibility.mjs:43:20
[modifier] combo registry load failed; combo modifiers disabled: loadBcuComboRegistry: semantic provider core-db unavailable
[battle boot] talent registry load failed; talents disabled Error: loadBcuTalentRegistry: semantic provider core-db unavailable
    at loadBcuTalentRegistry (file:///workspaces/rhg/js/battle/bcu-runtime/BcuTalentRegistryLoader.js:54:13)
    at installBcuTalentRegistry (file:///workspaces/rhg/js/battle/bcu-runtime/BcuTalentRegistryLoader.js:76:11)
    at file:///workspaces/rhg/scripts/check-bcu-modifier-registry-failure-visibility.mjs:61:20
[modifier] talent registry load failed; talent modifiers disabled: loadBcuTalentRegistry: semantic provider core-db unavailable
check-bcu-modifier-registry-failure-visibility: OK

$ node scripts/check-bcu-zombie-extra-revive-source-range-parity.mjs
check-bcu-zombie-extra-revive-source-range-parity: OK

$ node scripts/check-formation-storage-failure-visibility.mjs
[storage] formation write failed: quota exceeded
[storage] formation read failed: read denied
[storage] stage write failed: quota exceeded
[storage] stage read failed: read denied
check-formation-storage-failure-visibility: OK

$ node scripts/check-bcu-battle-sound-effects-parity.mjs
check-bcu-battle-sound-effects-parity: OK

$ node scripts/check-bcu-counter-surge-reflect-parity.mjs
check-bcu-counter-surge-reflect-parity: OK

$ node scripts/check-boot-import-progress.mjs
check-boot-import-progress: OK

$ node scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs
check-bcu-zombie-corpse-soulstrike-parity: OK

$ node scripts/check-bcu-demon-shield-regen-timing.mjs
check-bcu-demon-shield-regen-timing: OK

$ node scripts/check-projectile-damage-parity.mjs
check-projectile-damage-parity: OK

$ node scripts/check-proc-immunity-resistance-parity.mjs
check-proc-immunity-resistance-parity: OK

$ node scripts/check-bcu-toxic-effect-parity.mjs
check-bcu-toxic-effect-parity: OK

$ node scripts/check-effect-bundle-aliases.mjs
check-effect-bundle-aliases: OK

$ node scripts/check-effect-coordinate-traces.mjs
check-effect-coordinate-traces: OK

$ node scripts/check-bcu-death-animation-parity.mjs
check-bcu-death-animation-parity: OK

$ node scripts/check-bcu-warp-lifecycle-parity.mjs
check-bcu-warp-lifecycle-parity: OK

$ node scripts/check-bcu-warp-interrupt-scene-parity.mjs
check-bcu-warp-interrupt-scene-parity: OK

$ node scripts/check-bcu-combo-proc-duration-parity.mjs
check-bcu-combo-proc-duration-parity: OK

$ node scripts/check-bcu-combo-speed-crit-parity.mjs
check-bcu-combo-speed-crit-parity: OK

$ node scripts/check-ability-partial-blockers.mjs
check-ability-partial-blockers: OK

$ node scripts/check-bcu-wave-surge-point-capture-parity.mjs
check-bcu-wave-surge-point-capture-parity: OK

$ node scripts/check-bcu-metal-abi-double-apply.mjs
check-bcu-metal-abi-double-apply: OK

$ node scripts/check-bcu-cat-cannon-runtime-parity.mjs
check-bcu-cat-cannon-runtime-parity: OK

$ node scripts/check-bcu-cat-cannon-effect-position-parity.mjs
check-bcu-cat-cannon-effect-position-parity: OK

$ node scripts/check-bcu-cat-cannon-wave-anim-parity.mjs
check-bcu-cat-cannon-wave-anim-parity: OK

$ node scripts/check-bcu-cannon-level-curve-parity.mjs
check-bcu-cannon-level-curve-parity: OK

$ node scripts/check-bcu-non-basic-cat-cannon-spec-parity.mjs
check-bcu-non-basic-cat-cannon-spec-parity: OK

$ node scripts/check-bcu-non-basic-cat-cannon-runtime-parity.mjs
check-bcu-non-basic-cat-cannon-runtime-parity: OK

$ node scripts/check-bcu-non-basic-cat-cannon-anim-parity.mjs
OK check-bcu-non-basic-cat-cannon-anim-parity: per-cannon BASE/ATK(EXT) eanim mapping + real-anim spawn with observable trace fallback

$ node scripts/check-bcu-enemy-castle-boss-spawn-parity.mjs
check-bcu-enemy-castle-boss-spawn-parity: OK

$ node --check scripts/check-bcu-enemy-castle-resolution.mjs

$ node scripts/check-bcu-enemy-castle-resolution.mjs
OK: CH_CASTLES length -> 53
OK: CH_CASTLES[0] -> 45
OK: CH_CASTLES[45] -> 0
OK: CH_CASTLES[46] -> 46
OK: explicit id 7 -> 7
OK: explicit id 0 -> 0
OK: EoC1 Zombie (stageNormal0_0_Z) -> 1045
OK: EoC2 Zombie (stageNormal0_1_Z) -> 1044
OK: EoC3 Zombie (stageNormal0_2_Z) -> 1043
OK: ItF1 (stageNormal1_0) -> 2042
OK: ItF2 (stageNormal1_1) -> 2041
OK: CotC1 (stageNormal2_0) -> 3039
OK: path basename -> 1045
OK: unknown -1 resolves real castle -> true
check-bcu-enemy-castle-resolution: OK

$ node scripts/check-actor-render-bounds-guard.mjs
OK: enemy 393 ラミエル attack renders all 236 frames (peak bounds 15000x11625, old cap 4096)
OK: actor render bounds guard rejects only non-finite/absurd, passes legitimate large animation frames

$ node scripts/check-battle-runtime-lightweight-guards.mjs
check-battle-runtime-lightweight-guards: OK

$ node scripts/check-battle-pause-control.mjs
check-battle-pause-control: OK (audio settings + pause/option control + sprite parity)

$ node scripts/check-battle-music-and-zombie-killer.mjs
check-battle-music-and-zombie-killer: OK (music pipeline + stage music + zombie killer SE)

$ node --check scripts/check-bcu-cat-cannon-wave-immunity-parity.mjs

$ node scripts/check-bcu-cat-cannon-wave-immunity-parity.mjs
check-bcu-cat-cannon-wave-immunity-parity: OK

$ node --check scripts/check-bcu-boss-knockback-castle-limit-parity.mjs

$ node scripts/check-bcu-boss-knockback-castle-limit-parity.mjs
check-bcu-boss-knockback-castle-limit-parity: OK

$ node --check scripts/build-bcu-stage-crown-index.mjs

$ node --check scripts/check-bcu-stage-crown-parity.mjs

$ node scripts/check-bcu-stage-crown-parity.mjs
check-bcu-stage-crown-parity: OK

$ node --check scripts/check-bcu-special-castle-resolution-parity.mjs

$ node scripts/check-bcu-special-castle-resolution-parity.mjs
check-bcu-special-castle-resolution-parity: OK

$ node --check scripts/build-bcu-slim-indexes.mjs

$ node --check scripts/check-bcu-slim-indexes-sync.mjs

$ node scripts/check-bcu-slim-indexes-sync.mjs
OK: public/assets/generated/bcu-actor-index.slim.json in sync (4364KB)
OK: public/assets/generated/bcu-background-index.slim.json in sync (1682KB)
OK: public/assets/generated/bcu-stage-index.slim.json in sync (11486KB)
check-bcu-slim-indexes-sync: OK

BCU ability parity safe suite summary:
- OK: node --check js/battle/bcu-runtime/BcuDelayRuntime.js
- OK: node --check js/battle/BcuDelayRuntimePatch.js
- OK: node --check js/battle/bcu-runtime/BcuWaveInvalidRuntime.js
- OK: node --check js/battle/BattleSceneBcuWaveInvalidApplyPatch.js
- OK: node --check js/battle/bcu-runtime/BcuBarrierShieldEffectRuntime.js
- OK: node --check js/battle/BattleActorBarrierShieldVisualPatch.js
- OK: node --check js/battle/BattleToxicEffectAssetPatch.js
- OK: node --check js/battle/BcuProcImmunityVisualPatch.js
- OK: node --check js/battle/BattleWaveEffectLoader.js
- OK: node --check js/ui/PlayerProductionBar.js
- OK: node --check js/ui/ProductionCardSkin.js
- OK: node --check js/ui/ProductionCardDogIconFitPatch.js
- OK: node --check js/bcu/BcuStageDifficultyRuntime.js
- OK: node --check js/ui/FormationStageDifficultyPatch.js
- OK: node --check js/battle/bcu-runtime/BcuUnitLevelRuntime.js
- OK: node --check js/battle/BattleSceneBcuUnitLevelPatch.js
- OK: node --check js/ui/FormationEditorBcuUnitLevelPatch.js
- OK: node --check js/bcu/BcuUnitRepository.js
- OK: node --check js/battle/PlayableCharacterRegistry.js
- OK: node --check js/battle/FormationStore.js
- OK: node --check scripts/build-bcu-core-db-bundle.mjs
- OK: node --check scripts/build-bcu-wave-effect-bundle.mjs
- OK: node --check js/battle/BattleSceneBcuWaveOnBlockedHitPatch.js
- OK: node --check js/battle/bcu-runtime/BcuSummonRuntime.js
- OK: node --check js/battle/BattleSceneBcuSummonPatch.js
- OK: node --check js/battle/BattleActorZombieRevivePatch.js
- OK: node --check js/battle/BcuStorageDiagnostics.js
- OK: node --check js/battle/StageRegistry.js
- OK: node --check js/battle/bcu-runtime/BcuCatCannonRuntime.js
- OK: node --check js/battle/bcu-runtime/BcuCannonLevelCurve.js
- OK: node --check js/battle/BattleSceneBcuCatCannonPatch.js
- OK: node --check js/battle/BattleSceneRendererEffectGlowPatch.js
- OK: node --check js/battle/BattleSceneAttackEffectPatch.js
- OK: node --check js/battle/bcu-runtime/BcuEnemyCastleBossSpawn.js
- OK: node --check js/preview/PreviewAppBattleResultOverlayPatch.js
- OK: node --check scripts/check-bcu-stage-difficulty-parity.mjs
- OK: node --check scripts/check-production-card-icon-source-parity.mjs
- OK: node --check scripts/check-bcu-parser-indexes.mjs
- OK: node --check scripts/check-bcu-delay-runtime.mjs
- OK: node --check scripts/check-bcu-stage-line-row-parity.mjs
- OK: node --check scripts/check-bcu-wallet-runtime-parity.mjs
- OK: node --check scripts/check-bcu-wave-invalid-parity.mjs
- OK: node --check scripts/check-bcu-wave-on-barrier-shield-block-parity.mjs
- OK: node --check scripts/check-bcu-unit-level-runtime-parity.mjs
- OK: node --check scripts/check-bcu-barrier-shield-effect-parity.mjs
- OK: node --check scripts/check-bcu-burrow-lifecycle-parity.mjs
- OK: node --check scripts/check-bcu-castle-guard-parity.mjs
- OK: node --check scripts/check-bcu-spirit-bundle-manifest-parity.mjs
- OK: node --check scripts/check-bcu-spirit-lifecycle-parity.mjs
- OK: node --check scripts/check-bcu-spirit-cooldown-emphasize-parity.mjs
- OK: node --check scripts/check-bcu-summon-runtime-parity.mjs
- OK: node --check scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs
- OK: node --check scripts/check-bcu-demon-shield-regen-timing.mjs
- OK: node --check scripts/check-projectile-damage-parity.mjs
- OK: node --check scripts/check-proc-immunity-resistance-parity.mjs
- OK: node --check scripts/check-bcu-toxic-effect-parity.mjs
- OK: node --check scripts/check-effect-bundle-aliases.mjs
- OK: node --check scripts/check-effect-coordinate-traces.mjs
- OK: node --check scripts/check-bcu-death-animation-parity.mjs
- OK: node --check scripts/check-bcu-warp-lifecycle-parity.mjs
- OK: node --check scripts/check-bcu-warp-interrupt-scene-parity.mjs
- OK: node --check scripts/check-bcu-combo-proc-duration-parity.mjs
- OK: node --check scripts/check-bcu-combo-speed-crit-parity.mjs
- OK: node --check scripts/check-ability-partial-blockers.mjs
- OK: node --check scripts/check-bcu-wave-surge-point-capture-parity.mjs
- OK: node --check scripts/check-bcu-metal-abi-double-apply.mjs
- OK: node --check scripts/check-actor-render-bounds-guard.mjs
- OK: node --check scripts/check-battle-runtime-lightweight-guards.mjs
- OK: node scripts/check-bcu-stage-difficulty-parity.mjs
- OK: node scripts/check-production-card-icon-source-parity.mjs
- OK: node scripts/check-bcu-parser-indexes.mjs
- OK: node scripts/check-bcu-delay-runtime.mjs
- OK: node scripts/check-bcu-stage-line-row-parity.mjs
- OK: node scripts/check-bcu-wallet-runtime-parity.mjs
- OK: node scripts/check-bcu-wave-invalid-parity.mjs
- OK: node scripts/check-bcu-wave-on-barrier-shield-block-parity.mjs
- OK: node scripts/check-bcu-unit-level-runtime-parity.mjs
- OK: node scripts/check-bcu-barrier-shield-effect-parity.mjs
- OK: node scripts/check-bcu-burrow-lifecycle-parity.mjs
- OK: node scripts/check-bcu-castle-guard-parity.mjs
- OK: node scripts/check-bcu-spirit-bundle-manifest-parity.mjs
- OK: node scripts/check-bcu-spirit-lifecycle-parity.mjs
- OK: node scripts/check-bcu-summon-runtime-parity.mjs
- OK: node scripts/check-bcu-summon-procobject-loader-parity.mjs
- OK: node scripts/check-bcu-trait-targetforms-loader-parity.mjs
- OK: node scripts/check-bcu-modifier-realdata-sweep-parity.mjs
- OK: node --check scripts/check-bcu-modifier-registry-failure-visibility.mjs
- OK: node scripts/check-bcu-modifier-registry-failure-visibility.mjs
- OK: node scripts/check-bcu-zombie-extra-revive-source-range-parity.mjs
- OK: node scripts/check-formation-storage-failure-visibility.mjs
- OK: node scripts/check-bcu-battle-sound-effects-parity.mjs
- OK: node scripts/check-bcu-counter-surge-reflect-parity.mjs
- OK: node scripts/check-boot-import-progress.mjs
- OK: node scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs
- OK: node scripts/check-bcu-demon-shield-regen-timing.mjs
- OK: node scripts/check-projectile-damage-parity.mjs
- OK: node scripts/check-proc-immunity-resistance-parity.mjs
- OK: node scripts/check-bcu-toxic-effect-parity.mjs
- OK: node scripts/check-effect-bundle-aliases.mjs
- OK: node scripts/check-effect-coordinate-traces.mjs
- OK: node scripts/check-bcu-death-animation-parity.mjs
- OK: node scripts/check-bcu-warp-lifecycle-parity.mjs
- OK: node scripts/check-bcu-warp-interrupt-scene-parity.mjs
- OK: node scripts/check-bcu-combo-proc-duration-parity.mjs
- OK: node scripts/check-bcu-combo-speed-crit-parity.mjs
- OK: node scripts/check-ability-partial-blockers.mjs
- OK: node scripts/check-bcu-wave-surge-point-capture-parity.mjs
- OK: node scripts/check-bcu-metal-abi-double-apply.mjs
- OK: node scripts/check-bcu-cat-cannon-runtime-parity.mjs
- OK: node scripts/check-bcu-cat-cannon-effect-position-parity.mjs
- OK: node scripts/check-bcu-cat-cannon-wave-anim-parity.mjs
- OK: node scripts/check-bcu-cannon-level-curve-parity.mjs
- OK: node scripts/check-bcu-non-basic-cat-cannon-spec-parity.mjs
- OK: node scripts/check-bcu-non-basic-cat-cannon-runtime-parity.mjs
- OK: node scripts/check-bcu-non-basic-cat-cannon-anim-parity.mjs
- OK: node scripts/check-bcu-enemy-castle-boss-spawn-parity.mjs
- OK: node --check scripts/check-bcu-enemy-castle-resolution.mjs
- OK: node scripts/check-bcu-enemy-castle-resolution.mjs
- OK: node scripts/check-actor-render-bounds-guard.mjs
- OK: node scripts/check-battle-runtime-lightweight-guards.mjs
- OK: node scripts/check-battle-pause-control.mjs
- OK: node scripts/check-battle-music-and-zombie-killer.mjs
- OK: node --check scripts/check-bcu-cat-cannon-wave-immunity-parity.mjs
- OK: node scripts/check-bcu-cat-cannon-wave-immunity-parity.mjs
- OK: node --check scripts/check-bcu-boss-knockback-castle-limit-parity.mjs
- OK: node scripts/check-bcu-boss-knockback-castle-limit-parity.mjs
- OK: node --check scripts/build-bcu-stage-crown-index.mjs
- OK: node --check scripts/check-bcu-stage-crown-parity.mjs
- OK: node scripts/check-bcu-stage-crown-parity.mjs
- OK: node --check scripts/check-bcu-special-castle-resolution-parity.mjs
- OK: node scripts/check-bcu-special-castle-resolution-parity.mjs
- OK: node --check scripts/build-bcu-slim-indexes.mjs
- OK: node --check scripts/check-bcu-slim-indexes-sync.mjs
- OK: node scripts/check-bcu-slim-indexes-sync.mjs

check-bcu-ability-parity-safe-suite: OK

Exit code: 0

## npm test
$ npm test

> rhg-bcu-battle@1.0.0 test
> node --test tests/*.test.mjs

✔ AppLoadingOverlay show resets progress for reused overlay instances (3.873297ms)
✔ damage queue is excused in insertion order (no side/position/key resort) (4.581095ms)
✔ player-before-enemy insertion order (the BCU direction-pass order) is preserved (0.331808ms)
✔ known BCU battle actions map to lineup change sentinels (2.249782ms)
✔ inherited object names fall through to slot indexes when slot is finite (0.239597ms)
✔ inherited object names return null when no finite slot is present (0.231301ms)
✔ unknown actions fall through to slot index or null (0.212946ms)
✔ BcuCombatModel parses unit full IMU* guard fields (3.720923ms)
✔ BcuCombatModel parses enemy full IMU* guard fields with confirmed DataEnemy columns (1.120457ms)
✔ applyBcuProc rejects full immunity status procs without state side effects (3.737133ms)
✔ applyBcuProc applies partial resistance to status duration and toxic damage (2.751657ms)
✔ IMUWEAK smartImu follows BCU checkSmartImu direction (0.660932ms)
✔ applyBcuProc applies partial knockback resistance to proc KB distance (0.942085ms)
✔ ProcResolver suppresses curse and seal proc groups before runtime apply (2.995261ms)
✔ guardBcuDamage rejects wave, surge, blast, and toxic queue before damage is pending (1.075964ms)
✔ queueAttackDamage applies partial wave resistance before enqueueing damage (6.380648ms)
✔ queueAttackDamage guard rejection does not enqueue pending damage or procs (1.134273ms)
✔ normal queueAttackDamage still enqueues regular attack damage (1.160312ms)
✔ curse and seal suppress DamageAbilityResolver trait ability multipliers and restore when expired (1.624237ms)
✔ seal suppresses strongAttack and critical procs in damage resolver (0.479092ms)
✔ critical BattleScene wrapper chain remains callable after parity imports (0.455018ms)
✔ BattleAttackProfile maps per-hit abi flags onto attack events as bcuHitAbi (2.188798ms)
✔ ProcResolver gates attack procs per hit on bcuHitAbi != 1 (BCU abis[ind] == 1 setProc gate) (1.646528ms)
✔ ProcResolver keeps entity-level zombieKiller/soulstrike exempt from the hit abi gate (0.411597ms)
✔ DamageAbilityResolver gates strongAttack/critical procs per hit on bcuHitAbi != 1 (0.46689ms)
✔ zombie revive enters attack-wait immediately when an enemy is in touch range (BCU update2 checkTouch) (12.5478ms)
✔ CopRand nextFloat(seed=0) matches BCU/Java float vector exactly (1.184757ms)
✔ CopRand nextFloat results are exact Java floats (Math.fround stable) (0.198109ms)
✔ CopRand nextDouble consumes the seed identically to nextFloat (0.260525ms)
✔ CopRand is reproducible from the same 64-bit seed (1.6531ms)
✔ CopRand drawCount tracks the number of seeded draws (0.189624ms)
✔ JavaRandom matches java.util.Random nextInt/nextLong for seed=0 (0.196396ms)
✔ normalizeBattleSeed parses strings and clamps to signed 64-bit; randomBattleSeed is in range (0.274752ms)
✔ direction sort is stable: dire -1 (player) before +1 (enemy), insertion order kept on ties (1.489495ms)
✔ direction sort falls back to side when direction is absent (dog-player => -1) (0.248934ms)
✔ layer sort is stable: ascending currentLayer, insertion order kept within a layer (0.309707ms)
✔ same-direction, same-position entities are NOT reordered (no pos/instanceId tiebreak) (0.288087ms)
✔ will=0 enemy occupies exactly 1 slot (1.076296ms)
✔ will=2 enemy occupies 3 slots (will + 1) (0.170658ms)
✔ an enemy in final knockback is still counted (0.159457ms)
✔ a 'dead' enemy still playing its death animation (not removable) is counted (0.225049ms)
✔ a 'dead' enemy that is BCU-removable is NOT counted (0.17209ms)
✔ mixed roster sums will+1 per non-dead enemy and ignores removed/removable ones (0.275634ms)
✔ boss-as-base (EEnemy) adds will+1; an ECastle base does not (0.248713ms)
✔ constructor draws row first-frame BEFORE the global respawn (BCU StageBasis order) (1.423372ms)
✔ commit draws row respawn -> spawn layer -> global respawn; spawn frame and layer are exact (1.515694ms)
✔ a failed spawn (rejectSpawn) consumes no RNG (0.444158ms)
✔ computeBcuTouchState: Target Only with only an incompatible enemy in range -> touch true, touchEnemy false (1.683686ms)
✔ computeBcuTouchState: adding a trait-compatible enemy flips touchEnemy true (0.417918ms)
✔ computeBcuTouchState: Target Only with only the enemy base in range -> touchEnemy true (base counts) (0.295891ms)
✔ computeBcuTouchState: non-Target-Only unit attacks any in-range enemy (touchEnemy == touch) (0.203378ms)
✔ computeBcuTouchState: nothing in range -> touch false, touchEnemy false (0.260325ms)
ℹ tests 52
ℹ suites 0
ℹ pass 52
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1892.150734

Exit code: 0

## npm run lint --if-present
$ npm run lint --if-present

Exit code: 0

## npm run build --if-present
$ npm run build --if-present

> rhg-bcu-battle@1.0.0 build
> vite build

vite v8.1.0 building client environment for production...
[2Ktransforming...
/rhg/assets/vendor/bootstrap-icons/bootstrap-icons.min.css doesn't exist at build time, it will remain unchanged to be resolved at runtime

/rhg/assets/ui/nyanko-menu-bg.png referenced in /rhg/assets/ui/nyanko-menu-bg.png didn't resolve at build time, it will remain unchanged to be resolved at runtime

/rhg/assets/ui/nyanko-battle-load-bg.png referenced in /rhg/assets/ui/nyanko-battle-load-bg.png didn't resolve at build time, it will remain unchanged to be resolved at runtime

/rhg/assets/ui/nyanko-ui-stamp.svg referenced in /rhg/assets/ui/nyanko-ui-stamp.svg didn't resolve at build time, it will remain unchanged to be resolved at runtime

/rhg/assets/FOT-大江戸勘亭流 Std E.otf referenced in /rhg/assets/FOT-大江戸勘亭流 Std E.otf didn't resolve at build time, it will remain unchanged to be resolved at runtime
✓ 282 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                                   2.72 kB │ gzip:  1.34 kB
dist/assets/nyanko-stage-selector-pro-DZ_9GIkk.css               20.22 kB │ gzip:  3.41 kB
dist/assets/index-BqVnFC8Q.css                                  163.45 kB │ gzip: 26.21 kB
dist/assets/installBcuPatches-CSxvAhkH.js                         0.39 kB │ gzip:  0.26 kB
dist/assets/BcuModifierDiagnostics-0ktZapK-.js                    0.68 kB │ gzip:  0.41 kB
dist/assets/installUiPatches-kxa96f9S.js                          0.73 kB │ gzip:  0.44 kB
dist/assets/BcuImgCut-Dl3DzW60.js                                 0.76 kB │ gzip:  0.49 kB
dist/assets/battleDirectPatches-CS5RroPu.js                       0.86 kB │ gzip:  0.45 kB
dist/assets/installBattleRendererPatches-zdcy3iMT.js              0.93 kB │ gzip:  0.51 kB
dist/assets/installBattleCorePatches-Be67e39S.js                  0.95 kB │ gzip:  0.52 kB
dist/assets/installBattleProjectilePatches-DrbRUgW-.js            0.97 kB │ gzip:  0.52 kB
dist/assets/BcuComboRegistryLoader-BoSRIusU.js                    1.02 kB │ gzip:  0.58 kB
dist/assets/installBattleActorLifecyclePatches-BZFRxAQd.js        1.10 kB │ gzip:  0.58 kB
dist/assets/BcuExtraActorAnimationBundlePatch-DVYv3haB.js         1.52 kB │ gzip:  0.79 kB
dist/assets/AudioSettings-BjmvYlQ-.js                             1.66 kB │ gzip:  0.66 kB
dist/assets/BcuTalentRegistryLoader-X_PTvVCz.js                   1.71 kB │ gzip:  0.88 kB
dist/assets/installBattleScenePatches-Dy_FKrR2.js                 1.75 kB │ gzip:  0.76 kB
dist/assets/BattleTouchGuard-sEjdcWfn.js                          1.76 kB │ gzip:  0.79 kB
dist/assets/PreviewAppBattleMusicPatch-C30VvVHD.js                1.90 kB │ gzip:  0.84 kB
dist/assets/PreviewAppCustomStageBattleConfigPatch-DySghrkS.js    1.97 kB │ gzip:  0.87 kB
dist/assets/runtimePatches-iJeA1mxn.js                            2.12 kB │ gzip:  0.86 kB
dist/assets/BattleSceneBcuTouchPatch-QuZjYXXX.js                  2.16 kB │ gzip:  0.90 kB
dist/assets/PreviewAppPageTransitionPatch-Dd9NbpZf.js             2.19 kB │ gzip:  0.94 kB
dist/assets/BcuWaveBundleEffectSpawner-CHiOw5hP.js                2.98 kB │ gzip:  1.45 kB
dist/assets/installBattlePatches-D9FKvdJL.js                      3.21 kB │ gzip:  1.11 kB
dist/assets/RuntimeAssetGuard-BRw2XkJD.js                         3.23 kB │ gzip:  1.39 kB
dist/assets/BcuAssetDatabase-z22IXhrf.js                          3.35 kB │ gzip:  1.14 kB
dist/assets/BattleSoundEventPatch-b28P0pYw.js                     4.74 kB │ gzip:  2.00 kB
dist/assets/BcuResistRuntime-CNh-d7Eb.js                          4.90 kB │ gzip:  1.92 kB
dist/assets/PreviewAppBattleResultOverlayPatch-BAezTWsN.js        5.06 kB │ gzip:  2.11 kB
dist/assets/BcuComboStatModifier-DHuRy_8U.js                      5.10 kB │ gzip:  2.23 kB
dist/assets/BcuBarrierShieldEffectRuntime-DPp0-MNg.js             6.10 kB │ gzip:  2.11 kB
dist/assets/BcuWarpLifecycleRuntime-nin-FQIA.js                   6.67 kB │ gzip:  2.58 kB
dist/assets/BcuSpriteText-Cxo1P_3f.js                             8.17 kB │ gzip:  2.59 kB
dist/assets/index-feAXEv7K.js                                     9.08 kB │ gzip:  3.80 kB
dist/assets/BattleSoundEffects-CP9l6PBd.js                        9.15 kB │ gzip:  3.30 kB
dist/assets/BcuCombatModel-BV-AUOiZ.js                           10.16 kB │ gzip:  3.70 kB
dist/assets/BattleSurgeRuntimePatch-Btib4sqW.js                  11.22 kB │ gzip:  4.23 kB
dist/assets/StageRuntimeSceneAdapter-kia5Vaxm.js                 11.60 kB │ gzip:  3.22 kB
dist/assets/BcuTalentInfoData-C0XKDm3m.js                        12.05 kB │ gzip:  4.03 kB
dist/assets/BattleWaveEffectLoader-ByGdEngG.js                   13.22 kB │ gzip:  3.02 kB
dist/assets/BcuAssetLoader-uyvXAJO_.js                           13.34 kB │ gzip:  4.43 kB
dist/assets/PreviewAppBattlePauseOverlayPatch-D6td2AJ_.js        15.56 kB │ gzip:  4.78 kB
dist/assets/BattleStatsLoader-CArpgFRO.js                        17.41 kB │ gzip:  5.70 kB
dist/assets/BcuStatusEffectManager-CD_zNYNZ.js                   20.91 kB │ gzip:  6.90 kB
dist/assets/battleRendererPatches-CXAL9dbN.js                    22.74 kB │ gzip:  7.88 kB
dist/assets/BcuCatCannonRuntime-pIGvBvFn.js                      24.04 kB │ gzip:  8.10 kB
dist/assets/BattleSceneRenderer-Bqchl5Qq.js                      32.09 kB │ gzip:  9.84 kB
dist/assets/battleProjectilePatches-BimeWX6G.js                  39.34 kB │ gzip: 11.26 kB
dist/assets/ProductionCardSkin-BWSeJKGr.js                       43.94 kB │ gzip: 13.70 kB
dist/assets/BcuBootLoader-CiZy9j2z.js                            44.10 kB │ gzip: 12.37 kB
dist/assets/BcuOrbModifier-2K13GtU-.js                           62.35 kB │ gzip: 19.19 kB
dist/assets/PreviewApp-BsGG8b0p.js                               62.74 kB │ gzip: 19.22 kB
dist/assets/battleCorePatches-AvjPpTf9.js                        74.45 kB │ gzip: 22.14 kB
dist/assets/battleScenePatches-UGx4Xyrz.js                       77.13 kB │ gzip: 21.96 kB
dist/assets/battleActorLifecyclePatches-0Z4afhmu.js              96.30 kB │ gzip: 27.64 kB
dist/assets/uiPatches-DhnzwR5T.js                               162.65 kB │ gzip: 40.40 kB
dist/assets/BattleScene-CePKhscw.js                             315.94 kB │ gzip: 86.42 kB

✓ built in 1.55s

Exit code: 0

