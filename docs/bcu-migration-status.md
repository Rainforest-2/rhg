# BCU migration status

## Last updated
- date: 2026-05-09 (UTC)
- commit: (working tree)
- task: Task 10-FINAL (AnimationRuntime / BcuAnimator / BcuModelInstance contract)

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

## Partial
- Exact BCU easing/interpolation parity is not fully source-verified
- Full mamodel/maanim visual parity is not manually verified
- Animation viewer parity remains future/manual
- Browser manual validation if not run
- BattleScene/BattleActor monolith responsibility

## Unresolved
- Browser manual validation by Codex
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

## Node checks
- command: `node scripts/check-battle-scene-stage-runtime-wiring.mjs`
- result: pass
- command: `node scripts/check-bcu-stage-spawn-runtime.mjs`
- result: pass
- command: `node scripts/check-stage-asset-tracing.mjs`
- result: pass
