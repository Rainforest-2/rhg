# Current BCU ability parity status

This document records the current non-visual BCU ability/proc/effect parity status for `rhgrive2/game`.

It is intentionally conservative. A row is not treated as code-complete merely because a parser field or a resolver branch exists. Code-complete requires BCU source evidence, JS runtime wiring, deterministic tests, and ZIP/effect trace evidence where visuals are involved.

Manual browser visual inspection is outside Codex hard requirements. Rows with complete code/effect traces but no manual visual inspection may be marked `human-visual-review-needed`, not `fully-complete`.

Manual visual review tracking lives in [`bcu-visual-review-checklist.md`](./bcu-visual-review-checklist.md).
BCU parity updates must follow [`bcu-fact-first-update-procedure.md`](./bcu-fact-first-update-procedure.md): fact collection, existing JS audit, minimal update, deterministic check, then docs/status update.

## Status vocabulary

- `code-complete-candidate`: implementation and deterministic tests exist, but this document does not claim manual visual confirmation.
- `partial`: some combination of BCU source proof, JS runtime, tests, or bundle evidence is missing.
- `parsed-only`: BCU CSV fields are parsed, but there is no proven runtime owner or deterministic runtime test.
- `blocked`: implementation would require guessing without additional BCU source extraction or repo architecture work.
- `ready-for-implementation`: BCU holder/runtime/timing evidence is now sufficient to design a minimal implementation, but deterministic tests must be added before runtime code changes.
- `needs-test-first`: BCU source evidence is meaningful, but behavior must be locked with deterministic tests before changing runtime.
- `needs-loader-backed-fixtures`: BCU source paths are identified, but JS loaders/fixtures must be added before runtime behavior can be safely changed.

## Code-complete candidates

These areas have meaningful JS runtime wiring and focused regression tests:

| Area | Status | Evidence |
|---|---|---|
| freeze / slow / weaken / knockback proc | `code-complete-candidate` | `ProcResolver.getProcCatalog()` marks these implemented and actor-targeted. Existing status runtime applies actor proc status. |
| curse / seal / toxic | `code-complete-candidate` | Proc catalog and runtime status paths exist; immunity/resistance still needs continued coverage for edge sources. |
| warp lifecycle | `code-complete-candidate` | `BcuWarpLifecycleRuntime` replaces simple countdown with entrance/exit lifecycle; warped actors are fully interrupted during the scene tick (no walking/retargeting/attacking, frozen idle pose, walk resumed at exit) like BCU `kbTime > 0`; `scripts/check-bcu-warp-lifecycle-parity.mjs` covers normal lifecycle, IMUWARP, replacement lifecycle, and death during exit; `scripts/check-bcu-warp-interrupt-scene-parity.mjs` covers scene-tick interruption, backward/forward exit positions, attack cancellation, and walk resumption. |
| `P_DELAY` runtime/effect | `human-visual-review-needed` | BCU source shows `EUnit/EEnemy.processProcs -> status[P_DELAY]`, `EUnit.postUpdate -> basis.cdDelay -> ELineUp.delay`, and `EEnemy.postUpdate -> basis.lineDelay -> EStage.delay`; `BcuDelayRuntime` maps those owners to `BattleEconomy` cooldown frames and stage row `nextFrame`; `BcuDelayRuntimePatch` queues same-tick delay and flushes once in `proc-resolve`; `A_E_DELAY` is bundled as `effect:wave` `enemy-delay/*`; `scripts/check-bcu-delay-runtime.mjs`, `scripts/check-effect-bundle-aliases.mjs`, and `scripts/check-effect-coordinate-traces.mjs` cover runtime, ZIP alias, and coordinate trace. |
| wave / mini-wave | `code-complete-candidate` | Projectile base damage model and runtime helper tests exist; effect coordinate traces use runtime helpers. |
| surge / mini-surge | `code-complete-candidate` | Runtime container, raw projectile damage basis, and coordinate trace checks exist. |
| blast | `code-complete-candidate` | Blast damage bands, point-position capture, side-specific visual offset, and tests exist. |
| barrier / demon shield / shield breaker | `human-visual-review-needed` | BCU `Entity.damaged`, `AnimManager.getEff`, and `KBManager.updateKB` behavior is wired; `scripts/check-bcu-barrier-shield-effect-parity.mjs` and `scripts/check-bcu-demon-shield-regen-timing.mjs` cover gate order, phases, y offset 25, scale 0.75, layer, and delayed `SHIELD_REGEN`. Manual browser visual review is not recorded. |
| death soul core | `code-complete-candidate` | Parser fields, soul ZIP loader, death runtime, fallback cleanup, and `scripts/check-bcu-death-animation-parity.mjs` exist. |
| zombie corpse / soulstrike standard path | `human-visual-review-needed` | `scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs` covers `DataEnemy` revive indexes, `AB_ZKILL` / `AB_CKILL`, revive HP, `REVIVE_SHOW_TIME` corpse targetability, non-soulstrike exclusion, soulstrike revive cancellation, zombie-killer revive suppression, death surge single spawn at demon-soul frame 21, corpse DOWN/REVIVE visual phase timing, render override hide/show, effect cleanup, and HP restoration. Manual browser visual review is still not recorded. |
| AB_GLASS skip-soul behavior | `code-complete-candidate` | Death runtime branch and BattleScene attack-complete self-remove test exist. |
| burrow | `code-complete-candidate` | `BcuCombatModel` parses `DataEnemy.ints[43]` and `ints[44] / 4`; `BcuBurrowLifecycleRuntime` / `BattleActorBcuBurrowPatch` implement down, underground move, up, count decrement, distance consumption, base clamp, freeze/KB/death start guards, normal-vs-`TCH_UG` capture, targetability, touch/collision, renderability, and death cleanup. `scripts/check-bcu-burrow-lifecycle-parity.mjs` passes. Exact `BURROW_DOWN/MOVE/UP` actor animation appearance still needs human visual review if inspected in browser. |
| spirit lifecycle | `human-visual-review-needed` | `BcuCombatModel` parses `DataUnit.ints[110] -> SPIRIT.id`; `BcuSpiritLifecycleRuntime` / `BattleSceneBcuSpiritPatch` implement summoner spawn cooldown 15, manual spirit spawn after cooldown, one spirit per living summoner, BCU spawn-position clamp, attack start on add, damage rejection with `P_IMUATK` status trace, self-kill after attack completion, and cleanup flags. `scripts/check-bcu-spirit-lifecycle-parity.mjs` passes. Exact normal unit attack animation and A_IMUATK appearance are not manually reviewed. |
| castle/base guard | `human-visual-review-needed` | `BcuCastleGuardRuntime` / `BattleSceneBcuCastleGuardPatch` implement `StageBasis.activeGuard` as scene/base state, activate on guarded boss, hold enemy-base damage while active, break when boss condition disappears, annotate boss spawn markers, and spawn existing `enemy-wave-guard/*` hold/break phases. `scripts/check-bcu-castle-guard-parity.mjs` passes. Exact browser appearance is not manually reviewed. |

## Partial / blocked areas

These must not be marked code-complete until the listed blocker is resolved.

| Area | Current status | Blocking issue | Safe next step |
|---|---|---|---|
| `P_DELAY` remaining manual visual review | `human-visual-review-needed` | Code/effect/coordinate evidence exists, but exact browser appearance has not been manually inspected by a human. BCU `DataUnit`/`DataEnemy` CSV constructors do not expose a direct `IMUDELAY` column in inspected source; `IMUDELAY` remains a `Proc.IMUAD` holder for custom/proc-object sources and is supported by runtime when present. | Human/manual visual review only; do not mark `fully-complete` until recorded. |
| burrow | `code-complete-candidate` | Source, parser, actor lifecycle, targetability/collision, renderability state, movement distance consumption, base clamp, freeze/KB/death start guards, and deterministic tests exist. | Human/manual visual review of exact `BURROW_DOWN/MOVE/UP` actor appearance remains optional before any `fully-complete` claim. |
| summon | `partial` | BCU schema and runtime owner are proven: `Proc.SUMMON`, `IMUSUMMON`, `AtkModelEntity.setProc/invokeLater`, `AtkModelUnit.summon`, `AtkModelEnemy.summon`, `Entity.setSummon`, `EntCont`, and summoned-enemy stage `SCDef.allow(StageBasis, AbEnemy)` group lookup. JS implements explicit proc-object summon runtime via `BcuSummonRuntime` / `BattleSceneBcuSummonPatch`, carries per-hit `SUMMON` objects through `BattleAttackProfile`, maps `summon -> IMUSUMMON`, queues delayed spawn, handles immediate/on-hit/on-kill triggers, random inclusive distance, unit/enemy side resolution, unit-level and enemy-magnification inheritance, layer fallback, side limit/ignore_limit, same_health, bond_hp damage propagation, full/partial `IMUSUMMON`, and source-backed `smap`/`sdef`/`SCGroup` stage allow fixtures via `BattleSceneBcuStageSpawnPatch.getBcuSummonStageAllow`. BCU custom/proc-object `SUMMON` holders now normalize into per-hit attack events through `attachBcuProcObjectSummonsToAttackHits`; `scripts/check-bcu-nine-item-runtime-parity.mjs` covers the loader handoff and `scripts/check-bcu-summon-runtime-parity.mjs` covers group rejection, `allow=-1`, and `ignore_limit`. | Do not implement from normal CSV. Remaining blockers are broad automatic discovery of real custom pack proc-object files and exact summon `anim_type` entry appearance review. |
| spirit | `human-visual-review-needed` | Parser and production lifecycle are implemented and tested. `LineUp`-style spirit form resolution uses explicit `bcuSpiritUnitDefs` when present, or BCU DB unit asset resolution from `SPIRIT.id`; runtime is stage/production state, not proc status. | Human/manual review of exact normal spirit actor animation and A_IMUATK appearance remains. |
| castle/base guard states | `human-visual-review-needed` | `StageBasis.activeGuard` equivalent scene state, enemy boss activation, base damage hold, guard break, and `enemy-wave-guard/*` hold/break effect phases are implemented and tested. | Human/manual review of exact guard appearance remains. |
| combo / orb / treasure / talent / PCoin damage modifiers | `partial` | Loader-backed fixtures and deterministic checks now exist for all five sources. **combo** (`BasisLU.getInc`, `LineUp.renewCombo`): loaded from NyancomboData/Param (`BcuComboData`), wired into unit stat construction via `BcuComboStatModifier` (C_ATK attack, C_DEF health) with boot registry load; C_GOOD/C_MASSIVE/C_RESIST and C_WKILL/C_EKILL increments are now consumed by `DamageAbilityResolver` for damage-family and killer factors; wave/surge immunity still folds into `BcuResistRuntime`; `check-bcu-combo-modifier-loader`, `check-bcu-combo-stat-modifier`, `check-bcu-combo-immunity-resist-parity`, and `check-bcu-nine-item-runtime-parity`. **treasure** (`Treasure.getAtkMulti/getDefMulti/getFruit`): `BcuTreasureModifier`, construction-time; treasure is always maxed by design (2.5x atk/hp for every cat unit, no per-game config); `check-bcu-treasure-modifier`. **orb** (`EUnit.getOrbAtk/getOrbRes/getOrbMassive/getOrbGood`): `BcuOrbModifier`, consumed by `DamageAbilityResolver` — ORB_ATK additive, ORB_RES reduction, and ORB_MASSIVE/ORB_STRONG/ORB_RESISTANT folded into the AB_MASSIVE/AB_GOOD/AB_RESIST factors; fed by `FormationStore` orb-equipment options; `check-bcu-orb-modifier` + `check-bcu-orb-resolver-consumption`. **talent/PCoin** (`PCoin.getAtk/HPMultiplication`, `PCoin.improve`): `BcuTalentModifier` + `BcuTalentInfoData` parse the real `SkillAcquisition.csv` and `jp-util.properties`; attack/HP talents still scale construction stats, and PC_AB, PC_IMU, PC_P resistance, PC_TRAIT, PC2_SPEED, PC2_COST, PC2_CD, PC2_HB, and PC2_TBA now mutate the battle stats/combat model when selected; `check-bcu-talent-modifier`, `check-bcu-talent-info-loader`, and `check-bcu-nine-item-runtime-parity`. The death-surge orb family (`ORB_DEATH_SURGE` → `MINIDEATHSURGE`) is wired (see mini-death-surge row). | Remaining: combo **speed (C_SPE)** and **crit (C_CRIT)** runtime hooks are still not wired. Combo proc-duration (`C_STOP`/`C_SLOW`/`C_WEAK` `.time`) and knockback distance (`C_KB` `.dis`) are now wired into `ProcResolver` via `BcuComboStatModifier.buffProcPayloadWithCombos` (mirrors `AtkModelUnit` ctor `buffed[i].(STOP|SLOW|WEAK).time *= (100+getInc)/100` and `getAttack` `proc.KB.dis *= (100+getInc(C_KB))/100`); curse/seal/warp/toxic/delay have **no Nyanko combo type** (negative evidence) so their payloads are never buffed; covered by `scripts/check-bcu-combo-proc-duration-parity.mjs`. Broad real-data PCoin side-effect acceptance is fixture-backed but not visually reviewed; record full in-battle visual acceptance. |
| targetForms / special trait compatibility | `partial` | BCU `Trait.targetForms` / `targetType` branches are identified in `Entity.traitCompatible` and `EEnemy.getDamage`. `BcuTraitCompatibility` now honors `targetType` anti-traited compatibility and `targetForms` form lists without changing ordinary shared-trait matching; `DamageAbilityResolver` uses the same metadata for targetForms-sensitive damage-family compatibility. `scripts/check-bcu-nine-item-runtime-parity.mjs` covers positive and negative fixture cases. | Remaining: broad loader-backed real custom trait/form fixtures and capture/proc edge coverage beyond the focused fixture. |
| AB_SKILL status resistance side | `code-complete-candidate` | `BcuResistRuntime` now folds three source-backed resistance contributions into the field immunity, additively capped at 100 exactly like BCU's single `proc.IMU*.mult`: (1) sage field resistance + AB_SKILL bypass (pre-existing), (2) equipped resist orbs (`EUnit.processAbilityOrbs` `ORB_*_RESIST`) via `getOrbStatusResistance`, (3) combo wave/surge full immunity (`EUnit.processComboAbilities`) via `bcuComboImmunities`. Covered by `check-proc-immunity-resistance-parity` (orb stacking + cap) and `check-bcu-combo-immunity-resist-parity` (combo end-to-end). The speculative pre-computed `bcuTalentOrbResistance` map (PCoin/custom status resistance) has no proven loader and stays explicitly gated as `talentOrbResistance.implemented:false`. | Wire PCoin (`PC_IMU`) / custom-source status resistance only when its loader/holder is proven; record in-battle visual acceptance. |
| mini-death-surge | `code-complete-candidate` | Holder proof resolved: `MINIDEATHSURGE` has no CSV column; its only proven holder is the `ORB_DEATH_SURGE` talent orb (`EUnit.processAbilityOrbs`: prob=100, dis_0=200, dis_1=500, time=20, mult=max(`ORB_DEATH_SURGE_MULT[grade]`={3,6,10,14,20})). `getOrbMiniDeathSurgeProc` (`BcuOrbModifier`) derives it from equipped orbs (gate self-satisfied: `ORB_DEATH_SURGE` ∈ `ORB_EVERY_OTHER` ⇒ `isOrbBoosted`). `BcuDeathAnimationRuntime` now mirrors `Entity.AnimManager.kill()` mutually-exclusive roll (full first, else-if mini, both demon-soul) and routes the mini surge through the existing `miniSurge` key (damage × `MINIDEATHSURGE.mult/100` via `buildSurge`, `EEnemy.getDamage:93`/`EUnit:303`). Roll RNG mirrors `Data.IntType.perform` (prob 0/100 consume no roll). `scripts/check-bcu-mini-death-surge-parity.mjs` covers orb holder math, mini selection/demon-soul/key, frame-21 mini container + damage scale, and full/mini mutual-exclusion RNG fidelity. | Human/manual browser visual review of the mini demon-soul + WT_MIVC surge appearance remains before any `fully-complete` claim. |
| zombie extra-revive / custom revive edge cases | `partial` | Standard zombie corpse, soulstrike, revive visual state, and death-surge single-spawn paths are deterministically covered. Explicit extra/custom revive sources can now schedule revive using BCU `ZombX` aggregate min-time / max-health semantics through fixture-backed `bcuZombieExtraReviveSources`; `scripts/check-bcu-nine-item-runtime-parity.mjs` covers the custom revive handoff. | Remaining gaps are broad source loading/range filtering for real extra-reviver actors and human browser visual acceptance. |
| toxic immunity / enemy `IMUPOIATK` absence | `negative-evidence` | Unit CSV direct holder is proven at `DataUnit.ints[90] -> IMUPOIATK.mult = 100`. Inspected normal `DataEnemy.fillData` has toxic attack `POIATK` at enemy indexes 79/80 and no enemy toxic-immunity holder. Treat enemy toxic immunity as nonexistent in supported enemy data. Runtime `Entity.damaged` can read a generic target `getProc().IMUPOIATK.mult`, but no enemy loader path should populate it. | Implement unit direct toxic immunity and unit/custom/PCoin holder support only when the corresponding JS source loaders exist. Do not add an enemy CSV index or enemy toxic-immunity source. |
| bounty/money visual | `logic-only-unless-future-visual-proof` | BCU logic is proven: `Entity.damaged` stores accepted `P_BOUNTY`, `EEnemy.kill` multiplies money by drop multi, combo money increase, and bounty status, and bounty-orb contribution is consumed/reset. Additional source/effect searches found no dedicated `A_BOUNTY`, `A_MONEY`, or bounty-specific battle `EAnimCont`; effect ZIPs have no stable bounty/money alias. | Treat bounty as logic/economy only. Add/keep deterministic economy tests; do not add a battle visual unless future PC/draw-side source or asset evidence proves one. |

## Important implementation notes

### Parser does not imply runtime completion

`BcuCombatModel` still parses fields whose owners are not yet fully implemented. Burrow is no longer parsed-only: its BCU holder, `Entity` lifecycle owner, JS lifecycle implementation, targetability/collision handling, and deterministic lifecycle test now exist. `P_DELAY` is no longer parsed-only: BCU source proves the owner path, same-tick aggregation is implemented, `A_E_DELAY` is bundled and traced, and remaining work is human/manual visual review rather than code evidence.

### Damage resolver scope is intentionally limited

`DamageAbilityResolver` contains useful damage-family logic, but it explicitly omits some exact runtime sources: orbs, combos, barrier/shield gating, wave/surge object damage class dispatch, full targetForms special cases, and sage status resistance. Do not call all damage abilities `code-complete-candidate` until those sources are implemented and tested.

### Summon source evidence does not imply CSV implementation

`Proc.SUMMON` and its runtime owner are now mapped, and explicit proc-object runtime wiring exists. Inspected BCU evidence still shows summon is proc-object/custom attack data, not a normal direct unit/enemy CSV field in the current JS parser path. Stage `SCDef.allow` group semantics are fixture-backed for `smap`/`sdef`/`SCGroup` limits. The correct next step is BCU custom/proc-object source loading, not a CSV-only shortcut.

### Toxic immunity holder split

`IMUPOIATK` is safe to treat as a unit direct CSV holder and as a unit/proc-object/PCoin-capable runtime proc where source loaders prove it. Enemy toxic immunity is treated as nonexistent for supported enemy data: inspected `DataEnemy.fillData` only proves enemy toxic attack fields, and no enemy toxic-immunity loader should be added.

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
node scripts/check-bcu-warp-interrupt-scene-parity.mjs
node scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs
node scripts/check-bcu-barrier-shield-effect-parity.mjs
node scripts/check-bcu-demon-shield-regen-timing.mjs
node scripts/check-bcu-summon-runtime-parity.mjs
node scripts/check-bcu-combo-proc-duration-parity.mjs
node scripts/check-ability-partial-blockers.mjs
```

The GitHub Actions workflow `.github/workflows/bcu-parity-safe-suite.yml` runs `scripts/check-bcu-ability-parity-safe-suite.mjs` on push and pull request.
