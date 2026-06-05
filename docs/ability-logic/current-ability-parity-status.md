# Current BCU ability parity status

This document records the current non-visual BCU ability/proc/effect parity status for `rhgrive2/game`.

It is intentionally conservative. A row is not treated as code-complete merely because a parser field or a resolver branch exists. Code-complete requires BCU source evidence, JS runtime wiring, deterministic tests, and ZIP/effect trace evidence where visuals are involved.

Manual browser visual inspection is outside Codex hard requirements. Rows with complete code/effect traces but no manual visual inspection may be marked `human-visual-review-needed`, not `fully-complete`.

## Status vocabulary

- `code-complete-candidate`: implementation and deterministic tests exist, but this document does not claim manual visual confirmation.
- `partial`: some combination of BCU source proof, JS runtime, tests, or bundle evidence is missing.
- `parsed-only`: BCU CSV fields are parsed, but there is no proven runtime owner or deterministic runtime test.
- `blocked`: implementation would require guessing without additional BCU source extraction or repo architecture work.
- `ready-for-implementation`: BCU holder/runtime/timing evidence is now sufficient to design a minimal implementation, but deterministic tests must be added before runtime code changes.
- `needs-test-first`: BCU source evidence is meaningful, but behavior must be locked with deterministic tests before changing runtime.

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
| barrier / demon shield / shield breaker | `human-visual-review-needed` | BCU `Entity.damaged`, `AnimManager.getEff`, and `KBManager.updateKB` behavior is wired; `scripts/check-bcu-barrier-shield-effect-parity.mjs` and `scripts/check-bcu-demon-shield-regen-timing.mjs` cover gate order, phases, y offset 25, scale 0.75, layer, and delayed `SHIELD_REGEN`. Manual browser visual review is not recorded. |
| death soul core | `code-complete-candidate` | Parser fields, soul ZIP loader, death runtime, fallback cleanup, and `scripts/check-bcu-death-animation-parity.mjs` exist. |
| AB_GLASS skip-soul behavior | `code-complete-candidate` | Death runtime branch and BattleScene attack-complete self-remove test exist. |

## Partial / blocked areas

These must not be marked code-complete until the listed blocker is resolved.

| Area | Current status | Blocking issue | Safe next step |
|---|---|---|---|
| `P_DELAY` remaining manual visual review | `human-visual-review-needed` | Code/effect/coordinate evidence exists, but exact browser appearance has not been manually inspected by a human. BCU `DataUnit`/`DataEnemy` CSV constructors do not expose a direct `IMUDELAY` column in inspected source; `IMUDELAY` remains a `Proc.IMUAD` holder for custom/proc-object sources and is supported by runtime when present. | Human/manual visual review only; do not mark `fully-complete` until recorded. |
| burrow | `ready-for-implementation` | 2026-06-05 source pass proves BCU holder `DataEnemy.ints[43]/[44]/4` and runtime owner `Entity.update/update2/startBurrow/updateBurrow/touchable`, including negative `kbTime` phases and underground `TCH_UG` targetability. JS still has parser-only state and no movement/capture/collision runtime. | Add `check-bcu-burrow-lifecycle-parity.mjs` first, then implement actor lifecycle, targetability, collision, renderability, base clamp, and death/revive/warp/soulstrike interactions. |
| summon | `blocked` | BCU runtime owner is proven (`AtkModelEntity.setProc/invokeLater`, `AtkModelUnit.summon`, `AtkModelEnemy.summon`, `Entity.setSummon`, `EntCont`), but normal `DataUnit`/`DataEnemy` CSV holder is negative evidence; holder is custom/proc-object data that JS does not currently load. | Do not implement from CSV. First map custom/proc-object attack data and actor creation contract, including `IMUSUMMON`, layer fallback, limit checks, delayed `EntCont`, `same_health`, and `bond_hp` damage propagation. |
| spirit | `ready-for-implementation` | BCU holder and owner are proven: `DataUnit.ints[110] -> SPIRIT.id`, `LineUp` spirit form, `StageBasis.act_spawn/update` cooldown and flags, `EUnit.isSpirit` damage rejection/self-kill. JS parser/runtime are missing. | Add parser and lifecycle tests first: index 110, cooldown 15, range 150, one spirit per living summoner, attack start, `P_IMUATK` visual on damage, self-kill cleanup. |
| castle/base guard states | `ready-for-implementation` | BCU owner is now mapped to `StageBasis.activeGuard`, `Entity.postUpdate`, and `ECastle.guard`; JS has `enemy-wave-guard/*` ZIP alias but no `activeGuard` runtime state or base damage gate. | Add `check-bcu-castle-guard-parity.mjs` first; implement as stage/base state, not actor proc status. |
| combo / orb / treasure / talent / PCoin damage modifiers | `partial` | BCU source paths are identified (`BasisLU.getInc`, `Treasure`, `EUnit.OrbHandler`, `PCoin`, `AtkModelUnit`), but JS data loaders and exact fixtures are missing. `DamageAbilityResolver` intentionally omits these sources. | Add loader-backed fixtures for strong, massive, resistant, insane damage/resistant, AB_SKILL, AB_VKILL, killer families, partial resistance, attack construction, and bounty orb effects. |
| targetForms / special trait compatibility | `partial` | BCU `Trait.targetForms` branches are identified in `EEnemy.getDamage` and `Entity.traitCompatible`, but local JS fixture data and regression tests are missing. | Add minimal BCU targetForms fixtures before changing `BcuTraitCompatibility`, capture, or damage family logic. |
| AB_SKILL status resistance side | `partial` | Supported sage field resistance in `BcuResistRuntime` passes checks, but broader holder sources remain partial: talent/orb/custom resistance sources are unsupported and no full external-source matrix exists. | Extend `check-proc-immunity-resistance-parity.mjs` or a new external-source check for source-backed orb/talent/PCoin/custom resistance before status upgrade. |
| death surge / zombie corpse interaction | `needs-test-first` | Death surge 21-frame trigger is tested, but BCU `ZombX` corpse state, `REVIVE_SHOW_TIME`, soulstrike cancellation, zombie killer immunity, mini-death-surge, and cleanup ordering are not fully represented by JS tests. | Add dedicated zombie corpse + death surge + soulstrike lifecycle tests before behavior edits. |
| zombie corpse / soulstrike full parity | `needs-test-first` | BCU source proves `TCH_CORPSE` via `AB_CKILL`, `Entity.touchable`, and `ZombX.updateRevive`; JS has a corpse target path but lacks deterministic tests for show-time window, revive visual phase, and cleanup windows. | Add corpse targetability and revive visual/effect trace checks; keep row partial until they pass. |
| enemy `IMUPOIATK` direct CSV holder | `blocked` | `DataUnit` index 90 maps toxic immunity, but inspected `DataEnemy.fillData` maps enemy indexes 79/80 to `P_POIATK` and has no direct enemy `IMUPOIATK` column. | Inspect custom/proc-object holders before adding an enemy toxic immunity index. |
| bounty/money visual | `partial` | BCU money formula in `EEnemy.kill` is known, but battle visual owner/ZIP alias for bounty or money effect is not proven. | Keep logic separate from visual row; inspect PC/draw-side source or add exhaustive negative visual evidence. |

## Important implementation notes

### Parser does not imply runtime completion

`BcuCombatModel` still parses fields whose owners are not yet fully implemented. Burrow is no longer merely "source-unproven": its BCU holder and `Entity` lifecycle owner are now documented in `docs/ability-logic/bcu-ability-source-evidence.md` and `docs/ability-logic/bcu-evidence-extraction-pass-2026-06-04.md`. It remains non-code-complete because JS lacks lifecycle/runtime tests and implementation. `P_DELAY` is no longer parsed-only: BCU source proves the owner path, same-tick aggregation is implemented, `A_E_DELAY` is bundled and traced, and remaining work is human/manual visual review rather than code evidence.

### Damage resolver scope is intentionally limited

`DamageAbilityResolver` contains useful damage-family logic, but it explicitly omits some exact runtime sources: orbs, combos, barrier/shield gating, wave/surge object damage class dispatch, full targetForms special cases, and sage status resistance. Do not call all damage abilities `code-complete-candidate` until those sources are implemented and tested.

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
node scripts/check-bcu-barrier-shield-effect-parity.mjs
node scripts/check-bcu-demon-shield-regen-timing.mjs
node scripts/check-ability-partial-blockers.mjs
```

If this repo gains CI, wire the command above or `scripts/check-bcu-ability-parity-safe-suite.mjs` into it.
