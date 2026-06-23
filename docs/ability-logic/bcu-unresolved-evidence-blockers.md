# BCU unresolved evidence and compatibility blockers

Updated: 2026-06-23.

This file lists blockers for broad parity claims in `Rainforest-2/rhg`. A row here can coexist with an implemented runtime: the blocker may be its real data source, a browser acceptance gap, or a compatibility boundary.

## Active blockers

| Severity | Area | Current blocker | Required next step |
|---|---|---|---|
| High | Real custom-pack SUMMON loading | Explicit proc-object `SUMMON` data reaches `BcuSummonRuntime`, but automatic discovery/loading of real custom pack proc-object files is not demonstrated. | Add loader-backed real custom-pack fixtures, then validate attack-hit handoff and stage allow/group behavior end to end. |
| High | Normal CSV SUMMON holder | Inspected BCU evidence does not prove a direct normal unit/enemy CSV `SUMMON` holder. | Keep normal CSV parsing unchanged unless source evidence identifies one. |
| High | BCU save / lineup compatibility | rhg persistence is browser-local `localStorage` JSON. The BCU serialization owner, schema, import/export rules, and round-trip compatibility are unconfirmed. | Find the BCU save/lineup owner, document the format and versions, then add import/export fixtures before making any compatibility claim. |
| High | Storage failure visibility | `FormationStore` / `StageRegistry` persistence failures can fall back silently. | Surface read/write failure through UI or structured log; test blocked/quota-full storage. |
| Medium | `Trait.targetForms` real-data coverage | Focused compatibility fixtures pass, but broad real custom trait/form loading plus capture/proc/targetOnly edge coverage is absent. | Add real loader-backed fixtures and a cross-path regression matrix. |
| Medium | Combo / orb / treasure / talent / PCoin acceptance | Main modifier hooks are implemented, but broad real-data sweep coverage and in-battle visual acceptance are incomplete. | Keep `partial`; add real-data fixtures and record browser acceptance. |
| Medium | Non-basic cannon visual assets | Dedicated cannon runtime is present—including BASE_WALL—but per-cannon ATK/EXT bitmap-animation aliases remain incomplete. | Add aliases from BCU assets; do not replace them with a generic effect approximation. |
| Medium | Extend/waved cannon timing | Exact per-frame sweep/travel coordinates are not manually accepted. | Capture a fixed BCU reference and compare frames in browser. |
| Medium | Summon entry visual | `Entity.setSummon(anim_type)` start appearance, placement, layer, and cleanup are not manually accepted. | Review only after a loader-backed summon fixture is available. |
| Medium | Zombie extra/custom revive | Standard zombie lifecycle is deterministic-test covered, but broad real source/range filtering for extra/custom revivers is not. | Add real source/range fixtures before broad completion claims. |
| Medium | BCU PC draw-side source | No PC draw-side source ZIP is available in this checkout for claims that depend on PC-only rendering helpers. | Add the relevant PC source before making PC-only visual assertions. |
| Low | Bounty/money battle visual | Economy logic is source-backed, but no dedicated battle effect owner or stable visual alias is proven. | Keep it logic-only unless new BCU source proves a visual owner. |

## Manual-only acceptance blockers

These have runtime and deterministic evidence but remain visually unaccepted:

- P_DELAY;
- barrier / demon shield / shield breaker;
- burrow DOWN / underground / UP appearance;
- spirit actor and A_IMUATK appearance;
- castle/base guard hold/break;
- zombie corpse DOWN/REVIVE and mini-death-surge visuals;
- basic cannon firing/wave effect, non-basic cannon sweep, and BASE_WALL entry/idle.

Track outcomes only in `bcu-visual-review-checklist.md`. A passing headless test is not a manual browser acceptance.

## Resolved or negative-evidence items

Do not re-list these as current implementation blockers without a current code regression:

| Area | Current conclusion |
|---|---|
| Historical StageDefinitionLoader gaps | Current code already handles the historical `rowIndex`, castle `noContinue`, `-1` enemy-castle fallback, and `bossGuard` source-row issues. Treat old README claims as historical only. |
| Castle/base guard owner | Implemented as scene/base state; only browser appearance remains. |
| Standard zombie corpse/soulstrike | Deterministic runtime coverage exists; remaining scope is visual acceptance and extra/custom sources. |
| Basic/non-basic cannon runtime | Dedicated owners and deterministic checks exist. Visual asset/timing acceptance is separate. |
| Plain castle-owned attack | Negative evidence: plain `ECastle` has no attack owner. Boss-base attacks are ordinary `EEnemy`; stage threshold/kill spawns are stage-owned. |
| Special castle boss-spawn coordinate | Runtime wiring and formula coverage are implemented. |

## Documentation rule

Do not call a runtime missing merely because its loader or visual acceptance is incomplete. State the actual boundary:

1. runtime missing;
2. runtime exists but source loading is incomplete;
3. runtime exists but browser appearance is unaccepted;
4. source owner is unconfirmed or disproven;
5. persistence schema compatibility is unconfirmed.