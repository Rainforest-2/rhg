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
