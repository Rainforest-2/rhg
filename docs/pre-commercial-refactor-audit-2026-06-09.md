# Pre-commercial refactor audit 2026-06-09

## Boot/import findings

- `index.html` loaded `InstallBattleDebugHud.js`, `FormationStageDifficultyFilterControlPatch.js`, then `main.js`.
- `InstallBattleDebugHud.js` imported production-affecting battle patches (`BattleUnifiedDamageDebugPatch.js`, `BattleCriticalEffectPatch.js`) before `main.js`.
- `BattleUnifiedDamageDebugPatch.js` imported `SemanticUnitIconNormalizePatch.js`, causing runtime alpha crop to be installed through a debug path.
- `main.js` contained one long sequence of dynamic patch imports. Wrapper order matters for `queueAttackDamage`, projectile runtimes, StageBasis bridge, and renderer layering.

## Classification

- Integrated into core owner:
  - `ProductionCardCatIconCanvasCropPatch.js`: `ProductionCardSkin.drawCatCard()` already owns the BCU square card canvas crop.
  - `SemanticUnitIconNormalizePatch.js`: runtime alpha crop conflicts with the current card render contract and is no longer needed.
- Required runtime patches kept:
  - UI formation/stage patches: installed from `js/boot/installUiPatches.js` before `PreviewApp` constructs UI objects.
  - BCU bundle/trace patches: installed from `js/boot/installBcuPatches.js` before battle runtime asset requests.
  - Battle parity patches: installed from `js/boot/installBattlePatches.js`; wrapper-sensitive groups are ordered and commented.
- BCU evidence-backed battle patches kept:
  - Projectile, proc, priority hit, immunity, barrier/shield, knockback, death/soul, burrow, delay, and renderer effect patches remain separate because they wrap runtime battle phases and must preserve existing wrapper chains.
- CSS/JS responsibility:
  - `UiMotion.mjs` remains because it is used by formation tuning and stage filter focus preservation.
  - Stage selector visual styling remains CSS; the filter patch only wires scoped input handlers and does not use broad `MutationObserver`.
- Removed duplicate/shim paths:
  - `regenerate-bcu-unit-icons-only-v2.mjs`: exact duplicate of the canonical unit-only regeneration entry.
  - `tmp-diagnose-enemy-512-generation.mjs`: unreferenced temporary diagnosis script.
- Left in place because not safely classifiable in this batch:
  - Tracked `tmp/` audit reports and screenshots: historical evidence/output, not runtime imports.
  - Existing verifier files: not runtime boot patches.

## Effect classification contract

- Wave, mini-wave, surge, mini-surge, and blast remain `stage-projectile`.
- Toxic, critical, strong attack, and metal killer are StageBasis `lea` / `EAnimCont` effects when their source marks that path.
- Proc invalid remains `entity-status-actor-drawEff`: actor-bound, layer baseline, scale `0.75`, no smoke y offset.
- Debug traces now expose `bcuEffectClass`, `layer`, `effectScale`, and `yFormula` from spawn and renderer paths.

## Icon generation contract

- Canonical cat/unit-only regeneration entry: `scripts/regenerate-bcu-unit-icons-only.mjs`.
- It runs `build-bcu-unit-icon-index.mjs` and `build-bcu-unit-icon-bundles-lite.mjs`.
- Enemy icon entries and `enemy.zip` are preserved by the unit-only index builder and are verified by hash when regeneration is run.
