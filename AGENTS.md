# AGENTS.md

Repository-wide instructions for AI coding agents working on `rhgrive2/game`.

## Mission

Complete Battle Cats Ultimate (BCU) battle parity for `rhgrive2/game` using local BCU references, current JS runtime analysis, deterministic checks, ZIP-bundle evidence, and maintainable incremental changes.

The immediate implementation plan is in:

- `docs/ability-logic/bcu-parity-codex-workplan.md`

Treat that workplan as the concrete task list for moving current partial BCU ability/proc/effect rows toward `code-complete`.

## Status vocabulary

Use these statuses consistently in docs and final reports:

- `partial`: facts, implementation, tests, or bundle evidence are missing.
- `code-complete`: local BCU reference, JS parser/runtime implementation, ZIP evidence, deterministic tests, and coordinate/effect traces pass.
- `human-visual-review-needed`: code-complete for logic/effect wiring, but exact manual visual appearance has not been inspected by a human.
- `fully-complete`: code-complete evidence exists and a human/manual visual review has also been recorded.

Do not use bare `complete` ambiguously. Prefer `code-complete` or `fully-complete`.

## Codex verification boundary

Codex cannot perform manual browser visual inspection. Therefore:

- Do not require browser/manual visual verification before marking a row `code-complete`.
- For visual/effect rows, require deterministic coordinate/effect traces instead.
- If exact appearance still needs human judgment, mark the row `human-visual-review-needed`, not `partial`, provided code/bundle/runtime/test evidence is complete.
- If code evidence is missing, keep the row `partial`.

## Non-negotiable evidence rule

A row may be marked `code-complete` only when all applicable items are proven:

1. BCU source behavior is identified from local references under `references/bcu/`.
2. JS parser reads every required holder field for units, enemies, base/castle/stage objects, combo/orb/treasure/talent sources, and special target forms where applicable.
3. Numeric rule matches BCU: probability, frames, percent, distance, random range, rounding/truncation, level scaling, damage order, status overwrite, and suppression.
4. Runtime hook fires at the same logical battle phase and ordering point as BCU.
5. No alternate path bypasses damage/proc guards, immunity, barrier/shield, status suppression, projectile generation, death priority, or knockback priority.
6. Required visual/effect animation is loaded from production ZIP bundles, not raw loose assets.
7. Effect timing/position/direction/camera scale/layer/lifetime/phase are represented in deterministic debug traces.
8. Focused automated checks exist and pass.
9. Documentation records the BCU reference, JS hook, tests, ZIP entries, and remaining human visual review status.

Do not mark a row code-complete because it appears to work.

## Reference priority

Use sources in this order:

1. `references/bcu/BCU_java_util_common.zip`
2. `references/bcu/BCU_Android-master.zip`
3. Markdown under `references/bcu/`, especially `キャラクターの特殊性能_全文_リンク削除.md`
4. Current repository code and generated assets
5. PC source only as rendering/UI support when common/Android do not answer the question
6. Existing docs under `docs/ability-logic/` as historical notes, never as sole proof

Before behavior edits, extract local references if needed:

```bash
mkdir -p /tmp/bcu-ref
python3 - <<'PY'
import pathlib, shutil, zipfile
pairs = [
    ('references/bcu/BCU_java_util_common.zip', '/tmp/bcu-ref/common'),
    ('references/bcu/BCU_Android-master.zip', '/tmp/bcu-ref/android'),
]
for z, out in pairs:
    p = pathlib.Path(z)
    o = pathlib.Path(out)
    if o.exists():
        shutil.rmtree(o)
    o.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(p) as f:
        f.extractall(o)
    print('extracted', p, '->', o)
PY
```

Inspect relevant BCU classes/methods:

- `util/Data.java`: `AB_*`, `P_*`, `TRAIT_*`, `A_*`, proc constants, ability constants.
- `battle/data/DataUnit.java`: unit CSV columns and transforms.
- `battle/data/DataEnemy.java`: enemy CSV columns and transforms.
- `battle/entity/Entity.java`: `damaged`, `processProcs`, `postUpdate`, `updateProc`, `getAbi`, `getProc`, `AnimManager`.
- `battle/entity/EUnit.java`: unit damage intake/output, resistance, revive/soul interactions.
- `battle/entity/EEnemy.java`: enemy damage intake/output, kill, bounty, trait handling.
- `battle/attack/AttackSimple.java`: target capture, direct damage/proc, projectile spawn order.
- `battle/attack/AttackWave.java`, `ContWaveDef.java`: wave/mini-wave timing, range, stopper, visual.
- `battle/attack/AttackVolcano.java`, `ContVolcano.java`: surge/mini-surge timing, capture, proc update, visual phases.
- `battle/attack/AttackBlast.java`, `ContBlast.java`: blast ranges, frame bands, damage falloff, visual phases.
- BCU effect mapping class, especially `EffAnim`.

## Runtime asset rule

Production runtime must use ZIP bundles only:

- `public/assets/bundles/effect/status-effects.zip`
- `public/assets/bundles/effect/wave.zip`
- `public/assets/bundles/effect/kbeff.zip`
- other existing semantic bundles under `public/assets/bundles/**/*.zip`

Files under `public/assets/bcu/...` are build-time inputs only. Do not add production browser runtime fallback to loose raw assets.

If an effect is missing:

1. Extend the relevant builder.
2. Rebuild the ZIP.
3. Update generated manifests/inventories.
4. Verify entries with `unzip -l`.
5. Add or update deterministic loader/alias tests.

Never hand-edit ZIP contents.

## Required first task order

Follow `docs/ability-logic/bcu-parity-codex-workplan.md` in this order:

1. W0: proof harness scripts.
2. W1: projectile damage source model.
3. W2: `BcuResistRuntime` and partial resistance unification.
4. W3: `P_DELAY` runtime or documented proof blocker.
5. W4: burrow lifecycle.
6. W5: effect scale and coordinate model.
7. W6: blast visual position and phase wiring.
8. W7: barrier, demon shield, and guard family.
9. W8: `AB_SKILL`, `AB_VKILL`, and external modifier completeness.
10. W9: summon, spirit, and other blocked lifecycle systems only after field proof.
11. W10: redundant debug allocation cleanup without gameplay changes.

Do not jump to W3-W9 before W0 and W1 unless the task explicitly scopes a smaller isolated fix.

## Core files to inspect before edits

Inspect relevant parts of these files before changing battle behavior:

- `js/main.js`
- `js/battle/BcuCombatModel.js`
- `js/battle/AbilityModel.js`
- `js/battle/BcuTraitCompatibility.js`
- `js/battle/BattleAttackProfile.js`
- `js/battle/BattleAttackResolver.js`
- `js/battle/DamageCalculator.js`
- `js/battle/DamageAbilityResolver.js`
- `js/battle/ProcResolver.js`
- `js/battle/BattleScene.js`
- `js/battle/BattleActor.js`
- `js/battle/BattleSceneBcuAttackPhasePatch.js`
- `js/battle/BattleSceneProcApplyPatch.js`
- `js/battle/BattleSceneBcuProcRuntimePatch.js`
- `js/battle/BattleActorProcStatusPatch.js`
- `js/battle/BcuProcImmunityPatch.js`
- `js/battle/bcu-runtime/BcuDamageGuardRuntime.js`
- `js/battle/bcu-runtime/BcuImmunityRuntime.js`
- `js/battle/bcu-runtime/BcuProcRuntime.js`
- `js/battle/bcu-runtime/BcuResistRuntime.js`
- `js/battle/bcu-runtime/BcuStatusSnapshot.js`
- `js/battle/bcu-runtime/BcuStatusIconResolver.js`
- `js/battle/bcu-runtime/BcuStatusEffectSpec.js`
- `js/battle/bcu-runtime/BcuStatusEffectManager.js`
- `js/battle/bcu-runtime/BcuStatusEffectPositioner.js`
- `js/battle/BattleActorBarrierShieldPatch.js`
- `js/battle/BattleActorStrengthenLethalPatch.js`
- `js/battle/BattleActorZombieRevivePatch.js`
- `js/battle/BattleActorAttackNullifyPatch.js`
- `js/battle/BattleWaveRuntimePatch.js`
- `js/battle/BattleSurgeRuntimePatch.js`
- `js/battle/BattleBlastRuntimePatch.js`
- `js/battle/BattleBcuPriorityEffectRuntimePatch.js`
- `js/battle/BattleProcHitEffectPatch.js`
- `js/battle/BattleCriticalEffectPatch.js`
- `js/battle/BattleWaveEffectLoader.js`
- `js/battle/BcuWaveBundleEffectSpawner.js`
- `js/battle/BattleSceneRendererEffectGlowPatch.js`
- `js/battle/EffectRuntime.js`
- relevant builder scripts under `scripts/`
- generated manifests under `public/assets/generated/`

## Wrapper chain safety

Preserve wrapper chains and import order unless BCU references prove a deliberate change is required.

High-risk methods:

- `BattleScene.prototype.queueAttackDamage`
- `BattleScene.prototype.runTickPhase`
- `BattleScene.prototype.resolveAttackHitEvent`
- `BattleScene.prototype.captureHitTargets`
- `BattleScene.prototype.cleanupDead`
- `BattleActor.prototype.takeDamage`
- `BattleActor.prototype.resolvePostDamage`
- `BattleActor.prototype.tick`
- `BattleActor.applyBcuProc`
- `BattleAttackResolver.captureTargets`
- `DamageCalculator.calculate`
- `DamageAbilityResolver.resolve`
- `ProcResolver.resolve`

When wrapping:

1. Capture the current method.
2. Call it with the same `this` and compatible arguments.
3. Preserve return shape unless all callers are audited.
4. Use a unique `Symbol.for(...)` patch flag.
5. Avoid double application.
6. Do not skip previous wrappers.
7. Add deterministic tests or trace assertions if order matters.

## Critical known gaps to fix

### Projectile damage model

Wave, surge, and blast must not blindly reuse the first accepted direct hit's `finalDamage` as the projectile base. BCU projectile containers carry attack data and resolve damage per target. Implement an explicit projectile attack basis and prove strengthen/weaken/mini/falloff order from BCU references.

### Resistance model

`BcuResistRuntime` must not remain unresolved for supported rows. Centralize full immunity and partial resistance behavior so `BcuProcImmunityPatch` and proc application use one source of truth.

### Runtime-missing systems

Do not call these code-complete until field, runtime owner, and tests are proven:

- `P_DELAY`
- burrow
- summon
- spirit
- castle/base guard states
- partial resistance sources beyond proven fields

### Effect coordinate model

Stage/projectile effects require explicit scale and coordinate metadata. Do not rely on one generic `cameraScale * spriteScale * effect.scale` formula unless BCU proof says that is correct for that effect class. Add deterministic coordinate traces.

### Debug allocation cleanup

Reduce or gate per-frame debug object allocation only after behavior-bearing paths are protected by tests. Do not change rendering, damage, proc, or wrapper semantics for optimization alone.

## Required tests/checks

Prefer small deterministic Node scripts under `scripts/check-*.mjs`. Each script must exit nonzero on failure.

The workplan requires these scripts or equivalent:

- `scripts/check-bcu-parser-indexes.mjs`
- `scripts/check-projectile-damage-parity.mjs`
- `scripts/check-proc-immunity-resistance-parity.mjs`
- `scripts/check-effect-bundle-aliases.mjs`
- `scripts/check-effect-coordinate-traces.mjs`
- `scripts/check-debug-allocation-guards.mjs`

Run `node --check` on every touched JS/MJS file. Do not assume `package.json` exists.

For effect work, also run:

```bash
unzip -l public/assets/bundles/effect/status-effects.zip
unzip -l public/assets/bundles/effect/wave.zip
unzip -l public/assets/bundles/effect/kbeff.zip
```

Update `docs/ability-logic/effect-zip-audit.md` with exact entries when effect bundles change.

## Documentation requirements

Update in the same commit as code/bundle work:

- `docs/ability-logic/fact-only-ability-parity-matrix.md`
- `docs/ability-logic/effect-zip-audit.md` when effects/bundles change
- `docs/ability-logic/bcu-parity-codex-workplan.md` if the plan changes
- focused audit docs if added
- generated manifests/inventories if builders change them

For `code-complete` rows, document:

- BCU reference source
- holder field/index
- numeric rule
- JS parser
- JS runtime hook
- visual ID if any
- raw asset path if any
- ZIP path and exact internal entries if any
- loader alias if any
- spawn/attach call if any
- coordinate/effect trace if any
- test commands and results
- whether human visual review is still needed

For incomplete rows, document the exact missing fact/hook/asset/test and why implementation would require guessing.

## Naming discipline

Use stable names:

- `strengthen` for attack-up `P_STRONG` threshold status.
- `strongAttack` for `P_SATK` 渾身の一撃.
- `strong` for `AB_GOOD` めっぽう強い damage family.
- `weaken` for `P_WEAK` attack-down.
- `freeze` internally for `P_STOP`, but document as `P_STOP`.
- `toxic` internally for `P_POIATK`, but document as `P_POIATK`.
- `surge` internally for BCU volcano/烈波.
- `blast` for 爆波.
- `seal` only when BCU `P_SEAL` source is proven. Do not mix it with curse.

## Prohibited shortcuts

Do not:

- mark rows code-complete based on comments, old docs, or visual appearance only.
- invent missing CSV indexes.
- infer effect aliases without `unzip -l` and loader verification.
- add browser runtime fallback to raw `public/assets/bcu` files.
- bypass `DamageCalculator`, `DamageAbilityResolver`, `ProcResolver`, or guard runtime by direct HP mutation.
- replace wrapper chains without auditing import order and callers.
- hide uncertain behavior behind broad try/catch.
- silently change random behavior.
- collapse unit/enemy side behavior unless BCU proves it identical.
- conflate `strong`, `strongAttack`, and `strengthen`.
- classify approximate visual placement as `fully-complete`.

## Final report format

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

Never report done without command output or an explicit statement that a required verification could not run.
