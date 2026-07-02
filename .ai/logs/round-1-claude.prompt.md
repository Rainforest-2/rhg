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
Round: 1 of 10
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

## Current Task
- Record the fresh `js/preview` + `js/data` audit state and defer any orphaned-scaffold removal or boss-music threshold decision pending evidence.

## Audited Areas
- `.ai/orchestrator.sh` verification command ordering and per-round logging behavior.
- `.ai` loop README wording for round log persistence.
- `js/input` — `BcuBattleInputAdapter.js` action mapping own-property fix with focused test coverage, plus read-through of `BcuDomTouchPolicy.js` and `BcuMobileGestureRuntime.js`.
- `js/audio` — read-through of `AudioEngine.js`, `MusicCatalog.js`, `AudioSettings.js`, `BattleSoundEffects.js`, `BattleSoundEventPatch.js`, `StageMusicResolver.js`; applied the `throttle()` `performance`-global guard fix.
- `js/boot` — read-through of `importProgress.js`, `installBattlePatches.js` (applied the `runDirectImports` defensive error-record fix), `installBcuPatches.js`, `installUiPatches.js`, and the `battle/install*Patches.js` shims + `groups/*` manifest imports; confirmed `installBcuBattleDataRegistries` passes the correct provider option key to each registry loader.
- `js/bcu-render` — full read-through of `BcuBlendRuntime.js`, `BcuEPartTransformRuntime.js`, `BcuEffAnimRuntime.js`, `BcuFakeGraphicsCanvas2D.js`. Verified the whole `js/bcu-render` chain is currently orphaned: its only battle bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` has zero importers, and the live status-icon runtime is the same-named inline class in `js/battle/bcu-runtime/BcuStatusEffectManager.js`. Also read the live status/render path (`BcuStatusEffectManager.js`, `BcuModelInstance.js`, `BcuSpriteSheet.js`, `BcuCanvasComposite.js`, `BcuStatusIconResolver.js`) and `StageRegistry.js` and found them consistent; confirmed the previous round's `installBattlePatches.js` `runDirectImports` fix has no regression.
- `js/preview` — full read-through of all 10 files (`PreviewApp.js`, `PreviewRenderer.js`, `PreviewUi.js`, `BattleSimulationClock.js`, `BattleCameraInputController.js`, `PreviewAppBattleMusicPatch.js`, `PreviewAppBattlePauseOverlayPatch.js`, `PreviewAppBattleResultOverlayPatch.js`, `PreviewAppCustomStageBattleConfigPatch.js`, `PreviewAppPageTransitionPatch.js`); found consistent. No runtime defect; the boss-music-start `<=` threshold default is recorded as a parity question below.
- `js/data` — full read-through of all 3 files (`bcuStageManifest.js`, `previewAssets.js`, `bcuAvailableEnemyAssets.js`). Confirmed `bcuStageManifest` (via `StageRegistry`) and `previewAssets` (via `BattleScene`/`BattleActorFactory`/`PreviewApp`/`DebugBattleInspector`) are imported by live code, and `bcuAvailableEnemyAssets.js` has zero importers across `js/`, `scripts/`, and `tests/` (orphaned).

## Unaudited Major Areas
- `js/battle`
- `js/bcu`
- `js/ui`
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

## Completed
- Created AI management directory and core files.
- Added workflow scaffolding for the development loop.
- Documented usage in the repository README.

## Remaining
- Continue Claude -> Codex -> verification rounds until the minimum round count, priority blocker, unaudited major area, and verification stop conditions are all satisfied.


## Current Git Snapshot
# Round 1 Git Snapshot
Date: 2026-07-01T17:12:12Z

## git status --short --untracked-files=no
[Limited to 200 lines; untracked files omitted.]
 M .ai/changelog.md
 M .ai/prompts/claude-review.md
 M .ai/review.md
 M .ai/state.md
 M js/audio/BattleSoundEventPatch.js
 M js/boot/installBattlePatches.js

## git diff --name-status
[Limited to 20 files; .ai/logs and node_modules omitted.]
M	.ai/changelog.md
M	.ai/prompts/claude-review.md
M	.ai/review.md
M	.ai/state.md
M	js/audio/BattleSoundEventPatch.js
M	js/boot/installBattlePatches.js


## Current git diff
[Excerpt: current git diff for configured project paths, excluding .ai/logs and node_modules, limited to 20 files and 12000 bytes per file; total budget 60000 bytes.]

### .ai/changelog.md
diff --git a/.ai/changelog.md b/.ai/changelog.md
index 8377b36c4..b6bb816da 100644
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
@@ -4556,3 +4558,42953 @@ tokens used
 
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
index 6add6d0c0..d9972fa51 100644
--- a/.ai/review.md
+++ b/.ai/review.md
@@ -1,4 +1,4 @@
-Confirmed: `adaptBcuBattleAction('toString', { frontLineup: 1, slot: 2 })` returns the `toString` function instead of the correct slot index `7`. The `in` operator walks the prototype chain, so any action name colliding with an `Object.prototype` member (`toString`, `valueOf`, `constructor`, `hasOwnProperty`, `__proto__`, …) is misrouted. I also verified the previous round's orchestrator stop-logic and its `none`-detection regex are sound (the `^(...)$` anchors prevent false positives). Here is the review.
+I've completed a thorough fresh audit of `js/preview` (all 10 files) and `js/data` (all 3 files). The concrete discovery is an orphaned data module. Here is my review.
 
 # Review
 
@@ -9,39 +9,35 @@ None
 None
 
 ## Medium
-- `js/input/BcuBattleInputAdapter.js:7` — `adaptBcuBattleAction` uses `if (action in BCU_BATTLE_ACTIONS)`. The `in` operator includes inherited `Object.prototype` properties, so an action string such as `toString`, `valueOf`, `constructor`, or `hasOwnProperty` is treated as a known action and returns the inherited function instead of falling through to the slot-index path. Verified: `adaptBcuBattleAction('toString', { frontLineup: 1, slot: 2 })` returns `[Function: toString]` instead of `7`; `adaptBcuBattleAction('toString')` returns the function instead of `null`. With current callers `action` is only `ACTION_LINEUP_CHANGE_UP`/`DOWN` or `null`, so it is not reachable in the live path today, but it is a latent correctness defect with a one-line, behavior-preserving fix and no test coverage on this module.
+- **`js/data/bcuAvailableEnemyAssets.js` is a fully orphaned module with a fabricated asset-availability index.** Verified by repo-wide grep (`.js`/`.mjs`/`.html`/`.json`, excluding `node_modules`/`.git`): there are **zero** references to `bcuAvailableEnemyAssets`, `hasBcuEnemyAsset`, or `BCU_AVAILABLE_ENEMY_IDS` outside the file itself — no static import, no dynamic import, no HTML/JSON manifest. (Control check confirms the sibling data files `previewAssets.js` and `bcuStageManifest.js` *are* imported by live `js/battle`/`js/preview` code, so the grep is reliable.) Beyond being dead code, the module hardcodes `new Set(0..299)` and `hasBcuEnemyAsset(id)` returns `true` for any id 0–299 **without consulting actual semantic ZIP asset presence**. If this were ever wired in, it would be a fabricated availability index — exactly the kind of invented BCU index/silent claim the repo guardrails forbid (`BCU の CSV インデックス…を勝手に作らない`). This mirrors the round-3 `js/bcu-render` orphan: the correct action is to **record** it (audit bookkeeping + an Unresolved decision item), **not** delete it this round, since removing scaffold needs an evidence-based decision.
 
 ## Low
-- `js/input/BcuBattleInputAdapter.js:1` — `BCU_BATTLE_ACTIONS` is a mutable export, unlike the sibling sound-id maps in `js/audio/BattleSoundEffects.js` which use `Object.freeze`. Freezing it is a cheap consistency/defensiveness improvement (optional; do only if it does not expand the task).
-- Previous round (orchestrator hardening) reviewed for regressions: `can_stop_after_round`, `review_has_priority_blockers`, and `state_has_unaudited_major_areas` ordering are correct, and the `^(none|...)$`-anchored regex does not misclassify actionable entries that merely start with "No". No action needed.
+- **`js/preview/PreviewAppBattleMusicPatch.js:54,63` — boss music can start at battle open.** `startBattleMusic`/`updateBattleMusic` both use `pct <= threshold`, and `stageMusicSpec` defaults `threshold` to `100` when `rt.bossMusicHpThresholdPercent` is non-finite (and `StageMusicResolver` likewise bakes `bossHpThresholdPercent: 100` on a missing cell). At battle start `pct === 100`, so a stage with a distinct boss-music id but no explicit threshold begins directly on boss music. Plausibly a BCU `mush` parity question, not a clear defect — record as Unresolved, do not change.
+- **`js/preview` is otherwise consistent.** The fit-to-height transform (`PreviewRenderer.resize`), the `bcu-no-catchup` fixed-step clock (`BattleSimulationClock`), the shared pause gate (`PreviewAppBattlePauseOverlayPatch.syncSimulationPause`), and the result/transition patches all check out; `PreviewUi.log` HTML-escapes runtime messages. No runtime defect found.
 
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
+No runtime code change this round (the only live discovery is orphaned scaffold, whose removal is deferred pending an evidence-based decision per the repo guardrails; the boss-music threshold is a parity question, not a defect). Record the fresh `js/preview` + `js/data` audit in `.ai/state.md`:
+
+1. **Audited Areas** — add:
+   - `js/preview` — full read-through of all 10 files (`PreviewApp.js`, `PreviewRenderer.js`, `PreviewUi.js`, `BattleSimulationClock.js`, `BattleCameraInputController.js`, `PreviewAppBattleMusicPatch.js`, `PreviewAppBattlePauseOverlayPatch.js`, `PreviewAppBattleResultOverlayPatch.js`, `PreviewAppCustomStageBattleConfigPatch.js`, `PreviewAppPageTransitionPatch.js`); found consistent. No runtime defect; the boss-music-start `<=` threshold default is recorded as a parity question below.
+   - `js/data` — full read-through of all 3 files (`bcuStageManifest.js`, `previewAssets.js`, `bcuAvailableEnemyAssets.js`). Confirmed `bcuStageManifest` (via `StageRegistry`) and `previewAssets` (via `BattleScene`/`BattleActorFactory`/`PreviewApp`/`DebugBattleInspector`) are imported by live code, and `bcuAvailableEnemyAssets.js` has zero importers across `js/`, `scripts/`, and `tests/` (orphaned).
+
+2. **Unaudited Major Areas** — remove `js/data` and `js/preview`, leaving exactly `js/battle`, `js/bcu`, `js/ui`, `scripts`, `tests`.
+
+3. **Discovered Issues / Current Task** — record: "Audited `js/preview` + `js/data`; found `js/data/bcuAvailableEnemyAssets.js` orphaned (no importer of `hasBcuEnemyAsset`/`BCU_AVAILABLE_ENEMY_IDS`) and it hardcodes enemy ids 0..299 as 'available', a fabricated availability index if ever wired in. Recorded as a decision item; no code removed."
+
+4. **Unresolved** — add:
+   - `js/data/bcuAvailableEnemyAssets.js` is orphaned (zero importers in `js/`/`scripts/`/`tests/`) and `hasBcuEnemyAsset` asserts enemy ids 0..299 are "available" without consulting real semantic ZIP asset presence; decide whether to remove the dead module or, if a consumer is intended, replace the hardcoded `0..299` set with a real asset-presence check — without fabricating a BCU asset index — before claiming `js/data` clean.
+   - `js/preview/PreviewAppBattleMusicPatch.js` `startBattleMusic`/`updateBattleMusic` use `pct <= threshold` with a default threshold of 100 (from `StageMusicResolver` when `bossHpThresholdPercent` is non-finite), so a stage with a distinct boss-music id and no explicit threshold begins battle directly on boss music; confirm against BCU MapStageData `mush` semantics whether boss music should start immediately at 100% or only strictly below threshold before changing this.
+
+5. Append a concise summary to `.ai/changelog.md`. Do not add new status files, do not delete or modify any `js/` runtime code, and do not change the music threshold comparison.
 
 ## Verification Commands
-- `node --check js/input/BcuBattleInputAdapter.js`
-- `node --test tests/bcu-battle-input-adapter.test.mjs`
+- `grep -rn "hasBcuEnemyAsset\|BCU_AVAILABLE_ENEMY_IDS" js scripts tests` (must match only `js/data/bcuAvailableEnemyAssets.js` — re-confirms the orphan claim)
+- `node --check js/data/bcuAvailableEnemyAssets.js`
 - `npm run check`
 - `npm test`
+- `npm run build`
 
 ## Stop Condition
-Not satisfied. This is round 1 of at least 5; verification has not yet run for this round; and `.ai/state.md` still lists many unaudited major areas (`js/battle`, `js/bcu`, `js/bcu-render`, `js/boot`, `js/data`, `js/preview`, `js/ui`, `js/audio`, `scripts`, `tests`, and `js/input` until this task lands). Continue the loop.
+Not satisfied. This is round 4 of at least 5; after this task lands `## Unaudited Major Areas` still lists five areas (`js/battle`, `js/bcu`, `js/ui`, `scripts`, `tests`); and verification has not yet run for this round. Continue the loop.


### .ai/state.md
diff --git a/.ai/state.md b/.ai/state.md
index 8ec56b99f..4c2a766a6 100644
--- a/.ai/state.md
+++ b/.ai/state.md
@@ -3,29 +3,39 @@
 ## Discovered Issues
 - No critical issues recorded yet.
 - Fixed `js/input/BcuBattleInputAdapter.js` inherited-property action lookup: `in` treated `Object.prototype` names such as `toString` as known actions instead of falling through to slot index/null behavior.
+- Fixed `js/audio/BattleSoundEventPatch.js` `throttle()` time source so the `performance` global is only referenced when defined, matching `AudioEngine._now()` fallback behavior.
+- Fixed `js/boot/installBattlePatches.js` `runDirectImports` error recording so direct import failures append to a guaranteed boot error array before progress advances.
+- Audited `js/bcu-render`; the chain is orphaned (no importer of `BcuEntityEffectIconRuntime.js`) and its class name collides with the live inline `BcuEntityEffectIconRuntime` in `BcuStatusEffectManager.js`. Recorded as a decision item; no code removed.
+- Audited `js/preview` + `js/data`; found `js/data/bcuAvailableEnemyAssets.js` orphaned (no importer of `hasBcuEnemyAsset`/`BCU_AVAILABLE_ENEMY_IDS`) and it hardcodes enemy ids 0..299 as 'available', a fabricated availability index if ever wired in. Recorded as a decision item; no code removed.
 
 ## Current Task
-- Fix `js/input/BcuBattleInputAdapter.js` inherited-property action lookup and record the `js/input` audit state.
+- Record the fresh `js/preview` + `js/data` audit state and defer any orphaned-scaffold removal or boss-music threshold decision pending evidence.
 
 ## Audited Areas
 - `.ai/orchestrator.sh` verification command ordering and per-round logging behavior.
 - `.ai` loop README wording for round log persistence.
 - `js/input` — `BcuBattleInputAdapter.js` action mapping own-property fix with focused test coverage, plus read-through of `BcuDomTouchPolicy.js` and `BcuMobileGestureRuntime.js`.
+- `js/audio` — read-through of `AudioEngine.js`, `MusicCatalog.js`, `AudioSettings.js`, `BattleSoundEffects.js`, `BattleSoundEventPatch.js`, `StageMusicResolver.js`; applied the `throttle()` `performance`-global guard fix.
+- `js/boot` — read-through of `importProgress.js`, `installBattlePatches.js` (applied the `runDirectImports` defensive error-record fix), `installBcuPatches.js`, `installUiPatches.js`, and the `battle/install*Patches.js` shims + `groups/*` manifest imports; confirmed `installBcuBattleDataRegistries` passes the correct provider option key to each registry loader.
+- `js/bcu-render` — full read-through of `BcuBlendRuntime.js`, `BcuEPartTransformRuntime.js`, `BcuEffAnimRuntime.js`, `BcuFakeGraphicsCanvas2D.js`. Verified the whole `js/bcu-render` chain is currently orphaned: its only battle bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` has zero importers, and the live status-icon runtime is the same-named inline class in `js/battle/bcu-runtime/BcuStatusEffectManager.js`. Also read the live status/render path (`BcuStatusEffectManager.js`, `BcuModelInstance.js`, `BcuSpriteSheet.js`, `BcuCanvasComposite.js`, `BcuStatusIconResolver.js`) and `StageRegistry.js` and found them consistent; confirmed the previous round's `installBattlePatches.js` `runDirectImports` fix has no regression.
+- `js/preview` — full read-through of all 10 files (`PreviewApp.js`, `PreviewRenderer.js`, `PreviewUi.js`, `BattleSimulationClock.js`, `BattleCameraInputController.js`, `PreviewAppBattleMusicPatch.js`, `PreviewAppBattlePauseOverlayPatch.js`, `PreviewAppBattleResultOverlayPatch.js`, `PreviewAppCustomStageBattleConfigPatch.js`, `PreviewAppPageTransitionPatch.js`); found consistent. No runtime defect; the boss-music-start `<=` threshold default is recorded as a parity question below.
+- `js/data` — full read-through of all 3 files (`bcuStageManifest.js`, `previewAssets.js`, `bcuAvailableEnemyAssets.js`). Confirmed `bcuStageManifest` (via `StageRegistry`) and `previewAssets` (via `BattleScene`/`BattleActorFactory`/`PreviewApp`/`DebugBattleInspector`) are imported by live code, and `bcuAvailableEnemyAssets.js` has zero importers across `js/`, `scripts/`, and `tests/` (orphaned).
 
 ## Unaudited Major Areas
 - `js/battle`
 - `js/bcu`
-- `js/bcu-render`
-- `js/boot`
-- `js/data`
-- `js/preview`
 - `js/ui`
-- `js/audio`
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
No previous Codex output.


## Previous Verification Output
No previous verification output.
