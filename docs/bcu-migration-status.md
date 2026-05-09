# BCU migration status

## Last updated
- date: 2026-05-09 (UTC)
- commit: (working tree)
- task: Task 6-FINAL (ActorStatsModel / stage magnification contract)

## Completed
| Task | Area | Files | What changed | Evidence |
|---|---|---|---|---|
| Task 3-FINAL | Castle/Background resolver | `js/battle/CastleAssetResolver.js`, `js/battle/BcuCastleAssetLoader.js`, `js/battle/StageBackgroundResolver.js`, `js/battle/StageBackgroundLoader.js`, `js/battle/DebugBattleInspector.js`, `scripts/check-stage-asset-tracing.mjs` | Castle/background requested/resolved/fallback/candidateReport tracing contract finalized and asserted. | `node scripts/check-stage-asset-tracing.mjs` pass. |
| Task 4-FINAL | BattleCamera projection contract finalized | `js/battle/BattleCamera.js` | world/screen transform and no-mutate contract fixed for camera transform path. | `node scripts/check-battle-scene-stage-runtime-wiring.mjs` pass. |
| Task 4-FINAL | BattleCameraInputController logical coordinate routing | `js/preview/BattleCameraInputController.js` | wheel/pinch/pan routed through logical coordinate helpers and camera transform APIs. | `node scripts/check-battle-scene-stage-runtime-wiring.mjs` pass. |
| Task 4-FINAL | BattleSceneRenderer projectX projection contract audited/fixed | `js/battle/BattleSceneRenderer.js` | renderer projection contract kept read-only against simulation/camera state mutation. | `node scripts/check-battle-scene-stage-runtime-wiring.mjs` pass. |
| Task 4-FINAL | DebugBattleInspector camera invariant diagnostics | `js/battle/DebugBattleInspector.js` | camera invariant diagnostics surfaced for stageLen/projection roundtrip/manual checks. | inspector contract assertions in `check-battle-scene-stage-runtime-wiring.mjs`. |
| Task 4-FINAL | Node checks for camera transform contract | `scripts/check-battle-scene-stage-runtime-wiring.mjs`, `scripts/check-stage-asset-tracing.mjs`, `scripts/check-bcu-stage-spawn-runtime.mjs` | Required checks are maintained and passing. | Node pass results below. |
| Task 5-FINAL | BattleFrameClock fixed-step source clarified | `js/battle/BattleFrameClock.js` | Added `stepCount`/`lastStep`; `step()` returns normalized clock snapshot including dt/fps/fixed step. | static + dynamic assertions in wiring check script. |
| Task 5-FINAL | BattleScene tick phase tracing | `js/battle/BattleScene.js` | Added explicit phase helpers and trace ring buffer with max length; tick order is traceable per logic frame. | `check-battle-scene-stage-runtime-wiring.mjs` phase assertions. |
| Task 5-FINAL | Enemy spawn phase before actor update | `js/battle/BattleScene.js`, `js/battle/DebugBattleInspector.js` | Expected phase order includes enemy-spawn before actor-state-update; inspector reports diagnostic boolean. | static order assertion + inspector field assertions. |
| Task 5-FINAL | DebugBattleInspector tick order diagnostics | `js/battle/DebugBattleInspector.js` | Added `tickOrder` diagnostics (`currentTickPhase`, `lastFramePhaseOrder`, expected order, spawn-before-actor). | wiring check assertions + debug DOM line. |
| Task 5-FINAL | Node checks for tick order contract | `scripts/check-battle-scene-stage-runtime-wiring.mjs` | Added static/dynamic checks for frame clock and tick phase contract; render/tick separation check retained. | Node pass results below. |

## Partial
- Ability/proc application remains later task
- DamageCalculator integration remains later task
- Browser manual validation if not run
- BattleScene monolith responsibility

## Unresolved
- Browser manual validation by Codex
- Only unresolved stats items pending browser verification

## Manual browser check
- [ ] `?debugBattle=1`
- [ ] debugBattle=1 で statsScaling が見える
- [ ] stage-scaled enemy actor の baseHp/scaledHp が見える
- [ ] stage-scaled enemy actor の baseDamage/scaledDamage が見える
- [ ] rowIndex / hpMagnification / attackMagnification が見える
- [ ] ability/proc は未適用/partial として扱われている

## Node checks
- command: `node scripts/check-stage-asset-tracing.mjs`
- result: pass
- command: `node scripts/check-battle-scene-stage-runtime-wiring.mjs`
- result: pass
- command: `node scripts/check-bcu-stage-spawn-runtime.mjs`
- result: pass
