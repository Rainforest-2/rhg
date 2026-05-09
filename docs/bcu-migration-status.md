# BCU migration status

## Last updated
- date: 2026-05-09 (UTC)
- commit: (working tree)
- task: Task 8-FINAL (DamageCalculator / AbilityModel / ProcResolver foundation)

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

## Partial
- Full BCU ability semantic mapping
- Full ProcResolver effects application
- Trait-based damage modifiers beyond debug opt-in
- Wave/surge/effect runtime integration remains later task
- Browser manual validation if not run
- BattleScene monolith responsibility

## Unresolved
- Browser manual validation by Codex
- Full BCU ability/proc parity is not implemented
- Raw ABI bit-to-semantic mapping is not verified

## Manual browser check
### Task 6/7 carry-over
- [ ] `?debugBattle=1`
- [ ] debugBattle=1 で statsScaling が見える
- [ ] debugBattle=1 で attackTimeline が見える
- [ ] multi-hit actor の totalHitCount / resolvedHitCount が見える
- [ ] due hit ごとに attackTargetsCaptured / attackTimelineHitResolved が出る
- [ ] damage が hit timing 前に入らない

### Task 8-FINAL
- [ ] debugBattle=1 で damageAndProc が見える
- [ ] rawAbi present の ability が raw-only-unverified と出る
- [ ] procResolver の skipped が見える
- [ ] critical/baseDestroyer/metal は debug opt-in なしで適用されない
- [ ] damage が二重適用されていない
- [ ] attackTimeline の due-hit/capture/damage/mark-resolved が維持されている

## Node checks
- command: `node scripts/check-battle-scene-stage-runtime-wiring.mjs`
- result: pass
- command: `node scripts/check-bcu-stage-spawn-runtime.mjs`
- result: pass
- command: `node scripts/check-stage-asset-tracing.mjs`
- result: pass
