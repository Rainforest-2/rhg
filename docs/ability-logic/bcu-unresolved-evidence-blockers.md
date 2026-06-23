# BCU unresolved evidence and compatibility blockers

Updated: 2026-06-23.

This file lists blockers for broad parity claims in `Rainforest-2/rhg`. A row here can coexist with an implemented runtime: the blocker may be its real data source, a browser acceptance gap, or a compatibility boundary.

## Active blockers

All remaining blockers are either manual browser acceptance, an absent draw-side source, or an out-of-scope feature. The non-visual loader/data gaps were closed (see Resolved).

| Severity | Area | Current blocker | Required next step |
|---|---|---|---|
| Medium | Non-basic cannon visual assets | Dedicated cannon runtime is present—including BASE_WALL—but per-cannon ATK/EXT bitmap-animation aliases remain incomplete. | Add aliases from BCU assets; do not replace them with a generic effect approximation. (Visual.) |
| Medium | Extend/waved cannon timing | Exact per-frame sweep/travel coordinates are not manually accepted. | Capture a fixed BCU reference and compare frames in browser. (Visual.) |
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
