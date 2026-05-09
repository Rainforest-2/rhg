# BCU migration status

## Last updated
- date: 2026-05-09 (UTC)
- commit: (working tree)
- task: Task 2-B (kill/group hook + respawn +1 parity option)

## Completed
| Area | Files | What changed | Evidence |
|---|---|---|---|
| Task 0 documentation | `docs/bcu-migration-status.md` | Created migration status document from actual code reads. | This file + reviewed sources listed in this document. |
| Spawn source preservation | `js/battle/BcuStageSpawnRuntime.js` | Stage spawn runtime now passes only `explicitSpawnWorldX` to resolver for non-700 explicit overrides, so source classification is preserved as `event-spawnWorldX` instead of being forced to `event-worldX`. | `resolveEnemySpawnDebug()` argument change for `resolveSpawnWorldXWithDebug`. |
| Spawn debug retention | `js/battle/BattleSceneStageRuntimeWiring.js` | `spawnStageEnemy` wrapper debug event now keeps `spawnId`, `spawnFrame`, `spawnWorldX`, `spawnWorldXSource`, `bossFlag`, `fallbackReason`, and context (`enemyBaseHpPercent`, `maxEnemyCount`, `aliveEnemyCount`, `templateMissing`). | `stageEnemySpawnRuntimeDebug` payload expanded in wiring wrapper. |
| Node checks strengthened | `scripts/check-bcu-stage-spawn-runtime.mjs`, `scripts/check-battle-scene-stage-runtime-wiring.mjs` | Updated assertion for explicit spawn source (`event-spawnWorldX`) and added wiring assertions for `spawnWorldXSource`, `templateMissing`, and `enemyBaseHpPercent`. | Updated assertions in both check scripts. |

| Spawn runtime kill hook | `js/battle/BcuStageSpawnRuntime.js` | Added `killCountTrigger` gating hook with optional context counters (`killCounterByRowIndex` / `killCounters`), non-blocking fallback, and one-time warning `kill-count-trigger-not-enforced`. | `isKillCountBlocked()`, `resolveKillCounter()`, and tick flow update. |
| Spawn runtime group hook | `js/battle/BcuStageSpawnRuntime.js` | Added optional `isGroupAllowed` hook gating and one-time warning `group-gating-not-enforced` when group semantics are not enforced. | `isGroupBlocked()` and tick flow update. |
| Respawn parity option | `js/battle/BcuStageSpawnRuntime.js` | Added opt-in `respawnAddsOneFrame` parity (`row` or `stageRuntime`) while preserving default behavior. | `commitSpawn()` sets `nextFrame = spawnFrame + interval + (addOne ? 1 : 0)`. |
| Node assertions (Task 2-B) | `scripts/check-bcu-stage-spawn-runtime.mjs` | Added assertions for kill/group hooks, one-time warning behavior, and respawn +1 option/default parity. | New assertions 17A-17H in script. |

## Partial
| Area | Files | Done | Remaining | Risk |
|---|---|---|---|---|
| Prototype wiring strategy | `js/battle/BattleSceneStageRuntimeWiring.js`, `js/main.js`, `js/battle/BattleScene.js` | Prototype wiring is idempotent and imported from `js/main.js` before app boot, and it injects spawn/runtime debug bridging. | Still temporary patch style; full safe migration into `BattleScene.js` main body is not done yet. | Medium: load order and wrapper layering must stay stable. |
| Spawn commit/reject contract | `js/battle/BattleScene.js`, `js/battle/BcuStageSpawnRuntime.js` | `tickStageEnemySpawn` commits only on successful `spawnStageEnemy`, and rejects on failure with retry delay. `rejectSpawn` resets pending state and advances `nextFrame` for retry. | Need browser/manual confirmation for all failure paths (template missing, runtime edge cases) under real assets. | Medium: runtime-only checks may miss rendering-path failures. |
| Kill counter ownership in battle runtime | `js/battle/BcuStageSpawnRuntime.js`, `js/battle/StageRuntimeSceneAdapter.js`, `js/battle/BattleSceneStageRuntimeWiring.js` | Spawn runtime now supports kill counter hook inputs. | Real battle runtime still does not define a single owner/updater for kill counters per row. | Medium: kill-trigger rows can behave differently across callers. |
| BCU group semantics parity | `js/battle/BcuStageSpawnRuntime.js` | Spawn runtime now supports `isGroupAllowed` hook input. | Full BCU group semantics are not hardcoded yet (intentional). | Medium: grouped spawn ordering may drift from BCU. |
| Debug surface completeness | `js/battle/BattleSceneStageRuntimeWiring.js`, `js/battle/DebugBattleInspector.js` | Wiring event now includes major Task 2 debug fields for spawn. | Inspector panel-level visualization of all new fields is not fully audited in this task. | Low/Medium observability gap. |

## Unresolved
| Item | Current code read | BCU-derived rule in AGENTS | Why unresolved | Impact | Next action |
|---|---|---|---|---|---|
| `commitSpawn` respawn +1 parity | `js/battle/BcuStageSpawnRuntime.js` currently uses `nextFrame = spawnFrame + interval` | AGENTS Task 2 notes BCU `rem++` equivalent should be considered (`+1`) | Existing local checks currently match current behavior; changing now risks double-adjust without full parity audit. | Potential 1-frame timing drift vs strict BCU. | Audit with fixture rows and decide +1 policy explicitly. |
| Kill count/group gating parity | `js/battle/BcuStageSpawnRuntime.js` has no full killCounter/group allow implementation | AGENTS 3.7/3.5 reference kill/group gating in BCU | Not part of this focused Task 0+2 patch scope. | Some rows may spawn earlier/later than BCU in edge cases. | Track in next spawn-runtime parity pass. |
| BattleScene monolith responsibilities | `js/battle/BattleScene.js` still owns many responsibilities | AGENTS long-term goal: extract parser/resolver/damage/proc/KB/effects responsibilities out | Large refactor intentionally deferred (minimal diff rule). | Maintenance risk and harder parity verification. | Incremental extraction task-by-task (Task 5+). |

## Current implementation snapshot (verified)
- `StageRuntime.js`: Exists; constructs runtime world model with stageLen/base/spawn/background ids, enemy rows, and effective max enemy count cap behavior. Enemy spawn defaults include BCU-standard 700.  
- `StageRuntimeSceneAdapter.js`: Exists; builds runtime via `StageRuntime`, provides `getEnemyBaseHpPercent(scene)`, and builds spawn tick context with `enemyBaseHpPercent`, `aliveEnemyCount`, `maxEnemyCount`, `stageLen`, `bases`, `enemySpawnWorldX`, `bossSpawnWorldX`.  
- `BattleSceneStageRuntimeWiring.js`: Exists; prototype wiring style (method wrappers), idempotent guard flag, and imported by `js/main.js`.  
- `BcuStageSpawnRuntime.js`: Exists; emits spawn event with `rowIndex`, `spawnId`, `spawnFrame`, `worldX`, `spawnWorldX`, `spawnWorldXSource`, `spawnResolveDebug`, `bossFlag`, magnification fields, `baseHpTriggerPercent`, and `row`; supports `commitSpawn` and `rejectSpawn`.  
- `BattleSpawnResolver.js`: Exists; spawn source priority is implemented with explicit world/spawn, then BCU spawn rules; source labels include `event-worldX`, `event-spawnWorldX`, `bcu-boss-spawn`, `bcu-enemy-spawn-700`, player BCU sources, and unresolved fallback source.  
- `CastleAssetResolver.js`: Exists; group-aware castle resolution (`rc/ec/wc/sc`) with fallback reason tracking.  
- `StageBackgroundResolver.js`: Exists; bgId resolution priority via runtime/stage/definition and fallback with reason tracking.  
- `BattleScene.js`: still contains broad runtime responsibilities (spawn, attack loop, effects, production, state update), with stage spawn integration performed directly in `tickStageEnemySpawn` + wiring overlay.  
- Task 2 unresolved verification points: full browser-side debug panel audit and kill/group parity behavior remain pending.

| Group allow full parity | `js/battle/BcuStageSpawnRuntime.js` | AGENTS 3.7 expects full BCU `s.data.allow(...)` semantics | This patch only adds hook points; semantics remain caller-defined. | Grouped spawn behavior can diverge from BCU in complex waves. | Define/implement shared group model in battle runtime and wire through context. |
| Kill counter runtime source | `js/battle/BcuStageSpawnRuntime.js`, `js/battle/BattleScene*` | AGENTS 3.5/3.7 expects `killCounter[i]` progression | Hook accepts counters but BattleScene-side authoritative counter update source is still not fixed. | killCount rows may be under-enforced unless caller supplies counters. | Implement counter ownership/update in runtime tick and pass via spawn context. |
| Respawn +1 default policy | `js/battle/BcuStageSpawnRuntime.js` | AGENTS 3.8 discusses BCU `rem++` parity | Default behavior intentionally unchanged to keep existing expectations (`nextFrame=15`) and avoid regression. | Default still differs from strict BCU unless opt-in is enabled. | Decide migration flag rollout plan; flip default only after browser parity validation. |

## Manual browser check
- [ ] `?debugBattle=1`
- [ ] stageLen does not change with zoom
- [ ] actor.x does not change with zoom
- [ ] base.x does not change with zoom
- [ ] spawnWorldXSource appears in debug
- [ ] castle fallback appears if asset missing
- [ ] bg fallback appears if asset missing

## Node checks
- command: `node scripts/check-bcu-stage-spawn-runtime.mjs`
- result: pass
- command: `node scripts/check-battle-scene-stage-runtime-wiring.mjs`
- result: pass
