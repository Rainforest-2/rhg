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
Round: 2 of 10
Repository: /workspaces/rhg

## Claude Review
I've completed a fresh audit of the unaudited `js/bcu` core parsers and part of `js/battle` (economy). Key findings: the previous `AppLoadingOverlay` patch is non-regressive, and I found a concrete internal inconsistency in `BattleEconomy`'s wallet-combo math — but it's currently inert (zero callers pass combo percents) and unverified by any parity check, so fixing it would require BCU evidence.

# Review

## Critical
None

## High
None

## Medium
- **`js/battle/BattleEconomy.js:116` — the wallet income-combo multiplier is internally inconsistent with the max-money combo path, and is a latent trap.** `computeWalletIncomeInternal` applies the income combo as `mon *= Math.floor(this.walletCombo.incomePercent / 100) + 1`, i.e. a whole-100%-step multiplier (a +10% or +50% combo floors to `0 → ×1`, contributing nothing; only 100/200/300% take effect). The sibling max-money combo path (`getBcuWalletMaxMoney`, line 46) treats the same class of "combo percent" input as an additive percentage: `(100 + Math.floor(maxMoneyComboPercent)) / 100`, so a +20% combo correctly yields ×1.20. Both percents are populated from the same `walletOptions` shape in the constructor (lines 74-79), so one of the two formulas is almost certainly wrong. **Not currently blocking:** I confirmed via grep that nothing in `js/` ever passes `incomeComboPercent`/`maxMoneyComboPercent` (the only writer/reader is `BattleEconomy.js` itself; `BATTLE_CONFIG.economy.dogPlayer.wallet` sets no combo fields), so both multipliers evaluate to a no-op (`×1`) today, and `check-bcu-wallet-runtime-parity.mjs` exercises no combo path at all. Because this slice is a claimed BCU parity port ("BCU StageBasis money/work_lv/maxMoney/upgradeCost … parity slice") and the correct formula cannot be proven from the inspected evidence, this must be **recorded as unresolved**, not "fixed" toward a guessed semantic (doing so would fabricate a parity claim, against the repo guardrails).

## Low
- **`js/battle/BattleEconomy.js` wallet-combo feature is dead code** (zero callers pass any combo option; no parity-check coverage). Record as a decision/parity item alongside the income-combo inconsistency; do not remove or rewire this round.
- **`js/bcu/BcuAnimParser.js:45-47` — the keyframe loop advances `cursor` and `k` on a non-finite first field (`continue`), so a malformed/blank line silently consumes one declared keyframe slot.** This matches "trust `keyCount`, skip junk" defensiveness and does not desync the cursor (both branches advance identically), so it is a read-through note, not a defect.
- **`js/bcu/BcuPathResolver.js:34` — `resolveUnitAsset` fabricates a hardcoded `public/assets/bcu/000004/...` base when no unit image is found in `files`** (unlike `resolveEnemyAsset`, which returns `null`). Likely intentional for the default pack, but worth a later parity glance against the semantic-ZIP-only asset rule; record only.
- Previous round's `js/ui/AppLoadingOverlay.js` `show()` progress-reset fix reviewed for regressions: `show()` resets `lastProgressValue = 0` and clears the bar to `0%` after `ensureRoot()`, the monotonic `Math.max` clamp in `setProgress` is untouched, and there is no bad interaction with `setError` (a later `show()` correctly re-zeros). No regression. No action.

## Next Codex Task
This is a fresh-audit round with no safe runtime change available (the only concrete finding is an inert, BCU-unverified parity formula that the guardrails forbid changing without source). Make **only** `.ai/state.md` bookkeeping + a changelog entry — no code, test, or asset changes:

1. **`.ai/state.md` → `## Audited Areas`** — add two partial entries:
   - `js/bcu` (partial) — read-through of `BcuIdentifier.js`, `BcuImgcutParser.js`, `BcuPathResolver.js`, `BcuText.js`, `BcuStageDifficultyRuntime.js`, `BcuAnimParser.js`, `BcuManifestLoader.js`; found consistent. Recorded the `resolveUnitAsset` hardcoded-base and `parseAnim` keyframe-skip read-through notes below.
   - `js/battle` (partial) — read-through of `BattleEconomy.js`, `BattleCoordinate.js`, `BattleFrameClock.js`, `BattleConfig.js`, `BattleAttackProfile.js`, plus `js/battle/bcu-runtime/BcuStageCrownRuntime.js` and the two `js/ui` stage-difficulty filter patches (`FormationStageDifficultyPatch.js`, `FormationStageDifficultyFilterControlPatch.js` — confirmed the `data-stage-filter-reset` button is handled by `FormationStageDifficultyPatch.onClick`, and that the always-true `isFiltering` is benign because every map includes ★1). Confirmed the previous-round `AppLoadingOverlay.js` `show()` progress-reset fix has no regression.

2. **`.ai/state.md` → `## Unaudited Major Areas`** — keep `js/battle` and `js/bcu` listed but annotate them partial:
   - `js/battle` (partial — economy/coordinate/frame-clock/config/attack-profile subset read round-2; most combat/patch files remain)
   - `js/bcu` (partial — identifier/parsers/path/text/difficulty/manifest subset read round-2; ~20 files remain: `BcuAssetLoader`, `BcuBootLoader`, `BcuModelParser`, `BcuAnimator`, `AnimationRuntime`, repositories, `SemanticAssetProvider`, etc.)
   - Leave `js/ui` (partial), `scripts`, `tests` unchanged.

3. **`.ai/state.md` → `## Unresolved`** — add:
   - `js/battle/BattleEconomy.js` `computeWalletIncomeInternal` applies the income combo as `mon *= Math.floor(incomePercent/100)+1` (whole-100%-step; sub-100% combos contribute nothing), which is inconsistent with the max-money combo path `getBcuWalletMaxMoney` that uses additive `(100 + maxMoneyComboPercent)/100`. Both come from the same `walletOptions` shape. The combo path is currently inert (no caller passes `incomeComboPercent`/`maxMoneyComboPercent`; both multipliers evaluate to ×1) and has no `check-bcu-wallet-runtime-parity` coverage. Confirm BCU `StageBasis` money-increment / combo application before changing either formula; do not encode a guessed semantic.

4. **`.ai/state.md` → `## Discovered Issues`** — add a one-line note that this round audited `js/bcu`/`js/battle` (partial), found no live defect, and recorded the inert wallet income-combo inconsistency as unresolved.

5. Append a concise entry to `.ai/changelog.md` (audit-only round; no runtime change). Do not modify `## Current Task` beyond pointing it at this bookkeeping round.

## Verification Commands
- `npm run check`
- `npm test`

## Stop Condition
Not satisfied. This is round 2 of at least 5. Although `Critical` and `High` are both `None`, `## Unaudited Major Areas` still lists actionable entries (`js/battle`, `js/bcu`, `js/ui` partial, `scripts`, `tests`), and there is a new open `Unresolved` parity question (wallet income-combo). Continue the loop.


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

✔ damage queue is excused in insertion order (no side/position/key resort) (1.646412ms)
✔ player-before-enemy insertion order (the BCU direction-pass order) is preserved (0.277719ms)
✔ known BCU battle actions map to lineup change sentinels (0.922701ms)
✔ inherited object names fall through to slot indexes when slot is finite (0.246189ms)
✔ inherited object names return null when no finite slot is present (0.168755ms)
✔ unknown actions fall through to slot index or null (0.174275ms)
✔ BcuCombatModel parses unit full IMU* guard fields (3.127515ms)
✔ BcuCombatModel parses enemy full IMU* guard fields with confirmed DataEnemy columns (1.128696ms)
✔ applyBcuProc rejects full immunity status procs without state side effects (2.940587ms)
✔ applyBcuProc applies partial resistance to status duration and toxic damage (1.651762ms)
✔ IMUWEAK smartImu follows BCU checkSmartImu direction (0.448667ms)
✔ applyBcuProc applies partial knockback resistance to proc KB distance (0.647989ms)
✔ ProcResolver suppresses curse and seal proc groups before runtime apply (1.786953ms)
✔ guardBcuDamage rejects wave, surge, blast, and toxic queue before damage is pending (0.735041ms)
✔ queueAttackDamage applies partial wave resistance before enqueueing damage (3.973814ms)
✔ queueAttackDamage guard rejection does not enqueue pending damage or procs (0.683404ms)
✔ normal queueAttackDamage still enqueues regular attack damage (0.914637ms)
✔ curse and seal suppress DamageAbilityResolver trait ability multipliers and restore when expired (1.411814ms)
✔ seal suppresses strongAttack and critical procs in damage resolver (0.43939ms)
✔ critical BattleScene wrapper chain remains callable after parity imports (0.387052ms)
✔ BattleAttackProfile maps per-hit abi flags onto attack events as bcuHitAbi (1.222611ms)
✔ ProcResolver gates attack procs per hit on bcuHitAbi != 1 (BCU abis[ind] == 1 setProc gate) (0.930927ms)
✔ ProcResolver keeps entity-level zombieKiller/soulstrike exempt from the hit abi gate (0.295902ms)
✔ DamageAbilityResolver gates strongAttack/critical procs per hit on bcuHitAbi != 1 (0.289961ms)
✔ zombie revive enters attack-wait immediately when an enemy is in touch range (BCU update2 checkTouch) (7.747775ms)
✔ CopRand nextFloat(seed=0) matches BCU/Java float vector exactly (1.160454ms)
✔ CopRand nextFloat results are exact Java floats (Math.fround stable) (0.200133ms)
✔ CopRand nextDouble consumes the seed identically to nextFloat (0.256138ms)
✔ CopRand is reproducible from the same 64-bit seed (1.714609ms)
✔ CopRand drawCount tracks the number of seeded draws (0.175237ms)
✔ JavaRandom matches java.util.Random nextInt/nextLong for seed=0 (0.195625ms)
✔ normalizeBattleSeed parses strings and clamps to signed 64-bit; randomBattleSeed is in range (0.269623ms)
✔ direction sort is stable: dire -1 (player) before +1 (enemy), insertion order kept on ties (1.500991ms)
✔ direction sort falls back to side when direction is absent (dog-player => -1) (0.205594ms)
✔ layer sort is stable: ascending currentLayer, insertion order kept within a layer (0.328163ms)
✔ same-direction, same-position entities are NOT reordered (no pos/instanceId tiebreak) (0.31079ms)
✔ will=0 enemy occupies exactly 1 slot (1.07164ms)
✔ will=2 enemy occupies 3 slots (will + 1) (0.166391ms)
✔ an enemy in final knockback is still counted (0.16097ms)
✔ a 'dead' enemy still playing its death animation (not removable) is counted (0.217075ms)
✔ a 'dead' enemy that is BCU-removable is NOT counted (0.19868ms)
✔ mixed roster sums will+1 per non-dead enemy and ignores removed/removable ones (0.253402ms)
✔ boss-as-base (EEnemy) adds will+1; an ECastle base does not (0.267048ms)
✔ constructor draws row first-frame BEFORE the global respawn (BCU StageBasis order) (2.246681ms)
✔ commit draws row respawn -> spawn layer -> global respawn; spawn frame and layer are exact (2.316803ms)
✔ a failed spawn (rejectSpawn) consumes no RNG (0.533365ms)
✔ computeBcuTouchState: Target Only with only an incompatible enemy in range -> touch true, touchEnemy false (2.344895ms)
✔ computeBcuTouchState: adding a trait-compatible enemy flips touchEnemy true (0.473634ms)
✔ computeBcuTouchState: Target Only with only the enemy base in range -> touchEnemy true (base counts) (0.414384ms)
✔ computeBcuTouchState: non-Target-Only unit attacks any in-range enemy (touchEnemy == touch) (0.298917ms)
✔ computeBcuTouchState: nothing in range -> touch false, touchEnemy false (0.426706ms)
ℹ tests 51
ℹ suites 0
ℹ pass 51
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1447.569005

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

✓ built in 881ms

Exit code: 0

