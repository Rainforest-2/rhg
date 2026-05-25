# AGENTS.md

Repository-wide instructions for AI coding agents working on `rhgrive2/game`.

## Mission

Complete BCU parity for partially implemented battle logic and its visual effects. The current priority is not new UI polish. The priority is to make existing partial battle systems fully correct, with production runtime loading effects from ZIP bundles only.

Normal runtime must use `public/assets/bundles/**/*.zip`. Files under `public/assets/bcu/...` are build-time inputs only. Do not add production runtime fallback to loose raw assets.

## Mandatory evidence rule

Do not claim an effect is bundled unless the current checkout proves it with `unzip -l` on the actual ZIP. Builder source, old docs, and raw file existence are not enough.

An effect row is complete only when all are proven:

- BCU reference identifies the visual/effect and timing.
- The actual ZIP contains the required internal entries.
- The loader resolves those entries by bundle key and internal path.
- Runtime code calls the loader and spawns or attaches the visual at the correct battle event.
- Logic behavior and visual behavior are both documented.

If any item is missing, keep the row partial and document the blocker.

## First step for any effect work

Run an actual ZIP audit before editing runtime code:

- list `public/assets/bundles/effect/status-effects.zip`
- list `public/assets/bundles/effect/wave.zip`
- list `public/assets/bundles/effect/kbeff.zip`
- search the lists for status, wave, surge, blast, barrier, demon shield, warp, wave invalid, wave stop, wave guard, counter, summon, poison, curse, seal, metal killer, and attack-nullify entries

Create or update `docs/ability-logic/effect-zip-audit.md` with exact ZIP entry names copied from the audit. Include whether each entry is a stable runtime alias or only a copied source-style path.

## Bundle ownership

This section defines target ownership for new/verified entries. It is not evidence that an entry is currently present. Current presence must still be proven by `unzip -l`.

Use existing bundles unless a documented blocker proves a new bundle is required.

- `effect/status-effects.zip`: actor-anchored status/proc visuals such as stop, slow, weaken, strengthen, survive, attack-nullify, curse, seal, poison.
- `effect/wave.zip`: target bundle for BCU `org/battle/s*` skill and projectile effects, including wave, mini-wave, surge, mini-surge, blast, strong attack, metal killer, barrier, demon shield, warp, wave invalid, wave stop, wave guard, counter surge, and summon visuals.
- `effect/kbeff.zip`: target bundle for BCU `org/battle/a` hit, knockback, critical, smoke, and kbeff-style visuals.

Do not edit ZIP files by hand. Extend builder scripts, rebuild ZIPs, and commit rebuilt ZIPs plus generated manifest/index changes together.

Relevant builders:

- `scripts/build-bcu-status-effect-bundle.mjs`
- `scripts/build-bcu-wave-effect-bundle.mjs`
- `scripts/build-bcu-effect-bundle.mjs`
- `scripts/build-bcu-semantic-bundles.mjs`

If an effect bundle is required by production but not rebuilt by the semantic bundle flow, either integrate it into that flow or document why it remains separate.

## Partial rows to complete first

Complete these before lower-priority work. Complete both logic and effect wiring when local BCU references and local assets prove the behavior.

1. Demon shield and shield breaker: initialization, HP/max HP, regeneration, damage gate order, breaker probability, destruction/breaker/revive/idle visuals, actor placement, and verification.
2. Barrier and barrier breaker: HP gate, break/no-break behavior, breaker probability, passthrough rules, start/during/end/destruction/breaker visuals, side variants, placement, and verification.
3. Warp: proc timing, no-warp-on-knockback if BCU requires it, removed-from-field state, targetability/collision suppression, return timing/distance, entrance/exit/chara visuals, and verification.
4. Wave invalid, wave stopper, and wave guard: parse confirmed fields, guard wave and mini-wave damage/procs, stop propagation at the correct timing/position, show invalid/stop/guard visuals, and verify normal attacks are unaffected.
5. Surge and blast immunities: parse confirmed fields and guard every surge/blast damage path. Direct damage paths must not bypass guards.
6. Death surge: parse fields, trigger on death at BCU timing, use exact side/position/level/range/duration/source, and verify trigger/no-trigger cases.
7. Counter surge: parse holder fields, detect eligible incoming surge hits, generate counter surge at BCU timing/position, wire counter visual if BCU uses one, and prevent loops.
8. Curse/seal suppression: audit and complete suppression for every affected ability. Check strong/good, massive/massives, resist/resists, all killer families, beast hunter, metal killer, base destroyer, projectile/proc generation, and target defensive abilities. Do not suppress base damage unless BCU does.
9. Toxic direct damage guard: ensure toxic immunity blocks toxic damage/proc on every path. Remove any direct pending-damage bypass that avoids the damage guard. Do not invent enemy toxic immunity if BCU has no enemy field.
10. LD/omni/multi-hit audit: fix only confirmed gaps in range boundaries, base/castle capture, per-hit ability/proc data, hit timing, and proc order.

Rows such as summon, spirit, partial resistances, sage resistance, villain killer holder path, burrow, and delay must stay blocked unless exact BCU fields, runtime state/math, effect mapping, and JS hooks are confirmed.

## Reference policy

Before changing battle behavior, extract and inspect local references under `references/bcu/`, especially:

- `BCU_java_util_common.zip`
- `BCU_Android-master.zip`
- relevant Markdown files under `references/bcu/`

Use common/Android references as primary gameplay sources. PC code may help rendering/UI, but do not use it as the first source when common/Android answer the behavior.

Inspect relevant classes/methods such as `Data`, `DataUnit`, `DataEnemy`, `Entity`, `EUnit`, `EEnemy`, `AttackSimple`, `AttackWave`, `ContWaveDef`, `AttackVolcano`, `ContVolcano`, `AttackBlast`, `ContBlast`, and the effect mapping class.

## Core files to inspect before edits

Inspect relevant parts of:

- `js/main.js`
- `js/battle/BcuCombatModel.js`
- `js/battle/AbilityModel.js`
- `js/battle/BattleAttackProfile.js`
- `js/battle/BattleAttackResolver.js`
- `js/battle/DamageCalculator.js`
- `js/battle/DamageAbilityResolver.js`
- `js/battle/ProcResolver.js`
- `js/battle/BattleScene.js`
- `js/battle/BattleActor.js`
- `js/battle/BattleSceneProcApplyPatch.js`
- `js/battle/BattleSceneBcuProcRuntimePatch.js`
- `js/battle/BattleActorProcStatusPatch.js`
- `js/battle/BcuProcImmunityPatch.js`
- `js/battle/bcu-runtime/BcuDamageGuardRuntime.js`
- `js/battle/bcu-runtime/BcuImmunityRuntime.js`
- `js/battle/bcu-runtime/BcuProcRuntime.js`
- `js/battle/bcu-runtime/BcuStatusEffectSpec.js`
- `js/battle/bcu-runtime/BcuStatusEffectManager.js`
- `js/battle/BattleActorBarrierShieldPatch.js`
- `js/battle/BattleWaveRuntimePatch.js`
- `js/battle/BattleSurgeRuntimePatch.js`
- `js/battle/BattleBlastRuntimePatch.js`
- `js/battle/BattleWaveEffectLoader.js`
- `js/battle/EffectRuntime.js`
- effect builder scripts under `scripts/`
- generated manifests/inventories under `public/assets/generated/`

## Runtime safety

Preserve wrapper chains and import order unless BCU references prove a change is required. High-risk methods include:

- `BattleScene.prototype.queueAttackDamage`
- `BattleScene.prototype.runTickPhase`
- `BattleScene.prototype.resolveAttackHitEvent`
- `BattleScene.prototype.cleanupDead`
- `BattleActor.prototype.takeDamage`
- `BattleActor.prototype.resolvePostDamage`
- `BattleActor.prototype.tick`
- `BattleActor.applyBcuProc`
- `BattleAttackResolver.captureTargets`
- `DamageAbilityResolver.resolve`
- `ProcResolver.resolve`

If wrapping, capture the current method and call it with the same `this` and compatible arguments. Do not replace wrapper chains with direct calls.

## Documentation requirements

Update in the same commit as code/bundle work:

- `docs/ability-logic/fact-only-ability-parity-matrix.md`
- `docs/ability-logic/effect-zip-audit.md`

For completed rows, document BCU reference, source field, timing/numeric rule, JS parse location, runtime hook, visual identifier, ZIP path, exact ZIP internal entry, loader mapping, and verification result.

For incomplete rows, document the exact missing fact/hook/asset and why implementation would require guessing.

## Verification

Do not assume `package.json` or npm scripts exist.

Run `node --check` on every touched JS/MJS file. At minimum run checks for the core files touched in parser, resolver, runtime, loader, and builder changes.

For effect work, run the relevant builders and verify ZIP contents with `unzip -l` after rebuild. Commit code changes, builder changes, rebuilt ZIPs, generated manifest/index changes, docs, and any focused verification scripts together.

Final report must include completed rows, changed files, BCU references used, exact ZIP entries added or verified, runtime hooks changed, verification commands/results, remaining blockers, and whether browser visual verification was run.
