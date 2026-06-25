# BCU unresolved evidence and compatibility blockers

Updated: 2026-06-25.

This file lists blockers for broad parity claims in `Rainforest-2/rhg`. A row here can coexist with an implemented runtime: the blocker may be its real data source, a browser acceptance gap, or a compatibility boundary.

## Active blockers

Most remaining blockers are manual browser acceptance, an absent draw-side source, or an out-of-scope feature. The loader/data gaps were closed (see Resolved). Same-frame attack resolution is kept as a review item only; do not change the runtime from the old blocker note without a fixed BCU capture because mutual kills are expected to exist in BCU behavior.

| Severity | Area | Current blocker | Required next step |
|---|---|---|---|
| High | Same-frame attack-resolution ordering | Previous notes claimed BCU suppresses same-frame mutual kills, but that is not a safe parity fact: mutual kills are expected to exist, and no runtime change should suppress them from source-line reasoning alone. rhg currently preserves same-frame due-hit capture/damage behavior. | Re-audit with a fixed BCU capture and a deterministic rhg fixture before making any ordering change. If the capture shows mutual kills, remove this as a blocker rather than changing runtime behavior. |
| Low | Asset load-state vs combat logic | rhg streams unit/cannon assets (staged critical-path + background warmup, see `BattleScene.js:1` memo and `BcuLoadingStrategyVerifier`), so a not-yet-loaded template can defer a spawn/first-attack or fail the wall cannon (Form 339) closed; BCU has all data in memory. This is observable, not silent — `spawnStageEnemy`/`spawnEnemy` push `enemySpawnRejected`, `startActorAttack` pushes `attackDeferredAnimationLoading`, and the wall cannon records `wall-template-loading` and stays charged. Early-firing assets (initial enemies with attack anims, wall cannon) are already warmed on the critical path. | Treat the long-tail streaming defer as an intentional browser boundary, not a silent fail-open. A full blocking preflight would regress the deliberate staged-load UX, so escalate only if a fixed BCU capture shows an opening-frame spawn/attack/cannon frame actually diverges. |
| Medium | Extend/waved cannon timing | Per-cannon ATK/EXT bitmap aliases are now wired: each cannon loads its own `NyCastle.aux.atks[id]` BASE/ATK eanim (ATK doubles as the ContExtend EXT sweep) and `spawnCatCannonNonBasicEffect` spawns the real animation, with the trace only as an observable load-fallback (`check-bcu-non-basic-cat-cannon-anim-parity`). What remains is exact per-frame sweep/travel coordinates, which are not manually accepted. | Capture a fixed BCU reference and compare extend/waved frames in browser. (Visual.) |
| Medium | Summon entry visual | `Entity.setSummon(anim_type)` start appearance, placement, layer, and cleanup are not manually accepted (the loader is now proven). | Review in browser using the loader-backed summon fixture. (Visual.) |
| Medium | BCU PC draw-side source | No PC draw-side source ZIP is available in this checkout for claims that depend on PC-only rendering helpers. | Add the relevant PC source before making PC-only visual assertions. |
| Low | Bounty/money battle visual | Economy logic is source-backed, but BCU shows no dedicated battle effect owner or stable visual alias (negative evidence). | Keep it logic-only; there is nothing to accept unless new BCU source proves a visual owner. |
| — | BCU save / lineup import-export | rhg ships no BCU save import/export feature and no BCU serialization owner exists in this checkout; this is out of scope, not a defect. | Only if such a feature is added: find the BCU owner and add round-trip fixtures first. Repository-local persistence stays a self-round-trip claim only. |
| — | Normal CSV SUMMON holder | Inspected BCU evidence does not prove a direct normal unit/enemy CSV `SUMMON` holder (negative evidence / guardrail). | Keep normal CSV parsing unchanged unless source evidence identifies one. |

## Manual-only acceptance blockers

These have runtime and deterministic evidence but remain visually unaccepted:

- P_DELAY;
- barrier / demon shield / shield breaker;
- burrow DOWN / underground / UP appearance;
- spirit actor and A_IMUATK appearance;
- castle/base guard hold/break;
- zombie corpse DOWN/REVIVE and full/mini death-surge demon-soul visuals;
- basic cannon firing/wave effect, non-basic cannon sweep, and BASE_WALL entry/idle.

Track outcomes only in `bcu-visual-review-checklist.md`. A passing headless test is not a manual browser acceptance.

## Resolved or negative-evidence items

Do not re-list these as current implementation blockers without a current code regression:

| Area | Current conclusion |
|---|---|
| Real custom-pack SUMMON loading | Resolved: `check-bcu-summon-procobject-loader-parity` loads a real `CustomEntity.atks[].proc.SUMMON` file from disk and drives loader → `BattleAttackProfile` → immediate/on_hit spawn end to end. |
| `Trait.targetForms` real-data coverage | Resolved: `check-bcu-trait-targetforms-loader-parity` loads a real `Trait` file (targetType/targetForms) and exercises the proc and Target-Only cross-paths through `bcuTraitCompatible`. |
| Combo/orb/treasure/talent/PCoin real-data sweep | Resolved (non-visual): `check-bcu-modifier-realdata-sweep-parity` composes real 150300 combo + talent/PCoin data with treasure/orb constants in BCU order. In-battle appearance remains a separate visual item. |
| Zombie extra/custom revive source/range | Resolved: `check-bcu-zombie-extra-revive-source-range-parity` drives the BCU `ZombX.updateRevive` range/warp/`revive_non_zombie`/`imu_zkill` filter from a real `REVIVE` proc-object file. |
| Storage failure visibility | Resolved: `FormationStore`/`StageRegistry` report read/write failures via `BcuStorageDiagnostics` (`check-formation-storage-failure-visibility`) instead of a silent catch; self-persistence round-trips. |
| Modifier registry fail-open visibility | Resolved: combo / talent (PCoin) registry load failures now report through `BcuModifierDiagnostics` (`reportModifierRegistryResult` → listeners + `wanko-modifier-registry-error` event), so a failed bundle is queryable instead of only landing in the `__BATTLE_BOOT_PATCH_ERRORS__` dead-letter array. `check-bcu-modifier-registry-failure-visibility` proves a load failure is observable and a success reports clean. UI surfacing of the warning to a player who has combos/talents configured remains a Codex-owned UI follow-up. |
| `怪人特効` combo grant | Resolved: BCU `EUnit.getAbi()` grants `AB_VKILL` from a positive `C_VKILL` combo increment, and `DamageAbilityResolver` now synthesizes that bit before applying the fixed villain attack/resist multipliers. |
| `衝撃波無効` boss shockwave skip | Resolved: BCU `Entity.interrupt(INT_SW)` rejects actors with `AB_IMUSW`, and `BattleBossShockwaveRuntimePatch` now excludes those actors from boss shockwave interruption. Visual effect acceptance remains separate. |
| Historical StageDefinitionLoader gaps | Current code already handles the historical `rowIndex`, castle `noContinue`, `-1` enemy-castle fallback, and `bossGuard` source-row issues. Treat old README claims as historical only. |
| Castle/base guard owner | Implemented as scene/base state; only browser appearance remains. |
| Standard zombie corpse/soulstrike | Deterministic runtime coverage exists; remaining scope is visual acceptance. |
| Full death-surge timing ownership | Resolved (non-visual): `BcuDeathAnimationRuntime` owns the BCU `soul.len() - dead == 21` trigger, the old priority-effect immediate spawn path is guarded against, and pending demon-soul asset recovery is tested. Browser appearance remains visual acceptance. |
| Basic/non-basic cannon runtime | Dedicated owners and deterministic checks exist. Visual asset/timing acceptance is separate. |
| Plain castle-owned attack | Negative evidence: plain `ECastle` has no attack owner. Boss-base attacks are ordinary `EEnemy`; stage threshold/kill spawns are stage-owned. |
| Special castle boss-spawn coordinate | Runtime wiring and formula coverage are implemented. |

## Documentation rule

Do not call a runtime missing merely because its loader or visual acceptance is incomplete. State the actual boundary:

1. runtime missing;
2. runtime exists but source loading is incomplete;
3. runtime exists but browser appearance is unaccepted;
4. source owner is unconfirmed or disproven;
5. compatibility scope is out of scope (no in-product feature).
