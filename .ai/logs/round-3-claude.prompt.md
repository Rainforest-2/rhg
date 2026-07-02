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
Round: 3 of 10
Repository: /workspaces/rhg

## Current AI State
# Current Status

## Discovered Issues
- No critical issues recorded yet.
- Round 2 audited `js/bcu`/`js/battle` partial subsets, found no live defect, and recorded the inert wallet income-combo inconsistency as unresolved.
- Fixed `js/input/BcuBattleInputAdapter.js` inherited-property action lookup: `in` treated `Object.prototype` names such as `toString` as known actions instead of falling through to slot index/null behavior.
- Fixed `js/audio/BattleSoundEventPatch.js` `throttle()` time source so the `performance` global is only referenced when defined, matching `AudioEngine._now()` fallback behavior.
- Fixed `js/boot/installBattlePatches.js` `runDirectImports` error recording so direct import failures append to a guaranteed boot error array before progress advances.
- Audited `js/bcu-render`; the chain is orphaned (no importer of `BcuEntityEffectIconRuntime.js`) and its class name collides with the live inline `BcuEntityEffectIconRuntime` in `BcuStatusEffectManager.js`. Recorded as a decision item; no code removed.
- Audited `js/preview` + `js/data`; found `js/data/bcuAvailableEnemyAssets.js` orphaned (no importer of `hasBcuEnemyAsset`/`BCU_AVAILABLE_ENEMY_IDS`) and it hardcodes enemy ids 0..299 as 'available', a fabricated availability index if ever wired in. Recorded as a decision item; no code removed.
- Fixed `js/ui/AppLoadingOverlay.js` so `show()` resets `lastProgressValue` and the visible progress bar, preventing the reused overlay's progress bar from sticking at 100% on every battle load after the first.

## Current Task
- Round 2 audit-only bookkeeping for partial `js/bcu` and `js/battle` read-throughs; no runtime change.

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
- `js/bcu` (partial) — read-through of `BcuIdentifier.js`, `BcuImgcutParser.js`, `BcuPathResolver.js`, `BcuText.js`, `BcuStageDifficultyRuntime.js`, `BcuAnimParser.js`, `BcuManifestLoader.js`; found consistent. Recorded the `resolveUnitAsset` hardcoded-base and `parseAnim` keyframe-skip read-through notes below.
- `js/battle` (partial) — read-through of `BattleEconomy.js`, `BattleCoordinate.js`, `BattleFrameClock.js`, `BattleConfig.js`, `BattleAttackProfile.js`, plus `js/battle/bcu-runtime/BcuStageCrownRuntime.js` and the two `js/ui` stage-difficulty filter patches (`FormationStageDifficultyPatch.js`, `FormationStageDifficultyFilterControlPatch.js`). Confirmed the `data-stage-filter-reset` button is handled by `FormationStageDifficultyPatch.onClick`, the always-true `isFiltering` is benign because every map includes ★1, and the previous-round `AppLoadingOverlay.js` `show()` progress-reset fix has no regression.

## Unaudited Major Areas
- `js/battle` (partial — economy/coordinate/frame-clock/config/attack-profile subset read round-2; most combat/patch files remain)
- `js/bcu` (partial — identifier/parsers/path/text/difficulty/manifest subset read round-2; ~20 files remain: `BcuAssetLoader`, `BcuBootLoader`, `BcuModelParser`, `BcuAnimator`, `AnimationRuntime`, repositories, `SemanticAssetProvider`, etc.)
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
- `js/bcu/BcuPathResolver.js` `resolveUnitAsset` fabricates a hardcoded `public/assets/bcu/000004/...` base when no unit image is found in `files`, unlike `resolveEnemyAsset`, which returns `null`; likely intentional for the default pack, but confirm against the semantic-ZIP-only asset rule before claiming this path clean.
- `js/bcu/BcuAnimParser.js` `parseAnim` advances `cursor` and `k` on a non-finite first keyframe field, so a malformed/blank line silently consumes one declared keyframe slot; this matches the current trust-`keyCount`/skip-junk defensive shape and does not desync the cursor, but remains a read-through note.
- `js/battle/BattleEconomy.js` `computeWalletIncomeInternal` applies the income combo as `mon *= Math.floor(incomePercent / 100) + 1` (whole-100%-step; sub-100% combos contribute nothing), which is inconsistent with the max-money combo path `getBcuWalletMaxMoney` that uses additive `(100 + maxMoneyComboPercent) / 100`. Both come from the same `walletOptions` shape. The combo path is currently inert (no caller passes `incomeComboPercent`/`maxMoneyComboPercent`; both multipliers evaluate to ×1) and has no `check-bcu-wallet-runtime-parity` coverage. Confirm BCU `StageBasis` money-increment / combo application before changing either formula; do not encode a guessed semantic.

## Completed
- Created AI management directory and core files.
- Added workflow scaffolding for the development loop.
- Documented usage in the repository README.

## Remaining
- Continue Claude -> Codex -> verification rounds until the minimum round count, priority blocker, unaudited major area, and verification stop conditions are all satisfied.


## Current Git Snapshot
# Round 3 Git Snapshot
Date: 2026-07-01T17:36:01Z

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
index 8377b36c4..76f2a2a7a 100644
--- a/.ai/changelog.md
+++ b/.ai/changelog.md
@@ -5,6 +5,8 @@
 - Record each meaningful change with context and verification notes.
 
 ## 2026-06-30
+- Recorded the round-2 audit-only `js/bcu` + `js/battle` partial read-through bookkeeping in `.ai/state.md`, including the unresolved inert wallet income-combo formula question; no runtime, test, or asset files changed. Verification passed: `npm run check`, `npm test` (52/52).
+- Recorded the round-4 `js/preview` + `js/data` audit in `.ai/state.md`, including the orphaned `bcuAvailableEnemyAssets.js` decision item and boss-music threshold parity question; no runtime code changed. Verification passed: orphan grep matched only `js/data/bcuAvailableEnemyAssets.js`, `node --check js/data/bcuAvailableEnemyAssets.js`, `npm run check`, `npm test` (51/51), and `npm run build`.
 - Added `npm run check` as the first orchestrator verification gate when the script exists.
 - Updated README and manual loop verification command lists to include `npm run check`.
 - Verification: `bash -n .ai/orchestrator.sh` passed; `npm run check` passed (`check-bcu-ability-parity-safe-suite: OK`); `npm test` passed (47/47); `grep -n "npm run check" .ai/orchestrator.sh README.md .ai/RUN_MANUALLY.md` confirmed all three references.
@@ -12,6 +14,7 @@
 ## Round 1 Codex Output
 - Corrected README round-log wording to state logs are saved every round; verification passed: corrected wording present, old phrasing absent, `npm run check`, `npm test` (47/47), and `npm run build`.
 - Fixed `BcuBattleInputAdapter` action lookup to require own string keys, added inherited-name/slot fallback tests, and updated `.ai/state.md` for the `js/input` audit. Verification passed: `node --check js/input/BcuBattleInputAdapter.js`, `node --check tests/bcu-battle-input-adapter.test.mjs`, `node --test tests/bcu-battle-input-adapter.test.mjs` (4/4), `npm run check`, and `npm test` (51/51).
+- Fixed `BattleSoundEventPatch` `throttle()` to guard the `performance` global before using `performance.now`, and updated `.ai/state.md` for the `js/audio` audit. Verification passed: `node --check js/audio/BattleSoundEventPatch.js`, `node scripts/check-battle-music-and-zombie-killer.mjs`, and `node scripts/check-bcu-battle-sound-effects-parity.mjs`.
 
 ## Round 1 Codex Output
 - Date: 2026-06-30T14:17:32Z
@@ -4556,3 +4559,83555 @@ tokens used
 
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
+check-bcu-castle-guard-par

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
index 6add6d0c0..628627a06 100644
--- a/.ai/review.md
+++ b/.ai/review.md
@@ -1,4 +1,4 @@
-Confirmed: `adaptBcuBattleAction('toString', { frontLineup: 1, slot: 2 })` returns the `toString` function instead of the correct slot index `7`. The `in` operator walks the prototype chain, so any action name colliding with an `Object.prototype` member (`toString`, `valueOf`, `constructor`, `hasOwnProperty`, `__proto__`, …) is misrouted. I also verified the previous round's orchestrator stop-logic and its `none`-detection regex are sound (the `^(...)$` anchors prevent false positives). Here is the review.
+I've completed a fresh audit of the unaudited `js/bcu` core parsers and part of `js/battle` (economy). Key findings: the previous `AppLoadingOverlay` patch is non-regressive, and I found a concrete internal inconsistency in `BattleEconomy`'s wallet-combo math — but it's currently inert (zero callers pass combo percents) and unverified by any parity check, so fixing it would require BCU evidence.
 
 # Review
 
@@ -9,39 +9,36 @@ None
 None
 
 ## Medium
-- `js/input/BcuBattleInputAdapter.js:7` — `adaptBcuBattleAction` uses `if (action in BCU_BATTLE_ACTIONS)`. The `in` operator includes inherited `Object.prototype` properties, so an action string such as `toString`, `valueOf`, `constructor`, or `hasOwnProperty` is treated as a known action and returns the inherited function instead of falling through to the slot-index path. Verified: `adaptBcuBattleAction('toString', { frontLineup: 1, slot: 2 })` returns `[Function: toString]` instead of `7`; `adaptBcuBattleAction('toString')` returns the function instead of `null`. With current callers `action` is only `ACTION_LINEUP_CHANGE_UP`/`DOWN` or `null`, so it is not reachable in the live path today, but it is a latent correctness defect with a one-line, behavior-preserving fix and no test coverage on this module.
+- **`js/battle/BattleEconomy.js:116` — the wallet income-combo multiplier is internally inconsistent with the max-money combo path, and is a latent trap.** `computeWalletIncomeInternal` applies the income combo as `mon *= Math.floor(this.walletCombo.incomePercent / 100) + 1`, i.e. a whole-100%-step multiplier (a +10% or +50% combo floors to `0 → ×1`, contributing nothing; only 100/200/300% take effect). The sibling max-money combo path (`getBcuWalletMaxMoney`, line 46) treats the same class of "combo percent" input as an additive percentage: `(100 + Math.floor(maxMoneyComboPercent)) / 100`, so a +20% combo correctly yields ×1.20. Both percents are populated from the same `walletOptions` shape in the constructor (lines 74-79), so one of the two formulas is almost certainly wrong. **Not currently blocking:** I confirmed via grep that nothing in `js/` ever passes `incomeComboPercent`/`maxMoneyComboPercent` (the only writer/reader is `BattleEconomy.js` itself; `BATTLE_CONFIG.economy.dogPlayer.wallet` sets no combo fields), so both multipliers evaluate to a no-op (`×1`) today, and `check-bcu-wallet-runtime-parity.mjs` exercises no combo path at all. Because this slice is a claimed BCU parity port ("BCU StageBasis money/work_lv/maxMoney/upgradeCost … parity slice") and the correct formula cannot be proven from the inspected evidence, this must be **recorded as unresolved**, not "fixed" toward a guessed semantic (doing so would fabricate a parity claim, against the repo guardrails).
 
 ## Low
-- `js/input/BcuBattleInputAdapter.js:1` — `BCU_BATTLE_ACTIONS` is a mutable export, unlike the sibling sound-id maps in `js/audio/BattleSoundEffects.js` which use `Object.freeze`. Freezing it is a cheap consistency/defensiveness improvement (optional; do only if it does not expand the task).
-- Previous round (orchestrator hardening) reviewed for regressions: `can_stop_after_round`, `review_has_priority_blockers`, and `state_has_unaudited_major_areas` ordering are correct, and the `^(none|...)$`-anchored regex does not misclassify actionable entries that merely start with "No". No action needed.
+- **`js/battle/BattleEconomy.js` wallet-combo feature is dead code** (zero callers pass any combo option; no parity-check coverage). Record as a decision/parity item alongside the income-combo inconsistency; do not remove or rewire this round.
+- **`js/bcu/BcuAnimParser.js:45-47` — the keyframe loop advances `cursor` and `k` on a non-finite first field (`continue`), so a malformed/blank line silently consumes one declared keyframe slot.** This matches "trust `keyCount`, skip junk" defensiveness and does not desync the cursor (both branches advance identically), so it is a read-through note, not a defect.
+- **`js/bcu/BcuPathResolver.js:34` — `resolveUnitAsset` fabricates a hardcoded `public/assets/bcu/000004/...` base when no unit image is found in `files`** (unlike `resolveEnemyAsset`, which returns `null`). Likely intentional for the default pack, but worth a later parity glance against the semantic-ZIP-only asset rule; record only.
+- Previous round's `js/ui/AppLoadingOverlay.js` `show()` progress-reset fix reviewed for regressions: `show()` resets `lastProgressValue = 0` and clears the bar to `0%` after `ensureRoot()`, the monotonic `Math.max` clamp in `setProgress` is untouched, and there is no bad interaction with `setError` (a later `show()` correctly re-zeros). No regression. No action.
 
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
+This is a fresh-audit round with no safe runtime change available (the only concrete finding is an inert, BCU-unverified parity formula that the guardrails forbid changing without source). Make **only** `.ai/state.md` bookkeeping + a changelog entry — no code, test, or asset changes:
+
+1. **`.ai/state.md` → `## Audited Areas`** — add two partial entries:
+   - `js/bcu` (partial) — read-through of `BcuIdentifier.js`, `BcuImgcutParser.js`, `BcuPathResolver.js`, `BcuText.js`, `BcuStageDifficultyRuntime.js`, `BcuAnimParser.js`, `BcuManifestLoader.js`; found consistent. Recorded the `resolveUnitAsset` hardcoded-base and `parseAnim` keyframe-skip read-through notes below.
+   - `js/battle` (partial) — read-through of `BattleEconomy.js`, `BattleCoordinate.js`, `BattleFrameClock.js`, `BattleConfig.js`, `BattleAttackProfile.js`, plus `js/battle/bcu-runtime/BcuStageCrownRuntime.js` and the two `js/ui` stage-difficulty filter patches (`FormationStageDifficultyPatch.js`, `FormationStageDifficultyFilterControlPatch.js` — confirmed the `data-stage-filter-reset` button is handled by `FormationStageDifficultyPatch.onClick`, and that the always-true `isFiltering` is benign because every map includes ★1). Confirmed the previous-round `AppLoadingOverlay.js` `show()` progress-reset fix has no regression.
+
+2. **`.ai/state.md` → `## Unaudited Major Areas`** — keep `js/battle` and `js/bcu` listed but annotate them partial:
+   - `js/battle` (partial — economy/coordinate/frame-clock/config/attack-profile subset read round-2; most combat/patch files remain)
+   - `js/bcu` (partial — identifier/parsers/path/text/difficulty/manifest subset read round-2; ~20 files remain: `BcuAssetLoader`, `BcuBootLoader`, `BcuModelParser`, `BcuAnimator`, `AnimationRuntime`, repositories, `SemanticAssetProvider`, etc.)
+   - Leave `js/ui` (partial), `scripts`, `tests` unchanged.
+
+3. **`.ai/state.md` → `## Unresolved`** — add:
+   - `js/battle/BattleEconomy.js` `computeWalletIncomeInternal` applies the income combo as `mon *= Math.floor(incomePercent/100)+1` (whole-100%-step; sub-100% combos contribute nothing), which is inconsistent with the max-money combo path `getBcuWalletMaxMoney` that uses additive `(100 + maxMoneyComboPercent)/100`. Both come from the same `walletOptions` shape. The combo path is currently inert (no caller passes `incomeComboPercent`/`maxMoneyComboPercent`; both multipliers evaluate to ×1) and has no `check-bcu-wallet-runtime-parity` coverage. Confirm BCU `StageBasis` money-increment / combo application before changing either formula; do not encode a guessed semantic.
+
+4. **`.ai/state.md` → `## Discovered Issues`** — add a one-line note that this round audited `js/bcu`/`js/battle` (partial), found no live defect, and recorded the inert wallet income-combo inconsistency as unresolved.
+
+5. Append a concise entry to `.ai/changelog.md` (audit-only round; no runtime change). Do not modify `## Current Task` beyond pointing it at this bookkeeping round.
 
 ## Verification Commands
-- `node --check js/input/BcuBattleInputAdapter.js`
-- `node --test tests/bcu-battle-input-adapter.test.mjs`
 - `npm run check`
 - `npm test`
 
 ## Stop Condition
-Not satisfied. This is round 1 of at least 5; verification has not yet run for this round; and `.ai/state.md` still lists many unaudited major areas (`js/battle`, `js/bcu`, `js/bcu-render`, `js/boot`, `js/data`, `js/preview`, `js/ui`, `js/audio`, `scripts`, `tests`, and `js/input` until this task lands). Continue the loop.
+Not satisfied. This is round 2 of at least 5. Although `Critical` and `High` are both `None`, `## Unaudited Major Areas` still lists actionable entries (`js/battle`, `js/bcu`, `js/ui` partial, `scripts`, `tests`), and there is a new open `Unresolved` parity question (wallet income-combo). Continue the loop.


### .ai/state.md
diff --git a/.ai/state.md b/.ai/state.md
index 8ec56b99f..68327f7e4 100644
--- a/.ai/state.md
+++ b/.ai/state.md
@@ -2,30 +2,50 @@
 
 ## Discovered Issues
 - No critical issues recorded yet.
+- Round 2 audited `js/bcu`/`js/battle` partial subsets, found no live defect, and recorded the inert wallet income-combo inconsistency as unresolved.
 - Fixed `js/input/BcuBattleInputAdapter.js` inherited-property action lookup: `in` treated `Object.prototype` names such as `toString` as known actions instead of falling through to slot index/null behavior.
+- Fixed `js/audio/BattleSoundEventPatch.js` `throttle()` time source so the `performance` global is only referenced when defined, matching `AudioEngine._now()` fallback behavior.
+- Fixed `js/boot/installBattlePatches.js` `runDirectImports` error recording so direct import failures append to a guaranteed boot error array before progress advances.
+- Audited `js/bcu-render`; the chain is orphaned (no importer of `BcuEntityEffectIconRuntime.js`) and its class name collides with the live inline `BcuEntityEffectIconRuntime` in `BcuStatusEffectManager.js`. Recorded as a decision item; no code removed.
+- Audited `js/preview` + `js/data`; found `js/data/bcuAvailableEnemyAssets.js` orphaned (no importer of `hasBcuEnemyAsset`/`BCU_AVAILABLE_ENEMY_IDS`) and it hardcodes enemy ids 0..299 as 'available', a fabricated availability index if ever wired in. Recorded as a decision item; no code removed.
+- Fixed `js/ui/AppLoadingOverlay.js` so `show()` resets `lastProgressValue` and the visible progress bar, preventing the reused overlay's progress bar from sticking at 100% on every battle load after the first.
 
 ## Current Task
-- Fix `js/input/BcuBattleInputAdapter.js` inherited-property action lookup and record the `js/input` audit state.
+- Round 2 audit-only bookkeeping for partial `js/bcu` and `js/battle` read-throughs; no runtime change.
 
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
+- `js/bcu` (partial) — read-through of `BcuIdentifier.js`, `BcuImgcutParser.js`, `BcuPathResolver.js`, `BcuText.js`, `BcuStageDifficultyRuntime.js`, `BcuAnimParser.js`, `BcuManifestLoader.js`; found consistent. Recorded the `resolveUnitAsset` hardcoded-base and `parseAnim` keyframe-skip read-through notes below.
+- `js/battle` (partial) — read-through of `BattleEconomy.js`, `BattleCoordinate.js`, `BattleFrameClock.js`, `BattleConfig.js`, `BattleAttackProfile.js`, plus `js/battle/bcu-runtime/BcuStageCrownRuntime.js` and the two `js/ui` stage-difficulty filter patches (`FormationStageDifficultyPatch.js`, `FormationStageDifficultyFilterControlPatch.js`). Confirmed the `data-stage-filter-reset` button is handled by `FormationStageDifficultyPatch.onClick`, the always-true `isFiltering` is benign because every map includes ★1, and the previous-round `AppLoadingOverlay.js` `show()` progress-reset fix has no regression.
 
 ## Unaudited Major Areas
-- `js/battle`
-- `js/bcu`
-- `js/bcu-render`
-- `js/boot`
-- `js/data`
-- `js/preview`
-- `js/ui`
-- `js/audio`
+- `js/battle` (partial — economy/coordinate/frame-clock/config/attack-profile subset read round-2; most combat/patch files remain)
+- `js/bcu` (partial — identifier/parsers/path/text/difficulty/manifest subset read round-2; ~20 files remain: `BcuAssetLoader`, `BcuBootLoader`, `BcuModelParser`, `BcuAnimator`, `AnimationRuntime`, repositories, `SemanticAssetProvider`, etc.)
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
+- `js/bcu/BcuPathResolver.js` `resolveUnitAsset` fabricates a hardcoded `public/assets/bcu/000004/...` base when no unit image is found in `files`, unlike `resolveEnemyAsset`, which returns `null`; likely intentional for the default pack, but confirm against the semantic-ZIP-only asset rule before claiming this path clean.
+- `js/bcu/BcuAnimParser.js` `parseAnim` advances `cursor` and `k` on a non-finite first keyframe field, so a malformed/blank line silently consumes one declared keyframe slot; this matches the current trust-`keyCount`/skip-junk defensive shape and does not desync the cursor, but remains a read-through note.
+- `js/battle/BattleEconomy.js` `computeWalletIncomeInternal` applies the income combo as `mon *= Math.floor(incomePercent / 100) + 1` (whole-100%-step; sub-100% combos contribute nothing), which is inconsistent with the max-money combo path `getBcuWalletMaxMoney` that uses additive `(100 + maxMoneyComboPercent) / 100`. Both come from the same `walletOptions` shape. The combo path is currently inert (no caller passes `incomeComboPercent`/`maxMoneyComboPercent`; both multipliers evaluate to ×1) and has no `check-bcu-wallet-runtime-parity` coverage. Confirm BCU `StageBasis` money-increment / combo application before changing either formula; do not encode a guessed semantic.
 
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
[Excerpt: tail 30000 bytes of 1293546 total bytes.]
AttackProfile.js`, plus `js/battle/bcu-runtime/BcuStageCrownRuntime.js` and the two `js/ui` stage-difficulty filter patches (`FormationStageDifficultyPatch.js`, `FormationStageDifficultyFilterControlPatch.js`). Confirmed the `data-stage-filter-reset` button is handled by `FormationStageDifficultyPatch.onClick`, the always-true `isFiltering` is benign because every map includes ★1, and the previous-round `AppLoadingOverlay.js` `show()` progress-reset fix has no regression.
 
 ## Unaudited Major Areas
-- `js/battle`
-- `js/bcu`
+- `js/battle` (partial — economy/coordinate/frame-clock/config/attack-profile subset read round-2; most combat/patch files remain)
+- `js/bcu` (partial — identifier/parsers/path/text/difficulty/manifest subset read round-2; ~20 files remain: `BcuAssetLoader`, `BcuBootLoader`, `BcuModelParser`, `BcuAnimator`, `AnimationRuntime`, repositories, `SemanticAssetProvider`, etc.)
 - `js/ui` (partial — loading-overlay/battle-HUD subset audited round-6; ~30 files remain: FormationEditor*, ProductionCardSkin, BcuStageCatalogBuilder, Nyanko*/Formation* patches, *Verifier files, etc.)
 - `scripts`
 - `tests`
@@ -40,6 +43,9 @@
 - `js/preview/PreviewAppBattleMusicPatch.js` `startBattleMusic`/`updateBattleMusic` use `pct <= threshold` with a default threshold of 100 (from `StageMusicResolver` when `bossHpThresholdPercent` is non-finite), so a stage with a distinct boss-music id and no explicit threshold begins battle directly on boss music; confirm against BCU MapStageData `mush` semantics whether boss music should start immediately at 100% or only strictly below threshold before changing this.
 - `js/ui/FormationStageDifficultyFilterControlPatch.js` `isFiltering` is always true because `filterState` coerces `star` through `normalizeCrownStar` to a finite value, so the stage-map list is always crown-star-filtered (default ★1) even with an empty query; confirm against intended BCU crown-difficulty default before treating as a defect.
 - `js/ui/BattleLoadingProgressVerifier.js` is orphaned (no importer) and only does static source-string checks; decide whether to wire it into the safe-suite or remove it.
+- `js/bcu/BcuPathResolver.js` `resolveUnitAsset` fabricates a hardcoded `public/assets/bcu/000004/...` base when no unit image is found in `files`, unlike `resolveEnemyAsset`, which returns `null`; likely intentional for the default pack, but confirm against the semantic-ZIP-only asset rule before claiming this path clean.
+- `js/bcu/BcuAnimParser.js` `parseAnim` advances `cursor` and `k` on a non-finite first keyframe field, so a malformed/blank line silently consumes one declared keyframe slot; this matches the current trust-`keyCount`/skip-junk defensive shape and does not desync the cursor, but remains a read-through note.
+- `js/battle/BattleEconomy.js` `computeWalletIncomeInternal` applies the income combo as `mon *= Math.floor(incomePercent / 100) + 1` (whole-100%-step; sub-100% combos contribute nothing), which is inconsistent with the max-money combo path `getBcuWalletMaxMoney` that uses additive `(100 + maxMoneyComboPercent) / 100`. Both come from the same `walletOptions` shape. The combo path is currently inert (no caller passes `incomeComboPercent`/`maxMoneyComboPercent`; both multipliers evaluate to x1) and has no `check-bcu-wallet-runtime-parity` coverage. Confirm BCU `StageBasis` money-increment / combo application before changing either formula; do not encode a guessed semantic.
 
 ## Completed
 - Created AI management directory and core files.

codex
One small wording cleanup remains: the requested unresolved note used “×1”; the file already contains non-ASCII audit text, so I’m matching that notation exactly.
apply patch
patch: completed
/workspaces/rhg/.ai/state.md
diff --git a/.ai/changelog.md b/.ai/changelog.md
index fc80d6e321149990a7c940f4b187bbb10993a82f..44bdc4a3603635e9f83aa0cca70c46f02bb3ca5f
--- a/.ai/changelog.md
+++ b/.ai/changelog.md
@@ -5,6 +5,7 @@
 - Record each meaningful change with context and verification notes.
 
 ## 2026-06-30
+- Recorded the round-2 audit-only `js/bcu` + `js/battle` partial read-through bookkeeping in `.ai/state.md`, including the unresolved inert wallet income-combo formula question; no runtime, test, or asset files changed. Verification passed: `npm run check`, `npm test` (52/52).
 - Recorded the round-4 `js/preview` + `js/data` audit in `.ai/state.md`, including the orphaned `bcuAvailableEnemyAssets.js` decision item and boss-music threshold parity question; no runtime code changed. Verification passed: orphan grep matched only `js/data/bcuAvailableEnemyAssets.js`, `node --check js/data/bcuAvailableEnemyAssets.js`, `npm run check`, `npm test` (51/51), and `npm run build`.
 - Added `npm run check` as the first orchestrator verification gate when the script exists.
 - Updated README and manual loop verification command lists to include `npm run check`.
@@ -69893,4 +69894,3 @@
 - next action: later rounds should inspect remaining `js/ui` files and resolve the recorded crown-filter and orphaned verifier questions.
 
 No commit or push performed. The worktree already contained unrelated `.ai`, audio, boot, and log changes; I preserved them.
-
diff --git a/.ai/state.md b/.ai/state.md
index ce69cb1cb4ac346c8ed277928485cf8738b5c4af..68327f7e47117873120479af5268a598d30e5a5c
--- a/.ai/state.md
+++ b/.ai/state.md
@@ -2,6 +2,7 @@
 
 ## Discovered Issues
 - No critical issues recorded yet.
+- Round 2 audited `js/bcu`/`js/battle` partial subsets, found no live defect, and recorded the inert wallet income-combo inconsistency as unresolved.
 - Fixed `js/input/BcuBattleInputAdapter.js` inherited-property action lookup: `in` treated `Object.prototype` names such as `toString` as known actions instead of falling through to slot index/null behavior.
 - Fixed `js/audio/BattleSoundEventPatch.js` `throttle()` time source so the `performance` global is only referenced when defined, matching `AudioEngine._now()` fallback behavior.
 - Fixed `js/boot/installBattlePatches.js` `runDirectImports` error recording so direct import failures append to a guaranteed boot error array before progress advances.
@@ -10,7 +11,7 @@
 - Fixed `js/ui/AppLoadingOverlay.js` so `show()` resets `lastProgressValue` and the visible progress bar, preventing the reused overlay's progress bar from sticking at 100% on every battle load after the first.
 
 ## Current Task
-- Fix the reused `AppLoadingOverlay` progress reset, add focused coverage, and record partial `js/ui` audit bookkeeping.
+- Round 2 audit-only bookkeeping for partial `js/bcu` and `js/battle` read-throughs; no runtime change.
 
 ## Audited Areas
 - `.ai/orchestrator.sh` verification command ordering and per-round logging behavior.
@@ -22,10 +23,12 @@
 - `js/preview` — full read-through of all 10 files (`PreviewApp.js`, `PreviewRenderer.js`, `PreviewUi.js`, `BattleSimulationClock.js`, `BattleCameraInputController.js`, `PreviewAppBattleMusicPatch.js`, `PreviewAppBattlePauseOverlayPatch.js`, `PreviewAppBattleResultOverlayPatch.js`, `PreviewAppCustomStageBattleConfigPatch.js`, `PreviewAppPageTransitionPatch.js`); found consistent. No runtime defect; the boss-music-start `<=` threshold default is recorded as a parity question below.
 - `js/data` — full read-through of all 3 files (`bcuStageManifest.js`, `previewAssets.js`, `bcuAvailableEnemyAssets.js`). Confirmed `bcuStageManifest` (via `StageRegistry`) and `previewAssets` (via `BattleScene`/`BattleActorFactory`/`PreviewApp`/`DebugBattleInspector`) are imported by live code, and `bcuAvailableEnemyAssets.js` has zero importers across `js/`, `scripts/`, and `tests/` (orphaned).
 - `js/ui` (partial) — read-through of `AppLoadingOverlay.js` (applied the `show()` progress-reset fix + new test), `BattleSpeedControl.js`, `BattlePauseMenu.js`, `SoundToggleControls.js`, `PlayerProductionBar.js`, `FormationStageDifficultyFilterControlPatch.js`, `BattleTouchGuard.js`.
+- `js/bcu` (partial) — read-through of `BcuIdentifier.js`, `BcuImgcutParser.js`, `BcuPathResolver.js`, `BcuText.js`, `BcuStageDifficultyRuntime.js`, `BcuAnimParser.js`, `BcuManifestLoader.js`; found consistent. Recorded the `resolveUnitAsset` hardcoded-base and `parseAnim` keyframe-skip read-through notes below.
+- `js/battle` (partial) — read-through of `BattleEconomy.js`, `BattleCoordinate.js`, `BattleFrameClock.js`, `BattleConfig.js`, `BattleAttackProfile.js`, plus `js/battle/bcu-runtime/BcuStageCrownRuntime.js` and the two `js/ui` stage-difficulty filter patches (`FormationStageDifficultyPatch.js`, `FormationStageDifficultyFilterControlPatch.js`). Confirmed the `data-stage-filter-reset` button is handled by `FormationStageDifficultyPatch.onClick`, the always-true `isFiltering` is benign because every map includes ★1, and the previous-round `AppLoadingOverlay.js` `show()` progress-reset fix has no regression.
 
 ## Unaudited Major Areas
-- `js/battle`
-- `js/bcu`
+- `js/battle` (partial — economy/coordinate/frame-clock/config/attack-profile subset read round-2; most combat/patch files remain)
+- `js/bcu` (partial — identifier/parsers/path/text/difficulty/manifest subset read round-2; ~20 files remain: `BcuAssetLoader`, `BcuBootLoader`, `BcuModelParser`, `BcuAnimator`, `AnimationRuntime`, repositories, `SemanticAssetProvider`, etc.)
 - `js/ui` (partial — loading-overlay/battle-HUD subset audited round-6; ~30 files remain: FormationEditor*, ProductionCardSkin, BcuStageCatalogBuilder, Nyanko*/Formation* patches, *Verifier files, etc.)
 - `scripts`
 - `tests`
@@ -40,6 +43,9 @@
 - `js/preview/PreviewAppBattleMusicPatch.js` `startBattleMusic`/`updateBattleMusic` use `pct <= threshold` with a default threshold of 100 (from `StageMusicResolver` when `bossHpThresholdPercent` is non-finite), so a stage with a distinct boss-music id and no explicit threshold begins battle directly on boss music; confirm against BCU MapStageData `mush` semantics whether boss music should start immediately at 100% or only strictly below threshold before changing this.
 - `js/ui/FormationStageDifficultyFilterControlPatch.js` `isFiltering` is always true because `filterState` coerces `star` through `normalizeCrownStar` to a finite value, so the stage-map list is always crown-star-filtered (default ★1) even with an empty query; confirm against intended BCU crown-difficulty default before treating as a defect.
 - `js/ui/BattleLoadingProgressVerifier.js` is orphaned (no importer) and only does static source-string checks; decide whether to wire it into the safe-suite or remove it.
+- `js/bcu/BcuPathResolver.js` `resolveUnitAsset` fabricates a hardcoded `public/assets/bcu/000004/...` base when no unit image is found in `files`, unlike `resolveEnemyAsset`, which returns `null`; likely intentional for the default pack, but confirm against the semantic-ZIP-only asset rule before claiming this path clean.
+- `js/bcu/BcuAnimParser.js` `parseAnim` advances `cursor` and `k` on a non-finite first keyframe field, so a malformed/blank line silently consumes one declared keyframe slot; this matches the current trust-`keyCount`/skip-junk defensive shape and does not desync the cursor, but remains a read-through note.
+- `js/battle/BattleEconomy.js` `computeWalletIncomeInternal` applies the income combo as `mon *= Math.floor(incomePercent / 100) + 1` (whole-100%-step; sub-100% combos contribute nothing), which is inconsistent with the max-money combo path `getBcuWalletMaxMoney` that uses additive `(100 + maxMoneyComboPercent) / 100`. Both come from the same `walletOptions` shape. The combo path is currently inert (no caller passes `incomeComboPercent`/`maxMoneyComboPercent`; both multipliers evaluate to ×1) and has no `check-bcu-wallet-runtime-parity` coverage. Confirm BCU `StageBasis` money-increment / combo application before changing either formula; do not encode a guessed semantic.
 
 ## Completed
 - Created AI management directory and core files.

diff --git a/.ai/changelog.md b/.ai/changelog.md
index fc80d6e321149990a7c940f4b187bbb10993a82f..44bdc4a3603635e9f83aa0cca70c46f02bb3ca5f
--- a/.ai/changelog.md
+++ b/.ai/changelog.md
@@ -5,6 +5,7 @@
 - Record each meaningful change with context and verification notes.
 
 ## 2026-06-30
+- Recorded the round-2 audit-only `js/bcu` + `js/battle` partial read-through bookkeeping in `.ai/state.md`, including the unresolved inert wallet income-combo formula question; no runtime, test, or asset files changed. Verification passed: `npm run check`, `npm test` (52/52).
 - Recorded the round-4 `js/preview` + `js/data` audit in `.ai/state.md`, including the orphaned `bcuAvailableEnemyAssets.js` decision item and boss-music threshold parity question; no runtime code changed. Verification passed: orphan grep matched only `js/data/bcuAvailableEnemyAssets.js`, `node --check js/data/bcuAvailableEnemyAssets.js`, `npm run check`, `npm test` (51/51), and `npm run build`.
 - Added `npm run check` as the first orchestrator verification gate when the script exists.
 - Updated README and manual loop verification command lists to include `npm run check`.
@@ -69893,4 +69894,3 @@
 - next action: later rounds should inspect remaining `js/ui` files and resolve the recorded crown-filter and orphaned verifier questions.
 
 No commit or push performed. The worktree already contained unrelated `.ai`, audio, boot, and log changes; I preserved them.
-
diff --git a/.ai/state.md b/.ai/state.md
index ce69cb1cb4ac346c8ed277928485cf8738b5c4af..68327f7e47117873120479af5268a598d30e5a5c
--- a/.ai/state.md
+++ b/.ai/state.md
@@ -2,6 +2,7 @@
 
 ## Discovered Issues
 - No critical issues recorded yet.
+- Round 2 audited `js/bcu`/`js/battle` partial subsets, found no live defect, and recorded the inert wallet income-combo inconsistency as unresolved.
 - Fixed `js/input/BcuBattleInputAdapter.js` inherited-property action lookup: `in` treated `Object.prototype` names such as `toString` as known actions instead of falling through to slot index/null behavior.
 - Fixed `js/audio/BattleSoundEventPatch.js` `throttle()` time source so the `performance` global is only referenced when defined, matching `AudioEngine._now()` fallback behavior.
 - Fixed `js/boot/installBattlePatches.js` `runDirectImports` error recording so direct import failures append to a guaranteed boot error array before progress advances.
@@ -10,7 +11,7 @@
 - Fixed `js/ui/AppLoadingOverlay.js` so `show()` resets `lastProgressValue` and the visible progress bar, preventing the reused overlay's progress bar from sticking at 100% on every battle load after the first.
 
 ## Current Task
-- Fix the reused `AppLoadingOverlay` progress reset, add focused coverage, and record partial `js/ui` audit bookkeeping.
+- Round 2 audit-only bookkeeping for partial `js/bcu` and `js/battle` read-throughs; no runtime change.
 
 ## Audited Areas
 - `.ai/orchestrator.sh` verification command ordering and per-round logging behavior.
@@ -22,10 +23,12 @@
 - `js/preview` — full read-through of all 10 files (`PreviewApp.js`, `PreviewRenderer.js`, `PreviewUi.js`, `BattleSimulationClock.js`, `BattleCameraInputController.js`, `PreviewAppBattleMusicPatch.js`, `PreviewAppBattlePauseOverlayPatch.js`, `PreviewAppBattleResultOverlayPatch.js`, `PreviewAppCustomStageBattleConfigPatch.js`, `PreviewAppPageTransitionPatch.js`); found consistent. No runtime defect; the boss-music-start `<=` threshold default is recorded as a parity question below.
 - `js/data` — full read-through of all 3 files (`bcuStageManifest.js`, `previewAssets.js`, `bcuAvailableEnemyAssets.js`). Confirmed `bcuStageManifest` (via `StageRegistry`) and `previewAssets` (via `BattleScene`/`BattleActorFactory`/`PreviewApp`/`DebugBattleInspector`) are imported by live code, and `bcuAvailableEnemyAssets.js` has zero importers across `js/`, `scripts/`, and `tests/` (orphaned).
 - `js/ui` (partial) — read-through of `AppLoadingOverlay.js` (applied the `show()` progress-reset fix + new test), `BattleSpeedControl.js`, `BattlePauseMenu.js`, `SoundToggleControls.js`, `PlayerProductionBar.js`, `FormationStageDifficultyFilterControlPatch.js`, `BattleTouchGuard.js`.
+- `js/bcu` (partial) — read-through of `BcuIdentifier.js`, `BcuImgcutParser.js`, `BcuPathResolver.js`, `BcuText.js`, `BcuStageDifficultyRuntime.js`, `BcuAnimParser.js`, `BcuManifestLoader.js`; found consistent. Recorded the `resolveUnitAsset` hardcoded-base and `parseAnim` keyframe-skip read-through notes below.
+- `js/battle` (partial) — read-through of `BattleEconomy.js`, `BattleCoordinate.js`, `BattleFrameClock.js`, `BattleConfig.js`, `BattleAttackProfile.js`, plus `js/battle/bcu-runtime/BcuStageCrownRuntime.js` and the two `js/ui` stage-difficulty filter patches (`FormationStageDifficultyPatch.js`, `FormationStageDifficultyFilterControlPatch.js`). Confirmed the `data-stage-filter-reset` button is handled by `FormationStageDifficultyPatch.onClick`, the always-true `isFiltering` is benign because every map includes ★1, and the previous-round `AppLoadingOverlay.js` `show()` progress-reset fix has no regression.
 
 ## Unaudited Major Areas
-- `js/battle`
-- `js/bcu`
+- `js/battle` (partial — economy/coordinate/frame-clock/config/attack-profile subset read round-2; most combat/patch files remain)
+- `js/bcu` (partial — identifier/parsers/path/text/difficulty/manifest subset read round-2; ~20 files remain: `BcuAssetLoader`, `BcuBootLoader`, `BcuModelParser`, `BcuAnimator`, `AnimationRuntime`, repositories, `SemanticAssetProvider`, etc.)
 - `js/ui` (partial — loading-overlay/battle-HUD subset audited round-6; ~30 files remain: FormationEditor*, ProductionCardSkin, BcuStageCatalogBuilder, Nyanko*/Formation* patches, *Verifier files, etc.)
 - `scripts`
 - `tests`
@@ -40,6 +43,9 @@
 - `js/preview/PreviewAppBattleMusicPatch.js` `startBattleMusic`/`updateBattleMusic` use `pct <= threshold` with a default threshold of 100 (from `StageMusicResolver` when `bossHpThresholdPercent` is non-finite), so a stage with a distinct boss-music id and no explicit threshold begins battle directly on boss music; confirm against BCU MapStageData `mush` semantics whether boss music should start immediately at 100% or only strictly below threshold before changing this.
 - `js/ui/FormationStageDifficultyFilterControlPatch.js` `isFiltering` is always true because `filterState` coerces `star` through `normalizeCrownStar` to a finite value, so the stage-map list is always crown-star-filtered (default ★1) even with an empty query; confirm against intended BCU crown-difficulty default before treating as a defect.
 - `js/ui/BattleLoadingProgressVerifier.js` is orphaned (no importer) and only does static source-string checks; decide whether to wire it into the safe-suite or remove it.
+- `js/bcu/BcuPathResolver.js` `resolveUnitAsset` fabricates a hardcoded `public/assets/bcu/000004/...` base when no unit image is found in `files`, unlike `resolveEnemyAsset`, which returns `null`; likely intentional for the default pack, but confirm against the semantic-ZIP-only asset rule before claiming this path clean.
+- `js/bcu/BcuAnimParser.js` `parseAnim` advances `cursor` and `k` on a non-finite first keyframe field, so a malformed/blank line silently consumes one declared keyframe slot; this matches the current trust-`keyCount`/skip-junk defensive shape and does not desync the cursor, but remains a read-through note.
+- `js/battle/BattleEconomy.js` `computeWalletIncomeInternal` applies the income combo as `mon *= Math.floor(incomePercent / 100) + 1` (whole-100%-step; sub-100% combos contribute nothing), which is inconsistent with the max-money combo path `getBcuWalletMaxMoney` that uses additive `(100 + maxMoneyComboPercent) / 100`. Both come from the same `walletOptions` shape. The combo path is currently inert (no caller passes `incomeComboPercent`/`maxMoneyComboPercent`; both multipliers evaluate to ×1) and has no `check-bcu-wallet-runtime-parity` coverage. Confirm BCU `StageBasis` money-increment / combo application before changing either formula; do not encode a guessed semantic.
 
 ## Completed
 - Created AI management directory and core files.

codex
## Summary
- Rows moved to code-complete-candidate: none
- Rows moved to human-visual-review-needed: none
- Rows still partial / unconfirmed: `js/battle`, `js/bcu`, `js/ui`, `scripts`, `tests`

## BCU references inspected
- files/classes/methods: none this turn; implemented the provided audit bookkeeping only.

## Changed files
- code: none
- tests: none
- docs: [.ai/state.md](/workspaces/rhg/.ai/state.md), [.ai/changelog.md](/workspaces/rhg/.ai/changelog.md)
- generated assets: none

## Verification
- `npm run check`: passed
- `npm test`: passed, 52/52

## Remaining risks
- risk: wallet income-combo behavior remains unresolved.
- reason: the formula is inert today and lacks BCU `StageBasis` evidence.
- next action: confirm BCU money-increment/combo application before changing `BattleEconomy`.

No commit or push performed.
diff --git a/.ai/changelog.md b/.ai/changelog.md
index fc80d6e321149990a7c940f4b187bbb10993a82f..44bdc4a3603635e9f83aa0cca70c46f02bb3ca5f
--- a/.ai/changelog.md
+++ b/.ai/changelog.md
@@ -5,6 +5,7 @@
 - Record each meaningful change with context and verification notes.
 
 ## 2026-06-30
+- Recorded the round-2 audit-only `js/bcu` + `js/battle` partial read-through bookkeeping in `.ai/state.md`, including the unresolved inert wallet income-combo formula question; no runtime, test, or asset files changed. Verification passed: `npm run check`, `npm test` (52/52).
 - Recorded the round-4 `js/preview` + `js/data` audit in `.ai/state.md`, including the orphaned `bcuAvailableEnemyAssets.js` decision item and boss-music threshold parity question; no runtime code changed. Verification passed: orphan grep matched only `js/data/bcuAvailableEnemyAssets.js`, `node --check js/data/bcuAvailableEnemyAssets.js`, `npm run check`, `npm test` (51/51), and `npm run build`.
 - Added `npm run check` as the first orchestrator verification gate when the script exists.
 - Updated README and manual loop verification command lists to include `npm run check`.
@@ -69893,4 +69894,3 @@
 - next action: later rounds should inspect remaining `js/ui` files and resolve the recorded crown-filter and orphaned verifier questions.
 
 No commit or push performed. The worktree already contained unrelated `.ai`, audio, boot, and log changes; I preserved them.
-
diff --git a/.ai/state.md b/.ai/state.md
index ce69cb1cb4ac346c8ed277928485cf8738b5c4af..68327f7e47117873120479af5268a598d30e5a5c
--- a/.ai/state.md
+++ b/.ai/state.md
@@ -2,6 +2,7 @@
 
 ## Discovered Issues
 - No critical issues recorded yet.
+- Round 2 audited `js/bcu`/`js/battle` partial subsets, found no live defect, and recorded the inert wallet income-combo inconsistency as unresolved.
 - Fixed `js/input/BcuBattleInputAdapter.js` inherited-property action lookup: `in` treated `Object.prototype` names such as `toString` as known actions instead of falling through to slot index/null behavior.
 - Fixed `js/audio/BattleSoundEventPatch.js` `throttle()` time source so the `performance` global is only referenced when defined, matching `AudioEngine._now()` fallback behavior.
 - Fixed `js/boot/installBattlePatches.js` `runDirectImports` error recording so direct import failures append to a guaranteed boot error array before progress advances.
@@ -10,7 +11,7 @@
 - Fixed `js/ui/AppLoadingOverlay.js` so `show()` resets `lastProgressValue` and the visible progress bar, preventing the reused overlay's progress bar from sticking at 100% on every battle load after the first.
 
 ## Current Task
-- Fix the reused `AppLoadingOverlay` progress reset, add focused coverage, and record partial `js/ui` audit bookkeeping.
+- Round 2 audit-only bookkeeping for partial `js/bcu` and `js/battle` read-throughs; no runtime change.
 
 ## Audited Areas
 - `.ai/orchestrator.sh` verification command ordering and per-round logging behavior.
@@ -22,10 +23,12 @@
 - `js/preview` — full read-through of all 10 files (`PreviewApp.js`, `PreviewRenderer.js`, `PreviewUi.js`, `BattleSimulationClock.js`, `BattleCameraInputController.js`, `PreviewAppBattleMusicPatch.js`, `PreviewAppBattlePauseOverlayPatch.js`, `PreviewAppBattleResultOverlayPatch.js`, `PreviewAppCustomStageBattleConfigPatch.js`, `PreviewAppPageTransitionPatch.js`); found consistent. No runtime defect; the boss-music-start `<=` threshold default is recorded as a parity question below.
 - `js/data` — full read-through of all 3 files (`bcuStageManifest.js`, `previewAssets.js`, `bcuAvailableEnemyAssets.js`). Confirmed `bcuStageManifest` (via `StageRegistry`) and `previewAssets` (via `BattleScene`/`BattleActorFactory`/`PreviewApp`/`DebugBattleInspector`) are imported by live code, and `bcuAvailableEnemyAssets.js` has zero importers across `js/`, `scripts/`, and `tests/` (orphaned).
 - `js/ui` (partial) — read-through of `AppLoadingOverlay.js` (applied the `show()` progress-reset fix + new test), `BattleSpeedControl.js`, `BattlePauseMenu.js`, `SoundToggleControls.js`, `PlayerProductionBar.js`, `FormationStageDifficultyFilterControlPatch.js`, `BattleTouchGuard.js`.
+- `js/bcu` (partial) — read-through of `BcuIdentifier.js`, `BcuImgcutParser.js`, `BcuPathResolver.js`, `BcuText.js`, `BcuStageDifficultyRuntime.js`, `BcuAnimParser.js`, `BcuManifestLoader.js`; found consistent. Recorded the `resolveUnitAsset` hardcoded-base and `parseAnim` keyframe-skip read-through notes below.
+- `js/battle` (partial) — read-through of `BattleEconomy.js`, `BattleCoordinate.js`, `BattleFrameClock.js`, `BattleConfig.js`, `BattleAttackProfile.js`, plus `js/battle/bcu-runtime/BcuStageCrownRuntime.js` and the two `js/ui` stage-difficulty filter patches (`FormationStageDifficultyPatch.js`, `FormationStageDifficultyFilterControlPatch.js`). Confirmed the `data-stage-filter-reset` button is handled by `FormationStageDifficultyPatch.onClick`, the always-true `isFiltering` is benign because every map includes ★1, and the previous-round `AppLoadingOverlay.js` `show()` progress-reset fix has no regression.
 
 ## Unaudited Major Areas
-- `js/battle`
-- `js/bcu`
+- `js/battle` (partial — economy/coordinate/frame-clock/config/attack-profile subset read round-2; most combat/patch files remain)
+- `js/bcu` (partial — identifier/parsers/path/text/difficulty/manifest subset read round-2; ~20 files remain: `BcuAssetLoader`, `BcuBootLoader`, `BcuModelParser`, `BcuAnimator`, `AnimationRuntime`, repositories, `SemanticAssetProvider`, etc.)
 - `js/ui` (partial — loading-overlay/battle-HUD subset audited round-6; ~30 files remain: FormationEditor*, ProductionCardSkin, BcuStageCatalogBuilder, Nyanko*/Formation* patches, *Verifier files, etc.)
 - `scripts`
 - `tests`
@@ -40,6 +43,9 @@
 - `js/preview/PreviewAppBattleMusicPatch.js` `startBattleMusic`/`updateBattleMusic` use `pct <= threshold` with a default threshold of 100 (from `StageMusicResolver` when `bossHpThresholdPercent` is non-finite), so a stage with a distinct boss-music id and no explicit threshold begins battle directly on boss music; confirm against BCU MapStageData `mush` semantics whether boss music should start immediately at 100% or only strictly below threshold before changing this.
 - `js/ui/FormationStageDifficultyFilterControlPatch.js` `isFiltering` is always true because `filterState` coerces `star` through `normalizeCrownStar` to a finite value, so the stage-map list is always crown-star-filtered (default ★1) even with an empty query; confirm against intended BCU crown-difficulty default before treating as a defect.
 - `js/ui/BattleLoadingProgressVerifier.js` is orphaned (no importer) and only does static source-string checks; decide whether to wire it into the safe-suite or remove it.
+- `js/bcu/BcuPathResolver.js` `resolveUnitAsset` fabricates a hardcoded `public/assets/bcu/000004/...` base when no unit image is found in `files`, unlike `resolveEnemyAsset`, which returns `null`; likely intentional for the default pack, but confirm against the semantic-ZIP-only asset rule before claiming this path clean.
+- `js/bcu/BcuAnimParser.js` `parseAnim` advances `cursor` and `k` on a non-finite first keyframe field, so a malformed/blank line silently consumes one declared keyframe slot; this matches the current trust-`keyCount`/skip-junk defensive shape and does not desync the cursor, but remains a read-through note.
+- `js/battle/BattleEconomy.js` `computeWalletIncomeInternal` applies the income combo as `mon *= Math.floor(incomePercent / 100) + 1` (whole-100%-step; sub-100% combos contribute nothing), which is inconsistent with the max-money combo path `getBcuWalletMaxMoney` that uses additive `(100 + maxMoneyComboPercent) / 100`. Both come from the same `walletOptions` shape. The combo path is currently inert (no caller passes `incomeComboPercent`/`maxMoneyComboPercent`; both multipliers evaluate to ×1) and has no `check-bcu-wallet-runtime-parity` coverage. Confirm BCU `StageBasis` money-increment / combo application before changing either formula; do not encode a guessed semantic.
 
 ## Completed
 - Created AI management directory and core files.

tokens used
106,316
## Summary
- Rows moved to code-complete-candidate: none
- Rows moved to human-visual-review-needed: none
- Rows still partial / unconfirmed: `js/battle`, `js/bcu`, `js/ui`, `scripts`, `tests`

## BCU references inspected
- files/classes/methods: none this turn; implemented the provided audit bookkeeping only.

## Changed files
- code: none
- tests: none
- docs: [.ai/state.md](/workspaces/rhg/.ai/state.md), [.ai/changelog.md](/workspaces/rhg/.ai/changelog.md)
- generated assets: none

## Verification
- `npm run check`: passed
- `npm test`: passed, 52/52

## Remaining risks
- risk: wallet income-combo behavior remains unresolved.
- reason: the formula is inert today and lacks BCU `StageBasis` evidence.
- next action: confirm BCU money-increment/combo application before changing `BattleEconomy`.

No commit or push performed.



## Previous Verification Output
[Excerpt: tail 30000 bytes of 32723 total bytes.]
bcu-barrier-shield-effect-parity.mjs

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

✔ AppLoadingOverlay show resets progress for reused overlay instances (3.522042ms)
✔ damage queue is excused in insertion order (no side/position/key resort) (1.740784ms)
✔ player-before-enemy insertion order (the BCU direction-pass order) is preserved (0.211945ms)
✔ known BCU battle actions map to lineup change sentinels (1.098667ms)
✔ inherited object names fall through to slot indexes when slot is finite (0.233104ms)
✔ inherited object names return null when no finite slot is present (0.17185ms)
✔ unknown actions fall through to slot index or null (0.19343ms)
✔ BcuCombatModel parses unit full IMU* guard fields (2.362572ms)
✔ BcuCombatModel parses enemy full IMU* guard fields with confirmed DataEnemy columns (0.734859ms)
✔ applyBcuProc rejects full immunity status procs without state side effects (3.373506ms)
✔ applyBcuProc applies partial resistance to status duration and toxic damage (2.18425ms)
✔ IMUWEAK smartImu follows BCU checkSmartImu direction (0.627339ms)
✔ applyBcuProc applies partial knockback resistance to proc KB distance (0.898334ms)
✔ ProcResolver suppresses curse and seal proc groups before runtime apply (1.82977ms)
✔ guardBcuDamage rejects wave, surge, blast, and toxic queue before damage is pending (0.728007ms)
✔ queueAttackDamage applies partial wave resistance before enqueueing damage (3.805971ms)
✔ queueAttackDamage guard rejection does not enqueue pending damage or procs (0.700515ms)
✔ normal queueAttackDamage still enqueues regular attack damage (0.879428ms)
✔ curse and seal suppress DamageAbilityResolver trait ability multipliers and restore when expired (1.395831ms)
✔ seal suppresses strongAttack and critical procs in damage resolver (0.431404ms)
✔ critical BattleScene wrapper chain remains callable after parity imports (0.345634ms)
✔ BattleAttackProfile maps per-hit abi flags onto attack events as bcuHitAbi (1.251672ms)
✔ ProcResolver gates attack procs per hit on bcuHitAbi != 1 (BCU abis[ind] == 1 setProc gate) (0.915195ms)
✔ ProcResolver keeps entity-level zombieKiller/soulstrike exempt from the hit abi gate (0.308354ms)
✔ DamageAbilityResolver gates strongAttack/critical procs per hit on bcuHitAbi != 1 (0.290652ms)
✔ zombie revive enters attack-wait immediately when an enemy is in touch range (BCU update2 checkTouch) (11.14753ms)
✔ CopRand nextFloat(seed=0) matches BCU/Java float vector exactly (1.566549ms)
✔ CopRand nextFloat results are exact Java floats (Math.fround stable) (0.248874ms)
✔ CopRand nextDouble consumes the seed identically to nextFloat (0.263691ms)
✔ CopRand is reproducible from the same 64-bit seed (2.505618ms)
✔ CopRand drawCount tracks the number of seeded draws (0.220682ms)
✔ JavaRandom matches java.util.Random nextInt/nextLong for seed=0 (0.200825ms)
✔ normalizeBattleSeed parses strings and clamps to signed 64-bit; randomBattleSeed is in range (0.620927ms)
✔ direction sort is stable: dire -1 (player) before +1 (enemy), insertion order kept on ties (2.016317ms)
✔ direction sort falls back to side when direction is absent (dog-player => -1) (0.256779ms)
✔ layer sort is stable: ascending currentLayer, insertion order kept within a layer (0.349351ms)
✔ same-direction, same-position entities are NOT reordered (no pos/instanceId tiebreak) (0.400507ms)
✔ will=0 enemy occupies exactly 1 slot (1.363029ms)
✔ will=2 enemy occupies 3 slots (will + 1) (0.210272ms)
✔ an enemy in final knockback is still counted (0.207467ms)
✔ a 'dead' enemy still playing its death animation (not removable) is counted (0.267718ms)
✔ a 'dead' enemy that is BCU-removable is NOT counted (0.22552ms)
✔ mixed roster sums will+1 per non-dead enemy and ignores removed/removable ones (0.274461ms)
✔ boss-as-base (EEnemy) adds will+1; an ECastle base does not (0.299007ms)
✔ constructor draws row first-frame BEFORE the global respawn (BCU StageBasis order) (1.423402ms)
✔ commit draws row respawn -> spawn layer -> global respawn; spawn frame and layer are exact (1.675232ms)
✔ a failed spawn (rejectSpawn) consumes no RNG (0.389346ms)
✔ computeBcuTouchState: Target Only with only an incompatible enemy in range -> touch true, touchEnemy false (1.668398ms)
✔ computeBcuTouchState: adding a trait-compatible enemy flips touchEnemy true (0.350713ms)
✔ computeBcuTouchState: Target Only with only the enemy base in range -> touchEnemy true (base counts) (0.326168ms)
✔ computeBcuTouchState: non-Target-Only unit attacks any in-range enemy (touchEnemy == touch) (0.208669ms)
✔ computeBcuTouchState: nothing in range -> touch false, touchEnemy false (0.235669ms)
ℹ tests 52
ℹ suites 0
ℹ pass 52
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1500.781937

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

[33m[PLUGIN_TIMINGS] [0mYour build spent significant time in plugins. Here is a breakdown:
  - vite:css-post (48%)
  - vite:css (15%)
  - vite:worker (13%)
  - vite:asset (10%)
  - vite:prepare-out-dir (7%)
See https://rolldown.rs/reference/InputOptions.checks#plugintimings for more details.

✓ built in 3.13s

Exit code: 0

