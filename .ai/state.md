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
