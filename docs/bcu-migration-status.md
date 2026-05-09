# BCU migration status

## Last updated
- date: 2026-05-09 (UTC)
- commit: (working tree)
- task: Task 2-FINAL (EnemySpawnRuntime / BcuStageSpawnRuntime battle runtime path)

## Completed
| Area | Files | What changed | Evidence |
|---|---|---|---|
| Spawn tick context ownership | `js/battle/StageRuntimeSceneAdapter.js`, `js/battle/BattleSceneStageRuntimeWiring.js` | `buildSpawnTickContext()` now passes `killCounterByRowIndex`, `isGroupAllowed`, `enemyBaseHpPercent`, `aliveEnemyCount`, `maxEnemyCount`, `stageLen`, `bases`, `enemySpawnWorldX`, `bossSpawnWorldX` every frame. | `StageRuntimeSceneAdapter.buildSpawnTickContext`, `tickStageEnemySpawnWithRuntimeContext`. |
| Kill counter runtime ownership | `js/battle/BattleSceneStageRuntimeWiring.js` | Scene now owns `stageSpawnKillCounterByRowIndex`, initializes counters per row (`killCountTrigger`), tags spawned actors with row metadata, and decrements only once on actor cleanup. | `initializeStageSpawnKillCounters`, `spawnStageEnemyWithRuntimeDebug`, `cleanupDeadWithKillCounter`, `applyStageSpawnKillCounterOnDeath`. |
| Group gating policy decision | `js/battle/StageRuntimeSceneAdapter.js`, `js/battle/BattleSceneStageRuntimeWiring.js` | Group hook is now wired from adapter/context with default-allow semantics (`group=0/null=>allow`, grouped rows currently allow unless scene hook is customized). | `resolveSpawnGroupAllowed`, `proto.isStageSpawnGroupAllowed`. |
| Respawn +1 policy decision | `js/battle/BcuStageSpawnRuntime.js`, `scripts/check-bcu-stage-spawn-runtime.mjs` | Respawn +1 parity is explicit opt-in (`row.respawnAddsOneFrame` or `stageRuntime.respawnAddsOneFrame`). Default behavior remains unchanged for game-main stability. | checks 17G/17H/17I. |
| Debug inspector spawn counters | `js/battle/DebugBattleInspector.js` | Inspector spawn section now exposes `killCounters`, `groupPolicy`, `rowsWithWarnings`, `blockedByKillCount`, `blockedByGroup`. | `DebugBattleInspector.collect().spawn`. |
| Node checks updated | `scripts/check-bcu-stage-spawn-runtime.mjs`, `scripts/check-battle-scene-stage-runtime-wiring.mjs` | Added assertions for context ownership, kill counter hooks, cleanup decrement wiring, group policy hook, inspector fields, and respawn +1 row/runtime/default behavior. | both scripts pass locally. |

## Partial
| Area | Files | Done | Remaining | Risk |
|---|---|---|---|---|
| BCU `SCDef.allow` full parity (`group` + `enemyWill`) | `js/battle/BcuStageSpawnRuntime.js`, `js/battle/StageRuntimeSceneAdapter.js` | Hook path is complete and default group policy is explicit. | Full BCU group/will semantics are still not implemented because current runtime has no enemyWill/group-limit model. | Medium |
| Browser manual validation | runtime + debug overlay files | Node checks pass for spawn path and inspector contract. | Manual `?debugBattle=1` verification still pending. | Medium |
| BattleScene monolith responsibilities | `js/battle/BattleScene.js` + wiring | Task 2 finalized via minimal wiring patches; no large rewrite. | Responsibility extraction to dedicated runtimes is still pending in later tasks. | Medium |

## Unresolved
| Item | Current code read | BCU-derived rule in AGENTS | Why unresolved | Impact | Next action |
|---|---|---|---|---|---|
| Full BCU group/will spawn semantics | `BcuStageSpawnRuntime.tick()` currently uses hooks + maxEnemyCount cap | BCU `s.data.allow(...)` also checks group/will model | Repo does not yet expose enemyWill/group-limit runtime model. | Some grouped waves can diverge from strict BCU. | Implement shared group/will runtime model in next spawn parity pass. |
| Browser manual validation by Codex | debug inspector + scene wiring are in place | AGENTS expects manual browser verification checklist | This environment run only executed Node scripts. | Runtime regressions could still exist in real browser interaction. | Execute manual checklist in next browser QA pass. |

## Manual browser check
- [ ] `?debugBattle=1`
- [ ] stageLen does not change with zoom
- [ ] actor.x does not change with zoom
- [ ] base.x does not change with zoom
- [ ] spawnWorldXSource appears in debug
- [ ] killCounters / rowsWithWarnings / blockedByKillCount / blockedByGroup appear in debug
- [ ] castle fallback appears if asset missing
- [ ] bg fallback appears if asset missing

## Node checks
- command: `node scripts/check-bcu-stage-spawn-runtime.mjs`
- result: pass
- command: `node scripts/check-battle-scene-stage-runtime-wiring.mjs`
- result: pass
