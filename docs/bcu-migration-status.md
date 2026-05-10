# BCU migration status

## Last updated
- note: Priority 0 boot safety plus Priority 1 stage/spawn parser/runtime hardening and check-suite refresh.
- date: 2026-05-10 (UTC)
- commit: (working tree)
- task: AGENTS.md ordered execution pass through Priority 1 and repository check-suite stabilization

## Completed
| Task | Area | Files | What changed | Evidence |
|---|---|---|---|---|
| Priority 0 | Boot safety | `index.html`, `js/main.js`, `js/AppVersion.js`, `scripts/check-battle-scene-stage-runtime-wiring.mjs` | Added visible boot-error overlay, converted startup to dynamic imports inside `boot()`, reports failures through `__WAN_BOOT_ERROR__`, and added assertions for boot overlay/dynamic import/critical exports. | `node scripts/check-battle-scene-stage-runtime-wiring.mjs`, `node scripts/check-bcu-stage-spawn-runtime.mjs`, and `node scripts/check-stage-asset-tracing.mjs` pass. |
| Priority 1 | Stage CSV / StageRuntime / SpawnRuntime hardening | `js/battle/StageDefinitionLoader.js`, `js/battle/StageRuntime.js`, `js/battle/BcuStageSpawnRuntime.js`, `js/battle/BattleSpawnResolver.js`, `js/battle/DebugBattleInspector.js`, `scripts/check-bcu-stage-spawn-runtime.mjs`, `scripts/check-stage-runtime.mjs`, related check scripts | Added SCDef `S1` alias while preserving `SCORE`, parser raw/debug fields, BCU two-column `castleId,noContinue` support plus existing extended cannon row support, header-sourced `bossGuard`, `maxEnemyCountRaw` with cap to 50, runtime preservation of raw cap/debug fields, explicit partial C1 health-window hook diagnostics, and StageRuntime-first spawn debug metadata for explicit spawn paths. | All `scripts/check-*.mjs` pass. |
| Renderer parity pass | BCU BattleBox / Background.draw alignment | `js/battle/BattleSceneRenderer.js`, `js/battle/BattleConfig.js`, `scripts/check-battle-renderer-projection.mjs`, `scripts/check-renderer-coordinate-paths.mjs` | Added BCU render constants from `BattleBox.BBPainter`, BCU layer/sprite scale helpers, and BCU `Background.draw`-style background tile layout (`pos + 200*siz - bgWidth`, bottom anchored to stage ground). Background render now records `lastRenderDebug`. | renderer checks and global checks pass. |
| Renderer entity baseline pass | BCU BattleBox drawCastle/drawEntity alignment | `js/battle/BattleSceneRenderer.js`, `js/battle/BattleSceneStageRuntimeWiring.js`, `js/battle/BattleConfig.js`, renderer/wiring checks | Spawned stage enemies now keep SCDef layer metadata (`stageSpawnLayerMin`, `stageSpawnLayerMax`, `currentLayer`), and renderer uses BCU `midh - (road_h - layer*DEP) * siz` as the render-only Y baseline for bases and actors. Existing actor scale remains unchanged unless `applySpriteScale` is explicitly enabled. | renderer checks and global checks pass. |
| Renderer BCU projection reform | BCU BattleBox getX alignment | `js/battle/BattleSceneRenderer.js`, `js/battle/BattleConfig.js`, renderer/wiring checks | Battlefield actor/base/effect/HP debug draw paths now use a shared `projectBattleX()` helper that defaults to BCU `getX` projection (`x * ratio + off`) instead of drawing actors with normal projection while castles used BCU projection. Actor render scale now ignores ad-hoc catalog/global scale when `ignoreActorConfigScale` is enabled and uses BCU `sprite=0.8` scale. | renderer checks and global checks pass. |
| Renderer/Background BCU repair | BCU `Background.read/draw`, `StageBasis`, `EEnemy`, smoke effect alignment | `js/battle/StageBackgroundLoader.js`, `js/battle/StageBackgroundResolver.js`, `js/battle/BattleSceneRenderer.js`, `js/battle/BattleScene.js`, `js/battle/BattleSceneStageRuntimeWiring.js`, `js/battle/EffectRuntime.js`, `js/battle/BattleEffect.js`, `js/battle/BattleConfig.js`, `scripts/check-stage-asset-tracing.mjs` | Background loading now keys `bg.csv` by resolved bg ID, honors CSV column 13 as the imgcut file, column 15 as referenced image when present, uses BG part 0 and TOP part 20, and records CSV/source diagnostics. Background draw now follows BCU's ground-gradient-first contract instead of leaving a solid fallback strip. Player castle composite uses BCU left-edge `drawNyCast` anchoring, stage enemy layers randomize from L0-L1, ad-hoc visual depth/crowd offsets are disabled, and hit smoke uses BCU-style `pos + 25 + rand` and `layer + 3..8` metadata. | `node scripts/check-stage-asset-tracing.mjs`; all `scripts/check-*.mjs` pass. Browser visual check still required. |
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
