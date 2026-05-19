# Target Proc And Buff Parity

## Objective

Implement a local, testable BCU parity slice for target-trait proc compatibility, target-only capture, status overwrite, strengthen, and lethal-survive using the existing status-effect attachment pipeline.

## Exact User Scope

Follow repository `AGENTS.md` and advance ability logic implementation, starting with features that do not require a new renderer/runtime system. Treat attack-up/strengthen and survive/lethal-survive as positive buffs anchored to the affected actor, not as enemy debuffs.

## Non-Goals

This patch does not implement blast runtime, summon, burrow movement, full counter-surge behavior, broad renderer rewrites, full partial/smart proc resistances, or complete BCU parity.

## References Inspected

- `references/bcu/BCU_java_util_common.zip`
  - `battle/attack/AttackSimple.java`: `capture`, `excuse`
  - `battle/attack/AttackWave.java`: `capture`, `excuse`
  - `battle/attack/AttackVolcano.java`: `excuse`
  - `battle/attack/AttackAb.java`: `process`
  - `battle/entity/Entity.java`: `AnimManager.drawEff`, `AnimManager.getEff`, `processProcs`, `postUpdate`, `getAbi`, `getProc`, `checkTouch`, `traitCompatible`, `updateProc`
  - `battle/entity/ECastle.java`: `traitCompatible`
  - `util/Data.java`: `AB_ONLY`, `P_STOP`, `P_SLOW`, `P_WEAK`, `P_CURSE`, `P_SEAL`, `P_STRONG`, `P_LETHAL`, `P_BOUNTY`, `procSharable`
- `references/bcu/BCU_Android-master.zip`
  - `app/src/main/res/values-ja/strings.xml`: `eff_surv`, `eff_surve`, `eff_imwv`, `eff_imwve`
- Markdown inspected:
  - `references/bcu/キャラクターの特殊性能_全文_リンク削除.md`
  - Sections around `attack_down`, `slow`, and `survive`

## Current JS Files Inspected

- `js/main.js`
- `js/battle/BcuCombatModel.js`
- `js/battle/AbilityModel.js`
- `js/battle/BattleAttackProfile.js`
- `js/battle/BattleAttackResolver.js`
- `js/battle/DamageCalculator.js`
- `js/battle/DamageAbilityResolver.js`
- `js/battle/ProcResolver.js`
- `js/battle/BattleSceneProcApplyPatch.js`
- `js/battle/BattleActorProcStatusPatch.js`
- `js/battle/BcuProcImmunityPatch.js`
- `js/battle/BattleActorZombieRevivePatch.js`
- `js/battle/BattleWaveRuntimePatch.js`
- `js/battle/BattleSurgeRuntimePatch.js`
- `js/battle/BattleBaseProjectileProcPatch.js`
- `js/battle/KBRuntime.js`
- `js/battle/BattleDeterministicRandomPatch.js`
- `js/battle/bcu-runtime/BcuStatusSnapshot.js`
- `js/battle/bcu-runtime/BcuStatusIconResolver.js`
- `js/battle/bcu-runtime/BcuStatusEffectManager.js`
- `js/battle/bcu-runtime/BcuStatusEffectPositioner.js`
- `js/battle/bcu-runtime/BcuStatusEffectSpec.js`
- `scripts/build-bcu-status-effect-bundle.mjs`

## Current `js/main.js` Import Order For Touched Patches

The current relevant order is `BattleActorBcuKbTargetPatch`, `BattleActorProcStatusPatch`, `BattleActorBarrierShieldPatch`, `BattleSoulstrikePatch`, `BattleDeterministicRandomPatch`, wave/surge/base projectile patches, `BattleSceneProcApplyPatch`, status icon/effect render patches, `BcuKnockbackRuntimePatch`, `BcuKnockbackProcPriorityPatch`, `BattleActorZombieRevivePatch`, `BcuProcImmunityPatch`. The selected patch adds strengthen/lethal after knockback priority and before zombie revive so lethal-survive can prevent zombie revive from seeing a death.

## Wrapper Chain For Touched Methods

- `BattleScene.prototype.queueAttackDamage`: existing deterministic RNG wrapper remains; it now records the scene RNG on actor targets for later defender-side post-damage procs.
- `BattleAttackResolver.captureTargets`: direct method edit, no wrapper.
- `DamageCalculator.calculate`: direct method edit; deterministic RNG bridge still wraps the static method.
- `BattleActor.prototype.applyBcuProc`: installed by `BattleActorProcStatusPatch`, then wrapped by `BcuProcImmunityPatch`.
- `BattleActor.prototype.tick`: wrapped by `BattleActorProcStatusPatch`.
- `BattleActor.prototype.resolvePostDamage`: base method, replaced by `BcuKnockbackRuntimePatch`, then wrapped by the new strengthen/lethal patch, then by zombie revive.

## Data Flow

- Attack capture: `BattleScene.resolveAttackHitEvent` calls `BattleAttackResolver.captureTargets`; target-only now filters actor candidates through BCU-style trait compatibility and still allows base candidates.
- Damage calculation: `BattleScene.queueAttackDamage` calls `DamageCalculator.calculate`; attacker strengthen is applied to base attack before weaken, then `DamageAbilityResolver` handles damage ability multipliers.
- Proc resolution: `DamageCalculator.calculate` calls `ProcResolver.resolve`; actor-targeted status/proc candidates now skip incompatible target traits before probability rolls.
- Proc application: `BattleSceneProcApplyPatch` forwards already-rolled proc items to `BattleActor.applyBcuProc`; no new second roll is added.
- Status visualization: `BcuStatusSnapshot` exposes STOP/SLOW/WEAK/CURSE/SEAL/POISON plus STRONG/LETHAL; `BcuStatusIconResolver` maps them to existing bundle effect keys anchored on the affected actor.
- Post-damage resolution: `KBRuntime.resolvePostDamage` calls the actor method; the new patch converts a lethal death result to 1 HP with knockback when the one-time survive roll succeeds, then activates strengthen once HP is under the threshold.

## Asset Bundle Paths

Inspected existing bundle:

- `public/assets/bundles/effect/status-effects.zip`
- `public/assets/generated/bcu-status-effect-inventory.json`
- `public/assets/generated/bcu-bundle-manifest.json`

Internal paths already used by runtime include `A_DOWN/image.png`, `A_DOWN/model.mamodel`, and `A_DOWN/DEF.maanim`. This patch extends the same bundle with:

- `A_UP/image.png`, `A_UP/imgcut.imgcut`, `A_UP/model.mamodel`, `A_UP/DEF.maanim`
- `A_E_UP/image.png`, `A_E_UP/imgcut.imgcut`, `A_E_UP/model.mamodel`, `A_E_UP/DEF.maanim`
- `A_SHIELD/image.png`, `A_SHIELD/imgcut.imgcut`, `A_SHIELD/model.mamodel`, `A_SHIELD/DEF.maanim`
- `A_E_SHIELD/image.png`, `A_E_SHIELD/imgcut.imgcut`, `A_E_SHIELD/model.mamodel`, `A_E_SHIELD/DEF.maanim`

## In Scope

- Target trait compatibility for actor-targeted proc application.
- Target-only capture filtering.
- Status overwrite semantics for freeze/slow/weaken/curse/seal.
- Strengthen attack-up activation and damage multiplier.
- Lethal survive one-time post-damage behavior.
- Friendly buff icons using the existing actor-anchored status-effect display.
- Death surge separation from ordinary attack surge rolls.

## Deferred

- Full blast runtime and immunity.
- Counter-surge emitter parity.
- Summon.
- Burrow movement.
- Full partial/smart resistance math.
- New actor animation systems.

## Current Observed JS Behavior

- `ProcResolver` rolls candidates from semantic flags and probability without checking target traits.
- `BattleAttackResolver.captureTargets` does not filter actor candidates for `targetOnly`.
- Status reapplication uses max-duration semantics.
- `ProcResolver` treats `deathSurge` probability as ordinary `surge`.
- Strengthen and lethal survive are parsed but not applied as post-damage state/damage behavior.
- Status bundle contains down/slow/stop/curse/seal/poison, but not up/shield entries.

## Reference Behavior

- `AttackSimple.capture` and `AttackWave.capture` apply `AB_ONLY` by keeping only `traitCompatible` targets; `ECastle.traitCompatible` returns true.
- `Entity.processProcs` exits before applying proc statuses unless `traitCompatible` or special poison target paths pass.
- `Entity.processProcs` assigns STOP/SLOW/CURSE/SEAL durations directly for normal positive durations; WEAK goes through `WeakToken`.
- `Entity.postUpdate` activates `P_STRONG` once HP is at/below threshold and later attack execution adds `atk * status[P_STRONG][0] / 100`.
- `Entity.postUpdate` handles `P_LETHAL` after HP reaches zero, rolls once, sets HP to 1 on success, shows `P_LETHAL`, and increments the one-time marker.
- `Entity.AnimManager.getEff(P_STRONG)` uses `A_UP`/`A_E_UP`; `getEff(P_LETHAL)` uses `A_SHIELD`/`A_E_SHIELD`.

## Selected Implementation Plan

1. Add a small shared BCU trait compatibility helper.
2. Use it in capture and proc resolution without changing proc payload shape.
3. Replace max-duration state reapplication with direct overwrite for normal status procs.
4. Apply strengthen in `DamageCalculator` and activate it after damage resolution.
5. Apply lethal survive in a post-knockback wrapper before zombie revive.
6. Extend status effect specs, rebuild the existing status effect bundle, and route STRONG/LETHAL through the current actor-anchored status icon renderer.

## Rejected Ideas

- Reusing damage resolver private trait helpers from `DamageAbilityResolver`: risky because they are not exported and would couple proc/capture logic to damage-only details.
- Adding a second buff bundle: rejected because the existing effect status bundle already supports actor-attached icons.
- Rolling lethal with raw `Math.random()`: rejected because battle logic already has a scene RNG; the deterministic patch will expose it to actor post-damage logic.

## Invariants

- No duplicate proc roll or duplicate proc application.
- Target compatibility is checked before probability rolls for actor-targeted procs.
- Bases are not treated as normal actors for proc application.
- Existing wrapper chains are preserved.
- Buff and debuff visuals share the same affected-actor status attachment path.
- Normal runtime loads ability/status assets from `effect:status`, not loose raw paths.

## Static Verification Plan

- `node --check` every changed JS module and changed script.
- Rebuild `public/assets/bundles/effect/status-effects.zip` with `scripts/build-bcu-status-effect-bundle.mjs`.
- Inspect rebuilt ZIP contents for the added internal paths.
- Run existing status-effect smoke check if local dependencies allow it.

## Executable Local Checks And Results

- `node --check js/battle/BcuTraitCompatibility.js`: passed.
- `node --check js/battle/ProcResolver.js`: passed.
- `node --check js/battle/BattleAttackResolver.js`: passed.
- `node --check js/battle/BattleActorProcStatusPatch.js`: passed.
- `node --check js/battle/DamageCalculator.js`: passed.
- `node --check js/battle/BattleActorStrengthenLethalPatch.js`: passed.
- `node --check js/battle/BattleDeterministicRandomPatch.js`: passed.
- `node --check js/battle/bcu-runtime/BcuStatusSnapshot.js`: passed.
- `node --check js/battle/bcu-runtime/BcuStatusIconResolver.js`: passed.
- `node --check js/battle/bcu-runtime/BcuStatusEffectSpec.js`: passed.
- `node --check js/main.js`: passed.
- `node --check js/battle/BattleScene.js`: passed.
- `node --check scripts/build-bcu-status-effect-bundle.mjs`: passed.
- `node --check scripts/check-ability-model.mjs`: passed.
- `node --check scripts/check-damage-ability-resolver.mjs`: passed.
- `node scripts/build-bcu-status-effect-bundle.mjs`: passed; rewrote `public/assets/bundles/effect/status-effects.zip` and `public/assets/generated/bcu-status-effect-inventory.json`.
- ZIP inspection found all 16 expected new entries under `A_UP`, `A_E_UP`, `A_SHIELD`, and `A_E_SHIELD`.
- `node scripts/smoke-bcu-status-effects.mjs`: passed.
- `node scripts/check-ability-model.mjs`: passed after updating the check to the current `ProcResolver.v3-bcu-proc-roll-contract`.
- `node scripts/check-damage-ability-resolver.mjs`: passed after updating the stale check to assert current BCU damage resolver behavior.
- `node scripts/check-damage-calculator.mjs`: passed.
- `node scripts/check-bundled-assets-never-load-raw.mjs`: passed.
- Inline ProcResolver check: red target applied one freeze proc; black target applied zero and skipped with `target-trait-incompatible`.
- Inline BattleAttackResolver check: `targetOnly` range capture returned only the compatible red actor.
- Inline status overwrite check: freeze 100 frames followed by freeze 10 frames left `framesRemaining: 10`.
- Inline strengthen/lethal check: strengthen doubled 10 damage to 20 after threshold activation; lethal survive left actor at 1 HP with no death pending.
- No package manager manifest was present at repo root, so no package-script test suite was available.

## Validation Limits

No browser/manual test is requested. This pass validates static behavior and bundle contents; frame-perfect animation timing of the new buff icons remains limited to existing status-effect renderer behavior.

## Rollback Plan

Revert the helper, resolver/capture/status/damage/post-damage patches, remove the new `js/main.js` import, restore `BcuStatusEffectSpec.js`, and rebuild the status-effect bundle to remove `A_UP`, `A_E_UP`, `A_SHIELD`, and `A_E_SHIELD`.
