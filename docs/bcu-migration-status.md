# BCU migration status

## Last updated
- date: 2026-05-09 (UTC)
- commit: (working tree)
- task: Task 12-FINAL (CharacterCatalog / PlayableCharacterRegistry / large roster foundation)

## Completed
| Task | Area | Files | What changed | Evidence |
|---|---|---|---|---|
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

### Partial
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
