# BCU parity Codex workplan

This document is the concrete implementation order for moving `rhgrive2/game` battle ability/proc/effect rows from partial to code-complete BCU parity.

It is written for Codex-style agents that can read files, edit code, run terminal checks, inspect ZIP contents, and produce deterministic logs, but cannot perform manual browser visual inspection. Browser/manual checks are therefore not a blocker for code-complete status. If a row has visual behavior, the agent must provide deterministic coordinate/effect traces and mark any remaining manual-only concern as `human-visual-review-needed` in docs.

## Required status vocabulary

Use these statuses in docs and final reports:

- `partial`: facts, implementation, tests, or bundle evidence are missing.
- `code-complete`: BCU source, JS implementation, ZIP evidence, deterministic tests, and coordinate/effect traces pass. Browser/manual inspection is not required.
- `human-visual-review-needed`: code-complete for logic/effect wiring, but exact human visual appearance has not been manually inspected.
- `fully-complete`: only use if code-complete evidence exists and a human/manual visual check has also been recorded.

Do not use `complete` ambiguously. Prefer `code-complete` or `fully-complete`.

## Global implementation constraints

1. Do not remove wrapper chains casually. Every wrapper must call the captured original with the same `this` and compatible arguments.
2. Do not read production runtime assets from loose `public/assets/bcu/**` paths. Runtime must use ZIP bundles.
3. Do not use direct HP mutation for damage that BCU routes through damage/proc guards.
4. Do not classify a row as code-complete without a deterministic test that can fail on regression.
5. Keep browser visual verification out of Codex hard requirements.
6. Update `docs/ability-logic/fact-only-ability-parity-matrix.md` with the new status and evidence after each implementation batch.
7. Update `docs/ability-logic/effect-zip-audit.md` after every effect bundle change.

## Global checks to run after touched files

At minimum:

```bash
node --check js/battle/BcuCombatModel.js
node --check js/battle/DamageCalculator.js
node --check js/battle/DamageAbilityResolver.js
node --check js/battle/ProcResolver.js
node --check js/battle/BattleWaveRuntimePatch.js
node --check js/battle/BattleSurgeRuntimePatch.js
node --check js/battle/BattleBlastRuntimePatch.js
node --check js/battle/BattleBcuPriorityEffectRuntimePatch.js
node --check js/battle/BcuProcImmunityPatch.js
node --check js/battle/bcu-runtime/BcuResistRuntime.js
node --check js/battle/BattleWaveEffectLoader.js
node --check js/battle/BcuWaveBundleEffectSpawner.js
node --check js/battle/BattleSceneRendererEffectGlowPatch.js
node --check js/battle/EffectRuntime.js
```

Only run files that exist; if a command references a missing file, document it and add the missing test/script if that was part of the task.

## W0 — create the proof harness first

### Problem

Current parity state relies too much on docs and manual reasoning. Many rows cannot be safely moved to code-complete because there are no focused tests proving parser indexes, projectile damage order, effect aliases, guard paths, or coordinate traces.

### Required new scripts

Add small Node scripts under `scripts/`:

1. `scripts/check-bcu-parser-indexes.mjs`
   - Build minimal raw unit/enemy arrays.
   - Assert parsed indexes for wave, mini-wave, surge, mini-surge, death surge, blast, barrier, demon shield, warp, toxic, attack-nullify, strengthen, weaken, lethal, bounty, beast hunter, metal killer, delay.
   - Assert `/4` distance fields for surge/blast/warp/burrow/deathSurge.

2. `scripts/check-projectile-damage-parity.mjs`
   - Construct minimal attacker/targets with different traits and metal status.
   - Verify wave/surge/blast do not inherit a first target's final trait-adjusted damage incorrectly.
   - Verify mini-wave/mini-surge/blast falloff multipliers are applied exactly once.

3. `scripts/check-proc-immunity-resistance-parity.mjs`
   - Verify full immunity blocks proc and damage guard paths.
   - Verify partial resistance modifies only BCU-approved duration/distance/percent fields.
   - Verify `BcuResistRuntime.getBcuResistValue` no longer returns `implemented: false` once W2 is implemented.

4. `scripts/check-effect-bundle-aliases.mjs`
   - Inspect `status-effects.zip`, `wave.zip`, and `kbeff.zip`.
   - Assert required internal entries for every loader alias.
   - Assert `BattleWaveEffectLoader` aliases line up with ZIP directories.

5. `scripts/check-effect-coordinate-traces.mjs`
   - Exercise real runtime spawn helpers without a browser.
   - Assert effect trace records include `effectKey`, `phase`, `worldX`, `worldY`, `screenOffsetX`, `bcuSmokeYOffset`, `layer`, `bcuScaleMode`, `effectScale`, `renderFlipX`, `source`, and `bcuReference`.
   - Include wave, mini-wave, surge start/during/end, mini-surge start/during/end, blast start/explode, barrier, demon shield, warp entrance/exit, wave invalid, wave stop, and counter-surge fixtures.

6. `scripts/check-debug-allocation-guards.mjs`
   - Ensure heavy debug globals are gated behind an explicit debug flag or reduced to counters.
   - Do not fail on intentionally retained concise debug state.

### Code-complete criteria

- All scripts above exist.
- Scripts are deterministic and exit nonzero on failure.
- `node --check scripts/*.mjs` passes for touched scripts.
- New checks are referenced in `fact-only-ability-parity-matrix.md`.

## W1 — fix projectile damage source model

### Current risk

Wave, surge, and blast currently derive projectile damage from the accepted direct hit calculation's `finalDamage` in several runtime patches. That risks copying the first target's trait/metal/critical/resist/barrier-adjusted damage into subsequent projectile hits.

### BCU model to match

BCU projectile containers carry attack data equivalent to raw attack power plus proc metadata. Each projectile target should go through damage resolution for that target. A projectile must not inherit another target's final adjusted damage.

### Target files

- `js/battle/DamageCalculator.js`
- `js/battle/DamageAbilityResolver.js`
- `js/battle/BattleWaveRuntimePatch.js`
- `js/battle/BattleSurgeRuntimePatch.js`
- `js/battle/BattleBlastRuntimePatch.js`
- `js/battle/BattleSceneProcApplyPatch.js`
- `js/battle/BattleSceneBcuProcRuntimePatch.js`
- any event metadata producer used by `BattleSceneBcuAttackPhasePatch.js`

### Required implementation

1. Add an explicit attack damage basis to damage calculation result, for example:
   - `rawAttackDamage`
   - `bcuProjectileBaseDamage`
   - `bcuRawAtkSource`
2. Define exactly whether BCU projectile raw attack includes strengthen/weaken. Prove with local BCU `AttackSimple`, `AttackWave`, `AttackVolcano`, `AttackBlast`, and `Entity.AttackSimple.excuse` references before coding.
3. Update wave/surge/blast runtime to store raw projectile attack data, not a first target's `finalDamage`.
4. On projectile hit, call `queueAttackDamage` with event damage set to the correct raw projectile damage so `DamageCalculator` can resolve target-specific modifiers once.
5. Preserve mini-wave and mini-surge 20% damage exactly once.
6. Preserve blast 100/70/40% falloff exactly once.
7. Add metadata flags to prevent recursive projectile spawning from projectile damage unless BCU explicitly does so.

### Tests

- `node scripts/check-projectile-damage-parity.mjs`
- Cases:
  - first direct target is metal, second wave target is non-metal.
  - first direct target has resistant trait, second wave target does not.
  - first direct target triggers critical, projectile target does not inherit critical unless BCU says it should.
  - mini-wave applies 20% once.
  - blast bands apply 100/70/40 once.

### Code-complete criteria

- Projectile runtime does not use initial `finalDamage` as the universal projectile base unless a test proves that exact BCU behavior.
- Direct hit and projectile hit both pass through damage/proc guards.
- Regression tests pass.

## W2 — implement BcuResistRuntime and reconcile partial resistance

### Current risk

`js/battle/bcu-runtime/BcuResistRuntime.js` currently reports `implemented: false`, while `BcuProcImmunityPatch.js` already applies some partial resistance adjustments. That creates two inconsistent sources of truth.

### Target files

- `js/battle/bcu-runtime/BcuResistRuntime.js`
- `js/battle/BcuProcImmunityPatch.js`
- `js/battle/BcuCombatModel.js`
- `js/battle/ProcResolver.js`
- `js/battle/BattleActorProcStatusPatch.js`
- `js/battle/DamageAbilityResolver.js`

### Required implementation

1. Extract BCU `EUnit.getResistValue` and `EEnemy.getResistValue` behavior from local references.
2. Map current JS actor schema to BCU resistance sources.
3. Move partial resistance math into `BcuResistRuntime` and make `BcuProcImmunityPatch` call it instead of duplicating rules.
4. Cover duration, distance, percent damage, probability, and any sage/special bypass rules separately.
5. Implement `AB_SKILL` status resistance/bypass fully before marking sage rows code-complete.
6. Preserve full immunity as a fast block path.

### Tests

- `node scripts/check-proc-immunity-resistance-parity.mjs`
- Cases:
  - full freeze immunity blocks freeze.
  - partial freeze resistance reduces duration.
  - partial knockback resistance reduces distance.
  - partial toxic resistance reduces toxic percent.
  - sage-related resistance behaves according to BCU source.

### Code-complete criteria

- `BcuResistRuntime.getBcuResistValue(...)` no longer returns `implemented: false` for supported sources.
- Partial resistance behavior is centralized.
- Existing immunity behavior still passes.

## W3 — implement P_DELAY runtime or explicitly block it with proof

2026-06-03 status: `P_DELAY` runtime/effect evidence is now `human-visual-review-needed`. `BcuDelayRuntime` queues same-tick delay and flushes once per tick; `A_E_DELAY` is bundled as `effect:wave` `enemy-delay/*`; deterministic delay, bundle alias, and coordinate trace checks pass. No direct `DataUnit`/`DataEnemy` CSV `IMUDELAY` column was found in inspected BCU constructors; `IMUDELAY` remains supported as a `Proc.IMUAD` holder when present from custom/proc-object sources.

### Current risk

Enemy `delay` is parsed, but there is no confirmed runtime application path equivalent to BCU.

### Target files

- `js/battle/BcuCombatModel.js`
- `js/battle/ProcResolver.js`
- `js/battle/BattleSceneProcApplyPatch.js`
- `js/battle/BattleActorProcStatusPatch.js`
- production/cooldown/economy runtime files that actually own unit production timing

### Required implementation

1. Extract BCU delay/lethargy field and runtime state from local references.
2. Decide whether delay is actor-local, lineup/production-local, or base/economy-local in this codebase. Do not store it as actor status unless BCU proves actor-local behavior.
3. Add `delay` to proc catalog only after the target runtime owner is known.
4. Add immunity/resistance handling if BCU has it.
5. Add status/effect visual only if BCU has one and local assets prove it.

### Tests

- Parser fixture for enemy 111/112 delay fields.
- Runtime test showing delay changes the same production/cooldown variable BCU changes.
- Negative test: delay proc does not affect unrelated actor movement/damage.

### Code-complete criteria

- Delay has an owner runtime and deterministic test.
- If owner cannot be proven, keep row `partial` and document blocker.

## W4 — implement burrow lifecycle

### Current risk

Enemy `burrow` is parsed but not implemented as a movement/targetability lifecycle.

### Target files

- `js/battle/BcuCombatModel.js`
- `js/battle/ProcResolver.js`
- `js/battle/BattleActor.js`
- `js/battle/BattleAttackResolver.js`
- `js/battle/BattleScene.js`
- `js/battle/BattleSceneBcuAttackPhasePatch.js`
- movement/stage-basis patches that control actor position and collision

### Required implementation

1. Extract BCU burrow state machine: count, distance, start trigger, hidden state, reappearance, collision, targetability, renderability.
2. Add actor state fields equivalent to BCU, e.g. `bcuBurrowState`.
3. During burrow hidden state:
   - not renderable if BCU hides it.
   - not targetable if BCU excludes it.
   - collision/movement suppression must match BCU.
4. On reappearance, set exact final position and remaining count.
5. Verify interactions with soulstrike, zombie revive, base/castle capture, warp, knockback, and death.

### Tests

- Parser fixture for count and distance.
- Runtime test for hidden/renderable/touchable flags.
- Runtime test for final displacement.
- Capture test proving attacks ignore or include burrowed actor according to BCU.

### Code-complete criteria

- Full lifecycle is tested.
- No partial state that only hides sprite without changing capture/collision semantics.

## W5 — fix effect scale and coordinate model

### Current risk

Stage/projectile effects are drawn through a generic renderer path that multiplies camera scale, sprite scale, and effect scale. BCU does not necessarily apply actor sprite scale to all world/projectile effects. This can make wave/surge/blast/barrier/shield/warp visually offset or incorrectly scaled.

### Target files

- `js/battle/EffectRuntime.js`
- `js/battle/BcuWaveBundleEffectSpawner.js`
- `js/battle/BattleSceneRendererEffectGlowPatch.js`
- `js/battle/BattleSceneBcuStatusEffectRenderPatch.js`
- `js/battle/bcu-runtime/BcuStatusEffectPositioner.js`
- `js/battle/BattleBlastRuntimePatch.js`
- `js/battle/BattleBcuPriorityEffectRuntimePatch.js`

### Required implementation

1. Add explicit `bcuScaleMode` or equivalent metadata to effects:
   - `entity-status`
   - `stage-projectile`
   - `actor-priority-effect`
   - `warp-hole`
   - `hit-smoke`
2. Renderer chooses scale formula by mode, not by one generic formula.
3. Add effect debug trace containing:
   - `scaleMode`
   - `cameraScale`
   - `spriteScaleUsed`
   - `effectScale`
   - `finalScale`
   - `screenX`
   - `screenY`
   - `bcuReference`
4. Do not change status effect coordinate behavior unless BCU proof requires it.
5. Do not change `projectBattleX` or layer Y helpers globally.

### Tests

- `node scripts/check-effect-coordinate-traces.mjs`
- Verify each effect class emits `bcuScaleMode`, coordinate trace, and renderer scale trace through real spawn helpers.
- Verify status effects do not accidentally use actor sprite scale if BCU does not.
- Verify projectile effects do not inherit actor sprite scale unless BCU does.

### Code-complete criteria

- Every BCU effect class has explicit scale mode.
- No visual row relies on an implicit renderer formula.

## W6 — fix blast visual position and phase wiring

### Current risk

Blast logic includes BCU-like frame bands, but visual creation currently risks using `pos` directly without BCU side-specific draw offsets.

### Target files

- `js/battle/BattleBlastRuntimePatch.js`
- `js/battle/BattleWaveEffectLoader.js`
- `js/battle/BcuWaveBundleEffectSpawner.js`
- `js/battle/BattleSceneRendererEffectGlowPatch.js`

### Required implementation

1. Extract BCU `ContBlast.draw` exact unit/enemy x/y offsets and phase behavior.
2. Add side-specific blast offsets to runtime metadata.
3. Use `spawnWaveBundleEffect` or a blast-specific spawner so blast shares coordinate trace support.
4. Preserve `BLAST_SHIFT`, half-width, 44 frame lifetime, and 10/20/30 frame damage ticks unless BCU proof changes them.
5. Ensure blast damage falloff and visual phases are independent but synchronized.

### Tests

- `node scripts/check-projectile-damage-parity.mjs`
- `node scripts/check-effect-coordinate-traces.mjs`
- Cases for unit blast and enemy blast offsets.
- Runtime-level blast fixture proving `queueAttackDamage` receives `[base, 70%, 40%]` falloff and BCU point-position capture does not expand by target half-width.

### Code-complete criteria

- Blast damage and blast visual trace both match extracted BCU constants.

## W7 — complete barrier, demon shield, and guard family

### Current risk

Barrier and demon shield logic are advanced, but exact gate order, pass-through behavior, regen timing, guard/base state, and visual placement still need strict proof.

2026-06-04 update: barrier and demon shield actor gate order, shield pierce pass-through, damage-break blocking, full/half/destruction/breaker/revive phases, y offset 25, actor-priority scale 0.75, layer trace, and demon shield regen at the BCU KB end tick are covered by deterministic checks. Manual browser visual review is still not recorded, and base/castle guard remains partial.

### Target files

- `js/battle/BattleActorBarrierShieldPatch.js`
- `js/battle/BattleBcuPriorityEffectRuntimePatch.js`
- `js/battle/BcuWaveBundleEffectSpawner.js`
- `js/battle/BattleWaveEffectLoader.js`
- `js/battle/BattleSceneRendererEffectGlowPatch.js`
- `js/battle/BcuProcImmunityPatch.js`
- `js/battle/bcu-runtime/BcuDamageGuardRuntime.js`

### Required implementation

1. Extract BCU barrier and demon shield gate order.
2. Confirm if breaker damage passes through or only breaks.
3. Confirm insufficient damage blocks damage and procs.
4. Confirm demon shield HP/max HP/regen at HP knockback.
5. Confirm full/half/destruction/breaker/revive phase choice.
6. Add guard/base/castle state only after BCU fields and runtime owner are proven.
7. Add strict debug events for gate decisions.

### Tests

- Barrier insufficient damage blocks HP/proc.
- Barrier breaker breaks with correct probability.
- Demon shield pierce vs damage break behavior.
- Shield regen on HP knockback only.
- Effect alias and phase trace for all phases.
- `node scripts/check-bcu-demon-shield-regen-timing.mjs`

### Code-complete criteria

- Gate order and visual phases have deterministic tests.
- Base/castle guard stays partial unless runtime owner is implemented.

## W8 — resolve AB_SKILL, AB_VKILL, and external modifier completeness

### Current risk

Some damage families have resolver support but missing holder paths or incomplete external modifiers. `AB_VKILL` exists in constants/resolver but is not parsed from unit raw data. `AB_SKILL` damage exists but status resistance is incomplete.

### Target files

- `js/battle/BcuCombatModel.js`
- `js/battle/DamageAbilityResolver.js`
- `js/battle/bcu-runtime/BcuResistRuntime.js`
- trait compatibility files
- combo/orb/talent/treasure loader/model files once identified

### Required implementation

1. Extract holder source for every killer family from BCU references.
2. If holder comes from combo/orb/talent/treasure, implement that source path instead of adding fake CSV fields.
3. Implement actual BCU fruit/treasure/combo/orb/talent values or explicit config sources.
4. Remove or gate placeholder constants that make rows appear complete.
5. Add tests for attacker-side and defender-side multipliers separately.
6. Add curse/seal suppression tests for every family.

### Tests

- Parser/holder test for `AB_VKILL` or explicit partial blocker doc.
- Damage test for `AB_SKILL` including resistance side.
- Damage tests for `AB_GOOD`, `AB_MASSIVE`, `AB_RESIST`, `AB_RESISTS`, `AB_MASSIVES` with non-placeholder fruit/treasure source or explicit config.

### Code-complete criteria

- Resolver support plus real holder path plus external modifier source.
- Otherwise row stays `partial`.

## W9 — implement summon, spirit, and other blocked actor lifecycle systems only after field proof

### Current risk

Summon, spirit, burrow, delay, castle guard, and partial resistance are high-risk because they require lifecycle or owner state, not just damage math.

### Target files

To be decided after BCU source extraction. Do not guess.

### Required implementation

1. Identify exact BCU holder fields and runtime state machine.
2. Identify visual/effect mapping and bundle availability.
3. Identify interactions with target capture, damage, proc, death, knockback, base/castle, and cleanup.
4. Only then add runtime hooks.

### Code-complete criteria

- No lifecycle system is marked code-complete until field, runtime owner, visual owner, and tests are all proven.

### Current lifecycle addendum: death soul and warp

This pass implements two lifecycle rows because the task explicitly scoped them and local BCU references identify exact owners:

- Death soul animation: BCU refs `DataUnit.ints[67]`, `DataEnemy.ints[54]`, enemy fallback `ints[54] == -1 && ints[63] == 1 -> Soul 9`, `Entity.AnimManager.kill/draw/update`, `PackData.loadSoul`, `Soul`, and `DemonSoul`. Runtime: `BcuCombatModel.deathAnimation`, `BcuDeathAnimationRuntime`, `BattleBcuDeathAnimationRuntimePatch`, `BcuSoulEffectLoader`, and `effect:soul`. Evidence: `node scripts/check-bcu-death-animation-parity.mjs`, `node scripts/check-effect-bundle-aliases.mjs`, and `node scripts/check-effect-coordinate-traces.mjs`.
- Warp lifecycle: BCU refs `INT_WARP`, `Entity.AnimManager.kbAnim`, `Entity.KBManager.updateKB`, `WaprCont`, `A_W`, `A_W_C`, and Android `BattleBox` WaprCont offsets. Runtime: `BcuWarpLifecycleRuntime` and `BattleActorProcStatusPatch` lifecycle delegation. Evidence: `node scripts/check-bcu-warp-lifecycle-parity.mjs`, `node scripts/check-effect-bundle-aliases.mjs`, and `node scripts/check-effect-coordinate-traces.mjs`.

Both rows remain `human-visual-review-needed` after deterministic checks pass. Death surge is only partial beyond the BCU 21-frame soul trigger because full damage/capture ordering and mini-death-surge split are not fully audited.

## W10 — remove or gate redundant debug allocation without changing logic

### Current risk

Some performance patches suppress verbose traces but allocate debug objects while suppressing. Effect cleanup also writes global debug summaries every cleanup. These are safe optimization targets if behavior is untouched.

### Target files

- `js/battle/BattleProjectilePerformanceAndPositionPatch.js`
- `js/battle/EffectRuntime.js`
- any file writing large `globalThis.__BCU_*_DEBUG__` or `last*Debug` objects per frame

### Required implementation

1. Add a tiny helper such as `isBcuDebugEnabled()` if none exists.
2. Keep concise counters by default.
3. Write large debug objects only when debug is enabled.
4. Do not remove behavior-bearing events, effect creation, wrapper calls, or renderer metadata.
5. Do not change wave/surge smoke kind, offsets, layer, lifetime, or effect filtering.
6. Ensure `check-debug-allocation-guards.mjs` treats heavy examples/trace arrays as debug-only, not as a normal success condition.

### Tests

- `node scripts/check-debug-allocation-guards.mjs`
- Existing node checks for render/projection/tick order if available.

### Code-complete criteria

- Debug allocation reduced or gated.
- No gameplay/render path changed.

## Required final report format for Codex

Every implementation batch must end with:

```md
## Summary
- Rows moved to code-complete:
- Rows moved to human-visual-review-needed:
- Rows still partial:

## BCU references inspected
- files/classes/methods:

## Changed files
- code:
- tests:
- docs:
- generated assets:

## Verification
- command: result

## Remaining risks
- risk:
- reason:
- next action:
```

If a requested check cannot run because the repo lacks tooling, add the minimal script instead of skipping silently.
