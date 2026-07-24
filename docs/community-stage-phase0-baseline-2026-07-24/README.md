# みんなのステージ Phase 0 baseline

監査日: 2026-07-24
対象 revision: `c2df41ddc5b9bd33fc02e1eae7887da2e5c65e99` (`main` = `origin/main`)
範囲: 設計書 Phase 0 の再監査のみ。Phase 1 以降の schema、UI、online、auth、Cloudflare 実装は行っていない。

## 固定時点と外部状況

- 監査開始時の `git status --short --branch` は `## main...origin/main` のみで clean。`git fetch origin main --prune` 後も ahead/behind は `0 0`。
- open PR は 0。open Issue は #43, #58, #59, #61, #63, #84（connector が返した対象）。いずれもcommunity platform を実装中のPRではない。直近 merge は `a0f4d4b` (#85 boss shockwave) と、それ以前の #83/#82/#80/#79/#78/#76。
- `c2df41d` は `Add files via upload`。今回の設計に直接競合する community/Cloudflare/auth/D1/R2 の実装は現行ツリーにもopen PRにもない。

## owner と実データフロー

| 項目 | 現行 owner と入口 → 終端 |
|---|---|
| CustomStage schema / migration / normalize | `CustomStageSchema`: `migrateCustomStage` (207–235) → `createCustomStage` (282–321) → `normalizeCustomStage` (330–334)。現行 version は **2** (22)。|
| CustomStage validation | `CustomStageValidator.validateCustomStage` (34–161) が raw draft を先に検証し、schema normalize は iteration/frame 解決だけに使う。`CustomStageStore.saveValidatedCustomStageAtomic` が save 境界。|
| CustomStage persistence | `CustomStageStore`, key `wanko.customStages.v1` (86)。`readCustomStages` は validation → normalize (111–130)、`writeCustomStages` は v1 envelope を一括保存 (143–166)、atomic save は 196–232。|
| CustomStage JSON export/import | `FormationCustomStageBuilderPatch` の `data-custom-builder-export`/`import` UI (624–686) → builder import preview/commit → `saveValidatedCustomStageAtomic`。RHG 独自 envelopeでありBCU serializerではない。|
| CustomStage runtime adapter | `buildCustomStageDefinition` (CustomStageAdapter 148–290) が normalized stage → StageDefinition-shaped object (`runtime.customStageLimits`, `enemyRows`) を生成。`loadCustomStageDefinition` (293–297) が loader facade。|
| Formation persistence | `FormationStore`, key `wanko-battle.formation.v2` (18)。`sanitizeFormation` (333) → `FormationStore.save` (374–390); load は v2/v1 read → migration/sanitize (358–372)。|
| Formation runtime adapter | `PreviewApp.start` constructs `FormationEditor` (126–173); its Apply callback → `PreviewApp.applyFormationToBattle` (254) → `resetBattle` → `new BattleScene` (311)。Scene resolves production characters/units, then `BattleSceneBcuUnitLevelPatch` wraps both resolvers (238–256).|
| unit / plus level | `FormationStore.options.bcuCatUnitLevels` normalizes `level` + `plusLevel` (84–94, 408–418)。`BattleSceneBcuUnitLevelPatch.buildCatLevelRequest` (61–94) emits explicit level/plus then `resolveBcuUnitLevelConfig` (96–115) owns BCU level resolution.|
| HP / ATK multiplier | normal raw stats are built first. `withFormationCombatTuning` applies cat level, dog stage magnification, combo, treasure, orb, talent, then character modification in that exact order (226–235). Stage enemy HP/ATK row magnification is stored in adapter rows (51–52, 133–136) and resolved in the stage-enemy construction route.|
| unit cost | `ProductionRuntime.resolveBcuProductionValues` applies raw price → stage price floor → combo discount (40–72). `applyCharacterModificationToProduction` then makes explicit absolute cost/respawn/deploy-limit overrides (84–121); `applyCustomStageProductionModifiers` is the final custom-stage global multiplier (139–162).|
| character modification | `CharacterModificationResolver.applyCharacterModification` validates and sparse-overrides normal final stats (411–473), then `CharacterModificationDerivedModel.rebuildModifiedDerivedModels` rebuilds combat/attack/lifecycle models (165–276). `BattleActorFactory` consumes the resolved template; `ProductionRuntime` consumes production output. Raw source is not mutated.|
| player capacity | base request gate is `ProductionRuntime.validateRequest` (272–320); it is wrapped in boot order by `BcuPlayerCapacityProductionPatch`, `BcuMaxUnitSpawnLifetimePatch`, then `BcuRarityCapacityProductionPatch` (`battleDirectPatches.js` 2–5). |
| battle start / clear result | `PreviewApp.applyFormationToBattle` → `resetBattle` → `BattleScene.init`; fixed clock drives `BattleScene.tick` (278–280). Result presentation is installed only post-load by `PreviewAppBattleResultOverlayPatch` (`runtimePatches.js` 9–14).|
| replay/import | There is no BCU replay importer in this scope. Stage-vs-stage local config uses `CustomStageBattleStore`: `wanko.customStageBattle.v1`, v1→v2 typed-ref migration (67–125), then `PreviewAppCustomStageBattleConfigPatch`.|
| service worker / PWA / offline | no `navigator.serviceWorker` registration, service-worker source, or runtime cache owner was found in tracked `js/`/root code. The current PWA manifest/install gate does not establish an offline fallback contract. |
| feature flag | no generic feature-flag owner exists. The only nearby local debug switch is `debugUi` in `PreviewApp.start` (132); it is not a community rollout flag.|
| application boot | `index.html` ESM entry → `main.js` `boot` (182–247). Exact dynamic order: UI patches → BCU helper → battle groups → touch guard → `BcuBootLoader.loadGame` → combo/talent registry → runtime patches → `PreviewApp` → `app.start`.|

## boot graph / patch invariant

`main.js:182–247` is the top-level graph. Static imports in group files are the install order, explicitly documented as such in `uiPatches.js:1–3` and every battle group header.

```text
index.html → js/main.js
  → installUiPatches → CustomStageBoot → Formation/UI wrappers → PremiumMotion (last)
  → installBcuPatches → BcuExtraActorAnimationBundlePatch
  → installBattlePatches
      core → projectile → scene → direct → actor-lifecycle → renderer
  → BcuBootLoader.loadGame → semantic provider/repositories/asset DB
  → combo + talent registries
  → post-load runtime: sound → custom-battle config → result → pause → transition → music
  → new PreviewApp(db) → PreviewApp.start → FormationEditor
  → Apply → BattleScene.init → StageDefinition/StageRuntime/actor templates/bases → 30fps tick
```

No wrapper chain or import order was changed. Required battle groups fail closed (`installBattlePatches.js:20–110`); post-load runtime modules are individually warning-isolated (`runtimePatches.js:17–28`).

## Current UI / browser baseline

Current boot lands directly in the existing FormationEditor; there is no community home shell. The captured editor images therefore establish the true pre-Phase-1 navigation baseline, not a proposed home.

- `screenshots/existing-start-screen-desktop.png`: actual existing boot destination (FormationEditor), desktop.
- `screenshots/existing-start-screen-ipad-1024x768.png`: actual existing boot destination at the iPad-equivalent viewport.
- `screenshots/existing-start-screen-offline-event.png`: same existing screen after an offline event; it establishes that current code has no visible network/offline fallback transition.
- `screenshots/formation-desktop.png`: formation character-modification editor, desktop.
- `screenshots/custom-stage-editor-desktop.png`: existing local CustomStage editor.
- `screenshots/iphone-390x844.png`, `screenshots/landscape-667x320.png`: existing responsive editor captures.

The dedicated boot capture completed with no browser errors at 1024×768. The existing broader character-modification UI suite still times out while opening the local CustomStage create action; its partial screenshots and complete log are preserved rather than relabelled as visual acceptance.

## Fixtures

`fixtures/` is generated by `npm run capture:community-phase0`. It uses fixed, non-personal values only.

- current normalized CustomStage; custom-stage export; import-result storage envelope
- normalized Formation v5 with `level: 30`, `plusLevel: 20`
- sparse CharacterModification, and representative localStorage keys/values
- CustomStage adapter output before `BattleScene.init` (the final serializable boundary before semantic assets/actors are created)

No cookie, token, browser profile, or user content is captured.

## Commands and results

| Command | Result |
|---|---|
| `git fetch origin main --prune` | success; main/origin match |
| `npm run verify` | **failed** because its `npm test` invokes the browser design test timeout below |
| `npm test` | **failed**: 89 pass, 0 fail, 1 cancelled; `tests/character-modification-design-browser.test.mjs` timed out after 240000ms |
| `npm run build` | success (Vite build); warnings preserved in log |
| lint | no `lint` script exists in `package.json`; no substitute was claimed |
| `npm run capture:community-phase0:screens` | success; desktop, iPad-equivalent, and offline-event captures; no browser errors |
| `npm run check:character-modification:ui` | failed in the existing local-CustomStage create action (`data-custom-builder-new` click timeout); no pass claimed |
| `npm run capture:community-phase0` | success |

Full output is in `logs/`. `npm run verify` / test did not pass in this baseline, so Phase 0 does **not** claim a green CI baseline.

## Design-document reconciliation

| Finding | Classification | Evidence / consequence |
|---|---|---|
| Design assumes schema v3, provenance envelope, and challenge restrictions; main is CustomStage v2. | expected future Phase 1; no discrepancy requiring a Phase-0 patch | schema is explicitly v2 at `CustomStageSchema.js:22`; do not add fields before Phase 1. |
| Design calls for a new home and community flags; main boots to FormationEditor and has no flag owner. | current code has no owner; later Phase must introduce one deliberately | no inferred manager/store was created. |
| Design requires Cloudflare/D1/R2/auth/offline fallback; none is present. | Phase 3+ future work | no Functions, D1, R2, auth, or SW code added. |
| Existing browser CustomStage UI check times out on the create action, preventing a complete local-CustomStage iPad visual baseline. | **must resolve before Phase 1 visual acceptance** | retain logs/captures; do not weaken the test or call partial capture accepted. |
| Existing tests mutate the generated crown index during `precheck`. | known current build side effect; unrelated to community functionality | generated-file worktree delta must be restored or deliberately committed by its owner before a clean Phase-0 documentation commit. |

## Phase 1 entry gate

1. Resolve or obtain an explicit waiver for the local-CustomStage browser click timeout, then collect the remaining actual iPad (1024×768 and 768×1024) local-custom-stage, JSON import/export, and save/reload screenshots.
2. Restore the generated crown-index worktree side effect from this audit before committing only the baseline material.
3. Use the listed owners and the fixture boundaries; do not change CustomStage v2 or create community runtime/store owners until the Phase-1 schema decision is executed.
