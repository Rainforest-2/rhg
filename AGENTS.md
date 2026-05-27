# AGENTS.md

Repository-wide instructions for AI coding agents working on `rhgrive2/game`.

This repository is implementing browser/runtime parity with Battle Cats Ultimate (BCU). The current objective is not feature expansion or UI polish. The objective is to turn every `partial` BCU battle ability, proc, and effect row into `complete` only when the implementation is proven by local BCU reference code, local asset evidence, runtime wiring, deterministic verification, and browser visual verification where visuals are involved.

## Non-negotiable mission

Make battle logic and battle visuals BCU-equivalent.

A row may be marked `complete` only when all of the following are true:

1. The BCU source behavior is identified from local references under `references/bcu/`.
2. The JS parser reads every required holder field for units, enemies, stage/base/castle objects, combo/orb/treasure/talent sources, and special target forms where applicable.
3. The numeric rule matches BCU: probability, frames, percent, distance, random range, rounding/truncation, level scaling, damage order, status overwrite rules, and suppression rules.
4. The runtime hook fires at the same battle phase and ordering point as BCU.
5. No alternate path bypasses damage/proc guards, immunity, barrier/shield, status suppression, projectile generation, death priority, or knockback priority.
6. Required visual/effect animation is loaded from a production ZIP bundle, not raw loose assets.
7. Effect spawn timing, position, direction, camera scale, layer, lifetime, phase, and sound trigger are proven equivalent or documented with a measured accepted delta.
8. Focused automated verification exists and passes.
9. Manual browser visual verification is run for visuals, or the row remains `partial` with an explicit blocker.

Do not mark a row complete because it appears implemented. Completeness requires evidence.

## Hard runtime asset rule

Production runtime must use ZIP bundles only:

- `public/assets/bundles/effect/status-effects.zip`
- `public/assets/bundles/effect/wave.zip`
- `public/assets/bundles/effect/kbeff.zip`
- other existing semantic bundles under `public/assets/bundles/**/*.zip`

Files under `public/assets/bcu/...` are build-time inputs only. Do not add production fallback from browser runtime to loose raw assets. If an effect is missing, extend the relevant builder, rebuild the ZIP, update generated manifests/inventories, and verify with `unzip -l`.

Never hand-edit ZIP contents.

## Evidence hierarchy

Use this priority order for facts:

1. Local BCU common Java source from `references/bcu/BCU_java_util_common.zip`.
2. Local BCU Android source/assets from `references/bcu/BCU_Android-master.zip`.
3. Local reference Markdown under `references/bcu/`, especially `キャラクターの特殊性能_全文_リンク削除.md`.
4. Current repository source and generated assets.
5. PC source only as rendering/UI support when common/Android do not answer the behavior.
6. Existing docs in `docs/ability-logic/` as historical notes, never as sole proof.

Old documentation, raw asset existence, builder source, or comments are not sufficient proof by themselves.

## Required first steps for any parity task

Before editing behavior:

1. Identify the exact ability/proc/effect row being changed.
2. Extract local BCU references if they are not already extracted.
3. Inspect the relevant BCU source methods and constants.
4. Inspect the current JS parser/runtime/effect loader path.
5. Write down the specific gap being closed.
6. Add or update tests before broad refactoring.
7. Keep changes narrow.

Use commands like these from the repository root:

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

Then search BCU references with focused queries:

```bash
rg -n "P_STRONG|P_WEAK|P_WARP|P_BLAST|P_VOLC|P_BARRIER|P_DEMONSHIELD|P_DELAY|AB_CSUR|AB_WAVES|AB_GOOD|AB_MASSIVE|AB_RESIST|AB_SKILL|AB_VKILL|BSTHUNT" /tmp/bcu-ref/common /tmp/bcu-ref/android
rg -n "class Entity|void damaged|getDamage|processProcs|postUpdate|updateProc|AttackSimple|ContWaveDef|ContVolcano|ContBlast|EffAnim" /tmp/bcu-ref/common /tmp/bcu-ref/android
```

## BCU classes that must be inspected for battle parity

For behavior changes, inspect the relevant classes/methods. Do not rely on names alone.

- `util/Data.java`: `AB_*`, `P_*`, `TRAIT_*`, `A_*`, proc constants, ability constants.
- `battle/data/DataUnit.java`: unit CSV columns and transformations.
- `battle/data/DataEnemy.java`: enemy CSV columns and transformations.
- `battle/entity/Entity.java`: `damaged`, `processProcs`, `postUpdate`, `updateProc`, `getAbi`, `getProc`, `AnimManager`.
- `battle/entity/EUnit.java`: unit damage intake/output, resistance, revive/soul interactions.
- `battle/entity/EEnemy.java`: enemy damage intake/output, kill, bounty, trait handling.
- `battle/attack/AttackSimple.java`: target capture, direct damage/proc, projectile spawn order.
- `battle/attack/AttackWave.java` and `ContWaveDef.java`: wave/mini-wave timing, range, stopper, visual.
- `battle/attack/AttackVolcano.java` and `ContVolcano.java`: surge/mini-surge timing, capture, proc update, visual phases.
- `battle/attack/AttackBlast.java` and `ContBlast.java`: blast ranges, frame bands, damage falloff, visual phases.
- BCU effect mapping class, especially `EffAnim`: `A_*` IDs to raw paths and phases.
- Android raw proc text JSON for human-facing descriptions only, not primary runtime behavior.

## Current JS files to inspect before edits

Inspect only relevant files, but do not modify behavior blindly. Common files:

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
- `js/battle/BattleActorProcStatusPatch.js`
- `js/battle/BattleActorBarrierShieldPatch.js`
- `js/battle/BattleActorStrengthenLethalPatch.js`
- `js/battle/BattleActorZombieRevivePatch.js`
- `js/battle/BattleActorAttackNullifyPatch.js`
- `js/battle/BattleSceneProcApplyPatch.js`
- `js/battle/BattleSceneBcuProcRuntimePatch.js`
- `js/battle/BattleSceneBcuAttackPhasePatch.js`
- `js/battle/BcuProcImmunityPatch.js`
- `js/battle/BattleWaveRuntimePatch.js`
- `js/battle/BattleSurgeRuntimePatch.js`
- `js/battle/BattleBlastRuntimePatch.js`
- `js/battle/BattleBcuPriorityEffectRuntimePatch.js`
- `js/battle/BattleProcHitEffectPatch.js`
- `js/battle/BattleCriticalEffectPatch.js`
- `js/battle/BattleWaveEffectLoader.js`
- `js/battle/BcuWaveBundleEffectSpawner.js`
- `js/battle/EffectRuntime.js`
- `js/battle/bcu-runtime/BcuDamageGuardRuntime.js`
- `js/battle/bcu-runtime/BcuImmunityRuntime.js`
- `js/battle/bcu-runtime/BcuProcRuntime.js`
- `js/battle/bcu-runtime/BcuResistRuntime.js`
- `js/battle/bcu-runtime/BcuStatusSnapshot.js`
- `js/battle/bcu-runtime/BcuStatusIconResolver.js`
- `js/battle/bcu-runtime/BcuStatusEffectSpec.js`
- `js/battle/bcu-runtime/BcuStatusEffectManager.js`
- `js/battle/bcu-runtime/BcuStatusEffectPositioner.js`
- `scripts/build-bcu-status-effect-bundle.mjs`
- `scripts/build-bcu-wave-effect-bundle.mjs`
- `scripts/build-bcu-effect-bundle.mjs`
- generated manifests under `public/assets/generated/`

## Wrapper chain safety

Preserve wrapper chains and import order unless BCU proof requires a deliberate redesign.

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

When wrapping a method:

1. Capture the current method.
2. Call it with the same `this` and compatible arguments.
3. Preserve return shape unless all callers are audited.
4. Add a unique `Symbol.for(...)` patch flag.
5. Avoid double application.
6. Record debug metadata without changing gameplay semantics.
7. Do not skip previous wrappers.

If wrapper order is part of BCU parity, add a focused test or trace assertion.

## Definition of complete for logic rows

A logic row is complete only when these facts are recorded in `docs/ability-logic/fact-only-ability-parity-matrix.md`:

- BCU holder source: class, field/index, value transform.
- JS parse location and field name.
- Runtime hook location.
- Trigger phase and order relative to damage, proc, knockback, death, barrier, shield, and projectile generation.
- Probability and RNG source.
- Duration conversion: frames vs milliseconds.
- Rounding/truncation rule.
- Damage multiplication/addition order.
- Suppression rules under curse/seal/immunity/barrier/shield.
- Trait compatibility / target form rule.
- Interaction with base/castle and actor targets.
- Regression tests and commands run.

If any field is unknown, the row remains `partial`.

## Definition of complete for visual/effect rows

A visual/effect row is complete only when these facts are proven:

- BCU effect ID, for example `A_UP`, `A_E_UP`, `A_IMUATK`, `A_BLAST`, `A_E_BLAST`, `A_COUNTERSURGE`.
- BCU raw path from the effect mapping source.
- Builder script that copies the asset.
- Actual ZIP file containing the runtime entries.
- Exact internal ZIP entry names from `unzip -l`.
- Loader alias and loader result shape.
- Runtime spawn/attach call.
- Effect phase names, if phased.
- Frame count / `maxFrame` / duration.
- Spawn frame relative to battle logic.
- X/Y coordinate formula.
- Direction / flip rule.
- Camera scale rule.
- Actor/base/world layer rule.
- Sound trigger if BCU has one.
- Browser visual verification result.

If visual placement is approximate, document the measured delta and keep the row `partial` unless the delta is intentional and accepted.

## Required ZIP audit for effect work

Before effect runtime work and after rebuilding bundles:

```bash
mkdir -p docs/ability-logic
{
  echo '# Effect ZIP audit'
  echo
  date -u '+Generated: %Y-%m-%dT%H:%M:%SZ'
  echo
  for z in \
    public/assets/bundles/effect/status-effects.zip \
    public/assets/bundles/effect/wave.zip \
    public/assets/bundles/effect/kbeff.zip
  do
    echo "## $z"
    if [ -f "$z" ]; then
      unzip -l "$z"
    else
      echo 'MISSING'
    fi
    echo
  done
} > docs/ability-logic/effect-zip-audit.md
```

Then search exact entries:

```bash
unzip -l public/assets/bundles/effect/status-effects.zip | rg "A_UP|A_E_UP|A_DOWN|A_E_DOWN|A_STOP|A_E_STOP|A_SLOW|A_E_SLOW|A_IMUATK|A_SHIELD|A_E_SHIELD|A_CURSE|A_E_CURSE|A_SEAL|A_E_SEAL|A_POISON"
unzip -l public/assets/bundles/effect/wave.zip | rg "wave|mini|surge|volc|blast|barrier|shield|warp|invalid|stop|guard|counter|summon|metal|strong"
unzip -l public/assets/bundles/effect/kbeff.zip | rg "critical|crit|kb|smoke|hit"
```

Update `docs/ability-logic/effect-zip-audit.md` with exact ZIP entry names copied from the audit. Include whether each entry is a stable runtime alias or only a copied source-style path.

## Bundle ownership

This section defines target ownership for verified entries. It is not evidence that an entry is currently present. Current presence must still be proven by `unzip -l`.

Use existing bundles unless a documented blocker proves a new bundle is required.

- `effect/status-effects.zip`: actor-anchored status/proc visuals such as stop, slow, weaken, strengthen, survive, attack-nullify, curse, seal, poison.
- `effect/wave.zip`: BCU `org/battle/s*` skill and projectile effects, including wave, mini-wave, surge, mini-surge, blast, strong attack, metal killer, barrier, demon shield, warp, wave invalid, wave stop, wave guard, counter surge, summon, and priority effects.
- `effect/kbeff.zip`: BCU `org/battle/a` hit, knockback, critical, smoke, and kbeff-style visuals.

Do not edit ZIP files by hand. Extend builder scripts, rebuild ZIPs, and commit rebuilt ZIPs plus generated manifest/index changes together.

## Completion roadmap

The fastest path to many complete rows is to close whole families, not isolated symptoms.

### P0 — build the proof harness first

Before moving many rows to complete, add deterministic verification for:

1. Parser field/index fixtures for unit and enemy raw CSV arrays.
2. Damage/proc calculation fixtures with deterministic RNG.
3. Runtime guard fixtures for normal, wave, mini-wave, surge, mini-surge, blast, toxic, barrier, and shield damage.
4. Effect ZIP and loader alias fixtures.
5. Coordinate trace helpers for status, projectile, barrier, shield, warp, invalid, stop, and counter-surge effects.
6. Browser visual debug output for effect placement and phase timing.

A row cannot become complete if no focused verification can fail when it regresses.

### P1 — parser and source completeness

Complete parser coverage before runtime polish. For every ability/proc row:

1. Verify unit and enemy indexes from BCU `DataUnit`/`DataEnemy`.
2. Verify `/4` distance transforms and any frame/unit transforms.
3. Verify min/max/random range semantics.
4. Verify target trait and target form source.
5. Verify combo/orb/talent/treasure inputs, or document the row as partial.
6. Add focused parser tests.

Do not invent missing fields. If BCU has no enemy field, document that and do not create one.

### P2 — barrier, demon shield, and base/castle guard family

Rows:

- `P_BARRIER`
- `P_BREAK`
- `P_DEMONSHIELD`
- `P_SHIELDBREAK`
- wave guard / castle guard / base guard where applicable

Required fixes/audits:

1. Confirm barrier initialization and max HP from BCU.
2. Confirm barrier vs demon shield gate order.
3. Confirm breaker probability and whether damage passes through.
4. Confirm insufficient damage behavior: block damage and procs, break only when BCU breaks.
5. Confirm demon shield HP, max HP, half/full state, destruction, breaker, and regeneration.
6. Confirm shield regeneration timing on HP knockback, not arbitrary visual frame.
7. Confirm base/castle guard states and visual placement before marking base/castle rows complete.
8. Verify all visuals: idle/full/half/destruction/breaker/revive/guard.
9. Add strict numeric and visual trace tests.

### P3 — projectile family

Rows:

- `P_WAVE`
- `P_MINIWAVE`
- `AB_WAVES`
- `P_IMUWAVE`
- `P_VOLC`
- `P_MINIVOLC`
- `P_IMUVOLC`
- `P_DEATHSURGE`
- `AB_CSUR`
- `P_BLAST`
- `P_IMUBLAST`

Required fixes/audits:

1. Confirm spawn timing from BCU attack containers.
2. Confirm wave constants, mini-wave damage, next-wave propagation, stopper timing, and stopper visual.
3. Confirm surge random range, point-position capture, interval, `vcapt`, alive time, and phase effects.
4. Confirm death surge timing relative to death, lethal, zombie revive, and cleanup.
5. Confirm counter surge trigger, foreswing, damage source, range, non-looping rule, and visual.
6. Confirm blast center, half-width, shift, 10/20/30 frame bands, 100/70/40 damage falloff, 44 frame lifetime, and capture range semantics.
7. Confirm invalid/stop/counter visuals spawn at BCU frame, coordinate, direction, layer, and scale.
8. Ensure every projectile damage path enters the damage guard before HP mutation or proc application.

If one projectile runtime is corrected, update all related tests because these systems share `queueAttackDamage` and `runTickPhase` wrappers.

### P4 — warp, toxic, curse, seal, and attack-nullify family

Rows:

- `P_WARP`
- `P_POIATK`
- `IMUPOIATK`
- `P_CURSE`
- `P_SEAL`
- `P_IMUATK`
- `P_BSTHUNT` attack-nullify branch

Required fixes/audits:

1. Prove warp no-knockback behavior and apply or document exact BCU order.
2. Use BCU animation length for warp enter/exit timing.
3. Verify warp hidden/untargetable/untouchable/unrenderable states.
4. Verify final displacement formula, direction, and bounds.
5. Ensure toxic damage always uses guarded `takeDamage`, never direct HP mutation.
6. Verify poison/toxic immunity, including whether enemies have an actual BCU source field.
7. Complete curse/seal proc suppression matrix from BCU `getProc` behavior.
8. Verify `P_IMUATK` and `P_BSTHUNT` nullify duration/status decrement and attribute gating.
9. Verify `A_IMUATK`, poison, curse, seal, and warp visuals with exact anchors.

### P5 — damage ability family with external modifiers

Rows:

- `AB_GOOD`
- `AB_RESIST`
- `AB_RESISTS`
- `AB_MASSIVE`
- `AB_MASSIVES`
- `AB_BAKILL`
- `P_BSTHUNT` damage branch
- `AB_SKILL`
- `AB_VKILL`
- `AB_WKILL`
- `AB_EKILL`

Required fixes/audits:

1. Implement or explicitly model BCU treasure/fruit values; do not keep fixed placeholder constants for complete rows.
2. Implement combo/orb/talent modifiers if BCU applies them to the row.
3. Confirm holder source for every killer family.
4. Confirm custom targetForms and pack traits.
5. Confirm attacker-side and defender-side rules separately.
6. Confirm curse/seal suppression and exceptions.
7. Implement sage status resistance/bypass before marking `AB_SKILL` complete.
8. Resolve villain killer holder path; do not mark `AB_VKILL` complete until holder parsing is proven.

Rows in this family should remain partial until external modifier sources are real, tested, and documented.

### P6 — attack capture family

Rows:

- `AB_ONLY`
- LD / long-distance attack
- omni / all-direction attack
- multi-hit attack
- base/castle capture rules
- corpse/soulstrike target rules

Required fixes/audits:

1. Compare JS `BattleAttackProfile` and `BattleAttackResolver` against BCU `DataAtk` and `AttackSimple.capture`.
2. Verify each hit has the correct damage, ability, proc, rawAbi, target mode, and timing.
3. Verify base capture when actors are out of range or filtered by `AB_ONLY`.
4. Verify corpse targeting with soulstrike and zombie revive.
5. Verify per-hit proc generation and no shared mutable event bugs.
6. Add deterministic fixtures for every attack-shape edge.

### P7 — currently blocked domains

Do not implement these by guessing. They need exact BCU field and lifecycle mapping first:

- full summon actor/effect runtime
- full spirit actor/runtime identity
- burrow movement lifecycle
- delay/lethargy runtime
- castle guard / castle barrier / base guard parity
- partial resistance system beyond known full immunity

Required before implementation:

1. Identify BCU holder fields.
2. Identify runtime state machine.
3. Identify visual/effect mapping.
4. Identify interaction with damage/proc/death/knockback.
5. Add fixtures and a browser trace scenario.

## Numeric parity rules

Follow BCU math exactly. Do not simplify.

- Use integer truncation where BCU uses integer arithmetic.
- Preserve percent semantics: `mult` may mean remaining damage, added damage, chance, resistance, or HP percent depending on context.
- Preserve frame units. Convert to milliseconds only at the boundary needed by browser runtime.
- Distances from CSV may require `/4`; prove each field from `DataUnit`/`DataEnemy`.
- Random ranges may be inclusive or exclusive. Prove each with BCU code.
- Damage order matters. Do not reorder strengthen, weaken, strong/massive/resist, base destroyer, critical, metal, metal killer, barrier/shield, toxic, or projectile generation without proof.
- BCU target capture may use actor point position or body width depending on attack type. Prove each type.

If a numeric rule is unknown, keep the row partial.

## Visual coordinate parity rules

For every effect, document and verify:

- world coordinate source: attacker pos, target pos, base pos, projectile center, screen anchor, or actor origin.
- camera projection function.
- X offset.
- Y offset.
- actor side / direction / `dire`.
- whether unit side is mirrored.
- camera scale vs actor scale.
- layer and draw order.
- phase start frame.
- phase duration.
- whether model internal offsets carry the visible displacement.

Status effects should generally follow BCU `Entity.AnimManager.drawEff` style: actor origin, slot spacing, camera scale, no actor sprite scale unless BCU applies it.

Projectile/world effects should generally follow their BCU container draw method, not actor status placement.

Do not reuse a convenient effect spawner if its coordinate model is wrong.

## Damage/proc guard rules

Every damage path must pass through the appropriate guard before mutating HP or applying procs.

Audit these paths:

- direct normal attack
- base attack
- wave
- mini-wave
- surge
- mini-surge
- blast
- death surge
- counter surge
- toxic
- barrier/shield interactions
- soulstrike/corpse damage
- zombie revive death path

No direct HP mutation is allowed unless BCU does direct HP mutation and the JS code records why it bypasses guard. Prefer guarded `takeDamage` with metadata.

## Documentation requirements

Update these in the same commit as code/bundle work:

- `docs/ability-logic/fact-only-ability-parity-matrix.md`
- `docs/ability-logic/effect-zip-audit.md`
- any focused audit document added for a feature family
- any generated manifest or inventory changed by builders

For completed rows, document:

- BCU reference source
- holder field/index
- numeric rule
- JS parser
- JS runtime hook
- visual ID
- raw asset path
- ZIP path
- exact ZIP internal entries
- loader alias
- spawn/attach call
- coordinate formula
- test commands and results
- browser verification result or measured non-visual reason why browser verification is not required

For incomplete rows, document:

- exact missing fact
- exact missing hook
- exact missing asset or loader alias
- exact missing test
- why implementation would require guessing

## Test file guidance

Prefer small deterministic scripts under `scripts/check-*.mjs` for parity probes. Each script should:

1. Construct minimal actors/events directly.
2. Inject deterministic RNG.
3. Avoid browser-only dependencies unless the test is explicitly browser-driven.
4. Assert exact numeric outputs.
5. Print a compact pass/fail summary.
6. Exit nonzero on failure.

For browser visual tests, add explicit debug helpers instead of relying on visual inspection alone. A good helper exports a JSON record like:

```json
{
  "frame": 123,
  "effectKey": "enemyBlast",
  "phase": "explode",
  "worldX": 1000,
  "screenX": 420,
  "screenY": 612,
  "scale": 0.75,
  "direction": 1,
  "layer": 0,
  "source": "BCU ContBlast"
}
```

## Verification

Do not assume `package.json` or npm scripts exist.

Run `node --check` on every touched JS/MJS file. At minimum run checks for the core files touched in parser, resolver, runtime, loader, and builder changes.

For Markdown-only edits, verify the file exists and is readable. If the Markdown includes shell snippets, scan them for syntax errors and destructive commands.

For effect work, run the relevant builders and verify ZIP contents with `unzip -l` after rebuild. Commit code changes, builder changes, rebuilt ZIPs, generated manifest/index changes, docs, and any focused verification scripts together.

## Commit/report requirements

A final report after any coding task must include:

- rows moved to complete
- rows left partial and why
- changed files
- BCU references used
- exact constants and indexes verified
- exact ZIP entries added or verified
- runtime hooks changed
- verification commands and results
- browser visual verification result, if applicable
- remaining risks

Never report done without command output or an explicit statement that a required verification was not run.

## Prohibited shortcuts

Do not:

- mark rows complete based on comments or old docs only.
- invent missing CSV indexes.
- infer effect aliases without `unzip -l` and loader verification.
- add browser runtime fallback to raw `public/assets/bcu` files.
- bypass `DamageCalculator`, `DamageAbilityResolver`, `ProcResolver`, or guard runtime by direct HP mutation.
- replace wrapper chains without auditing import order and callers.
- hide uncertain behavior behind broad try/catch.
- silently change random behavior.
- collapse unit/enemy side behavior unless BCU proves it is identical.
- conflate similarly named abilities, for example `strong` vs `strongAttack` vs `strengthen`.
- classify approximate visual placement as complete.

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

## Current strategic target

The fastest path to many rows marked complete is not to code each row in isolation. First build the proof harness, then close families:

1. Parser/index fixture coverage.
2. ZIP/loader/effect alias audit.
3. Damage/proc guard unification tests.
4. Status visual placement verification.
5. Barrier/shield family strict tests.
6. Projectile family strict tests.
7. Curse/seal/immunity suppression matrix.
8. External modifier systems: treasure/combo/orb/talent/custom target forms.
9. Blocked actor lifecycle systems: burrow, summon, spirit, delay, castle guard.

Until those are done, keep partial rows partial even if the game appears to work.
