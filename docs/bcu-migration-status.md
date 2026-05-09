# BCU migration status

## Last updated
- date: 2026-05-09 (UTC)
- commit: (working tree)
- task: Task 3-FINAL (Castle / Background resolver end-to-end audit & tracing fix)

## Completed
- Node checks for camera transform contract
- DebugBattleInspector camera invariant diagnostics
- BattleSceneRenderer projectX projection contract audited/fixed
- BattleCameraInputController logical coordinate routing
- BattleCamera projection contract finalized
| Area | Files | What changed | Evidence |
|---|---|---|---|
| CastleAssetResolver end-to-end tracing | `js/battle/CastleAssetResolver.js`, `scripts/check-stage-asset-tracing.mjs` | Resolver contract (`requested/resolved/group/local/fallback/candidateReport`) is asserted for `rc/ec/wc/sc` and out-of-range group fallback (`9001 -> rc001`). | `check-stage-asset-tracing.mjs` castle assertions. |
| BcuCastleAssetLoader baseDebug / candidateReport tracing | `js/battle/BcuCastleAssetLoader.js`, `scripts/check-stage-asset-tracing.mjs` | Success/failure load paths are asserted with deterministic `imageLoader` seam, including `reason`, `fallbackReason`, `baseDebug`, and `candidateReport`. | `check-stage-asset-tracing.mjs` loader success/failure assertions. |
| StageBackgroundResolver end-to-end tracing | `js/battle/StageBackgroundResolver.js`, `scripts/check-stage-asset-tracing.mjs` | Background resolver path/ID contract and invalid fallback contract are verified (`bg007.png`, `bg07.imgcut`, invalid->`bgId-invalid-fallback-0`). | `check-stage-asset-tracing.mjs` background candidate/fallback assertions. |
| StageBackgroundLoader test seam / source tracing | `js/battle/StageBackgroundLoader.js`, `scripts/check-stage-asset-tracing.mjs` | Loader now supports constructor seams (`fetchText`, `loadImage`) for deterministic Node checks without browser globals; source tracing is preserved. | `StageBackgroundLoader.constructor/load`, `check-stage-asset-tracing.mjs` fixtures. |
| DebugBattleInspector assets castle/background tracing | `js/battle/DebugBattleInspector.js` | `collect()` now surfaces castle/background requested/resolved/fallback plus group/local/source/assetKind/candidateReport; DOM panel includes condensed tracing lines. | `DebugBattleInspector.collect`, `DebugBattleInspector.updateDomOverlay`. |
| scripts/check-stage-asset-tracing.mjs updated and passing | `scripts/check-stage-asset-tracing.mjs` | Script updated to current contracts for resolver/loader/inspector tracing and passes locally. | Node check result below. |

## Partial
- BattleScene monolith responsibility
- BCU PC exact +200 render offset parity if not fully audited
- Browser manual validation if not run
| Area | Files | Done | Remaining | Risk |
|---|---|---|---|---|
| Browser manual validation | runtime + debug overlay files | Node checks pass for tracing contracts and inspector output shape. | Manual `?debugBattle=1` confirmation still not executed in this task run. | Medium |
| Actual asset visual correctness | castle/bg runtime files | Data-path tracing contract is validated via deterministic seams. | Real asset visual correctness (real PNG/imgcut/csv combos) still needs browser/manual validation. | Medium |
| BattleScene monolith responsibility | `js/battle/BattleScene.js` + wiring | Task 3 finalized without large rewrites to monolith path. | Responsibility extraction remains for later tasks. | Medium |

## Unresolved
- Browser manual validation by Codex
| Item | Current code read | BCU-derived rule in AGENTS | Why unresolved | Impact | Next action |
|---|---|---|---|---|---|
| Browser manual validation by Codex | debug inspector + resolver/loader tracing paths are in place | AGENTS expects manual browser verification checklist | This run executed Node checks only. | Browser-only regressions could remain. | Execute manual checklist in next browser QA pass. |

## Manual browser check
- [ ] `?debugBattle=1`
- [ ] stageLen does not change with zoom
- [ ] actor.x does not change with zoom
- [ ] base.x does not change with zoom
- [ ] spawnWorldXSource appears in debug
- [ ] assets.castle requested/resolved/fallback is visible
- [ ] assets.background requested/resolved/fallback is visible
- [ ] invalid / missing castle asset shows fallbackReason
- [ ] invalid / missing bg asset shows bgFallbackReason

## Node checks
- command: `node scripts/check-stage-asset-tracing.mjs`
- result: pass
- command: `node scripts/check-battle-scene-stage-runtime-wiring.mjs`
- result: pass
- command: `node scripts/check-bcu-stage-spawn-runtime.mjs`
- result: pass

- [ ] debugBattle=1
- [ ] spawnWorldXSource remains stable after zoom/pan
- [ ] camera invariant stageLenMatch is true
- [ ] projection roundTrip is true
- [ ] wheel pan changes camera.pos only
- [ ] wheel/pinch zoom changes camera.siz and camera.pos only