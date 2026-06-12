# Per-hit proc abi gate and zombie revive touch check (2026-06-12)

Scope: two reported battle-logic defects. BCU references are
`/tmp/bcu-ref/common` = `references/bcu/BCU_java_util_common.zip` (extracted).

## 1. Multi-hit attacks applied wave/procs on every hit (fixed)

- Defect: a 3-hit character whose data enables waves only on a specific hit
  (e.g. `unit418` forms with unit CSV `ints[63..65] = (0,0,1)`) generated waves
  on all three hits. `ProcResolver.resolve` and `DamageAbilityResolver.resolve`
  always read the attacker-wide `BcuCombatModel.proc`, with no per-hit gate.
- BCU source: `AtkModelUnit.getAttack` / `AtkModelEnemy.getAttack` call
  `setProc(ind, proc)` only when `abis[ind] == 1`
  (`battle/attack/AtkModelEntity.java` `abis[i] = rawAtkData()[i][2]`;
  `DataUnit` reads `abi0/abi1/abi2 = ints[63..65]`, `DataEnemy` from
  `ints[59..61]`). The `setProc` "par" list (CRIT, WAVE, KB, WARP, STOP, SLOW,
  WEAK, POISON, CURSE, SEAL, BREAK, SUMMON, SATK, VOLC, MINIWAVE, SHIELDBREAK,
  MINIVOLC, METALKILL, BLAST, DELAY, …) is therefore fully disabled for hits
  with `abi != 1`. Exempt from the gate: entity-level abilities (AB_ZKILL
  zombie killer, soulstrike), `BCShareable = { P_BOUNTY, P_ATKBASE }`, and
  `P_BSTHUNT`, which `getAttack` copies unconditionally.
- Data survey: all 460 sampled single-hit unit forms in bundled packs carry
  `abi0 = 1`; multi-hit forms include `(0,0,1)` (unit418, unit517), `(1,1,0)`
  (unit437), `(1,0,0)` (unit455), `(0,1)` (unit502/513/529/544).
- Fix:
  - `js/battle/BattleAttackProfile.js` now stamps each timeline event with
    `bcuHitAbi` from `attackHits[i].abi` (fallback branch uses `1`, matching
    `DefaultData.abi0 = 1` default).
  - `js/battle/ProcResolver.js` exports `isBcuHitProcDisabled(event)` and
    skips every catalog proc except `zombieKiller`/`soulstrike` with reason
    `bcu-hit-abi-disabled` when `Number.isFinite(event.bcuHitAbi)` and
    `trunc(bcuHitAbi) !== 1`.
  - `js/battle/DamageAbilityResolver.js` gates the proc-sourced damage rolls
    (SATK strongAttack, CRIT critical, METALKILL metalKiller) with the same
    helper; trait/entity damage abilities (AB_GOOD/AB_MASSIVE/… and fixed
    killers) stay ungated as in BCU `getDamage`.
  - `js/battle/BcuDelayRuntimePatch.js` applies the gate to the DELAY proc.
- Synthetic projectile events (wave/mini-wave/surge/blast/base-projectile
  clones) spread `...event`, so they inherit `bcuHitAbi` from the originating
  hit; a projectile can only originate from an `abi == 1` hit, so its carried
  status procs keep rolling, matching BCU `AttackWave`/`ContVolcano` sharing
  the already-gated attack proc object. Events without `bcuHitAbi` (bases,
  legacy callers) are not gated.
- Tests: `tests/bcu-combat-parity.test.mjs` —
  per-hit `bcuHitAbi` mapping, ProcResolver gate + exemptions + legacy-event
  passthrough, DamageAbilityResolver crit/SATK gate. Existing suites
  (`scripts/check-bcu-ability-parity-safe-suite.mjs`, wave/damage/proc check
  scripts) pass unchanged.
- Status: `code-complete` for logic; no visual change involved.

## 2. Zombie revive briefly walked before attacking (fixed)

- Defect: `performRevive` in `js/battle/BattleActorZombieRevivePatch.js`
  unconditionally set `state = 'move'` plus the WALK animation on the revive
  frame, and the actor's tick applied that walk pose before the scene's
  attack-start phase could switch states, showing a 1-frame walk even with an
  enemy in touch range.
- BCU source: `Entity.update2` short-circuits while `status[P_REVIVE][1] != 0`;
  on the frame the countdown reaches 0 the normal flow resumes:
  `checkTouch()` true → `anim.setAnim(UType.IDLE, true)` and
  `atkm.startAttack()` once `waitTime == 0`; WALK is only set when no enemy is
  in touch range. `waitTime` keeps decrementing during the corpse countdown
  (`Entity.update` first line), which the JS runtime already mirrors via
  `BattleAttackTimeline.tickBcuWait` running for corpse-pending actors.
- Fix: `performRevive` now performs the BCU touch check through the scene
  (`findTargetForActor` + `canAttack`). Touching → `state = 'attack-wait'`
  with the IDLE animation (the same-frame `attack-start` phase then calls
  `startActorAttack` when `waitTime == 0`); not touching → `state = 'move'`
  with WALK as before. Debug trace records `reviveTouchTarget`/`reviveState`.
- Tests: `tests/bcu-combat-parity.test.mjs` — revive with touchable enemy →
  `attack-wait`; no enemy or out-of-range enemy → `move`.
  `scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs` passes unchanged.
- Status: `code-complete`; the revive-frame pose change is
  `human-visual-review-needed` for exact appearance only.
