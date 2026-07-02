# Codex Fix Prompt

You are the implementation owner for this repository.

Implement only the `Next Codex Task` from `.ai/review.md`. Do not implement other review findings unless they are strictly required to complete that task.

Constraints:
- Do not make huge changes.
- Do not make unrequested specification changes.
- Preserve existing runtime behavior unless the task explicitly requires changing it.
- If facts are missing or the requested behavior cannot be proven, record the uncertainty in `.ai/state.md` under an `Unresolved` heading.
- Update `.ai/state.md` when the `Next Codex Task` includes audit bookkeeping. Keep `## Audited Areas` and `## Unaudited Major Areas` current; remove an unaudited area only after it was actually inspected.
- Add or update focused tests when the change needs test coverage.
- Append a concise summary of your changes and verification notes to `.ai/changelog.md`.
- Do not commit.
- Do not push.

Before finishing, run the verification commands that are relevant to the files you changed when they are available in this environment.


# Runtime Context
Round: 1 of 10
Repository: /workspaces/rhg

## Claude Review
I have a confirmed, user-visible defect in the unaudited `js/ui` area. Let me verify the previous Codex patch has no regression, then write the review.

The previous patch (`BattleSoundEventPatch.js` throttle guard) in the diff is exactly the recommended guarded form — correct, no regression. I have enough to write the review.

# Review

## Critical
None

## High
- **`js/ui/AppLoadingOverlay.js:86-96` — the loading progress bar is permanently stuck at 100% on every battle load after the first.** `setProgress` clamps progress monotonically: `const next = Math.max(this.lastProgressValue, …)` (line 132) and stores it back (line 133). `lastProgressValue` is initialized to `0` only in the constructor (line 63); **`show()` never resets it**. The overlay is instantiated once (`PreviewApp.js:89`) and reused for every battle load — `applyFormationToBattle` (`PreviewApp.js:217`) and `resetBattle` (`PreviewApp.js:267`) both call `show()` on the same instance. The first load ramps the bar `0.05 → 0.83 → 0.84 → 0.9 → 1.0` (`resetBattle` ends at `value: 1.0`, `PreviewApp.js:350`), leaving `lastProgressValue === 1`. Every subsequent `show()` leaves it at `1`, so `setProgress({value: 0.05})` computes `Math.max(1, 0.05) === 1` and the bar renders full for the entire load. Since retrying a stage or returning to formation and starting another battle is routine, this is a confirmed user-visible regression: the prominent progress bar shows "complete" while the battle is still loading. The step chips still update (they key off `phase`, lines 136-142), which is exactly what makes the stuck bar misleading rather than obviously broken. `BattleLoadingProgressVerifier.verifyLoadingOverlayTimerAdvances` only does a static `s.includes('lastProgressValue')` text check (and is itself orphaned — no importer), so nothing catches this.

## Medium
None

## Low
- **`js/ui/FormationStageDifficultyFilterControlPatch.js:34-36` — `isFiltering(f)` is always true.** `filterState` sets `star: normalizeCrownStar(f.star ?? 1)`, and `normalizeCrownStar` always returns a finite integer clamped to `[MIN,MAX]` (`BcuStageCrownRuntime.js:24-28`), so `Number.isFinite(f.star)` never fails and the crown-star filter is applied even with an empty query — the map list defaults to showing only the selected crown star (★1). This is plausibly intended (a crown selector always has a value, matching BCU crown difficulty) and is covered by the passing `check-bcu-stage-difficulty-parity.mjs`; record as a parity question, do not change this round.
- **`js/ui/BattleLoadingProgressVerifier.js` is orphaned** (no importer across `js/`, `scripts/`, `tests/`) and only performs static source-string assertions. Record as a decision item (wire into the safe-suite or remove), consistent with the round-3/round-4 orphan-scaffold handling; do not remove this round.
- Previous round's `js/audio/BattleSoundEventPatch.js` `throttle()` guard fix reviewed for regressions: the applied form `scene?.timeMs ?? ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now())` matches `AudioEngine._now()` semantics and is correct. No action.

## Next Codex Task
Fix the loading-overlay progress reset and add focused coverage, plus `js/ui` audit bookkeeping.

1. **`js/ui/AppLoadingOverlay.js` — reset progress in `show()`.** Inside `show()` (which already calls `ensureRoot()` first, so `this.root` exists), reset the monotonic progress state and clear the stale bar so a reused overlay starts each load from empty:
   - Add `this.lastProgressValue = 0;`
   - Reset the visible bar: `const bar = this.root.querySelector('.app-loading-progress-bar'); if (bar) bar.style.width = '0%';`
   
   Do **not** change the monotonic `Math.max(...)` clamp in `setProgress` (it is correct *within* one load), the timer logic, the step-chip logic, or any other method.

2. **Add `tests/app-loading-overlay-progress-reset.test.mjs`** (picked up by `npm test`'s `node --test tests/*.test.mjs`). The module imports are node-safe (`assetBase.js` falls back to `/` when `import.meta.env` is undefined; `AppVersion.js` is a constant), so a lightweight DOM stub works. Before importing `AppLoadingOverlay.js`, install a minimal `globalThis.document` stub whose `createElement` returns a generic fake node that tolerates everything `ensureRoot`/`show`/`setProgress` touch — `className`, `dataset` (object), `innerHTML` setter (no-op), `classList` with `add/remove/toggle/contains`, `style` (object), `textContent`, `addEventListener`, `appendChild`, `remove`, `querySelector` (returns another fake node), and `querySelectorAll` (returns `[]`) — plus a `body`/`head`. Then assert on the plain instance field `overlay.lastProgressValue`:
   - `new AppLoadingOverlay({ mount })`, `show()`, `setProgress({ phase: 'ready', value: 1.0 })` → `lastProgressValue === 1`.
   - Second `show()` → `lastProgressValue === 0` (fails before the fix).
   - `setProgress({ phase: 'battle-scene', value: 0.05 })` → `lastProgressValue === 0.05` (was pinned at `1` before the fix).
   
   Keep the stub minimal; do not add jsdom or any new dependency.

3. **`.ai/state.md` bookkeeping** (this round audited part of `js/ui`, not all of it — keep uncertainty honest):
   - **Audited Areas** — add a *partial* `js/ui` entry: read-through of `AppLoadingOverlay.js` (applied the `show()` progress-reset fix + new test), `BattleSpeedControl.js`, `BattlePauseMenu.js`, `SoundToggleControls.js`, `PlayerProductionBar.js`, `FormationStageDifficultyFilterControlPatch.js`, `BattleTouchGuard.js`.
   - **Unaudited Major Areas** — keep `js/ui` listed, annotated `js/ui (partial — loading-overlay/battle-HUD subset audited round-6; ~30 files remain: FormationEditor*, ProductionCardSkin, BcuStageCatalogBuilder, Nyanko*/Formation* patches, *Verifier files, etc.)`. Do **not** remove `js/ui`.
   - **Discovered Issues** — record: fixed `js/ui/AppLoadingOverlay.js` so `show()` resets `lastProgressValue` (and the visible bar), preventing the reused overlay's progress bar from sticking at 100% on every battle load after the first.
   - **Unresolved** — add: (a) `FormationStageDifficultyFilterControlPatch.isFiltering` is always true because `filterState` coerces `star` through `normalizeCrownStar` to a finite value, so the stage-map list is always crown-star-filtered (default ★1) even with an empty query; confirm against intended BCU crown-difficulty default before treating as a defect. (b) `js/ui/BattleLoadingProgressVerifier.js` is orphaned (no importer) and only does static source-string checks; decide whether to wire it into the safe-suite or remove it.

4. Append a concise summary to `.ai/changelog.md`. Do not modify other runtime code, do not add new status files.

## Verification Commands
- `node --check js/ui/AppLoadingOverlay.js`
- `node --check tests/app-loading-overlay-progress-reset.test.mjs`
- `node --test tests/app-loading-overlay-progress-reset.test.mjs`
- `npm run check`
- `npm test`
- `npm run build`

## Stop Condition
Not satisfied. `High` is non-empty this round (the `AppLoadingOverlay` progress-reset regression), and `## Unaudited Major Areas` still lists `js/battle`, `js/bcu`, `js/ui` (only partially audited), `scripts`, and `tests`; verification for this round has not run yet. Continue the loop.


## Latest Verification Output
[Excerpt: tail 30000 bytes of 32342 total bytes.]
cripts/check-bcu-delay-runtime.mjs

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

✔ damage queue is excused in insertion order (no side/position/key resort) (1.697518ms)
✔ player-before-enemy insertion order (the BCU direction-pass order) is preserved (0.213288ms)
✔ known BCU battle actions map to lineup change sentinels (0.912422ms)
✔ inherited object names fall through to slot indexes when slot is finite (0.20913ms)
✔ inherited object names return null when no finite slot is present (0.167562ms)
✔ unknown actions fall through to slot index or null (0.172702ms)
✔ BcuCombatModel parses unit full IMU* guard fields (2.377375ms)
✔ BcuCombatModel parses enemy full IMU* guard fields with confirmed DataEnemy columns (0.769255ms)
✔ applyBcuProc rejects full immunity status procs without state side effects (2.368659ms)
✔ applyBcuProc applies partial resistance to status duration and toxic damage (1.884887ms)
✔ IMUWEAK smartImu follows BCU checkSmartImu direction (0.483653ms)
✔ applyBcuProc applies partial knockback resistance to proc KB distance (0.618173ms)
✔ ProcResolver suppresses curse and seal proc groups before runtime apply (1.889144ms)
✔ guardBcuDamage rejects wave, surge, blast, and toxic queue before damage is pending (0.73423ms)
✔ queueAttackDamage applies partial wave resistance before enqueueing damage (4.00887ms)
✔ queueAttackDamage guard rejection does not enqueue pending damage or procs (0.812957ms)
✔ normal queueAttackDamage still enqueues regular attack damage (0.957356ms)
✔ curse and seal suppress DamageAbilityResolver trait ability multipliers and restore when expired (1.439236ms)
✔ seal suppresses strongAttack and critical procs in damage resolver (0.633572ms)
✔ critical BattleScene wrapper chain remains callable after parity imports (0.316671ms)
✔ BattleAttackProfile maps per-hit abi flags onto attack events as bcuHitAbi (1.219595ms)
✔ ProcResolver gates attack procs per hit on bcuHitAbi != 1 (BCU abis[ind] == 1 setProc gate) (1.090784ms)
✔ ProcResolver keeps entity-level zombieKiller/soulstrike exempt from the hit abi gate (0.297455ms)
✔ DamageAbilityResolver gates strongAttack/critical procs per hit on bcuHitAbi != 1 (0.308716ms)
✔ zombie revive enters attack-wait immediately when an enemy is in touch range (BCU update2 checkTouch) (7.638608ms)
✔ CopRand nextFloat(seed=0) matches BCU/Java float vector exactly (1.226939ms)
✔ CopRand nextFloat results are exact Java floats (Math.fround stable) (0.194392ms)
✔ CopRand nextDouble consumes the seed identically to nextFloat (0.281615ms)
✔ CopRand is reproducible from the same 64-bit seed (1.55968ms)
✔ CopRand drawCount tracks the number of seeded draws (0.170107ms)
✔ JavaRandom matches java.util.Random nextInt/nextLong for seed=0 (0.184134ms)
✔ normalizeBattleSeed parses strings and clamps to signed 64-bit; randomBattleSeed is in range (0.271556ms)
✔ direction sort is stable: dire -1 (player) before +1 (enemy), insertion order kept on ties (1.574398ms)
✔ direction sort falls back to side when direction is absent (dog-player => -1) (0.238044ms)
✔ layer sort is stable: ascending currentLayer, insertion order kept within a layer (0.304809ms)
✔ same-direction, same-position entities are NOT reordered (no pos/instanceId tiebreak) (0.296733ms)
✔ will=0 enemy occupies exactly 1 slot (1.429237ms)
✔ will=2 enemy occupies 3 slots (will + 1) (0.212857ms)
✔ an enemy in final knockback is still counted (0.211384ms)
✔ a 'dead' enemy still playing its death animation (not removable) is counted (0.281165ms)
✔ a 'dead' enemy that is BCU-removable is NOT counted (0.227845ms)
✔ mixed roster sums will+1 per non-dead enemy and ignores removed/removable ones (0.363699ms)
✔ boss-as-base (EEnemy) adds will+1; an ECastle base does not (0.375451ms)
✔ constructor draws row first-frame BEFORE the global respawn (BCU StageBasis order) (1.976598ms)
✔ commit draws row respawn -> spawn layer -> global respawn; spawn frame and layer are exact (2.415507ms)
✔ a failed spawn (rejectSpawn) consumes no RNG (0.493732ms)
✔ computeBcuTouchState: Target Only with only an incompatible enemy in range -> touch true, touchEnemy false (2.326661ms)
✔ computeBcuTouchState: adding a trait-compatible enemy flips touchEnemy true (0.444509ms)
✔ computeBcuTouchState: Target Only with only the enemy base in range -> touchEnemy true (base counts) (0.451362ms)
✔ computeBcuTouchState: non-Target-Only unit attacks any in-range enemy (touchEnemy == touch) (0.28936ms)
✔ computeBcuTouchState: nothing in range -> touch false, touchEnemy false (0.475407ms)
ℹ tests 51
ℹ suites 0
ℹ pass 51
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1613.817703

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
dist/assets/installBcuPatches-D1686G1T.js                         0.39 kB │ gzip:  0.27 kB
dist/assets/BcuModifierDiagnostics-0ktZapK-.js                    0.68 kB │ gzip:  0.41 kB
dist/assets/installUiPatches-DlDjasQF.js                          0.73 kB │ gzip:  0.44 kB
dist/assets/BcuImgCut-Dl3DzW60.js                                 0.76 kB │ gzip:  0.49 kB
dist/assets/battleDirectPatches-DSEZZRIz.js                       0.86 kB │ gzip:  0.45 kB
dist/assets/installBattleRendererPatches-DskqQXBT.js              0.93 kB │ gzip:  0.51 kB
dist/assets/installBattleCorePatches-Bba_toy4.js                  0.95 kB │ gzip:  0.52 kB
dist/assets/installBattleProjectilePatches-BHlQHU9C.js            0.97 kB │ gzip:  0.52 kB
dist/assets/BcuComboRegistryLoader-BoSRIusU.js                    1.02 kB │ gzip:  0.58 kB
dist/assets/installBattleActorLifecyclePatches-C2jBnLli.js        1.10 kB │ gzip:  0.58 kB
dist/assets/BcuExtraActorAnimationBundlePatch-DVYv3haB.js         1.52 kB │ gzip:  0.79 kB
dist/assets/AudioSettings-BjmvYlQ-.js                             1.66 kB │ gzip:  0.66 kB
dist/assets/BcuTalentRegistryLoader-X_PTvVCz.js                   1.71 kB │ gzip:  0.88 kB
dist/assets/installBattleScenePatches-NVy8XQ02.js                 1.75 kB │ gzip:  0.76 kB
dist/assets/BattleTouchGuard-sEjdcWfn.js                          1.76 kB │ gzip:  0.79 kB
dist/assets/PreviewAppBattleMusicPatch-BlepCVs1.js                1.90 kB │ gzip:  0.84 kB
dist/assets/PreviewAppCustomStageBattleConfigPatch-DQotsMFn.js    1.97 kB │ gzip:  0.87 kB
dist/assets/runtimePatches-COWhivKs.js                            2.12 kB │ gzip:  0.85 kB
dist/assets/BattleSceneBcuTouchPatch-mnbSCB0T.js                  2.16 kB │ gzip:  0.90 kB
dist/assets/PreviewAppPageTransitionPatch-BqvirWLm.js             2.19 kB │ gzip:  0.94 kB
dist/assets/BcuWaveBundleEffectSpawner-BB8QQngT.js                2.98 kB │ gzip:  1.45 kB
dist/assets/installBattlePatches-DvYRL--g.js                      3.17 kB │ gzip:  1.12 kB
dist/assets/RuntimeAssetGuard-BRw2XkJD.js                         3.23 kB │ gzip:  1.39 kB
dist/assets/BcuAssetDatabase-z22IXhrf.js                          3.35 kB │ gzip:  1.14 kB
dist/assets/BattleSoundEventPatch-CrXJLypt.js                     4.74 kB │ gzip:  2.00 kB
dist/assets/BcuResistRuntime-CFYxNPOL.js                          4.90 kB │ gzip:  1.92 kB
dist/assets/PreviewAppBattleResultOverlayPatch-CmHAMxtL.js        5.06 kB │ gzip:  2.10 kB
dist/assets/BcuComboStatModifier-DHuRy_8U.js                      5.10 kB │ gzip:  2.23 kB
dist/assets/BcuBarrierShieldEffectRuntime-ONn5gh2s.js             6.10 kB │ gzip:  2.11 kB
dist/assets/BcuWarpLifecycleRuntime-060_L3Hi.js                   6.67 kB │ gzip:  2.58 kB
dist/assets/BcuSpriteText-Cxo1P_3f.js                             8.17 kB │ gzip:  2.59 kB
dist/assets/index-8zCqZ6VS.js                                     9.08 kB │ gzip:  3.80 kB
dist/assets/BattleSoundEffects-SAgjeN9v.js                        9.15 kB │ gzip:  3.30 kB
dist/assets/BcuCombatModel-BV-AUOiZ.js                           10.16 kB │ gzip:  3.70 kB
dist/assets/BattleSurgeRuntimePatch-Cv1Kk0K4.js                  11.22 kB │ gzip:  4.23 kB
dist/assets/StageRuntimeSceneAdapter-BH98AXP8.js                 11.60 kB │ gzip:  3.22 kB
dist/assets/BcuTalentInfoData-C0XKDm3m.js                        12.05 kB │ gzip:  4.03 kB
dist/assets/BattleWaveEffectLoader-ByGdEngG.js                   13.22 kB │ gzip:  3.02 kB
dist/assets/BcuAssetLoader-uyvXAJO_.js                           13.34 kB │ gzip:  4.43 kB
dist/assets/PreviewAppBattlePauseOverlayPatch-9nOVfBIy.js        15.56 kB │ gzip:  4.78 kB
dist/assets/BattleStatsLoader-CArpgFRO.js                        17.41 kB │ gzip:  5.70 kB
dist/assets/BcuStatusEffectManager-C4MeUVG2.js                   20.91 kB │ gzip:  6.90 kB
dist/assets/battleRendererPatches-Dxl1rgBK.js                    22.74 kB │ gzip:  7.88 kB
dist/assets/BcuCatCannonRuntime-CatkdxLT.js                      24.04 kB │ gzip:  8.10 kB
dist/assets/BattleSceneRenderer-DO93mnM2.js                      32.09 kB │ gzip:  9.84 kB
dist/assets/battleProjectilePatches-CeZQRLHZ.js                  39.34 kB │ gzip: 11.26 kB
dist/assets/ProductionCardSkin-CvFu3onI.js                       43.94 kB │ gzip: 13.70 kB
dist/assets/BcuBootLoader-CiZy9j2z.js                            44.10 kB │ gzip: 12.37 kB
dist/assets/BcuOrbModifier-BwJHhPju.js                           62.35 kB │ gzip: 19.19 kB
dist/assets/PreviewApp-P-RwsiiN.js                               62.64 kB │ gzip: 19.20 kB
dist/assets/battleCorePatches-uqWb337V.js                        74.45 kB │ gzip: 22.14 kB
dist/assets/battleScenePatches-DMy2yiAg.js                       77.13 kB │ gzip: 21.96 kB
dist/assets/battleActorLifecyclePatches-DDVrH7CB.js              96.30 kB │ gzip: 27.64 kB
dist/assets/uiPatches-CndikDVS.js                               162.65 kB │ gzip: 40.40 kB
dist/assets/BattleScene-DbpF-Efi.js                             315.94 kB │ gzip: 86.42 kB

✓ built in 1.88s

Exit code: 0

