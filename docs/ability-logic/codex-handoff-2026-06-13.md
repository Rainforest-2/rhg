# Codex handoff — remaining BCU parity items (2026-06-13)

Context: the proc-immunity/resistance + death-surge cluster was completed and
verified this session (see below). The items here are the **heavy / blocked**
ones the user explicitly wanted handed to Codex because they require source-backed
custom-entity data paths, stage fixtures, or broad stat-construction wiring.

Follow the repo fact-first rule: `fact -> existing JS audit -> minimal update ->
deterministic check -> docs/status update`. BCU source is extractable from
`references/bcu/BCU_java_util_common.zip` and `BCU_Android-master.zip`.

## Completed this session (do NOT redo)

- **mini-death-surge** (`MINIDEATHSURGE`): holder proven = `ORB_DEATH_SURGE` talent
  orb only (no CSV). `getOrbMiniDeathSurgeProc` (`BcuOrbModifier`) +
  `BcuDeathAnimationRuntime` mutually-exclusive full/mini roll (mirrors
  `Entity.AnimManager.kill` + `Data.IntType.perform` RNG) + `miniSurge` routing.
  Check: `scripts/check-bcu-mini-death-surge-parity.mjs`.
- **orb status-resistance families**: `getOrbStatusResistance` (`BcuOrbModifier`,
  `EUnit.processAbilityOrbs ORB_*_RESIST`) folded into `BcuResistRuntime`.
- **combo wave/surge immunity**: `BcuComboStatModifier` `bcuComboImmunities`
  (`EUnit.processComboAbilities C_IMUWAVE/C_IMUVOLC`) folded into `BcuResistRuntime`.
  Checks: `scripts/check-proc-immunity-resistance-parity.mjs`,
  `scripts/check-bcu-combo-immunity-resist-parity.mjs`.

## Heavy item 1 — Summon: custom/proc-object loader (task #4 remains)

- JS owner exists: `BcuSummonRuntime` / `BattleSceneBcuSummonPatch`,
  `getBcuSummonProcForEvent()` reads only `SUMMON` already on the event /
  `attacker.rawStats.attackHits`. There is no automatic loader for BCU
  custom/proc-object `SUMMON` source data.
- BCU source: `Proc.SUMMON`, `AtkModelEntity.setProc/invokeLater`,
  `AtkModelUnit.summon`, `AtkModelEnemy.summon`, `Entity.setSummon`, `EntCont`.
  Custom/proc-object data lives on `CustomEntity` (see
  `battle/data/CustomEntity.java`), not standard `DataUnit/DataEnemy` CSV.
- Stage allow/group subtask is now fixture-backed: `BattleSceneBcuStageSpawnPatch`
  exposes `getBcuSummonStageAllow`, resolving BCU `SCDef.smap`/`sdef` and
  `SCGroup` limits; `BcuSummonRuntime` preserves `allow=-1` for blocked
  `ignore_limit` summons and tags spawned summon actors with the resolved group.
  Covered by `scripts/check-bcu-summon-runtime-parity.mjs`.
- Remaining blocker (per `bcu-unresolved-evidence-blockers.md`): standard asset set
  ships no custom/proc-object source; add a loader + minimal fixtures before
  claiming automatic source loading.

## Heavy item 2 — Zombie extra / custom revive (task #3)

- `reviveSpec()` (`BattleActorZombieRevivePatch`) reads only
  `BcuCombatModel.proc.revive` count/time/health (standard `DataEnemy` ints[45-47]).
- BCU extra/custom revive = `MaskEntity.getResurrection()` (default null), overridden
  in **`CustomEntity.getResurrection()`** returning an `AtkDataModel`. `Entity.update`
  spawns the resurrection attack at soul-frame milestones (`adm.pre == soul.len()-dead`).
  This is a **custom-entity-only** data path — same blocker family as summon above.
- Next step: add the `CustomEntity` resurrection data path + fixtures, then mirror
  the `Entity.update` resurrection-attack spawn. Standard CSV is unchanged.

## Heavy item 3 — targetForms / special trait compatibility (task #10)

- `DamageAbilityResolver` leaves full `Trait.targetForms` special cases omitted.
- BCU branches identified in `EEnemy.getDamage` and `Entity.traitCompatible`, but
  local JS fixture data + regression tests are missing.
- Next step: add minimal source-backed `targetForms` fixtures before changing
  `BcuTraitCompatibility`, capture, or damage-family logic.

## Also deferred (large stat-construction surface, lower priority)

- **Talent non-ATK/HP families (task #7)**: `applyTalentToStats` only applies
  `getTalentAttackMultiplier`/`getTalentHpMultiplier`. PCoin also drives
  `PC_AB` (abi grant), `PC_IMU` (immunity proc), `PC_TRAIT` (trait grant),
  `PC_BASE PC2_SPEED/COST/CD/HB/TBA` (speed/cost/cooldown/KB-count/attack-rate).
  Each needs `PCoin.set*` mapping + targeted checks.
- **Combo damage families + killer combo-scaled (task #9 remainder)**: combo
  speed/crit/good/massive/resist/strong/proc-durations are computed/exposed by
  `BcuComboStatModifier` but not multiplied in; killer (`getWKAtk/getEKAtk`)
  combo-scaled form is explicitly uncertain — do NOT change without source proof.
