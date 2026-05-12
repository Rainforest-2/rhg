# BCU migration status

## Last updated
- note: BCU ZIP regression pass updated PNG integrity validation, enemy icon source policy, aggregate icon bundle invariants, Formation slot icon loading, catalog memoization/windowing, actor bundle completeness diagnostics, and Safari-friendly failure logs.
- date: 2026-05-12 (UTC)
- commit: (working tree)
- task: AGENTS.md BCU semantic bundle migration contract

## BCU Zip-First Runtime Migration (2026-05-11)
### Strict semantic bundle pass
- Runtime default: `semantic-strict`.
- Language target: `jp` only.
- Non-Japanese language prune result: 0 deleted, 109 excluded from shipped runtime manifests/indexes, 16 Japanese files kept, 25 `languageUnknown` entries reported for explicit follow-up.
- Bundle generation result: full generation, `generationMode: "all"`, 4,243 bundles.
- Bundle count by kind: actor 2,855; stage-map 695; background 361; enemyCastle 330; core 1; language 1.
- Actor index: 2,855 total; 2,833 full; 22 partial; 0 rawOnly.
- Stage index: 8,519 total; duplicate/alias conflict entries 1,944.
- Background index: 361 total; 351 complete; 10 partial; 0 rawOnly.
- Castle index: 330 enemy castles complete; 0 partial; 4 nyanko castle entries.
- Core DB bundle status: `public/assets/bundles/core/core-db.zip` is generated and is the default boot database. It contains `bundle.json`, `manifest-lite.json`, `units.json`, `enemies.json`, `names-jp.json`, `backgrounds.json`, `castles.json`, `stages.json`, `stage-aliases.json`, `asset-keys.json`, and `diagnostics-summary.json`.
- Language bundle status: `public/assets/bundles/lang/jp.zip` is generated for compatibility, but normal boot reads Japanese names from `core-db.zip:names-jp.json`.
- Raw runtime blocking status: runtime guard is installed in `semantic-strict`; boot, formation icons, actor assets, stages, backgrounds, and enemy castles use generated ZIP bundles.
- Known remaining rawOnly assets: none reported in generated semantic indexes.
- Browser Network verification result: passed on `http://127.0.0.1:4173/index.html` with Playwright Chromium. Observed bundle/core requests, no `public/assets/bcu/**`, no `public/assets/bcu-manifest.json`, `semanticMode = semantic-strict`, `blockedRawReads = 0`, and formation icon raw DOM sources `[]`.

## Aggregated Icon Bundle Pass (2026-05-12)
### Icon source audit summary
- Audit files generated: `public/assets/generated/bcu-icon-source-audit.json` and `public/assets/generated/bcu-icon-source-audit.md`.
- Audit records: 2,855 actor keys.
- Enemy icon policy: use valid discovered `public/assets/bcu/<pack>/org/enemy/<id3>/enemy_icon_<id3>.png`, including enemy 526+; no `edi_*.png`, actor `image.png`, or sprite-sheet fallback is used for enemy UI icons.
- PNG validation result: strict signature/IHDR/dimensions/color-type/chunk-boundary/CRC/IEND checks run during audit and bundle generation.
- Audit summary: `ok=1962`, `needs-remap=316`, `missing=7`, `invalid-png=570`, `ambiguous=0`.
- Invalid or missing mappings are omitted from `bcu-icon-index.json`; UI shows `image-missing` placeholders instead of guessing from actor `image.png`.

### Generated icon runtime index and bundles
- Icon index generated: `public/assets/generated/bcu-icon-index.json`, 2,278 entries. Every entry points to a PNG that exists inside its aggregate ZIP.
- Aggregate icon bundles in `public/assets/generated/bcu-bundle-manifest.json`:
  - `public/assets/bundles/icon/enemy.zip`: 246 valid PNGs.
  - `public/assets/bundles/icon/unit-f.zip`: 822 valid PNGs.
  - `public/assets/bundles/icon/unit-c.zip`: 799 valid PNGs.
  - `public/assets/bundles/icon/unit-s.zip`: 393 valid PNGs.
  - `public/assets/bundles/icon/unit-u.zip`: 18 valid PNGs.
- Rejected one-ZIP-per-icon paths are not generated.
- ZIP format remains STORE/no-compression.
- Index path -> ZIP entry verification result: pass via `node scripts/check-icon-index-paths-exist-in-zips.mjs`.
- Aggregate ZIP PNG integrity result: pass via `node scripts/check-icon-png-integrity.mjs`.

### Runtime status
- Formation catalog/slot icons now call `SemanticAssetProvider.getActorUiIconUrl()`.
- Selected 10 Formation slots resolve immediately through `.formation-slots img[data-semantic-icon]`; they no longer depend on the `.formation-catalog-scroll` IntersectionObserver root.
- Catalog icons are the only icons observed under `.formation-catalog-grid img[data-semantic-icon]`, with de-duped work and concurrency limit 6.
- Failed icon loads reset pending/resolved state and delete rejected work cache entries so rerender can retry.
- Formation catalog is windowed: it renders visible rows plus overscan instead of all catalog cards, records `formation-render` performance measures, and logs catalog/rendered-card/icon queue diagnostics.
- CharacterCatalog is memoized by BCU DB identity, locale, and revision; `byId`, `byFaction`, `byBaseId`, and `available` indexes are built once per catalog revision.
- Production card icons now call `SemanticAssetProvider.getActorUiIconUrl()`.
- `getActorUiIconUrl()` reads `bcu-icon-index.json` and aggregate icon ZIPs only; it does not call actor bundle icon fallback or actor `image.png`.
- `SemanticAssetProvider.archive()` uses `bundleArchivePromises` for in-flight ZIP parse caching.
- `SemanticAssetProvider.readCoreDb()` uses `coreDbPromise` and retries after failure.
- Node provider probe: `mode=semantic-strict`, `blockedRawReads=0`, `rawFallbacks=0`, `bundleErrors=0`; icon read opened aggregate icon ZIP only.
- Formation initial actor bundle request count: not browser-verified in this session; static checks and provider probe confirm UI icon code does not call actor icon APIs before Apply.
- Formation initial icon bundle request names observed in provider probe: `unit-f.zip` for sampled available unit icons. Full browser Network verification was not run.
- Production card icon source: aggregate icon ZIP via `getActorUiIconUrl()`.
- Browser Network/visual verification result: not run in this session per user instruction allowing browser verification to be skipped when unavailable.

### Battle and actor bundle status
- Actor runtime completeness check added: `node scripts/check-actor-bundles-complete.mjs`.
- Actor completeness result: pass for 2,699 `full` actor bundles; 156 partial/invalid actor records are not treated as spawn-ready by the check.
- Actor image source repair: `build-bcu-actor-index.mjs` remaps selected actor runtime sources away from invalid PNG images when a valid full/partial candidate exists.
- BattleActorFactory now requires move/idle before render-core, attack before spawn-ready, and kb before full-visual; missing required animations throw explicit `actor-animation` diagnostics instead of marking templates ready.
- `BcuAssetLoader` actor and animation bundle failures now include `kind`, `semanticKey`, `bundlePath`, `internalPath`, `missingEntries`, original error fields, and message.

### Effect and diagnostics status
- KBEff semantic bundle generated: `public/assets/bundles/effect/kbeff.zip` with `bundle.json`, `image.png`, `imgcut.imgcut`, `model.mamodel`, `kb_hb.maanim`, `kb_sw.maanim`, and `kb_ass.maanim`.
- KBEff runtime remains gated in `semantic-strict` by `BattleScene.ensureKbeffLoading()`; if enabled with a semantic provider, `BcuKbeffLoader` reads the effect ZIP instead of raw `public/assets/bcu/000001/org/battle/a/**`.
- Safari error logging status: `PreviewApp.applyFormationToBattle` and `FormationEditor` apply/icon failures log `{ name, message, stack, cause, error }`; UI hints use `err?.message || String(err)`.
- Bundle diagnostics now include concrete `kind`, `semanticKey`, `bundlePath`, `internalPath`, `missingEntries`, original error fields, and message for icon/effect/background/castle/actor paths.
- Blocked raw read count in Node provider probe: 0.
- Raw fallback count in Node provider probe: 0.

### Generated index list
- `public/assets/generated/bcu-asset-audit.json`
- `public/assets/generated/bcu-asset-audit.md`
- `public/assets/generated/bcu-canonical-index.json`
- `public/assets/generated/bcu-actor-index.json`
- `public/assets/generated/bcu-stage-index.json`
- `public/assets/generated/bcu-background-index.json`
- `public/assets/generated/bcu-castle-index.json`
- `public/assets/generated/bcu-core-index.json`
- `public/assets/generated/bcu-language-index.json`
- `public/assets/generated/bcu-icon-source-audit.json`
- `public/assets/generated/bcu-icon-source-audit.md`
- `public/assets/generated/bcu-icon-index.json`
- `public/assets/generated/bcu-bundle-manifest.json`
- `public/assets/generated/bcu-diagnostics.json`
- `public/assets/generated/bcu-lang-prune-report.json`
- `public/assets/generated/bcu-lang-prune-report.md`

### Generated bundle families
- `public/assets/bundles/actor/enemy/*.zip`
- `public/assets/bundles/actor/unit/*.zip`
- `public/assets/bundles/stage/map/*.zip`
- `public/assets/bundles/background/*.zip`
- `public/assets/bundles/castle/enemy/*.zip`
- `public/assets/bundles/core/*.zip`
- `public/assets/bundles/icon/enemy.zip`
- `public/assets/bundles/icon/unit-f.zip`
- `public/assets/bundles/icon/unit-c.zip`
- `public/assets/bundles/icon/unit-s.zip`
- `public/assets/bundles/icon/unit-u.zip`
- `public/assets/bundles/effect/kbeff.zip`
- `public/assets/bundles/lang/jp.zip`
- ZIP format: STORE/no-compression only. Browser runtime uses `js/bcu/SemanticAssetProvider.js` minimal STORE ZIP reader.
- Repository mode: full semantic bundle generation. Full local generation command: `node scripts/build-bcu-semantic-bundles.mjs --all`.

### Current generated counts
- Audit file count: 51,539; files included in no classification: 0.
- Actor entries: 2,855 total; 2,833 full; 22 partial; 0 iconOnly.
- Known partial actor entries include: `unit:515:c`, `unit:729:f`, `unit:732:f`, `unit:734:f`, `unit:739:f`, `unit:755:f`, `unit:761:f`, `unit:764:f`, `unit:770:f`, `unit:775:f`.
- Stage entries: 8,519 total; duplicate basename / alias conflict entries: 1,944.
- Background entries: 361 total; entries missing image or imgcut: 10; candidate images: 574; candidate imgcuts: 370.
- Castle entries: 330 enemy castles; 4 nyanko castle parts; locale/default fallback warnings: 1.
- Bundle manifest: 4,249 bundles, `generationMode: "all"`; kind counts are actor 2,855, stage-map 695, background 361, enemyCastle 330, language 1, effect 1, core 1, icon 5.

### Runtime migration status
- `BcuBootLoader` initializes `SemanticAssetProvider`, reads `core/core-db.zip`, and constructs runtime repositories through `fromCoreDb`.
- Default runtime mode is `semantic-strict`.
- `BcuAssetDatabase.getSummary()` exposes semantic mode, bundle count, and raw fallback/rawOnly count.
- `BcuAssetLoader` uses semantic actor bundles when `semanticKey` is present and blocks raw access for bundled keys.
- `StageRegistry` exposes generated stage entries first and avoids silently choosing conflicting aliases.
- `StageDefinitionLoader` reads semantic stage CSVs through `SemanticAssetProvider.readStageCsv(stageKey)` before legacy fallback.
- `StageBackgroundLoader` and `BcuCastleAssetLoader` use semantic bundles for bundled backgrounds/castles; raw fallback is blocked in normal `semantic-strict`.
- Formation and production icons resolve through `SemanticAssetProvider.getActorUiIconUrl()` and aggregate icon ZIPs, producing `blob:` URLs or placeholders, not raw BCU image paths and not actor bundle image fallbacks.
- Raw source assets under `public/assets/bcu/` were not deleted, moved, or rewritten.

### Validation command results
- `node scripts/prune-bcu-language-assets.mjs` pass: `excluded=109 unknown=25`
- `node scripts/build-bcu-manifest.mjs` pass: `files=51539 packs=248 locales=1`
- `node scripts/audit-bcu-assets.mjs` pass: `files=51539`
- `node scripts/build-bcu-canonical-index.mjs` pass: `bundles=4244`
- `node scripts/build-bcu-actor-index.mjs` pass: `entries=2855`
- `node scripts/build-bcu-stage-index.mjs` pass: `entries=8519`
- `node scripts/build-bcu-background-index.mjs` pass: `entries=361`
- `node scripts/build-bcu-castle-index.mjs` pass: `enemy=330 nyanko=4`
- `node scripts/build-bcu-core-index.mjs` pass: `entries=1 core-db=public/assets/bundles/core/core-db.zip`
- `node scripts/build-bcu-language-index.mjs` pass: `entries=1 files=16`
- `node scripts/build-bcu-core-db-bundle.mjs` pass: `entries=11`
- `node scripts/build-bcu-semantic-bundles.mjs --all` pass: final manifest contains 4,249 bundles including 5 icon bundles.
- `node scripts/audit-bcu-icon-sources.mjs` pass: `records=2855 summary={"invalid-png":570,"needs-remap":316,"missing":7,"ok":1962}`
- `node scripts/build-bcu-icon-index.mjs` pass: `entries=2278 forms=c,f,s,u`
- `node scripts/build-bcu-icon-bundles.mjs` pass: `enemy=246 unit-c=799 unit-f=822 unit-s=393 unit-u=18`
- `node scripts/check-icon-png-integrity.mjs` pass.
- `node scripts/check-icon-index-paths-exist-in-zips.mjs` pass.
- `node scripts/check-icon-bundles-are-aggregated.mjs` pass.
- `node scripts/check-icon-bundles-never-load-actor-bundles.mjs` pass.
- `node scripts/check-formation-icons-use-icon-bundles.mjs` pass.
- `node scripts/check-production-icons-use-icon-bundles.mjs` pass.
- `node scripts/check-actor-bundles-complete.mjs` pass: `checked=2699 skippedPartial=156`
- `node scripts/check-bcu-semantic-bundles.mjs` pass: `count=4249 mode=all`
- `node scripts/check-runtime-uses-zip-bundles.mjs` pass.
- `node scripts/check-bundled-assets-never-load-raw.mjs` pass.
- `node scripts/check-no-raw-runtime-paths.mjs` pass.
- `node scripts/check-no-non-jp-lang-assets.mjs` pass.
- `node scripts/check-core-db-runtime.mjs` pass.
- `node scripts/check-formation-icons-use-bundles.mjs` pass.
- `node scripts/check-stage-runtime-uses-bundles.mjs` pass.
- `node scripts/check-background-castle-use-bundles.mjs` pass.
- `node scripts/check-battle-scene-stage-runtime-wiring.mjs` pass.
- `node scripts/check-stage-asset-tracing.mjs` pass.
- `node scripts/check-bcu-stage-spawn-runtime.mjs` pass.
- `node scripts/check-battle-attack-timeline.mjs` pass.
- Browser verification command: `PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers /tmp/pw/node_modules/.bin/playwright test /tmp/pw/browser-raw-check.spec.mjs --reporter=line` pass.

### Unresolved risks
- 25 `languageUnknown` text files are retained only in the prune report for explicit classification.
- Some non-actor runtime/effect/UI paths still rely on legacy raw assets outside the bundled semantic families and are treated as explicit migration compatibility by the raw-path checker.
- Browser visual/Network verification was not automated in this terminal session because Playwright is not installed.

### Manual browser verification checklist
- [ ] Boot default app in `semantic-strict` mode and confirm no startup failure with full bundles.
- [ ] Load a bundled actor (`enemy:0` or `unit:0:f`) and confirm semantic bundle diagnostics show bundle source.
- [ ] Confirm non-bundled access, if any, is explicit `rawOnly` and visible in diagnostics.
- [ ] Select `stageRNA001_00` and confirm stage CSV source is semantic when sample bundle exists.
- [ ] Confirm duplicate stage aliases require disambiguation and do not silently pick a basename conflict.
- [ ] Confirm background and enemy castle render with semantic bundle source where sample bundle exists.

## Completed
| Task | Area | Files | What changed | Evidence |
|---|---|---|---|---|
| Priority 0 | Boot safety | `index.html`, `js/main.js`, `js/AppVersion.js`, `scripts/check-battle-scene-stage-runtime-wiring.mjs` | Added visible boot-error overlay, converted startup to dynamic imports inside `boot()`, reports failures through `__WAN_BOOT_ERROR__`, and added assertions for boot overlay/dynamic import/critical exports. | `node scripts/check-battle-scene-stage-runtime-wiring.mjs`, `node scripts/check-bcu-stage-spawn-runtime.mjs`, and `node scripts/check-stage-asset-tracing.mjs` pass. |
| Priority 1 | Stage CSV / StageRuntime / SpawnRuntime hardening | `js/battle/StageDefinitionLoader.js`, `js/battle/StageRuntime.js`, `js/battle/BcuStageSpawnRuntime.js`, `js/battle/BattleSpawnResolver.js`, `js/battle/DebugBattleInspector.js`, `scripts/check-bcu-stage-spawn-runtime.mjs`, `scripts/check-stage-runtime.mjs`, related check scripts | Added SCDef `S1` alias while preserving `SCORE`, parser raw/debug fields, BCU two-column `castleId,noContinue` support plus existing extended cannon row support, header-sourced `bossGuard`, `maxEnemyCountRaw` with cap to 50, runtime preservation of raw cap/debug fields, explicit partial C1 health-window hook diagnostics, and StageRuntime-first spawn debug metadata for explicit spawn paths. | All `scripts/check-*.mjs` pass. |
| Renderer parity pass | BCU BattleBox / Background.draw alignment | `js/battle/BattleSceneRenderer.js`, `js/battle/BattleConfig.js`, `scripts/check-battle-renderer-projection.mjs`, `scripts/check-renderer-coordinate-paths.mjs` | Added BCU render constants from `BattleBox.BBPainter`, BCU layer/sprite scale helpers, and BCU `Background.draw`-style background tile layout (`pos + 200*siz - bgWidth`, bottom anchored to stage ground). Background render now records `lastRenderDebug`. | renderer checks and global checks pass. |
| Renderer entity baseline pass | BCU BattleBox drawCastle/drawEntity alignment | `js/battle/BattleSceneRenderer.js`, `js/battle/BattleSceneStageRuntimeWiring.js`, `js/battle/BattleConfig.js`, renderer/wiring checks | Spawned stage enemies now keep SCDef layer metadata (`stageSpawnLayerMin`, `stageSpawnLayerMax`, `currentLayer`), and renderer uses BCU `midh - (road_h - layer*DEP) * siz` as the render-only Y baseline for bases and actors. Existing actor scale remains unchanged unless `applySpriteScale` is explicitly enabled. | renderer checks and global checks pass. |
| Renderer BCU projection reform | BCU BattleBox getX alignment | `js/battle/BattleSceneRenderer.js`, `js/battle/BattleConfig.js`, renderer/wiring checks | Battlefield actor/base/effect/HP debug draw paths now use a shared `projectBattleX()` helper that defaults to BCU `getX` projection (`x * ratio + off`) instead of drawing actors with normal projection while castles used BCU projection. Actor render scale now ignores ad-hoc catalog/global scale when `ignoreActorConfigScale` is enabled and uses BCU `sprite=0.8` scale. | renderer checks and global checks pass. |
| Renderer/Background BCU repair | BCU `Background.read/draw`, `StageBasis`, `EEnemy`, smoke effect alignment | `js/battle/StageBackgroundLoader.js`, `js/battle/StageBackgroundResolver.js`, `js/battle/BattleSceneRenderer.js`, `js/battle/BattleScene.js`, `js/battle/BattleSceneStageRuntimeWiring.js`, `js/battle/EffectRuntime.js`, `js/battle/BattleEffect.js`, `js/battle/BattleConfig.js`, `scripts/check-stage-asset-tracing.mjs` | Background loading now keys `bg.csv` by resolved bg ID, honors CSV column 13 as the imgcut file, column 15 as referenced image when present, uses BG part 0 and TOP part 20, and records CSV/source diagnostics. Background draw now follows BCU's ground-gradient-first contract instead of leaving a solid fallback strip. Player castle composite uses BCU left-edge `drawNyCast` anchoring, stage enemy layers randomize from L0-L1, ad-hoc visual depth/crowd offsets are disabled, and hit smoke uses BCU-style `pos + 25 + rand` and `layer + 3..8` metadata. | `node scripts/check-stage-asset-tracing.mjs`; all `scripts/check-*.mjs` pass. Browser visual check still required. |
| Camera/effect/one-row layout repair | BCU `BattleBox.calculateSiz/regulate`, smoke draw, target preference | `js/battle/BattleCamera.js`, `js/preview/BattleCameraInputController.js`, `js/battle/BattleSceneRenderer.js`, `js/battle/BattleScene.js`, `js/battle/EffectRuntime.js`, `js/battle/BattleEffect.js`, `js/ui/PlayerProductionBar.js`, camera/wiring checks | Camera zoom limits now come from BCU `minH/maxH/maxW`, clamp range includes BCU `off*2` margins so the player castle side can scroll fully into view, default battle layout uses one-lineup (`twoRow:false`) `midh`, hit smoke applies BCU `+75/+100` Y offsets, target selection keeps attacking the base instead of chasing an out-of-range respawn enemy through the castle, and production card icon cache keys include image paths to avoid cross-ID photo reuse. | `node scripts/check-battle-camera-contract.mjs`; `node scripts/check-battle-scene-stage-runtime-wiring.mjs`; all `scripts/check-*.mjs` pass. Browser visual check still required. |
| Check suite refresh | Runtime roadmap alignment | `scripts/check-ability-model.mjs`, `scripts/check-battle-attack-interval-debug.mjs`, `scripts/check-battle-attack-wait-runtime.mjs`, `scripts/check-battle-renderer-projection.mjs`, `scripts/check-battle-spawn-resolver.mjs`, `scripts/check-battle-tick-order.mjs`, `scripts/check-bcu-attack-interval-timing.mjs`, `scripts/check-bcu-renderer-patch.mjs`, `scripts/check-damage-ability-resolver.mjs`, `scripts/check-damage-calculator.mjs`, `scripts/check-debug-combat-coordinate-overlay.mjs` | Updated stale checks that still expected older roadmap states where Proc/KBRuntime/EffectRuntime or integrated renderer paths did not exist. Checks now assert the current contracts instead of requiring removed/obsolete constraints. | `for f in scripts/check-*.mjs; do node "$f"; done` pass. |
| Task 3-FINAL | Castle/Background resolver | `js/battle/CastleAssetResolver.js`, `js/battle/BcuCastleAssetLoader.js`, `js/battle/StageBackgroundResolver.js`, `js/battle/StageBackgroundLoader.js`, `js/battle/DebugBattleInspector.js`, `scripts/check-stage-asset-tracing.mjs` | Castle/background requested/resolved/fallback/candidateReport tracing contract finalized and asserted. | `node scripts/check-stage-asset-tracing.mjs` pass. |
| Task 4-FINAL | Camera transform | `js/battle/BattleCamera.js`, `js/preview/BattleCameraInputController.js`, `js/battle/BattleSceneRenderer.js`, `js/battle/DebugBattleInspector.js` | world/screen transform and no-mutate contract finalized with diagnostics. | `node scripts/check-battle-scene-stage-runtime-wiring.mjs` pass. |
| Task 5-FINAL | Tick order/clock | `js/battle/BattleFrameClock.js`, `js/battle/BattleScene.js`, `js/battle/DebugBattleInspector.js`, `scripts/check-battle-scene-stage-runtime-wiring.mjs` | fixed-step clock and tick phase trace contract finalized. | wiring check pass. |
| Task 7-FINAL | AttackTimeline contract finalized | `js/battle/BattleAttackTimeline.js`, `js/battle/BattleAttackProfile.js`, `js/battle/BattleAttackResolver.js`, `js/battle/BattleScene.js`, `js/battle/DebugBattleInspector.js`, `scripts/check-battle-scene-stage-runtime-wiring.mjs` | BattleAttackTimeline contract finalized; BattleAttackProfile hit event shape finalized; BattleAttackResolver target capture responsibility fixed; BattleScene attack flow traceable through due-hit/capture/damage/mark-resolved; DebugBattleInspector attack timeline diagnostics; Node checks for attack timeline contract. | wiring check pass. |
| Task 8-FINAL | AbilityModel implementation status catalog | `js/battle/AbilityModel.js` | Added ABILITY_STATUS / ABILITY_CATALOG and implementation status reporting as raw carrier + semantic status model. | wiring check static+dynamic assertions pass. |
| Task 8-FINAL | DamageAbilityResolver debug opt-in boundary | `js/battle/DamageAbilityResolver.js` | Explicit debug opt-in only boundary with implementationStatus and non-damage-proc not handled contract. | wiring check dynamic assertions pass. |
| Task 8-FINAL | ProcResolver no-op contract added | `js/battle/ProcResolver.js` | Added ProcResolver entry point with candidate collection and skipped/not-implemented classification. | wiring check static+dynamic assertions pass. |
| Task 8-FINAL | DamageCalculator proc result integration | `js/battle/DamageCalculator.js` | Damage remains pure calculation; proc result attached as separate field. | wiring check dynamic assertions pass. |
| Task 8-FINAL | DebugBattleInspector damage/proc diagnostics | `js/battle/DebugBattleInspector.js`, `js/battle/BattleScene.js` | Added damage/proc resolver diagnostics, recent proc events, ability status examples, and procResolved debug event hook. | wiring check static assertions pass. |
| Task 8-FINAL | Node checks for damage/ability/proc contract | `scripts/check-battle-scene-stage-runtime-wiring.mjs` | Added static and dynamic assertions for AbilityModel/DamageAbilityResolver/ProcResolver/DamageCalculator/Inspector contracts. | command pass. |


| Task 9-FINAL | KB runtime facade | `js/battle/KBRuntime.js`, `js/battle/BattleActor.js`, `js/battle/BattleScene.js` | KBRuntime facade/contract added; BattleActor KB debug shape aligned; BattleScene post-damage path traced via KBRuntime. | wiring check pass. |
| Task 9-FINAL | Effect runtime contract | `js/battle/EffectRuntime.js`, `js/battle/BattleEffect.js`, `js/battle/BattleScene.js` | EffectRuntime added for world-coordinate effect create/tick/cleanup; BattleEffect source/debug/world coordinates added; BattleScene effect runtime wiring added. | wiring check pass. |
| Task 9-FINAL | Inspector and checks | `js/battle/DebugBattleInspector.js`, `scripts/check-battle-scene-stage-runtime-wiring.mjs` | kbRuntime/effectRuntime diagnostics and Node contract assertions added. | wiring check pass. |

| Task 10-FINAL | AnimationRuntime facade | `js/bcu/AnimationRuntime.js` | Added animation facade for tick/apply/draw-list/describe contract with non-responsibility declaration. | wiring check pass. |
| Task 10-FINAL | BcuAnimator debug contract | `js/bcu/BcuAnimator.js` | Added getState/lastValuesDebug/lastApplyDebug while preserving apply() array return compatibility. | wiring check static+dynamic assertions pass. |
| Task 10-FINAL | BcuModelInstance debug contract | `js/bcu/BcuModelInstance.js` | Added getState/lastAppliedTrackDebug/lastDrawListDebug with draw list summary and no return-shape break. | wiring check static+dynamic assertions pass. |
| Task 10-FINAL | BattleActor + Inspector animation diagnostics | `js/battle/BattleActor.js`, `js/battle/DebugBattleInspector.js` | Actor animation apply/tick routed via AnimationRuntime facade and inspector exposes animationRuntime diagnostics. | wiring check pass. |
| Task 10-FINAL | Renderer no-mutate contract checked | `js/battle/BattleSceneRenderer.js`, `scripts/check-battle-scene-stage-runtime-wiring.mjs` | Renderer audited to avoid animator.tick/model.reset and keep animation-state mutation outside renderer. | wiring check static assertion pass. |
| Task 10-FINAL | Node checks for animation contract | `scripts/check-battle-scene-stage-runtime-wiring.mjs` | Added static + dynamic assertions for AnimationRuntime/BcuAnimator/BcuModelInstance/Inspector contracts. | command pass. |


| Task 11-FINAL | ProductionRuntime façade | `js/battle/ProductionRuntime.js` | Added production façade contract for economy status, unit status, request validation, produce, roster/lineup/formation diagnostics. | wiring check pass. |
| Task 11-FINAL | Economy/Scene/UI production contract | `js/battle/BattleEconomy.js`, `js/battle/BattleScene.js`, `js/ui/PlayerProductionBar.js` | Added economy debug/state contract and routed scene/UI production status/request flow via ProductionRuntime while keeping spawn in BattleScene. | wiring check pass. |
| Task 11-FINAL | Formation/Inspector/checks | `js/battle/FormationStore.js`, `js/battle/DebugBattleInspector.js`, `scripts/check-battle-scene-stage-runtime-wiring.mjs` | Added 2x5 formation summary helper, productionRuntime diagnostics panel data, and static/dynamic contract assertions. | wiring check pass. |

| Task 12-FINAL | CharacterCatalogRuntime façade | `js/battle/CharacterCatalogRuntime.js` | Added pure diagnostics/validation façade for catalog, rosters, preview assets, and formation compatibility summaries. | `node scripts/check-battle-scene-stage-runtime-wiring.mjs` pass. |
| Task 12-FINAL | Generated playable registry range | `js/battle/PlayableCharacterRegistry.js` | Added bounded generated dog/cat specs (13-30), ALL_* merged lists, and registry summary/validation contract while preserving manual specs. | wiring check static+dynamic assertions pass. |
| Task 12-FINAL | CharacterCatalog diagnostics API | `js/battle/CharacterCatalog.js` | Added summary/validation/diagnostics API via CharacterCatalogRuntime and bumped catalog version. | wiring check pass. |
| Task 12-FINAL | Inspector catalog diagnostics | `js/battle/DebugBattleInspector.js` | Added characterCatalog diagnostics bundle and compact DOM line `catalog total/dog/cat/generated/errors`. | wiring check static assertion pass. |
| Task 12-FINAL | Preview/formation/catalog contract checks | `scripts/check-battle-scene-stage-runtime-wiring.mjs`, `js/data/previewAssets.js` | Added assertions for generated preview ids, registry/catalog validations, and formation 2x5 compatibility; kept `buildPlayablePreviewAssets(ANIM4_E)` contract. | command pass. |
| Task 12-HOTFIX | CharacterCatalog export fix | `js/battle/CharacterCatalog.js`, `js/battle/DebugBattleInspector.js` | Fixed blank-page ES module import error caused by missing `CharacterCatalog.isGeneratedCharacter` export. | wiring check pass. |
| Task 12-HOTFIX | Generated metadata propagation | `js/battle/PlayableCharacterRegistry.js`, `scripts/check-battle-scene-stage-runtime-wiring.mjs` | Generated character metadata now flows into catalog entries and is asserted (`generated/generationSource/generatedRange`). | wiring check pass. |
| Task 12-HOTFIX | BattleScene syntax restore (background-only boot failure) | `js/battle/BattleScene.js` | Removed an extra `}` in `applyBcuProductionStatsFromTemplates`; ES module parsing had failed before `getPlayerProductionRoster`, so battle scene initialization stopped and only background was visible. | `node --input-type=module -e "import './js/main.js'"` pass. |

- StageDefinitionLoader SCDef column contract added.
- StageRuntime battle-time state strengthened with killCounter/groupState/debug.
- BcuStageSpawnRuntime firstFrame range debug and strict respawn source added.

## Partial
- Production runtime still uses existing BattleEconomy simple income model if true
- Generated asset visual/manual existence validation remains partial (candidate paths only)
- Full 0〜999 BCU roster expansion remains future work
- Full form evolution / multi-form unit support beyond current generated form remains partial
- Full BCU max deploy / will / production limit parity if not implemented
- Full BCU wallet/worker cat parity if not implemented
- Exact BCU easing/interpolation parity is not fully source-verified
- Full mamodel/maanim visual parity is not manually verified
- Animation viewer parity remains future/manual
- Browser manual validation if not run
- BattleScene/BattleActor monolith responsibility

## Unresolved
- Browser manual validation by Codex
- Generated asset paths are candidate-based and not manually verified
- Full BCU unit/enemy roster parity is not complete
- Full BCU animation visual parity is not manually verified
- Exact easing parity is not verified from BCU common source

## Manual browser check
### Task 6/7
- [ ] `?debugBattle=1`

### Task 8
- [ ] debugBattle=1 で damageAndProc が見える

### Task 9
- [ ] debugBattle=1 で kbRuntime / effectRuntime が見える

### Task 10
- [ ] debugBattle=1 で animationRuntime が見える
- [ ] actor currentAnimId / activeAnimRole / frame が見える
- [ ] appliedTrackCount / failedTrackCount が見える
- [ ] drawListCount / opacity / z-order summary が見える
- [ ] renderer が animation frame を進めていない
- [ ] attack hit timing が animation frame に戻っていない
- [ ] KB/effect runtime の Task 9 contract が壊れていない


### Task 11
- [ ] debugBattle=1 で productionRuntime が見える
- [ ] money / maxMoney / cooldowns が見える
- [ ] rosterStatus に cost/cooldown/source が見える
- [ ] 2x5 lineup rows が見える
- [ ] card UI が economy.tick / produce を直接呼んでいない
- [ ] クリックで scene.requestPlayerSpawn だけが呼ばれる
- [ ] BCU unit stats 由来の price / respawn が反映される場合 source が見える
- [ ] Task 10 animationRuntime の contract が壊れていない

## Node checks
- command: `node scripts/check-battle-scene-stage-runtime-wiring.mjs`
- result: pass
- command: `node scripts/check-bcu-stage-spawn-runtime.mjs`
- result: pass
- command: `node scripts/check-stage-asset-tracing.mjs`
- result: pass


### Task 12
- [ ] debugBattle=1 で characterCatalog が見える
- [ ] catalog total / dog / cat / generated count が見える
- [ ] FormationEditor で generated character が表示される
- [ ] generated character を 2x5 formation に入れられる
- [ ] Apply Battle 後に generated character が production roster に入る
- [ ] asset missing の場合も既存 fallback/debugで落ちない
- [ ] Task 11 productionRuntime の contract が壊れていない

## Task 12-BUGFIX (generated selectable formation)
### Completed
- FormationEditor generated/manual visibility controls.
- FormationEditor search/filter/count UI for generated catalog.
- Generated character selection path verified through FormationStore.
- Generated character production lineup entry compatibility.
- DebugBattleInspector generatedSelectable diagnostics.
- Node checks for generated selectable formation path.

#- StageDefinitionLoader SCDef column contract added.
- StageRuntime battle-time state strengthened with killCounter/groupState/debug.
- BcuStageSpawnRuntime firstFrame range debug and strict respawn source added.

## Partial
- Browser manual validation if not run.
- Generated asset visual/manual existence validation.
- Full 0〜999 BCU roster expansion.
- Full form evolution / multi-form support.

### Unresolved
- Browser manual validation by Codex.
- Generated asset paths are candidate-based and not manually verified.

### Manual browser check
- [ ] 編成画面で Generated filter を押すと generated キャラだけ出る
- [ ] search に `013` と入れると dog-enemy-013 / cat-unit-013-f が見える
- [ ] cat-unit-013-f をクリックすると active slot に入る
- [ ] dog-enemy-013 をクリックすると active slot に入る
- [ ] Apply Battle 後 productionRuntime に generatedRosterCount が出る
- [ ] generated キャラの画像が missing でも UI が落ちない
- [ ] debugBattle=1 で characterCatalog.generatedSelectable が見える
- [ ] webを開いて編成画面が表示される
- [ ] console に missing export error が出ない
- [ ] generated filter / generated diagnostics が動く


## Priority 2 — Attack order fix (2026-05-10)
### Completed
- Attack order fixed: due-hit -> capture -> damage attempt/apply -> markHitResolved.
- BattleScene attack hit resolution helper added (`resolveAttackHitEvent`).
- No-target hits are explicitly skipped then marked resolved.
- Multi-hit remains key/hitIndex based.
- DebugBattleInspector attackOrder diagnostics added.
- `scripts/check-battle-attack-timeline.mjs` updated to current runtime reality.

### Partial
- Full BCU ability/proc parity.
- Full BCU attack/proc side effects.
- Browser manual validation.
- BattleScene monolith responsibility.

### Manual browser check
- [ ] `?debugBattle=1` で `attackOrder` が見える
- [ ] `attackTimelineHitDue -> attackTargetsCaptured -> attackDamageResolved -> attackTimelineHitResolved` の順に出る
- [ ] no-target hit が skipped として出る
- [ ] multi-hit が hitIndex/key 単位で解決される
- [ ] damage が二重適用されない
- [ ] attack timing が animation frame依存に戻っていない

## Priority 3 — ProcResolver pending hooks / no-op contract hardening (2026-05-10)
### Completed
- ProcResolver pending hook contract added (`ProcResolver.v2-pending-contract`).
- ProcResolver remains no-apply/no-state-mutation (applied stays empty).
- DamageCalculator now carries proc pending/skipped counts and passes richer damageResult context to ProcResolver.
- BattleScene emits `procResolved` debug event with pending/skipped payload.
- DebugBattleInspector damageAndProc diagnostics now include pending summaries.
- Node wiring checks now assert pending contract and no forbidden runtime mutation/imports.

### Partial
- Full raw ABI -> semantic BCU proc mapping remains unverified (`raw-only-unverified` preserved).
- Actual freeze/slow/weaken/warp state application remains future work.
- Actual wave/surge effect runtime application remains future work.
- Browser manual validation remains pending.

### Manual browser check
- [ ] `?debugBattle=1` で damageAndProc が見える
- [ ] procPending / procSkipped が表示される
- [ ] rawAbi-only は raw-only-unverified として pending化されない
- [ ] semantic true のテストeventだけ pendingになる
- [ ] freeze/slow/wave/surge が実際にはまだ適用されない
- [ ] attack order fix が壊れていない

## Priority 4 — StageRuntime coordinate / base front / spawn position repair (2026-05-10)
### Completed
- StageRuntime coordinate contract added (`stageLen`, base positions/fronts, spawn positions, coordinate sources, summary methods).
- Base combat position and spawn position are StageRuntime-first.
- BattleSpawnResolver now uses StageRuntime before legacy fixed fallback.
- BattleScene.getSpawnWorldX passes StageRuntime to resolver.
- actorRadius/gap no longer shifts StageRuntime spawn position.
- Node checks cover base/spawn coordinate contract.

### Partial
- Exact animated castle visual offset parity remains future work.
- Boss spawn special cases remain partial where source rows/runtime are absent.
- Browser manual validation remains pending.

### Manual browser check
- [ ] debugBattle=1 で stageRuntime coordinate が見える
- [ ] enemyBasePosBcu / playerBasePosBcu が見える
- [ ] enemySpawnWorldX / playerSpawnWorldX が見える
- [ ] spawnWorldXSource が stage-runtime-* になる
- [ ] zoomしても spawn位置 / stageLen が変わらない
- [ ] 敵城visual centerではなくbase combat point基準で敵が出る
- [ ] actorRadius変更でspawn位置が不自然にずれない

## Priority 1 — BCU StageBasis parity: base/spawn/stage coordinate (2026-05-10)
### Completed
- StageRuntime now exposes BCU StageBasis coordinate contract fields and methods (`enemyCastleWorldX=800`, `playerCastleWorldX=stageLen-800`, `enemyNormalSpawnWorldX=700`, `playerSpawnWorldX=stageLen-700`).
- StageRuntime spawn resolution now distinguishes normal enemy spawn / boss spawn / enemy base entity spawn with explicit `stage-runtime-*` sources.
- StageRuntime now tracks enemy base row detection state (`enemyBaseRow`, `enemyBaseRowIndex`, `hasEnemyBaseEntity`) and exposes enemy-base-entity spawn coordinate.
- BattleBase `applyStageRuntime()` now applies BCU combat point coordinates directly to `posBcu/x/frontX` and keeps coordinate source/debug.
- BattleSpawnResolver is StageRuntime-first and keeps legacy fallback source explicit as `legacy-bcu-fixed-fallback`.
- BcuStageSpawnRuntime spawn event now carries StageRuntime coordinate/source metadata (`spawnWorldXSource`, `coordinateSource`, `stageRuntimeCoordinate`, `baseEnemy`, `bossFlag`).
- Node checks now assert StageRuntime coordinate methods/fields and StageRuntime-first spawn behavior.

### Partial
- Full enemy base entity runtime behavior remains partial (this patch adds StageRuntime state + non-silent spawn-source contract, not full entity lifecycle parity).
- boss_spawn asset extraction remains partial where source data is unavailable.
- Full BCU castle visual offset parity remains future work.
- Browser manual validation remains pending.

### Manual browser check
- [ ] `?debugBattle=1` で `enemyCastleWorldX=800` が見える
- [ ] `playerCastleWorldX=stageLen-800` が見える
- [ ] `enemySpawnWorldX=700` が見える
- [ ] `playerSpawnWorldX=stageLen-700` が見える
- [ ] boss_spawn が取れるステージで `bossSpawnWorldX` が使われる
- [ ] zoomしても `stageLen/baseX/spawnX` が変わらない
- [ ] actorRadius で spawn 位置がずれない
- [ ] 敵城が 0 番やにゃんこ城に fallback しない

## BCU visual bugfix — formation enemy icon + castle projection/anchor + base runtime apply (2026-05-10)
### Completed
- Dog/enemy formation icon primary now uses runtime enemy asset pack `000002`.
- `000010` enemy_icon is no longer primary for dog/enemy formation icons.
- BattleSceneRenderer adds `projectBcuX()` for base/castle rendering path.
- Enemy castle render anchor changed to BCU right-edge (`drawX = sx - drawW`).
- Castle-composite and placeholder base rendering now use BCU projection helper for base.x.
- BattleScene `loadBase()` now applies `BattleBase.applyStageRuntime()` before return (initial + final apply).
- Node checks now cover dog uiIcon source and castle projection/anchor contracts.

### Partial
- Full actor/render projection parity remains future work.
- Full HP bar/debug overlay BCU projection parity remains future work.
- Full CastleImg boss_spawn parity remains future work.
- Browser manual validation remains pending.

### Manual browser check
- [ ] 編成画面で dog-enemy-020〜030 の画像が runtime enemy と一致する
- [ ] 000010 enemy_icon の別キャラ画像が出ない
- [ ] 戦闘中の敵城がBCU右端アンカー位置に寄る
- [ ] 敵城が base.x 中心描画されていない
- [ ] stageLen=4800 で enemy base=800, player base=4000 が視覚的にも一致する
- [ ] debugBattle=1 で castle resolved が出る
- [ ] zoomしても城のcombat positionが変わらない
