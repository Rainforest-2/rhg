# Current BCU ability parity status

Updated: 2026-06-23.

This document records current non-visual BCU ability/proc/effect parity for `Rainforest-2/rhg`. It is intentionally conservative: a parser field, old note, or one fixture does not prove broad runtime parity.

## Status vocabulary

- `code-complete-candidate`: BCU source evidence, JS runtime ownership, and deterministic checks exist. Browser appearance is not yet accepted.
- `human-visual-review-needed`: logic/effect wiring is supported, but exact browser appearance has not been manually accepted.
- `partial`: one or more of source coverage, loader coverage, runtime coverage, real-data fixtures, or checks remain incomplete.
- `negative-evidence`: BCU source disproves the proposed feature owner; do not implement it under that owner.
- `logic-only-unless-future-visual-proof`: behavior is source-backed, but no battle visual owner/alias is proven.
- `unconfirmed`: the relevant source owner or compatibility format has not yet been established.

Manual browser review is tracked in [`bcu-visual-review-checklist.md`](./bcu-visual-review-checklist.md). The required work order is in [`bcu-parity-codex-workplan.md`](./bcu-parity-codex-workplan.md).

## Current runtime coverage

| Area | Status | Current evidence boundary |
|---|---|---|
| freeze / slow / weaken / knockback | `code-complete-candidate` | Proc catalog, actor status runtime, and deterministic checks exist. |
| curse / seal / toxic | `code-complete-candidate` | Runtime and resistance paths exist; retain edge coverage discipline. |
| warp lifecycle | `code-complete-candidate` | Lifecycle, interruption, targetability, exit position, and replacement/death cases are tested. Exact WaprCont appearance remains manual-review work. |
| P_DELAY | `human-visual-review-needed` | Player cooldown and enemy stage-line owners, same-tick aggregation, effect alias, and coordinate traces are covered. |
| wave / mini-wave / surge / mini-surge / blast | `code-complete-candidate` | Projectile runtime and focused damage/effect checks exist. Broad visual acceptance is separate. |
| barrier / demon shield / shield breaker | `human-visual-review-needed` | Gate order, phases, offsets, layer, and shield-regeneration timing are covered by deterministic checks. |
| death soul / AB_GLASS | `code-complete-candidate` | Parser, death runtime, fallback cleanup, and deterministic checks exist. |
| standard zombie corpse / soulstrike / revive | `human-visual-review-needed` | Deterministic coverage includes corpse targetability, soulstrike, zombie killer suppression, revive HP, phase timing, cleanup, and death-surge single spawn. Real extra/custom revive source coverage remains partial. |
| burrow | `code-complete-candidate` | Count/distance parse, down/underground/up lifecycle, collision/targetability, movement clamp, guards, and cleanup are tested. |
| spirit lifecycle | `human-visual-review-needed` | Spawn lifecycle, attack-only form bundle registration, semantic ZIP loading, and factory path are tested. Normal actor/A_IMUATK appearance is unaccepted. |
| castle/base guard | `human-visual-review-needed` | Active/hold/break state, base-damage hold, and effect phase trace are tested. Browser appearance remains unaccepted. |
| wallet / worker-cat level | `code-complete-candidate` | BCU ownership/formulas, strict upgrade gate, income, Lv8 handling, and action `-1` are wired and tested. |
| wallet and cannon UI bitmaps | `human-visual-review-needed` | BCU `img002` assets, sprite font layout, gauge/flash state, and headless checks are present; on-device/browser acceptance is pending. |
| basic cat cannon | `code-complete-candidate` | Dedicated cannon owner, action `-2`, charge/reset, 18F preTime, traveling wave bands, INT_ASS timing, lifetime, and draw math are tested. |
| non-basic cat cannon | `code-complete-candidate` | SLOW/STOP/WATER/GROUND/BARRIER/CURSE and BASE_WALL have dedicated runtime ownership and checks. ATK/EXT bitmap aliases and exact extend/waved visual timing remain open. |
| special castle boss-spawn coordinate | `code-complete-candidate` | Source formula, core bundle, StageDefinition enrichment, and StageRuntime consumption are tested. |
| enemy castle / stage “special attack” | `negative-evidence` | Plain `ECastle` has no attack owner. Boss bases use `EEnemy`; threshold/kill-count spawn behavior belongs to stage runtime. |

## Partial / evidence-limited areas

| Area | Status | Current boundary | Safe next step |
|---|---|---|---|
| SUMMON | `partial` | Explicit proc-object runtime, delay, triggers, inheritance, limits, same_health, bond_hp, and fixture-backed `SCDef` allow/group behavior exist. Normal CSV holder is unproven; automatic real custom-pack proc-object discovery/loading is not demonstrated. | Add real custom-pack loader fixtures. Do not add a normal CSV shortcut. |
| summon entry appearance | `partial` | Logic runtime exists, but `Entity.setSummon(anim_type)` appearance, placement, and layer are not manually accepted. | Review in browser after a real loader-backed fixture exists. |
| `Trait.targetForms` / special traits | `partial` | `BcuTraitCompatibility` and `DamageAbilityResolver` cover focused targetType/targetForms fixtures. | Add real custom trait/form loader fixtures plus capture/proc/targetOnly coverage. |
| combo / orb / treasure / talent / PCoin | `partial` | Core modifier paths—including speed, crit, proc duration, KB, orb damage families, treasure, and PCoin payloads—are wired. | Run broad real-data fixture sweeps and record in-battle acceptance. |
| AB_SKILL / status resistance extensions | `code-complete-candidate` for proven sources | Sage, resist orb, and combo immunity sources are covered; speculative talent/custom resistance loaders are not. | Add only source-proven PCoin/custom holders. |
| mini-death-surge | `human-visual-review-needed` | Proven ORB_DEATH_SURGE holder and mutually-exclusive full/mini roll runtime are tested. | Review mini demon-soul and WT_MIVC browser appearance. |
| extra/custom zombie revive | `partial` | Fixture-backed aggregate revive handoff exists. | Add real source/range fixtures and visual acceptance. |
| bounty/money visual | `logic-only-unless-future-visual-proof` | Economy behavior is source-backed; no dedicated battle visual owner or stable effect alias is proven. | Keep it logic/economy only unless new source evidence appears. |
| persistence / BCU save compatibility | `unconfirmed` | This is outside ability runtime. rhg persists repository-local browser state, not a proven BCU save schema. | Identify BCU serialization owner and round-trip fixtures before any import/export claim. |

## Audit consistency rules

The 2026-06-23 audit found that several old Stage/Spawn findings were already fixed in current code. Do not copy historical claims into this table without a current code comparison.

In particular, current status must distinguish:

1. **runtime exists but its real data source is incomplete** — SUMMON is the primary case;
2. **runtime and checks exist but appearance is unaccepted** — P_DELAY, shield families, spirit, guard, zombie revive, and cannon visuals;
3. **source owner is disproven** — a generic castle-owned attack runtime;
4. **compatibility scope is unconfirmed** — BCU save/lineup serialization.

## Required checks before status upgrades

```bash
node scripts/check-bcu-parser-indexes.mjs
node scripts/check-projectile-damage-parity.mjs
node scripts/check-proc-immunity-resistance-parity.mjs
node scripts/check-bcu-delay-runtime.mjs
node scripts/check-bcu-burrow-lifecycle-parity.mjs
node scripts/check-bcu-death-animation-parity.mjs
node scripts/check-bcu-warp-lifecycle-parity.mjs
node scripts/check-bcu-warp-interrupt-scene-parity.mjs
node scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs
node scripts/check-bcu-barrier-shield-effect-parity.mjs
node scripts/check-bcu-summon-runtime-parity.mjs
node scripts/check-bcu-spirit-bundle-manifest-parity.mjs
node scripts/check-bcu-castle-guard-parity.mjs
node scripts/check-bcu-wallet-runtime-parity.mjs
node scripts/check-bcu-non-basic-cat-cannon-runtime-parity.mjs
node scripts/check-ability-partial-blockers.mjs
```

A deterministic check only supports the exact claim it asserts. No row becomes `fully-complete` until the required manual visual review is recorded.