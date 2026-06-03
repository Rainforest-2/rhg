# Current BCU ability parity status

This document records the current non-visual BCU ability/proc/effect parity status for `rhgrive2/game`.

It is intentionally conservative. A row is not treated as code-complete merely because a parser field or a resolver branch exists. Code-complete requires BCU source evidence, JS runtime wiring, deterministic tests, and ZIP/effect trace evidence where visuals are involved.

Manual browser visual inspection is outside Codex hard requirements. Rows with complete code/effect traces but no manual visual inspection may be marked `human-visual-review-needed`, not `fully-complete`.

## Status vocabulary

- `code-complete-candidate`: implementation and deterministic tests exist, but this document does not claim manual visual confirmation.
- `partial`: some combination of BCU source proof, JS runtime, tests, or bundle evidence is missing.
- `parsed-only`: BCU CSV fields are parsed, but there is no proven runtime owner or deterministic runtime test.
- `blocked`: implementation would require guessing without additional BCU source extraction or repo architecture work.

## Code-complete candidates

These areas have meaningful JS runtime wiring and focused regression tests:

| Area | Status | Evidence |
|---|---|---|
| freeze / slow / weaken / knockback proc | `code-complete-candidate` | `ProcResolver.getProcCatalog()` marks these implemented and actor-targeted. Existing status runtime applies actor proc status. |
| curse / seal / toxic | `code-complete-candidate` | Proc catalog and runtime status paths exist; immunity/resistance still needs continued coverage for edge sources. |
| warp lifecycle | `code-complete-candidate` | `BcuWarpLifecycleRuntime` replaces simple countdown with entrance/exit lifecycle; `scripts/check-bcu-warp-lifecycle-parity.mjs` covers normal lifecycle, IMUWARP, replacement lifecycle, and death during exit. |
| `P_DELAY` runtime/effect | `human-visual-review-needed` | BCU source shows `EUnit/EEnemy.processProcs -> status[P_DELAY]`, `EUnit.postUpdate -> basis.cdDelay -> ELineUp.delay`, and `EEnemy.postUpdate -> basis.lineDelay -> EStage.delay`; `BcuDelayRuntime` maps those owners to `BattleEconomy` cooldown frames and stage row `nextFrame`; `BcuDelayRuntimePatch` queues same-tick delay and flushes once in `proc-resolve`; `A_E_DELAY` is bundled as `effect:wave` `enemy-delay/*`; `scripts/check-bcu-delay-runtime.mjs`, `scripts/check-effect-bundle-aliases.mjs`, and `scripts/check-effect-coordinate-traces.mjs` cover runtime, ZIP alias, and coordinate trace. |
| wave / mini-wave | `code-complete-candidate` | Projectile base damage model and runtime helper tests exist; effect coordinate traces use runtime helpers. |
| surge / mini-surge | `code-complete-candidate` | Runtime container, raw projectile damage basis, and coordinate trace checks exist. |
| blast | `code-complete-candidate` | Blast damage bands, point-position capture, side-specific visual offset, and tests exist. |
| death soul core | `code-complete-candidate` | Parser fields, soul ZIP loader, death runtime, fallback cleanup, and `scripts/check-bcu-death-animation-parity.mjs` exist. |
| AB_GLASS skip-soul behavior | `code-complete-candidate` | Death runtime branch and BattleScene attack-complete self-remove test exist. |

## Partial / blocked areas

These must not be marked code-complete until the listed blocker is resolved.

| Area | Current status | Blocking issue | Safe next step |
|---|---|---|---|
| `P_DELAY` remaining manual visual review | `human-visual-review-needed` | Code/effect/coordinate evidence exists, but exact browser appearance has not been manually inspected by a human. BCU `DataUnit`/`DataEnemy` CSV constructors do not expose a direct `IMUDELAY` column in inspected source; `IMUDELAY` remains a `Proc.IMUAD` holder for custom/proc-object sources and is supported by runtime when present. | Human/manual visual review only; do not mark `fully-complete` until recorded. |
| burrow | `parsed-only` | Enemy burrow fields are parsed, but lifecycle is not implemented. It affects movement, targetability, collision, reappearance, zombie revive, and soulstrike. | Implement only after BCU state machine and capture/collision semantics are proven. |
| summon | `blocked` | Holder fields, runtime owner, effect owner, and target/collision interactions are not proven in current docs/tests. | Extract BCU summon fields and runtime before coding. |
| spirit | `blocked` | Actor lifecycle and visual/runtime ownership are not proven. | Extract BCU spirit lifecycle and testable owner path. |
| castle/base guard states | `blocked` | Runtime owner and BCU state fields are not mapped. | Do not add broad actor flags; map BCU fields first. |
| combo / orb / treasure damage modifiers | `partial` | `DamageAbilityResolver` explicitly omits orbs and combos from exact runtime state. | Add data source loaders and deterministic modifier tests before marking damage families complete. |
| targetForms / special trait compatibility | `partial` | Full target-form special cases are not proven. | Add target-form fixtures based on BCU source. |
| AB_SKILL status resistance side | `partial` | Damage multiplier exists; status resistance/bypass is only partially centralized through `BcuResistRuntime`. | Extend BCU source-backed resistance tests before marking AB_SKILL complete. |
| death surge / zombie corpse interaction | `partial` | Death surge 21-frame trigger is tested, but full zombie revive/corpse cleanup/soulstrike interaction is not complete. | Add dedicated zombie corpse + death surge + soulstrike lifecycle tests. |
| zombie corpse / soulstrike full parity | `partial` | Soulstrike exists, but death soul docs/tests explicitly keep zombie corpse interaction partial. | Prove targetability and cleanup windows from BCU. |

## Important implementation notes

### Parser does not imply runtime completion

`BcuCombatModel` still parses fields whose owners are not yet fully implemented. `burrow` remains `parsed-only`. `P_DELAY` is no longer parsed-only: BCU source proves the owner path, same-tick aggregation is implemented, `A_E_DELAY` is bundled and traced, and remaining work is human/manual visual review rather than code evidence.

### Damage resolver scope is intentionally limited

`DamageAbilityResolver` contains useful damage-family logic, but it explicitly omits some exact runtime sources: orbs, combos, barrier/shield gating, wave/surge object damage class dispatch, full targetForms special cases, and sage status resistance. Do not call all damage abilities complete until those sources are implemented and tested.

### Death / warp status

The dedicated file `docs/ability-logic/death-warp-current-status.md` records the current death soul and warp lifecycle state. It supersedes older analysis-only wording in `fact-only-ability-parity-matrix.md` for those two areas.

## Required safe checks

Run these before upgrading any row status:

```bash
node scripts/check-bcu-parser-indexes.mjs
node scripts/check-bcu-delay-runtime.mjs
node scripts/check-projectile-damage-parity.mjs
node scripts/check-proc-immunity-resistance-parity.mjs
node scripts/check-effect-bundle-aliases.mjs
node scripts/check-effect-coordinate-traces.mjs
node scripts/check-debug-allocation-guards.mjs
node scripts/check-bcu-death-animation-parity.mjs
node scripts/check-bcu-warp-lifecycle-parity.mjs
node scripts/check-ability-partial-blockers.mjs
```

If this repo gains CI, wire the command above or `scripts/check-bcu-ability-parity-safe-suite.mjs` into it.
