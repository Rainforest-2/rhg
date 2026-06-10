# BCU check realignment 2026-06-10

This note records why several deterministic checks/tests were updated to match the
current runtime, with BCU source evidence proving the runtime (not the old checks)
is BCU-correct. No battle behavior was changed in this batch except gating
per-frame debug allocations behind `globalThis.__BCU_DEBUG_ALLOCATIONS__`.

## Evidence sources

- common: `references/bcu/BCU_java_util_common.zip` extracted to `/tmp/bcu-ref/common`.
- `battle/entity/Entity.java`: `waitTime = data.getTBA()` assigned on final hit
  (`updateAttack`, line ~785), decremented once per frame (`if (waitTime > 0) waitTime--`,
  lines 2421-2422), attack start gate `waitTime == 0 && touchEnemy && atkm.attacksLeft != 0`
  (line ~2461).
- `util/stage/Stage.java`: castle row is `castleId,non_con` only (lines 150-165, no cannon
  column; `non_con = strs[1].equals("1")`); enemy line columns `data[0] -= 2`,
  `data[2] *= 2; data[3] *= 2; data[4] *= 2`, `ss[11] -> M1` mult_atk,
  `data[5] > 100 && data[9] == 100` castle trigger swap (lines 170-260).
- `util/stage/EStage.java`: `allow()` assigns `rem[i] = respawn (+random)` then `rem[i]++`
  (respawn +1 parity); `inHealth` window rule `c0 >= c1 ? d <= c0 : (d > c0 && d <= c1)`.
- `util/stage/SCDef.java`: SIZE 16 column map `E,N,S0,R0,R1,C0,L0,L1,B,M,S1,C1,G,M1,KC,SC`
  matches `BCU_STAGE_ENEMY_COLUMNS` in `js/battle/StageDefinitionLoader.js`.

## Updated checks/tests (stale -> current BCU contract)

| File | Stale expectation | BCU-correct behavior now asserted |
|---|---|---|
| `tests/bcu-combat-parity.test.mjs` | standalone toxic leaves `pendingDamage` | standalone toxic resolves immediately (commit `800a80dc8`); hp reduced, pendingDamage flushed |
| `scripts/check-ability-model.mjs` | pinned `ProcResolver.v3-...` marker | version-tolerant `ProcResolver.v\d+-` + `bcu-proc-roll` |
| `scripts/check-battle-attack-wait-runtime.mjs` | TBA set in `enterAttackWait` | waitTime assigned on final hit, per-frame decrement, idempotent tick |
| `scripts/check-bcu-attack-interval-timing.mjs` | 1000/30 ms frame, cooldown at attack start | 33ms BCU frame (`BCU_BATTLE_TIMER_PERIOD_MS`), waitTime on final hit |
| `scripts/check-battle-attack-interval-debug.mjs` | `enterAttackWait` sets new TBA | enterAttackWait state-only; TBA preserved |
| `scripts/check-bcu-timing-parity-mode.mjs` | `set-bcu-attack-interval-on-attack-start` marker, 1000/30 ms | `final-hit-resolved-set-TBA` marker, 33ms frame |
| `scripts/check-stage-runtime.mjs` | castle row cannonId | `cannonId === null` per Stage.java |
| `scripts/check-bcu-stage-spawn-runtime.mjs` | respawn without +1, extended cannon row, partial C1 hook | respawn +1 default, BCU castle row, BCU `inHealth` window, BC CSV doubling/M1 columns |
| `scripts/check-actor-bundles-complete.mjs` / `check-actor-bundle-compatibility.mjs` | strict PNG IEND end-of-file | `allowTrailingBytes: true`, consistent with every other icon/actor build+check script (BC PNGs carry trailing bytes; CRC checks still run) |

## Raw-path guard annotations

`scripts/check-no-raw-runtime-paths.mjs` flagged raw `public/assets/bcu/**` literals in
`BcuEnemyRepository.js`, `BcuUnitRepository.js`, `BcuStageEnemyResolver.js`,
`StageBackgroundLoader.js`. All four are raw-only-diagnostics / no-db fallback paths;
production boot uses `fromCoreDb` (ZIP core-db) and `installRuntimeRawBcuGuard` blocks
raw fetches in semantic-strict mode. Guard comments were added next to each literal so
the check's proximity heuristic recognizes them.

## Per-frame debug allocation gating (W10)

Gated behind `globalThis.__BCU_DEBUG_ALLOCATIONS__ === true` (no readers in runtime;
`BattleDebugReport` falls back to `lastAttackWaitDebug`):

- `BattleAttackTimeline.tickBcuWait` -> `lastBcuWaitTickDebug`
- `BattleSceneBcuStageBasisTickPatch` -> `lastBcuStopMoveDebug`, `lastBcuStopAttackDebug`,
  `lastStageBasisAttackWaitDebug`
- `BattleScene.moveActorBcu` / `holdActorAttackTimelineForBcuStop` -> stop debug objects

## Remaining known-failing checks (environment/data, not code)

- `scripts/check-nonbattle-ui-polish.mjs`: requires `playwright`, which is not installed
  in this environment.
- `scripts/check-playable-roster-actor-readiness.mjs`: 44 first-form units lack actor
  index entries or full bundles (e.g. `unit:656:f` only has `656-s.zip`). Fix requires
  either regenerating `bcu-actor-index.json` + semantic bundles from the collab packs
  (large generated/binary churn, needs visual verification) or excluding those units via
  the `error-ally.json` -> `db.playable.allies.excludedAssetIds` path. Deferred.
