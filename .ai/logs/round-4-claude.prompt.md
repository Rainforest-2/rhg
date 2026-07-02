# Claude Review Prompt

You are the reviewer for this repository.

Do not edit code, documentation, tests, workflows, or generated files directly. Read the previous Codex output, verification results, git status, git diff, `.ai/state.md`, and repository context, then identify the next smallest implementation task for Codex.

Focus on concrete, actionable defects. Prefer one narrow fix that can be implemented and verified in the next Codex pass. Do not ask for broad rewrites, speculative refactors, or unrelated cleanup.

Passing verification is not enough to stop the loop. Every round must include fresh audit work. Prioritize unaudited production code areas listed in `.ai/state.md` over re-reviewing the previous Codex patch, while still checking the previous patch for regressions.

When you choose the next task, include any required `.ai/state.md` bookkeeping in that task so Codex records:
- the production area audited this round,
- the remaining unaudited major areas,
- any unresolved uncertainty.

The `Critical` and `High` sections must contain only actionable blockers. If there are none, write exactly `None`.

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
Round: 4 of 10
Repository: /workspaces/rhg

## Current AI State
# Current Status

## Discovered Issues
- No critical issues recorded yet.
- Fixed `js/input/BcuBattleInputAdapter.js` inherited-property action lookup: `in` treated `Object.prototype` names such as `toString` as known actions instead of falling through to slot index/null behavior.
- Fixed `js/audio/BattleSoundEventPatch.js` `throttle()` time source so the `performance` global is only referenced when defined, matching `AudioEngine._now()` fallback behavior.
- Fixed `js/boot/installBattlePatches.js` `runDirectImports` error recording so direct import failures append to a guaranteed boot error array before progress advances.
- Audited `js/bcu-render`; the chain is orphaned (no importer of `BcuEntityEffectIconRuntime.js`) and its class name collides with the live inline `BcuEntityEffectIconRuntime` in `BcuStatusEffectManager.js`. Recorded as a decision item; no code removed.

## Current Task
- Record the `js/bcu-render` fresh audit state and defer any orphaned-scaffold removal or wiring decision pending evidence.

## Audited Areas
- `.ai/orchestrator.sh` verification command ordering and per-round logging behavior.
- `.ai` loop README wording for round log persistence.
- `js/input` — `BcuBattleInputAdapter.js` action mapping own-property fix with focused test coverage, plus read-through of `BcuDomTouchPolicy.js` and `BcuMobileGestureRuntime.js`.
- `js/audio` — read-through of `AudioEngine.js`, `MusicCatalog.js`, `AudioSettings.js`, `BattleSoundEffects.js`, `BattleSoundEventPatch.js`, `StageMusicResolver.js`; applied the `throttle()` `performance`-global guard fix.
- `js/boot` — read-through of `importProgress.js`, `installBattlePatches.js` (applied the `runDirectImports` defensive error-record fix), `installBcuPatches.js`, `installUiPatches.js`, and the `battle/install*Patches.js` shims + `groups/*` manifest imports; confirmed `installBcuBattleDataRegistries` passes the correct provider option key to each registry loader.
- `js/bcu-render` — full read-through of `BcuBlendRuntime.js`, `BcuEPartTransformRuntime.js`, `BcuEffAnimRuntime.js`, `BcuFakeGraphicsCanvas2D.js`. Verified the whole `js/bcu-render` chain is currently orphaned: its only battle bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` has zero importers, and the live status-icon runtime is the same-named inline class in `js/battle/bcu-runtime/BcuStatusEffectManager.js`. Also read the live status/render path (`BcuStatusEffectManager.js`, `BcuModelInstance.js`, `BcuSpriteSheet.js`, `BcuCanvasComposite.js`, `BcuStatusIconResolver.js`) and `StageRegistry.js` and found them consistent; confirmed the previous round's `installBattlePatches.js` `runDirectImports` fix has no regression.

## Unaudited Major Areas
- `js/battle`
- `js/bcu`
- `js/data`
- `js/preview`
- `js/ui`
- `scripts`
- `tests`

## Unresolved
- `js/input/BcuMobileGestureRuntime.js` slide angle/threshold and up/down direction (`TAN_50`, `height * 0.15`, `dy / dragFrame < 0`) have not been confirmed against BCU touch source; audit in a later round before claiming BCU parity.
- `js/audio/StageMusicResolver.js` `parseStageMusicFromRows` indexes `rows[2 + stageIndex]` after `parseMsdRows` drops fully-non-numeric lines; confirm the MapStageData map-pattern line (row 1) always carries a finite number so filtering can never shift the stage-row index.
- `js/audio/BattleSoundEventPatch.js` `damageQueued` throttled-critical fall-through can play `HIT_0` after a throttled critical/strong-attack SE; confirm whether this rhg flood-guard behavior should stay or be changed for BCU parity.
- `js/bcu-render` chain (`BcuBlendRuntime`/`BcuEPartTransformRuntime`/`BcuEffAnimRuntime`/`BcuFakeGraphicsCanvas2D`) + the dead bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` are orphaned and duplicate the live `BcuEntityEffectIconRuntime` class name; decide whether to remove the dead scaffold or wire it in, with evidence, before claiming `js/bcu-render` clean. Keep the existing `isBcuBlendGlow` glow-value uncertainty (`glow === 1 | 2 | 3 | -1` unconfirmed vs BCU `EPart`/glow source).
- `BcuEffAnimRuntime.done()` and the inline `BcuEntityEffectIconRuntime.isDone()` never set `finished = true`; this appears intentional (status icons removed by expiry, not anim-loop completion) but is unconfirmed against BCU and currently has no consumer.

## Completed
- Created AI management directory and core files.
- Added workflow scaffolding for the development loop.
- Documented usage in the repository README.

## Remaining
- Continue Claude -> Codex -> verification rounds until the minimum round count, priority blocker, unaudited major area, and verification stop conditions are all satisfied.


## Current Git Snapshot
# Round 4 Git Snapshot
Date: 2026-06-30T23:48:37Z

## git status --short --untracked-files=no
[Limited to 200 lines; untracked files omitted.]
 M .ai/changelog.md
 M .ai/review.md
 M .ai/state.md
 M js/audio/BattleSoundEventPatch.js
 M js/boot/installBattlePatches.js

## git diff --name-status
[Limited to 20 files; .ai/logs and node_modules omitted.]
M	.ai/changelog.md
M	.ai/review.md
M	.ai/state.md
M	js/audio/BattleSoundEventPatch.js
M	js/boot/installBattlePatches.js


## Current git diff
[Excerpt: current git diff for configured project paths, excluding .ai/logs and node_modules, limited to 20 files and 12000 bytes per file; total budget 60000 bytes.]

### .ai/changelog.md
diff --git a/.ai/changelog.md b/.ai/changelog.md
index 8377b36c4..1c960ac0e 100644
--- a/.ai/changelog.md
+++ b/.ai/changelog.md
@@ -12,6 +12,7 @@
 ## Round 1 Codex Output
 - Corrected README round-log wording to state logs are saved every round; verification passed: corrected wording present, old phrasing absent, `npm run check`, `npm test` (47/47), and `npm run build`.
 - Fixed `BcuBattleInputAdapter` action lookup to require own string keys, added inherited-name/slot fallback tests, and updated `.ai/state.md` for the `js/input` audit. Verification passed: `node --check js/input/BcuBattleInputAdapter.js`, `node --check tests/bcu-battle-input-adapter.test.mjs`, `node --test tests/bcu-battle-input-adapter.test.mjs` (4/4), `npm run check`, and `npm test` (51/51).
+- Fixed `BattleSoundEventPatch` `throttle()` to guard the `performance` global before using `performance.now`, and updated `.ai/state.md` for the `js/audio` audit. Verification passed: `node --check js/audio/BattleSoundEventPatch.js`, `node scripts/check-battle-music-and-zombie-killer.mjs`, and `node scripts/check-bcu-battle-sound-effects-parity.mjs`.
 
 ## Round 1 Codex Output
 - Date: 2026-06-30T14:17:32Z
@@ -4556,3 +4557,24027 @@ tokens used
 
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
+check-bcu-summon-runtime-parity: OK
+
+$ node scripts/check-bcu-summon-procobject-loader-parity.mjs
+check-bcu-summon-procobject-loader-parity: OK
+
+$ node scripts/check-bcu-trait-targetforms-loader-parity.mjs
+check-bcu-trait-targetforms-loader-parity: OK
+
+$ node scripts/check-bcu-modifier-realdata-sweep-parity.mjs
+check-bcu-modifier-realdata-sweep-parity: OK
+
+$ node --check scripts/check-bcu-modifier-registry-failure-visibility.mjs
+
+$ node scripts/check-bcu-modifier-registry-failure-visibility.mjs
+[battle boot] combo registry load failed; combos disabled Error: loadBcuComboRegistry: semantic provider core-db unavailable
+    at loadBcuComboRegistry (file:///workspaces/rhg/js/battle/bcu-runtime/BcuComboRegistryLoader.js:44:13)
+    at installBcuComboRegistry (file:///workspaces/rhg/js/battle/bcu-runtime/BcuComboRegistryLoader.js:63:11)
+    at file:///workspaces/rhg/scripts/check-bcu-modifier-registry-failure-visibility.mj

### .ai/review.md
diff --git a/.ai/review.md b/.ai/review.md
index 6add6d0c0..66586fe51 100644
--- a/.ai/review.md
+++ b/.ai/review.md
@@ -1,4 +1,10 @@
-Confirmed: `adaptBcuBattleAction('toString', { frontLineup: 1, slot: 2 })` returns the `toString` function instead of the correct slot index `7`. The `in` operator walks the prototype chain, so any action name colliding with an `Object.prototype` member (`toString`, `valueOf`, `constructor`, `hasOwnProperty`, `__proto__`, …) is misrouted. I also verified the previous round's orchestrator stop-logic and its `none`-detection regex are sound (the `^(...)$` anchors prevent false positives). Here is the review.
+Confirmed definitively:
+- `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` has **zero importers**, and it is the **only** importer of the entire `js/bcu-render/` chain → the whole `js/bcu-render/` directory is orphaned (reachable only through a file nothing imports).
+- The live status-icon path uses a **same-named inline class** `BcuEntityEffectIconRuntime` inside `BcuStatusEffectManager.js`.
+- `isDone()`/`done()` and `removeEffect()` are not consumed anywhere (the lone `.done(` hit is a comment), so the "never sets `finished=true`" surface is dead, not a live defect.
+- Previous patch (`installBattlePatches.js` `runDirectImports`) is correct and consistent with sibling error-record sites — no regression.
+
+The freshly audited live render path (`BcuModelInstance`, `BcuSpriteSheet`, `BcuCanvasComposite`, `BcuStatusEffectManager`, `BcuStatusIconResolver`) is consistent and clean. No runtime defect found; the concrete discovery is the orphaned `js/bcu-render` chain + duplicate class name.
 
 # Review
 
@@ -9,39 +15,35 @@ None
 None
 
 ## Medium
-- `js/input/BcuBattleInputAdapter.js:7` — `adaptBcuBattleAction` uses `if (action in BCU_BATTLE_ACTIONS)`. The `in` operator includes inherited `Object.prototype` properties, so an action string such as `toString`, `valueOf`, `constructor`, or `hasOwnProperty` is treated as a known action and returns the inherited function instead of falling through to the slot-index path. Verified: `adaptBcuBattleAction('toString', { frontLineup: 1, slot: 2 })` returns `[Function: toString]` instead of `7`; `adaptBcuBattleAction('toString')` returns the function instead of `null`. With current callers `action` is only `ACTION_LINEUP_CHANGE_UP`/`DOWN` or `null`, so it is not reachable in the live path today, but it is a latent correctness defect with a one-line, behavior-preserving fix and no test coverage on this module.
+- **`js/bcu-render/*` is an orphaned module chain with a duplicate live class name.** Verified by import-path grep: nothing imports `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js`, and that file is the *sole* importer of the `js/bcu-render` chain (`BcuEffAnimRuntime.js` → `BcuEPartTransformRuntime.js`). `BcuBlendRuntime.js` and `BcuFakeGraphicsCanvas2D.js` have zero importers as well. Meanwhile the *live* status-icon path (`BcuStatusEffectManager.js:178`) drives a different, same-named inline class `BcuEntityEffectIconRuntime` (`BcuStatusEffectManager.js:109`) and the live render math (`BcuModelInstance`, `BcuSpriteSheet`, `BcuCanvasComposite`). The duplicate name is a real latent hazard (a future edit to "the icon runtime" could touch the dead file or the wrong class). This round's action is to **record** this (audit bookkeeping + Unresolved decision), **not** to delete code — removal of orphaned scaffold needs an evidence-based decision per the repo guardrails (it may be intentional parity scaffolding; `scripts/check-bcu-renderer-patch.mjs` exists and the glow-value set is still unconfirmed).
 
 ## Low
-- `js/input/BcuBattleInputAdapter.js:1` — `BCU_BATTLE_ACTIONS` is a mutable export, unlike the sibling sound-id maps in `js/audio/BattleSoundEffects.js` which use `Object.freeze`. Freezing it is a cheap consistency/defensiveness improvement (optional; do only if it does not expand the task).
-- Previous round (orchestrator hardening) reviewed for regressions: `can_stop_after_round`, `review_has_priority_blockers`, and `state_has_unaudited_major_areas` ordering are correct, and the `^(none|...)$`-anchored regex does not misclassify actionable entries that merely start with "No". No action needed.
+- **`BcuStatusEffectManager.js` dead surface.** The inline `BcuEntityEffectIconRuntime.isDone()` (line 138) and `removeEffect()` (line 227) are never called (effect lifetime is governed by the `wanted`-set delete in `updateEffects`, matching the documented "removed by status expiry, not anim-loop completion" comment at lines 118-121). `finished` is never set to `true`, which is consistent with that design. Not a defect; record as an observation only.
+- **`js/bcu-render/BcuBlendRuntime.js:14`** computes `const compositeBefore = ctx.globalCompositeOperation;` but never uses it (dead variable). Cosmetic; do not fix this round (orphaned file; touching it isn't warranted while a removal decision is pending).
+- **`js/battle/StageRegistry.js` + `js/data/bcuStageManifest.js` verified as by-design, not a defect.** The default stage `stageRNA001_00` resolves to a `BCU_STAGE_MANIFEST` entry whose `stageCsvPath` points at `./public/assets/bcu/...`; this is the intended curated RNA demo-stage path (distinct from the semantic ZIP pack stages), not an implicit raw-asset fallback. Recorded so a later round does not "fix" it into a regression.
 
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
+No runtime code change this round (no live defect exists in the freshly audited area; deleting orphaned scaffold is deferred pending an evidence-based decision). Record the `js/bcu-render` fresh audit in `.ai/state.md`:
+
+1. **Audited Areas** — add:
+   `js/bcu-render` — full read-through of `BcuBlendRuntime.js`, `BcuEPartTransformRuntime.js`, `BcuEffAnimRuntime.js`, `BcuFakeGraphicsCanvas2D.js`. Verified the whole `js/bcu-render` chain is currently **orphaned**: its only battle bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` has zero importers, and the live status-icon runtime is the same-named inline class in `js/battle/bcu-runtime/BcuStatusEffectManager.js`. Also read the live status/render path (`BcuStatusEffectManager.js`, `BcuModelInstance.js`, `BcuSpriteSheet.js`, `BcuCanvasComposite.js`, `BcuStatusIconResolver.js`) and `StageRegistry.js` and found them consistent; confirmed the previous round's `installBattlePatches.js` `runDirectImports` fix has no regression.
+
+2. **Unaudited Major Areas** — remove `js/bcu-render`, leaving `js/battle`, `js/bcu`, `js/data`, `js/preview`, `js/ui`, `scripts`, `tests`. (Do **not** remove `js/battle`, `js/bcu`, `js/data`, or `js/preview`: only individual files were read this round, not the full areas.)
+
+3. **Discovered Issues / Current Task** — record: "Audited `js/bcu-render`; the chain is orphaned (no importer of `BcuEntityEffectIconRuntime.js`) and its class name collides with the live inline `BcuEntityEffectIconRuntime` in `BcuStatusEffectManager.js`. Recorded as a decision item; no code removed."
+
+4. **Unresolved** — add:
+   - `js/bcu-render` chain (`BcuBlendRuntime`/`BcuEPartTransformRuntime`/`BcuEffAnimRuntime`/`BcuFakeGraphicsCanvas2D`) + the dead bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` are orphaned and duplicate the live `BcuEntityEffectIconRuntime` class name; decide whether to remove the dead scaffold or wire it in, with evidence, before claiming `js/bcu-render` clean. Keep the existing `isBcuBlendGlow` glow-value uncertainty (`glow === 1|2|3|-1` unconfirmed vs BCU `EPart`/glow source).
+   - Note that `BcuEffAnimRuntime.done()` and the inline `BcuEntityEffectIconRuntime.isDone()` never set `finished = true`; this appears intentional (status icons removed by expiry, not anim-loop completion) but is unconfirmed against BCU and currently has no consumer.
+
+5. Append a concise summary to `.ai/changelog.md`. Do not add new status files, do not delete or modify any `js/` runtime code, and do not change the glow-value set.
 
 ## Verification Commands
-- `node --check js/input/BcuBattleInputAdapter.js`
-- `node --test tests/bcu-battle-input-adapter.test.mjs`
+- `node scripts/check-bcu-renderer-patch.mjs`
+- `node scripts/check-battle-speed-control.mjs`
 - `npm run check`
 - `npm test`
+- `npm run build`
 
 ## Stop Condition
-Not satisfied. This is round 1 of at least 5; verification has not yet run for this round; and `.ai/state.md` still lists many unaudited major areas (`js/battle`, `js/bcu`, `js/bcu-render`, `js/boot`, `js/data`, `js/preview`, `js/ui`, `js/audio`, `scripts`, `tests`, and `js/input` until this task lands). Continue the loop.
+Not satisfied. This is round 3 of at least 5; `## Unaudited Major Areas` still lists seven areas (`js/battle`, `js/bcu`, `js/data`, `js/preview`, `js/ui`, `scripts`, `tests`) after this task lands; and verification has not yet run for this round. Continue the loop.


### .ai/state.md
diff --git a/.ai/state.md b/.ai/state.md
index 8ec56b99f..b55080ba0 100644
--- a/.ai/state.md
+++ b/.ai/state.md
@@ -3,29 +3,36 @@
 ## Discovered Issues
 - No critical issues recorded yet.
 - Fixed `js/input/BcuBattleInputAdapter.js` inherited-property action lookup: `in` treated `Object.prototype` names such as `toString` as known actions instead of falling through to slot index/null behavior.
+- Fixed `js/audio/BattleSoundEventPatch.js` `throttle()` time source so the `performance` global is only referenced when defined, matching `AudioEngine._now()` fallback behavior.
+- Fixed `js/boot/installBattlePatches.js` `runDirectImports` error recording so direct import failures append to a guaranteed boot error array before progress advances.
+- Audited `js/bcu-render`; the chain is orphaned (no importer of `BcuEntityEffectIconRuntime.js`) and its class name collides with the live inline `BcuEntityEffectIconRuntime` in `BcuStatusEffectManager.js`. Recorded as a decision item; no code removed.
 
 ## Current Task
-- Fix `js/input/BcuBattleInputAdapter.js` inherited-property action lookup and record the `js/input` audit state.
+- Record the `js/bcu-render` fresh audit state and defer any orphaned-scaffold removal or wiring decision pending evidence.
 
 ## Audited Areas
 - `.ai/orchestrator.sh` verification command ordering and per-round logging behavior.
 - `.ai` loop README wording for round log persistence.
 - `js/input` — `BcuBattleInputAdapter.js` action mapping own-property fix with focused test coverage, plus read-through of `BcuDomTouchPolicy.js` and `BcuMobileGestureRuntime.js`.
+- `js/audio` — read-through of `AudioEngine.js`, `MusicCatalog.js`, `AudioSettings.js`, `BattleSoundEffects.js`, `BattleSoundEventPatch.js`, `StageMusicResolver.js`; applied the `throttle()` `performance`-global guard fix.
+- `js/boot` — read-through of `importProgress.js`, `installBattlePatches.js` (applied the `runDirectImports` defensive error-record fix), `installBcuPatches.js`, `installUiPatches.js`, and the `battle/install*Patches.js` shims + `groups/*` manifest imports; confirmed `installBcuBattleDataRegistries` passes the correct provider option key to each registry loader.
+- `js/bcu-render` — full read-through of `BcuBlendRuntime.js`, `BcuEPartTransformRuntime.js`, `BcuEffAnimRuntime.js`, `BcuFakeGraphicsCanvas2D.js`. Verified the whole `js/bcu-render` chain is currently orphaned: its only battle bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` has zero importers, and the live status-icon runtime is the same-named inline class in `js/battle/bcu-runtime/BcuStatusEffectManager.js`. Also read the live status/render path (`BcuStatusEffectManager.js`, `BcuModelInstance.js`, `BcuSpriteSheet.js`, `BcuCanvasComposite.js`, `BcuStatusIconResolver.js`) and `StageRegistry.js` and found them consistent; confirmed the previous round's `installBattlePatches.js` `runDirectImports` fix has no regression.
 
 ## Unaudited Major Areas
 - `js/battle`
 - `js/bcu`
-- `js/bcu-render`
-- `js/boot`
 - `js/data`
 - `js/preview`
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


### js/boot/installBattlePatches.js
diff --git a/js/boot/installBattlePatches.js b/js/boot/installBattlePatches.js
index 4bccc3b7b..fba3a185c 100644
--- a/js/boot/installBattlePatches.js
+++ b/js/boot/installBattlePatches.js
@@ -31,7 +31,10 @@ async function runDirectImports(onProgress) {
     await import('./groups/battleDirectPatches.js');
   } catch (error) {
     console.warn('[battle boot] direct patches failed; continuing', error);
-    globalThis.__BATTLE_BOOT_PATCH_ERRORS__.push({ path: './groups/battleDirectPatches.js', message: error?.message || String(error), stack: error?.stack || null });
+    globalThis.__BATTLE_BOOT_PATCH_ERRORS__ = [
+      ...(globalThis.__BATTLE_BOOT_PATCH_ERRORS__ || []),
+      { path: './groups/battleDirectPatches.js', message: error?.message || String(error), stack: error?.stack || null }
+    ];
   }
   onProgress?.(1);
 }




## Previous Codex Output
[Excerpt: tail 30000 bytes of 901776 total bytes.]
hrottle()` `performance`-global guard fix.
 - `js/boot` — read-through of `importProgress.js`, `installBattlePatches.js` (applied the `runDirectImports` defensive error-record fix), `installBcuPatches.js`, `installUiPatches.js`, and the `battle/install*Patches.js` shims + `groups/*` manifest imports; confirmed `installBcuBattleDataRegistries` passes the correct provider option key to each registry loader.
+- `js/bcu-render` — full read-through of `BcuBlendRuntime.js`, `BcuEPartTransformRuntime.js`, `BcuEffAnimRuntime.js`, `BcuFakeGraphicsCanvas2D.js`. Verified the whole `js/bcu-render` chain is currently orphaned: its only battle bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` has zero importers, and the live status-icon runtime is the same-named inline class in `js/battle/bcu-runtime/BcuStatusEffectManager.js`. Also read the live status/render path (`BcuStatusEffectManager.js`, `BcuModelInstance.js`, `BcuSpriteSheet.js`, `BcuCanvasComposite.js`, `BcuStatusIconResolver.js`) and `StageRegistry.js` and found them consistent; confirmed the previous round's `installBattlePatches.js` `runDirectImports` fix has no regression.
 
 ## Unaudited Major Areas
 - `js/battle`
 - `js/bcu`
-- `js/bcu-render`
 - `js/data`
 - `js/preview`
 - `js/ui`
@@ -30,7 +31,8 @@
 - `js/input/BcuMobileGestureRuntime.js` slide angle/threshold and up/down direction (`TAN_50`, `height * 0.15`, `dy / dragFrame < 0`) have not been confirmed against BCU touch source; audit in a later round before claiming BCU parity.
 - `js/audio/StageMusicResolver.js` `parseStageMusicFromRows` indexes `rows[2 + stageIndex]` after `parseMsdRows` drops fully-non-numeric lines; confirm the MapStageData map-pattern line (row 1) always carries a finite number so filtering can never shift the stage-row index.
 - `js/audio/BattleSoundEventPatch.js` `damageQueued` throttled-critical fall-through can play `HIT_0` after a throttled critical/strong-attack SE; confirm whether this rhg flood-guard behavior should stay or be changed for BCU parity.
-- `js/bcu-render/BcuBlendRuntime.js` `isBcuBlendGlow` blend values (`glow === 1 | 2 | 3 | -1`) have not been confirmed against BCU `EPart`/glow source; audit before claiming `js/bcu-render` parity.
+- `js/bcu-render` chain (`BcuBlendRuntime`/`BcuEPartTransformRuntime`/`BcuEffAnimRuntime`/`BcuFakeGraphicsCanvas2D`) + the dead bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` are orphaned and duplicate the live `BcuEntityEffectIconRuntime` class name; decide whether to remove the dead scaffold or wire it in, with evidence, before claiming `js/bcu-render` clean. Keep the existing `isBcuBlendGlow` glow-value uncertainty (`glow === 1 | 2 | 3 | -1` unconfirmed vs BCU `EPart`/glow source).
+- `BcuEffAnimRuntime.done()` and the inline `BcuEntityEffectIconRuntime.isDone()` never set `finished = true`; this appears intentional (status icons removed by expiry, not anim-loop completion) but is unconfirmed against BCU and currently has no consumer.
 
 ## Completed
 - Created AI management directory and core files.

apply patch
patch: completed
/workspaces/rhg/.ai/changelog.md
diff --git a/.ai/changelog.md b/.ai/changelog.md
index c117753cb46ac6b56911620831eb0cfc64a145c1..2c464f435f9a0aa2b87b71a76df850c17e141140
--- a/.ai/changelog.md
+++ b/.ai/changelog.md
@@ -14871,6 +14871,7 @@
 - next action: leave for a dedicated cleanup if desired
 
 No commit or push performed.
+
 diff --git a/.ai/changelog.md b/.ai/changelog.md
 index bec886a53658bead087705a27518b263ed15c926..023428cbd3b7ee7610cb4f0dbc4ec6838e524023
 --- a/.ai/changelog.md
@@ -14966,3 +14967,6 @@
 
 No commit or push performed.
 
+## Round 3 - bcu-render audit bookkeeping
+- Recorded the fresh `js/bcu-render` audit in `.ai/state.md`: marked the render chain audited, removed only `js/bcu-render` from unaudited major areas, and captured the orphaned bridge/duplicate class-name decision item plus the unconfirmed `done()`/`isDone()` lifetime observation.
+- Verification passed: `node scripts/check-bcu-renderer-patch.mjs`, `node scripts/check-battle-speed-control.mjs`, `npm run check`, `npm test` (51/51), and `npm run build`.
diff --git a/.ai/state.md b/.ai/state.md
index 00ffdd101c1d900b87c36ecea877ed4cd406e194..b55080ba07be824c196a931816c105a8807bad8c
--- a/.ai/state.md
+++ b/.ai/state.md
@@ -5,9 +5,10 @@
 - Fixed `js/input/BcuBattleInputAdapter.js` inherited-property action lookup: `in` treated `Object.prototype` names such as `toString` as known actions instead of falling through to slot index/null behavior.
 - Fixed `js/audio/BattleSoundEventPatch.js` `throttle()` time source so the `performance` global is only referenced when defined, matching `AudioEngine._now()` fallback behavior.
 - Fixed `js/boot/installBattlePatches.js` `runDirectImports` error recording so direct import failures append to a guaranteed boot error array before progress advances.
+- Audited `js/bcu-render`; the chain is orphaned (no importer of `BcuEntityEffectIconRuntime.js`) and its class name collides with the live inline `BcuEntityEffectIconRuntime` in `BcuStatusEffectManager.js`. Recorded as a decision item; no code removed.
 
 ## Current Task
-- Fix `js/boot/installBattlePatches.js` `runDirectImports` defensive error recording and record the `js/boot` audit state.
+- Record the `js/bcu-render` fresh audit state and defer any orphaned-scaffold removal or wiring decision pending evidence.
 
 ## Audited Areas
 - `.ai/orchestrator.sh` verification command ordering and per-round logging behavior.
@@ -15,11 +16,11 @@
 - `js/input` — `BcuBattleInputAdapter.js` action mapping own-property fix with focused test coverage, plus read-through of `BcuDomTouchPolicy.js` and `BcuMobileGestureRuntime.js`.
 - `js/audio` — read-through of `AudioEngine.js`, `MusicCatalog.js`, `AudioSettings.js`, `BattleSoundEffects.js`, `BattleSoundEventPatch.js`, `StageMusicResolver.js`; applied the `throttle()` `performance`-global guard fix.
 - `js/boot` — read-through of `importProgress.js`, `installBattlePatches.js` (applied the `runDirectImports` defensive error-record fix), `installBcuPatches.js`, `installUiPatches.js`, and the `battle/install*Patches.js` shims + `groups/*` manifest imports; confirmed `installBcuBattleDataRegistries` passes the correct provider option key to each registry loader.
+- `js/bcu-render` — full read-through of `BcuBlendRuntime.js`, `BcuEPartTransformRuntime.js`, `BcuEffAnimRuntime.js`, `BcuFakeGraphicsCanvas2D.js`. Verified the whole `js/bcu-render` chain is currently orphaned: its only battle bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` has zero importers, and the live status-icon runtime is the same-named inline class in `js/battle/bcu-runtime/BcuStatusEffectManager.js`. Also read the live status/render path (`BcuStatusEffectManager.js`, `BcuModelInstance.js`, `BcuSpriteSheet.js`, `BcuCanvasComposite.js`, `BcuStatusIconResolver.js`) and `StageRegistry.js` and found them consistent; confirmed the previous round's `installBattlePatches.js` `runDirectImports` fix has no regression.
 
 ## Unaudited Major Areas
 - `js/battle`
 - `js/bcu`
-- `js/bcu-render`
 - `js/data`
 - `js/preview`
 - `js/ui`
@@ -30,7 +31,8 @@
 - `js/input/BcuMobileGestureRuntime.js` slide angle/threshold and up/down direction (`TAN_50`, `height * 0.15`, `dy / dragFrame < 0`) have not been confirmed against BCU touch source; audit in a later round before claiming BCU parity.
 - `js/audio/StageMusicResolver.js` `parseStageMusicFromRows` indexes `rows[2 + stageIndex]` after `parseMsdRows` drops fully-non-numeric lines; confirm the MapStageData map-pattern line (row 1) always carries a finite number so filtering can never shift the stage-row index.
 - `js/audio/BattleSoundEventPatch.js` `damageQueued` throttled-critical fall-through can play `HIT_0` after a throttled critical/strong-attack SE; confirm whether this rhg flood-guard behavior should stay or be changed for BCU parity.
-- `js/bcu-render/BcuBlendRuntime.js` `isBcuBlendGlow` blend values (`glow === 1 | 2 | 3 | -1`) have not been confirmed against BCU `EPart`/glow source; audit before claiming `js/bcu-render` parity.
+- `js/bcu-render` chain (`BcuBlendRuntime`/`BcuEPartTransformRuntime`/`BcuEffAnimRuntime`/`BcuFakeGraphicsCanvas2D`) + the dead bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` are orphaned and duplicate the live `BcuEntityEffectIconRuntime` class name; decide whether to remove the dead scaffold or wire it in, with evidence, before claiming `js/bcu-render` clean. Keep the existing `isBcuBlendGlow` glow-value uncertainty (`glow === 1 | 2 | 3 | -1` unconfirmed vs BCU `EPart`/glow source).
+- `BcuEffAnimRuntime.done()` and the inline `BcuEntityEffectIconRuntime.isDone()` never set `finished = true`; this appears intentional (status icons removed by expiry, not anim-loop completion) but is unconfirmed against BCU and currently has no consumer.
 
 ## Completed
 - Created AI management directory and core files.

diff --git a/.ai/changelog.md b/.ai/changelog.md
index c117753cb46ac6b56911620831eb0cfc64a145c1..2c464f435f9a0aa2b87b71a76df850c17e141140
--- a/.ai/changelog.md
+++ b/.ai/changelog.md
@@ -14871,6 +14871,7 @@
 - next action: leave for a dedicated cleanup if desired
 
 No commit or push performed.
+
 diff --git a/.ai/changelog.md b/.ai/changelog.md
 index bec886a53658bead087705a27518b263ed15c926..023428cbd3b7ee7610cb4f0dbc4ec6838e524023
 --- a/.ai/changelog.md
@@ -14966,3 +14967,6 @@
 
 No commit or push performed.
 
+## Round 3 - bcu-render audit bookkeeping
+- Recorded the fresh `js/bcu-render` audit in `.ai/state.md`: marked the render chain audited, removed only `js/bcu-render` from unaudited major areas, and captured the orphaned bridge/duplicate class-name decision item plus the unconfirmed `done()`/`isDone()` lifetime observation.
+- Verification passed: `node scripts/check-bcu-renderer-patch.mjs`, `node scripts/check-battle-speed-control.mjs`, `npm run check`, `npm test` (51/51), and `npm run build`.
diff --git a/.ai/state.md b/.ai/state.md
index 00ffdd101c1d900b87c36ecea877ed4cd406e194..b55080ba07be824c196a931816c105a8807bad8c
--- a/.ai/state.md
+++ b/.ai/state.md
@@ -5,9 +5,10 @@
 - Fixed `js/input/BcuBattleInputAdapter.js` inherited-property action lookup: `in` treated `Object.prototype` names such as `toString` as known actions instead of falling through to slot index/null behavior.
 - Fixed `js/audio/BattleSoundEventPatch.js` `throttle()` time source so the `performance` global is only referenced when defined, matching `AudioEngine._now()` fallback behavior.
 - Fixed `js/boot/installBattlePatches.js` `runDirectImports` error recording so direct import failures append to a guaranteed boot error array before progress advances.
+- Audited `js/bcu-render`; the chain is orphaned (no importer of `BcuEntityEffectIconRuntime.js`) and its class name collides with the live inline `BcuEntityEffectIconRuntime` in `BcuStatusEffectManager.js`. Recorded as a decision item; no code removed.
 
 ## Current Task
-- Fix `js/boot/installBattlePatches.js` `runDirectImports` defensive error recording and record the `js/boot` audit state.
+- Record the `js/bcu-render` fresh audit state and defer any orphaned-scaffold removal or wiring decision pending evidence.
 
 ## Audited Areas
 - `.ai/orchestrator.sh` verification command ordering and per-round logging behavior.
@@ -15,11 +16,11 @@
 - `js/input` — `BcuBattleInputAdapter.js` action mapping own-property fix with focused test coverage, plus read-through of `BcuDomTouchPolicy.js` and `BcuMobileGestureRuntime.js`.
 - `js/audio` — read-through of `AudioEngine.js`, `MusicCatalog.js`, `AudioSettings.js`, `BattleSoundEffects.js`, `BattleSoundEventPatch.js`, `StageMusicResolver.js`; applied the `throttle()` `performance`-global guard fix.
 - `js/boot` — read-through of `importProgress.js`, `installBattlePatches.js` (applied the `runDirectImports` defensive error-record fix), `installBcuPatches.js`, `installUiPatches.js`, and the `battle/install*Patches.js` shims + `groups/*` manifest imports; confirmed `installBcuBattleDataRegistries` passes the correct provider option key to each registry loader.
+- `js/bcu-render` — full read-through of `BcuBlendRuntime.js`, `BcuEPartTransformRuntime.js`, `BcuEffAnimRuntime.js`, `BcuFakeGraphicsCanvas2D.js`. Verified the whole `js/bcu-render` chain is currently orphaned: its only battle bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` has zero importers, and the live status-icon runtime is the same-named inline class in `js/battle/bcu-runtime/BcuStatusEffectManager.js`. Also read the live status/render path (`BcuStatusEffectManager.js`, `BcuModelInstance.js`, `BcuSpriteSheet.js`, `BcuCanvasComposite.js`, `BcuStatusIconResolver.js`) and `StageRegistry.js` and found them consistent; confirmed the previous round's `installBattlePatches.js` `runDirectImports` fix has no regression.
 
 ## Unaudited Major Areas
 - `js/battle`
 - `js/bcu`
-- `js/bcu-render`
 - `js/data`
 - `js/preview`
 - `js/ui`
@@ -30,7 +31,8 @@
 - `js/input/BcuMobileGestureRuntime.js` slide angle/threshold and up/down direction (`TAN_50`, `height * 0.15`, `dy / dragFrame < 0`) have not been confirmed against BCU touch source; audit in a later round before claiming BCU parity.
 - `js/audio/StageMusicResolver.js` `parseStageMusicFromRows` indexes `rows[2 + stageIndex]` after `parseMsdRows` drops fully-non-numeric lines; confirm the MapStageData map-pattern line (row 1) always carries a finite number so filtering can never shift the stage-row index.
 - `js/audio/BattleSoundEventPatch.js` `damageQueued` throttled-critical fall-through can play `HIT_0` after a throttled critical/strong-attack SE; confirm whether this rhg flood-guard behavior should stay or be changed for BCU parity.
-- `js/bcu-render/BcuBlendRuntime.js` `isBcuBlendGlow` blend values (`glow === 1 | 2 | 3 | -1`) have not been confirmed against BCU `EPart`/glow source; audit before claiming `js/bcu-render` parity.
+- `js/bcu-render` chain (`BcuBlendRuntime`/`BcuEPartTransformRuntime`/`BcuEffAnimRuntime`/`BcuFakeGraphicsCanvas2D`) + the dead bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` are orphaned and duplicate the live `BcuEntityEffectIconRuntime` class name; decide whether to remove the dead scaffold or wire it in, with evidence, before claiming `js/bcu-render` clean. Keep the existing `isBcuBlendGlow` glow-value uncertainty (`glow === 1 | 2 | 3 | -1` unconfirmed vs BCU `EPart`/glow source).
+- `BcuEffAnimRuntime.done()` and the inline `BcuEntityEffectIconRuntime.isDone()` never set `finished = true`; this appears intentional (status icons removed by expiry, not anim-loop completion) but is unconfirmed against BCU and currently has no consumer.
 
 ## Completed
 - Created AI management directory and core files.

codex
The EOF append is applied. I’m checking once more that there’s a single Round 3 entry and that it is at the actual tail.
exec
/bin/bash -lc 'rg -n "Round 3 - bcu-render" .ai/changelog.md' in /workspaces/rhg
exec
/bin/bash -lc 'tail -n 12 .ai/changelog.md' in /workspaces/rhg
exec
/bin/bash -lc 'git diff --name-only -- .ai/state.md .ai/changelog.md' in /workspaces/rhg
 succeeded in 772ms:
14966:## Round 3 - bcu-render audit bookkeeping

 succeeded in 791ms:
- `npm test`: passed, 51/51 tests

## Remaining risks
- risk: extra `git diff --check` reported trailing whitespace in pre-existing added `.ai/changelog.md` copied log content
- reason: cleaning that would be a broad unrelated changelog cleanup
- next action: leave for a dedicated cleanup if desired

No commit or push performed.

## Round 3 - bcu-render audit bookkeeping
- Recorded the fresh `js/bcu-render` audit in `.ai/state.md`: marked the render chain audited, removed only `js/bcu-render` from unaudited major areas, and captured the orphaned bridge/duplicate class-name decision item plus the unconfirmed `done()`/`isDone()` lifetime observation.
- Verification passed: `node scripts/check-bcu-renderer-patch.mjs`, `node scripts/check-battle-speed-control.mjs`, `npm run check`, `npm test` (51/51), and `npm run build`.

diff --git a/.ai/changelog.md b/.ai/changelog.md
index c117753cb46ac6b56911620831eb0cfc64a145c1..2c464f435f9a0aa2b87b71a76df850c17e141140
--- a/.ai/changelog.md
+++ b/.ai/changelog.md
@@ -14871,6 +14871,7 @@
 - next action: leave for a dedicated cleanup if desired
 
 No commit or push performed.
+
 diff --git a/.ai/changelog.md b/.ai/changelog.md
 index bec886a53658bead087705a27518b263ed15c926..023428cbd3b7ee7610cb4f0dbc4ec6838e524023
 --- a/.ai/changelog.md
@@ -14966,3 +14967,6 @@
 
 No commit or push performed.
 
+## Round 3 - bcu-render audit bookkeeping
+- Recorded the fresh `js/bcu-render` audit in `.ai/state.md`: marked the render chain audited, removed only `js/bcu-render` from unaudited major areas, and captured the orphaned bridge/duplicate class-name decision item plus the unconfirmed `done()`/`isDone()` lifetime observation.
+- Verification passed: `node scripts/check-bcu-renderer-patch.mjs`, `node scripts/check-battle-speed-control.mjs`, `npm run check`, `npm test` (51/51), and `npm run build`.
diff --git a/.ai/state.md b/.ai/state.md
index 00ffdd101c1d900b87c36ecea877ed4cd406e194..b55080ba07be824c196a931816c105a8807bad8c
--- a/.ai/state.md
+++ b/.ai/state.md
@@ -5,9 +5,10 @@
 - Fixed `js/input/BcuBattleInputAdapter.js` inherited-property action lookup: `in` treated `Object.prototype` names such as `toString` as known actions instead of falling through to slot index/null behavior.
 - Fixed `js/audio/BattleSoundEventPatch.js` `throttle()` time source so the `performance` global is only referenced when defined, matching `AudioEngine._now()` fallback behavior.
 - Fixed `js/boot/installBattlePatches.js` `runDirectImports` error recording so direct import failures append to a guaranteed boot error array before progress advances.
+- Audited `js/bcu-render`; the chain is orphaned (no importer of `BcuEntityEffectIconRuntime.js`) and its class name collides with the live inline `BcuEntityEffectIconRuntime` in `BcuStatusEffectManager.js`. Recorded as a decision item; no code removed.
 
 ## Current Task
-- Fix `js/boot/installBattlePatches.js` `runDirectImports` defensive error recording and record the `js/boot` audit state.
+- Record the `js/bcu-render` fresh audit state and defer any orphaned-scaffold removal or wiring decision pending evidence.
 
 ## Audited Areas
 - `.ai/orchestrator.sh` verification command ordering and per-round logging behavior.
@@ -15,11 +16,11 @@
 - `js/input` — `BcuBattleInputAdapter.js` action mapping own-property fix with focused test coverage, plus read-through of `BcuDomTouchPolicy.js` and `BcuMobileGestureRuntime.js`.
 - `js/audio` — read-through of `AudioEngine.js`, `MusicCatalog.js`, `AudioSettings.js`, `BattleSoundEffects.js`, `BattleSoundEventPatch.js`, `StageMusicResolver.js`; applied the `throttle()` `performance`-global guard fix.
 - `js/boot` — read-through of `importProgress.js`, `installBattlePatches.js` (applied the `runDirectImports` defensive error-record fix), `installBcuPatches.js`, `installUiPatches.js`, and the `battle/install*Patches.js` shims + `groups/*` manifest imports; confirmed `installBcuBattleDataRegistries` passes the correct provider option key to each registry loader.
+- `js/bcu-render` — full read-through of `BcuBlendRuntime.js`, `BcuEPartTransformRuntime.js`, `BcuEffAnimRuntime.js`, `BcuFakeGraphicsCanvas2D.js`. Verified the whole `js/bcu-render` chain is currently orphaned: its only battle bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` has zero importers, and the live status-icon runtime is the same-named inline class in `js/battle/bcu-runtime/BcuStatusEffectManager.js`. Also read the live status/render path (`BcuStatusEffectManager.js`, `BcuModelInstance.js`, `BcuSpriteSheet.js`, `BcuCanvasComposite.js`, `BcuStatusIconResolver.js`) and `StageRegistry.js` and found them consistent; confirmed the previous round's `installBattlePatches.js` `runDirectImports` fix has no regression.
 
 ## Unaudited Major Areas
 - `js/battle`
 - `js/bcu`
-- `js/bcu-render`
 - `js/data`
 - `js/preview`
 - `js/ui`
@@ -30,7 +31,8 @@
 - `js/input/BcuMobileGestureRuntime.js` slide angle/threshold and up/down direction (`TAN_50`, `height * 0.15`, `dy / dragFrame < 0`) have not been confirmed against BCU touch source; audit in a later round before claiming BCU parity.
 - `js/audio/StageMusicResolver.js` `parseStageMusicFromRows` indexes `rows[2 + stageIndex]` after `parseMsdRows` drops fully-non-numeric lines; confirm the MapStageData map-pattern line (row 1) always carries a finite number so filtering can never shift the stage-row index.
 - `js/audio/BattleSoundEventPatch.js` `damageQueued` throttled-critical fall-through can play `HIT_0` after a throttled critical/strong-attack SE; confirm whether this rhg flood-guard behavior should stay or be changed for BCU parity.
-- `js/bcu-render/BcuBlendRuntime.js` `isBcuBlendGlow` blend values (`glow === 1 | 2 | 3 | -1`) have not been confirmed against BCU `EPart`/glow source; audit before claiming `js/bcu-render` parity.
+- `js/bcu-render` chain (`BcuBlendRuntime`/`BcuEPartTransformRuntime`/`BcuEffAnimRuntime`/`BcuFakeGraphicsCanvas2D`) + the dead bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` are orphaned and duplicate the live `BcuEntityEffectIconRuntime` class name; decide whether to remove the dead scaffold or wire it in, with evidence, before claiming `js/bcu-render` clean. Keep the existing `isBcuBlendGlow` glow-value uncertainty (`glow === 1 | 2 | 3 | -1` unconfirmed vs BCU `EPart`/glow source).
+- `BcuEffAnimRuntime.done()` and the inline `BcuEntityEffectIconRuntime.isDone()` never set `finished = true`; this appears intentional (status icons removed by expiry, not anim-loop completion) but is unconfirmed against BCU and currently has no consumer.
 
 ## Completed
 - Created AI management directory and core files.

 succeeded in 774ms:
.ai/changelog.md
.ai/state.md

codex
## Summary
- Rows moved to code-complete-candidate: none
- Rows moved to human-visual-review-needed: none
- Rows still partial / unconfirmed: `js/bcu-render` orphaned-scaffold decision, `isBcuBlendGlow` values, and `done()`/`isDone()` lifetime behavior

## BCU references inspected
- files/classes/methods: none this round; task was audit bookkeeping from the provided review.

## Changed files
- code: none
- tests: none
- docs: `.ai/state.md`, `.ai/changelog.md`
- generated assets: none

## Verification
- `node scripts/check-bcu-renderer-patch.mjs`: passed
- `node scripts/check-battle-speed-control.mjs`: passed
- `npm run check`: passed
- `npm test`: passed, 51/51
- `npm run build`: passed

## Remaining risks
- risk: `js/bcu-render` remains orphaned with a duplicate live class name.
- reason: removal or wiring was explicitly deferred pending evidence.
- next action: later round should decide whether to remove the scaffold or wire it in, without changing the glow-value set prematurely.

No runtime code changed. No commit or push performed.
diff --git a/.ai/changelog.md b/.ai/changelog.md
index c117753cb46ac6b56911620831eb0cfc64a145c1..2c464f435f9a0aa2b87b71a76df850c17e141140
--- a/.ai/changelog.md
+++ b/.ai/changelog.md
@@ -14871,6 +14871,7 @@
 - next action: leave for a dedicated cleanup if desired
 
 No commit or push performed.
+
 diff --git a/.ai/changelog.md b/.ai/changelog.md
 index bec886a53658bead087705a27518b263ed15c926..023428cbd3b7ee7610cb4f0dbc4ec6838e524023
 --- a/.ai/changelog.md
@@ -14966,3 +14967,6 @@
 
 No commit or push performed.
 
+## Round 3 - bcu-render audit bookkeeping
+- Recorded the fresh `js/bcu-render` audit in `.ai/state.md`: marked the render chain audited, removed only `js/bcu-render` from unaudited major areas, and captured the orphaned bridge/duplicate class-name decision item plus the unconfirmed `done()`/`isDone()` lifetime observation.
+- Verification passed: `node scripts/check-bcu-renderer-patch.mjs`, `node scripts/check-battle-speed-control.mjs`, `npm run check`, `npm test` (51/51), and `npm run build`.
diff --git a/.ai/state.md b/.ai/state.md
index 00ffdd101c1d900b87c36ecea877ed4cd406e194..b55080ba07be824c196a931816c105a8807bad8c
--- a/.ai/state.md
+++ b/.ai/state.md
@@ -5,9 +5,10 @@
 - Fixed `js/input/BcuBattleInputAdapter.js` inherited-property action lookup: `in` treated `Object.prototype` names such as `toString` as known actions instead of falling through to slot index/null behavior.
 - Fixed `js/audio/BattleSoundEventPatch.js` `throttle()` time source so the `performance` global is only referenced when defined, matching `AudioEngine._now()` fallback behavior.
 - Fixed `js/boot/installBattlePatches.js` `runDirectImports` error recording so direct import failures append to a guaranteed boot error array before progress advances.
+- Audited `js/bcu-render`; the chain is orphaned (no importer of `BcuEntityEffectIconRuntime.js`) and its class name collides with the live inline `BcuEntityEffectIconRuntime` in `BcuStatusEffectManager.js`. Recorded as a decision item; no code removed.
 
 ## Current Task
-- Fix `js/boot/installBattlePatches.js` `runDirectImports` defensive error recording and record the `js/boot` audit state.
+- Record the `js/bcu-render` fresh audit state and defer any orphaned-scaffold removal or wiring decision pending evidence.
 
 ## Audited Areas
 - `.ai/orchestrator.sh` verification command ordering and per-round logging behavior.
@@ -15,11 +16,11 @@
 - `js/input` — `BcuBattleInputAdapter.js` action mapping own-property fix with focused test coverage, plus read-through of `BcuDomTouchPolicy.js` and `BcuMobileGestureRuntime.js`.
 - `js/audio` — read-through of `AudioEngine.js`, `MusicCatalog.js`, `AudioSettings.js`, `BattleSoundEffects.js`, `BattleSoundEventPatch.js`, `StageMusicResolver.js`; applied the `throttle()` `performance`-global guard fix.
 - `js/boot` — read-through of `importProgress.js`, `installBattlePatches.js` (applied the `runDirectImports` defensive error-record fix), `installBcuPatches.js`, `installUiPatches.js`, and the `battle/install*Patches.js` shims + `groups/*` manifest imports; confirmed `installBcuBattleDataRegistries` passes the correct provider option key to each registry loader.
+- `js/bcu-render` — full read-through of `BcuBlendRuntime.js`, `BcuEPartTransformRuntime.js`, `BcuEffAnimRuntime.js`, `BcuFakeGraphicsCanvas2D.js`. Verified the whole `js/bcu-render` chain is currently orphaned: its only battle bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` has zero importers, and the live status-icon runtime is the same-named inline class in `js/battle/bcu-runtime/BcuStatusEffectManager.js`. Also read the live status/render path (`BcuStatusEffectManager.js`, `BcuModelInstance.js`, `BcuSpriteSheet.js`, `BcuCanvasComposite.js`, `BcuStatusIconResolver.js`) and `StageRegistry.js` and found them consistent; confirmed the previous round's `installBattlePatches.js` `runDirectImports` fix has no regression.
 
 ## Unaudited Major Areas
 - `js/battle`
 - `js/bcu`
-- `js/bcu-render`
 - `js/data`
 - `js/preview`
 - `js/ui`
@@ -30,7 +31,8 @@
 - `js/input/BcuMobileGestureRuntime.js` slide angle/threshold and up/down direction (`TAN_50`, `height * 0.15`, `dy / dragFrame < 0`) have not been confirmed against BCU touch source; audit in a later round before claiming BCU parity.
 - `js/audio/StageMusicResolver.js` `parseStageMusicFromRows` indexes `rows[2 + stageIndex]` after `parseMsdRows` drops fully-non-numeric lines; confirm the MapStageData map-pattern line (row 1) always carries a finite number so filtering can never shift the stage-row index.
 - `js/audio/BattleSoundEventPatch.js` `damageQueued` throttled-critical fall-through can play `HIT_0` after a throttled critical/strong-attack SE; confirm whether this rhg flood-guard behavior should stay or be changed for BCU parity.
-- `js/bcu-render/BcuBlendRuntime.js` `isBcuBlendGlow` blend values (`glow === 1 | 2 | 3 | -1`) have not been confirmed against BCU `EPart`/glow source; audit before claiming `js/bcu-render` parity.
+- `js/bcu-render` chain (`BcuBlendRuntime`/`BcuEPartTransformRuntime`/`BcuEffAnimRuntime`/`BcuFakeGraphicsCanvas2D`) + the dead bridge `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js` are orphaned and duplicate the live `BcuEntityEffectIconRuntime` class name; decide whether to remove the dead scaffold or wire it in, with evidence, before claiming `js/bcu-render` clean. Keep the existing `isBcuBlendGlow` glow-value uncertainty (`glow === 1 | 2 | 3 | -1` unconfirmed vs BCU `EPart`/glow source).
+- `BcuEffAnimRuntime.done()` and the inline `BcuEntityEffectIconRuntime.isDone()` never set `finished = true`; this appears intentional (status icons removed by expiry, not anim-loop completion) but is unconfirmed against BCU and currently has no consumer.
 
 ## Completed
 - Created AI management directory and core files.

tokens used
112,603
## Summary
- Rows moved to code-complete-candidate: none
- Rows moved to human-visual-review-needed: none
- Rows still partial / unconfirmed: `js/bcu-render` orphaned-scaffold decision, `isBcuBlendGlow` values, and `done()`/`isDone()` lifetime behavior

## BCU references inspected
- files/classes/methods: none this round; task was audit bookkeeping from the provided review.

## Changed files
- code: none
- tests: none
- docs: `.ai/state.md`, `.ai/changelog.md`
- generated assets: none

## Verification
- `node scripts/check-bcu-renderer-patch.mjs`: passed
- `node scripts/check-battle-speed-control.mjs`: passed
- `npm run check`: passed
- `npm test`: passed, 51/51
- `npm run build`: passed

## Remaining risks
- risk: `js/bcu-render` remains orphaned with a duplicate live class name.
- reason: removal or wiring was explicitly deferred pending evidence.
- next action: later round should decide whether to remove the scaffold or wire it in, without changing the glow-value set prematurely.

No runtime code changed. No commit or push performed.



## Previous Verification Output
[Excerpt: tail 30000 bytes of 32340 total bytes.]
 scripts/check-bcu-delay-runtime.mjs

$ node --check scripts/check-bcu-stage-line-row-parity.mjs

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

✔ damage queue is excused in insertion order (no side/position/key resort) (1.662302ms)
✔ player-before-enemy insertion order (the BCU direction-pass order) is preserved (0.215943ms)
✔ known BCU battle actions map to lineup change sentinels (0.994305ms)
✔ inherited object names fall through to slot indexes when slot is finite (0.213037ms)
✔ inherited object names return null when no finite slot is present (0.166781ms)
✔ unknown actions fall through to slot index or null (0.174456ms)
✔ BcuCombatModel parses unit full IMU* guard fields (2.303768ms)
✔ BcuCombatModel parses enemy full IMU* guard fields with confirmed DataEnemy columns (0.737887ms)
✔ applyBcuProc rejects full immunity status procs without state side effects (2.404145ms)
✔ applyBcuProc applies partial resistance to status duration and toxic damage (1.622417ms)
✔ IMUWEAK smartImu follows BCU checkSmartImu direction (0.501705ms)
✔ applyBcuProc applies partial knockback resistance to proc KB distance (0.856958ms)
✔ ProcResolver suppresses curse and seal proc groups before runtime apply (4.263286ms)
✔ guardBcuDamage rejects wave, surge, blast, and toxic queue before damage is pending (1.041483ms)
✔ queueAttackDamage applies partial wave resistance before enqueueing damage (3.91826ms)
✔ queueAttackDamage guard rejection does not enqueue pending damage or procs (0.691089ms)
✔ normal queueAttackDamage still enqueues regular attack damage (0.878148ms)
✔ curse and seal suppress DamageAbilityResolver trait ability multipliers and restore when expired (1.375286ms)
✔ seal suppresses strongAttack and critical procs in damage resolver (0.458345ms)
✔ critical BattleScene wrapper chain remains callable after parity imports (0.34318ms)
✔ BattleAttackProfile maps per-hit abi flags onto attack events as bcuHitAbi (1.197134ms)
✔ ProcResolver gates attack procs per hit on bcuHitAbi != 1 (BCU abis[ind] == 1 setProc gate) (0.885832ms)
✔ ProcResolver keeps entity-level zombieKiller/soulstrike exempt from the hit abi gate (0.308997ms)
✔ DamageAbilityResolver gates strongAttack/critical procs per hit on bcuHitAbi != 1 (0.292917ms)
✔ zombie revive enters attack-wait immediately when an enemy is in touch range (BCU update2 checkTouch) (7.507616ms)
✔ CopRand nextFloat(seed=0) matches BCU/Java float vector exactly (1.13579ms)
✔ CopRand nextFloat results are exact Java floats (Math.fround stable) (0.228947ms)
✔ CopRand nextDouble consumes the seed identically to nextFloat (0.255406ms)
✔ CopRand is reproducible from the same 64-bit seed (1.60287ms)
✔ CopRand drawCount tracks the number of seeded draws (0.173945ms)
✔ JavaRandom matches java.util.Random nextInt/nextLong for seed=0 (0.196135ms)
✔ normalizeBattleSeed parses strings and clamps to signed 64-bit; randomBattleSeed is in range (0.262449ms)
✔ direction sort is stable: dire -1 (player) before +1 (enemy), insertion order kept on ties (1.46336ms)
✔ direction sort falls back to side when direction is absent (dog-player => -1) (0.228717ms)
✔ layer sort is stable: ascending currentLayer, insertion order kept within a layer (0.321129ms)
✔ same-direction, same-position entities are NOT reordered (no pos/instanceId tiebreak) (0.286956ms)
✔ will=0 enemy occupies exactly 1 slot (1.065969ms)
✔ will=2 enemy occupies 3 slots (will + 1) (0.170338ms)
✔ an enemy in final knockback is still counted (0.19347ms)
✔ a 'dead' enemy still playing its death animation (not removable) is counted (0.216544ms)
✔ a 'dead' enemy that is BCU-removable is NOT counted (0.174255ms)
✔ mixed roster sums will+1 per non-dead enemy and ignores removed/removable ones (0.243124ms)
✔ boss-as-base (EEnemy) adds will+1; an ECastle base does not (0.282968ms)
✔ constructor draws row first-frame BEFORE the global respawn (BCU StageBasis order) (1.423155ms)
✔ commit draws row respawn -> spawn layer -> global respawn; spawn frame and layer are exact (1.526087ms)
✔ a failed spawn (rejectSpawn) consumes no RNG (0.448827ms)
✔ computeBcuTouchState: Target Only with only an incompatible enemy in range -> touch true, touchEnemy false (1.647724ms)
✔ computeBcuTouchState: adding a trait-compatible enemy flips touchEnemy true (0.345395ms)
✔ computeBcuTouchState: Target Only with only the enemy base in range -> touchEnemy true (base counts) (0.368367ms)
✔ computeBcuTouchState: non-Target-Only unit attacks any in-range enemy (touchEnemy == touch) (0.202407ms)
✔ computeBcuTouchState: nothing in range -> touch false, touchEnemy false (0.23009ms)
ℹ tests 51
ℹ suites 0
ℹ pass 51
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1290.647732

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

/rhg/assets/ui/nyanko-ui-stamp.svg referenced in /rhg/assets/ui/nyanko-ui-stamp.svg didn't resolve at build time, it will remain unchanged to be resolved at runtime

/rhg/assets/ui/nyanko-menu-bg.png referenced in /rhg/assets/ui/nyanko-menu-bg.png didn't resolve at build time, it will remain unchanged to be resolved at runtime

/rhg/assets/ui/nyanko-battle-load-bg.png referenced in /rhg/assets/ui/nyanko-battle-load-bg.png didn't resolve at build time, it will remain unchanged to be resolved at runtime

/rhg/assets/FOT-大江戸勘亭流 Std E.otf referenced in /rhg/assets/FOT-大江戸勘亭流 Std E.otf didn't resolve at build time, it will remain unchanged to be resolved at runtime
✓ 282 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                                   2.72 kB │ gzip:  1.34 kB
dist/assets/nyanko-stage-selector-pro-DZ_9GIkk.css               20.22 kB │ gzip:  3.41 kB
dist/assets/index-BqVnFC8Q.css                                  163.45 kB │ gzip: 26.21 kB
dist/assets/installBcuPatches-DBOqhy4D.js                         0.39 kB │ gzip:  0.26 kB
dist/assets/BcuModifierDiagnostics-0ktZapK-.js                    0.68 kB │ gzip:  0.41 kB
dist/assets/installUiPatches-CuKW05-D.js                          0.73 kB │ gzip:  0.44 kB
dist/assets/BcuImgCut-Dl3DzW60.js                                 0.76 kB │ gzip:  0.49 kB
dist/assets/battleDirectPatches-BkV6INH8.js                       0.86 kB │ gzip:  0.45 kB
dist/assets/installBattleRendererPatches-BLN0OssK.js              0.93 kB │ gzip:  0.51 kB
dist/assets/installBattleCorePatches-xlUvayPW.js                  0.95 kB │ gzip:  0.52 kB
dist/assets/installBattleProjectilePatches-CZcpm7Yl.js            0.97 kB │ gzip:  0.52 kB
dist/assets/BcuComboRegistryLoader-BoSRIusU.js                    1.02 kB │ gzip:  0.58 kB
dist/assets/installBattleActorLifecyclePatches-Cp1_uSVY.js        1.10 kB │ gzip:  0.58 kB
dist/assets/BcuExtraActorAnimationBundlePatch-DVYv3haB.js         1.52 kB │ gzip:  0.79 kB
dist/assets/AudioSettings-BjmvYlQ-.js                             1.66 kB │ gzip:  0.66 kB
dist/assets/BcuTalentRegistryLoader-X_PTvVCz.js                   1.71 kB │ gzip:  0.88 kB
dist/assets/installBattleScenePatches-wWM6sP3i.js                 1.75 kB │ gzip:  0.76 kB
dist/assets/BattleTouchGuard-sEjdcWfn.js                          1.76 kB │ gzip:  0.79 kB
dist/assets/PreviewAppBattleMusicPatch-BXCcb6KH.js                1.90 kB │ gzip:  0.84 kB
dist/assets/PreviewAppCustomStageBattleConfigPatch-4MSEf9y4.js    1.97 kB │ gzip:  0.87 kB
dist/assets/runtimePatches-C7x2V6ee.js                            2.12 kB │ gzip:  0.86 kB
dist/assets/BattleSceneBcuTouchPatch-CebPO92T.js                  2.16 kB │ gzip:  0.90 kB
dist/assets/PreviewAppPageTransitionPatch-BEEYqcWZ.js             2.19 kB │ gzip:  0.94 kB
dist/assets/BcuWaveBundleEffectSpawner-D8XY5-r2.js                2.98 kB │ gzip:  1.45 kB
dist/assets/installBattlePatches-Glb2yIjT.js                      3.21 kB │ gzip:  1.12 kB
dist/assets/RuntimeAssetGuard-BRw2XkJD.js                         3.23 kB │ gzip:  1.39 kB
dist/assets/BcuAssetDatabase-z22IXhrf.js                          3.35 kB │ gzip:  1.14 kB
dist/assets/BattleSoundEventPatch-D7BnMgbQ.js                     4.74 kB │ gzip:  2.01 kB
dist/assets/BcuResistRuntime-DMYoEmvs.js                          4.90 kB │ gzip:  1.92 kB
dist/assets/PreviewAppBattleResultOverlayPatch-5_pVS7J5.js        5.06 kB │ gzip:  2.11 kB
dist/assets/BcuComboStatModifier-DHuRy_8U.js                      5.10 kB │ gzip:  2.23 kB
dist/assets/BcuBarrierShieldEffectRuntime-Dw_m6v-z.js             6.10 kB │ gzip:  2.12 kB
dist/assets/BcuWarpLifecycleRuntime-63SelQV8.js                   6.67 kB │ gzip:  2.59 kB
dist/assets/BcuSpriteText-Cxo1P_3f.js                             8.17 kB │ gzip:  2.59 kB
dist/assets/index-BqhDm7Qq.js                                     9.08 kB │ gzip:  3.80 kB
dist/assets/BattleSoundEffects-Beu-Ykwx.js                        9.15 kB │ gzip:  3.30 kB
dist/assets/BcuCombatModel-BV-AUOiZ.js                           10.16 kB │ gzip:  3.70 kB
dist/assets/BattleSurgeRuntimePatch-Exn3mR4N.js                  11.22 kB │ gzip:  4.24 kB
dist/assets/StageRuntimeSceneAdapter-CwSFpyt1.js                 11.60 kB │ gzip:  3.23 kB
dist/assets/BcuTalentInfoData-C0XKDm3m.js                        12.05 kB │ gzip:  4.03 kB
dist/assets/BattleWaveEffectLoader-ByGdEngG.js                   13.22 kB │ gzip:  3.02 kB
dist/assets/BcuAssetLoader-uyvXAJO_.js                           13.34 kB │ gzip:  4.43 kB
dist/assets/PreviewAppBattlePauseOverlayPatch-B3up1bUf.js        15.56 kB │ gzip:  4.78 kB
dist/assets/BattleStatsLoader-CArpgFRO.js                        17.41 kB │ gzip:  5.70 kB
dist/assets/BcuStatusEffectManager-GNW1Uytd.js                   20.91 kB │ gzip:  6.90 kB
dist/assets/battleRendererPatches-SXUQX9fY.js                    22.74 kB │ gzip:  7.88 kB
dist/assets/BcuCatCannonRuntime-DCsl-N0J.js                      24.04 kB │ gzip:  8.10 kB
dist/assets/BattleSceneRenderer-DcoN6a6L.js                      32.09 kB │ gzip:  9.84 kB
dist/assets/battleProjectilePatches-CncP_7ya.js                  39.34 kB │ gzip: 11.26 kB
dist/assets/ProductionCardSkin-D5upr5CY.js                       43.94 kB │ gzip: 13.70 kB
dist/assets/BcuBootLoader-CiZy9j2z.js                            44.10 kB │ gzip: 12.37 kB
dist/assets/BcuOrbModifier-FSPZFAYU.js                           62.35 kB │ gzip: 19.19 kB
dist/assets/PreviewApp-B4K0Q497.js                               62.64 kB │ gzip: 19.20 kB
dist/assets/battleCorePatches-Blj3Omkr.js                        74.45 kB │ gzip: 22.14 kB
dist/assets/battleScenePatches-Cj94UQQf.js                       77.13 kB │ gzip: 21.96 kB
dist/assets/battleActorLifecyclePatches-BlzezvQp.js              96.30 kB │ gzip: 27.64 kB
dist/assets/uiPatches-DiEEysY0.js                               162.65 kB │ gzip: 40.40 kB
dist/assets/BattleScene-DRJ_QqZf.js                             315.94 kB │ gzip: 86.42 kB

✓ built in 1.50s

Exit code: 0

