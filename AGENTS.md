# AGENTS.md

Repository-wide instructions for AI coding agents working on `rhgrive2/game`.

This project is a browser-based Battle Cats Ultimate (BCU) parity / preview runtime. Player-facing battle behavior should match the reference game. The implementation is JavaScript, but the source of truth for battle logic is the local BCU reference material under `references/bcu/`.

## Scope

These instructions apply to the whole repository unless a more specific `AGENTS.md` exists in a subdirectory.

## Current priority: ability parity implementation

The current task is not a research-only task. Codex should analyze first, document the plan, then proceed to implementation when the plan is local, testable, and does not require inventing unsupported behavior.

The priority is to fix and complete ability/proc logic, starting with features that either need no new visual runtime or can reuse existing status/effect rendering. Codex has terminal access and should use local shell commands to inspect references, inspect assets, rebuild bundles, and run static checks.

Do not stop after writing an analysis document unless one of these is true:

- a required local reference file is missing;
- the behavior cannot be inferred from `references/bcu/`;
- the implementation would require a new large renderer/projectile/runtime system not requested here;
- the change would require broad unrelated rewrites;
- local static checks reveal a blocking error that cannot be fixed safely in scope.

Otherwise, continue from analysis to code changes and commit the completed implementation.

## User-specific ability/UI requirement

Attack-up / strengthen and survive / lethal-survive must be treated as positive buffs where applicable, not as enemy debuffs. If these abilities need status icon/effect display, place the friendly buff visual in the same on-actor status display position family currently used for enemy debuff visuals, mirrored to the appropriate friendly actor target. In other words, use the existing status-effect attachment/positioning system instead of inventing a separate floating UI location.

Do not attach friendly buffs to the enemy side by mistake. Debuffs applied to enemies and buffs applied to allies should share the same rendering infrastructure but use the affected actor as the anchor.

## Ability effect asset bundle requirement

Codex may use the terminal. Before implementing ability visuals or status icons that already exist in assets, inspect the existing asset bundle that currently contains attack-down / weaken status animation assets. Then bundle all ability-related effect ZIP/assets that are needed for the current ability pass into that same ability/status effect bundle or its existing build pipeline.

Required workflow:

1. Locate the existing weaken / attack-down animation source and bundle.
2. Locate all relevant ability/status effect asset ZIPs or raw asset directories under `public/assets`, `assets`, and `references/bcu` as applicable.
3. Inspect existing bundle builder scripts before editing.
4. Extend the existing bundle script instead of hand-editing ZIP files.
5. Rebuild the affected bundle with terminal commands.
6. Commit the updated build script, rebuilt ZIP, and generated manifest/index files together.
7. Update the loader code only if the existing loader cannot read the newly bundled entries.
8. Document exact internal bundle paths used by runtime code.

Do not create a second competing status-effect bundle unless the existing architecture proves that one bundle cannot support the required entries. Do not hardcode loose raw paths as normal runtime behavior when a bundle path is available.

## Reference source policy

Codex-style agents cannot see files attached in ChatGPT. Use local repository files only.

Before changing ability or battle logic, inspect the local references under:

- `references/bcu/BCU_java_util_common.zip`
- `references/bcu/BCU_Android-master.zip`
- every relevant `*.md` file under `references/bcu/`

The user will place the important special-ability logic Markdown file under `references/bcu/`. Find it with local search, for example:

```bash
find references/bcu -maxdepth 3 -type f | sort
rg -n "波動|小波動|烈波|小烈波|爆波|呪い|古代の呪い|効果|能力|属性|上書き|毒撃|バリア|シールド|ゾンビ|魂攻撃|攻撃力アップ|生き残る|お金|めっぽう|打たれ強い|超ダメージ|渾身|ターゲット" references/bcu
```

Treat the Markdown as a high-level gameplay explanation. Treat the BCU Java/Kotlin reference ZIPs as the primary source for exact control flow, field names, timing, and state transitions.

Use `BCU_java_util_common.zip` and `BCU_Android-master.zip` as the primary gameplay references. Do not use PC-only Kotlin sources as the first gameplay source when the non-PC references answer the same question. PC code may still be useful for rendering/UI details.

When reference files are inspected, document the exact ZIP path, class, and method used. If a reference file is missing, stop and document what is missing instead of guessing.

Useful local commands:

```bash
mkdir -p /tmp/bcu-ref
python3 - <<'PY'
import zipfile, pathlib
for z in ['references/bcu/BCU_java_util_common.zip', 'references/bcu/BCU_Android-master.zip']:
    p = pathlib.Path(z)
    if p.exists():
        out = pathlib.Path('/tmp/bcu-ref') / p.stem
        out.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(p) as f:
            f.extractall(out)
        print('extracted', p, '->', out)
PY
rg -n "class Entity|damage\(|processProcs|AttackSimple|AttackWave|AttackVolcano|Barrier|Shield|Zomb|strength|lethal|bounty|target" /tmp/bcu-ref
```

## Required analysis artifact before runtime changes

Before editing runtime code for ability parity, create or update a design/analysis document under:

- `docs/ability-logic/`

Use a descriptive filename, for example:

- `docs/ability-logic/non-visual-ability-parity-plan.md`
- `docs/ability-logic/proc-targeting-and-status-overwrite.md`
- `docs/ability-logic/ability-status-assets-bundle.md`

The document must include:

- objective in one sentence;
- exact user-requested scope;
- explicit non-goals;
- all local reference files/classes/methods inspected;
- all Markdown reference sections inspected;
- current JS files inspected;
- current import order from `js/main.js` for touched patches;
- wrapper chain for every touched method;
- data flow for attack capture, damage calculation, proc resolution, proc application, status visualization, and post-damage resolution;
- asset bundle paths inspected and modified;
- list of abilities considered in scope;
- list of abilities explicitly deferred;
- current observed JS behavior;
- reference behavior;
- selected implementation plan;
- rejected implementation ideas and why they are risky;
- gameplay invariants that must remain true;
- static verification steps;
- executable local checks and their results;
- validation limits;
- rollback plan.

After the analysis document exists and no blocker is found, proceed to implementation. Do not require a second user confirmation for implementation unless the plan would exceed the requested scope.

## Known current ability-parity gaps to address

Use this as the initial checklist. Verify each item against local references before editing.

### High-priority correctness gaps

1. **Proc target trait compatibility is incomplete.**
   `ProcResolver` currently rolls proc candidates from semantic flags and probability. It must be checked against reference target-trait compatibility rules before applying attribute-targeted procs. Do not let a red-only/floating-only/etc. effect apply to unrelated targets.

2. **Status overwrite semantics are likely wrong.**
   Existing freeze/slow/weaken/curse/seal logic uses max-duration style behavior. Reference behavior must be checked. If the local Markdown/reference says same-proc reapplication overwrites duration/value, implement overwrite, not max-extension.

3. **Curse / ancient-curse / seal filtering must respect the reference distinction between `effect` and `ability`.**
   Do not blindly disable every semantic flag. Follow the local Markdown and BCU implementation. Wave, surge, barrier, shield, burrow, revive, and similar ability-class features may not follow the same disable rules as ordinary procs.

4. **Death surge is currently at risk of being treated as ordinary attack surge.**
   If `deathSurge` is present, do not let it fire as a normal attack proc. Either implement proper death-trigger behavior if in scope, or explicitly separate and defer it.

5. **Wave/surge immunity must gate damage from wave/surge runtime.**
   A proc-application immunity wrapper alone is insufficient. Damage from `BattleWaveRuntimePatch` and `BattleSurgeRuntimePatch` must respect reference immunity rules.

6. **Target-only / only-attacks behavior is not fully connected to capture.**
   Capture and base targeting must respect target-only constraints.

7. **Base/castle is not a normal actor pipeline.**
   Base damage/proc behavior must be made consistent carefully. Avoid one-off fixes that cause duplicated wave/surge creation or inconsistent proc rolls.

8. **Positive buff status placement must not be confused with enemy debuff placement.**
   Buff effects such as strengthen and survive should anchor to the affected friendly actor using the existing status-effect position system.

### Abilities suitable for this implementation campaign

Verify exact names and rules before coding:

- target trait compatibility for damage effects and procs;
- correct status overwrite and status value application;
- strengthen / attack-up at low HP;
- lethal survive / survive at 1 HP;
- bounty / extra money on kill;
- target-only / only-attacks;
- wave immunity;
- surge immunity;
- toxic immunity;
- full proc immunities and, if reference mapping is clear, partial resistances;
- curse/seal filtering according to effect-vs-ability rules;
- barrier breaker and shield pierce as damage-gate logic;
- demon shield regeneration on knockback if this does not require new actor art;
- zombie killer revive suppression;
- soulstrike corpse targeting and revive cancellation;
- existing damage ability parity corrections for metal, critical, massive, resistant, good, base-destroyer, metal-killer, strong attack, and related damage-only features.

### Defer unless explicitly requested or existing runtime can be reused safely

- full blast runtime and blast immunity;
- counter-surge emitter;
- summon;
- burrow / underground movement;
- large renderer refactors;
- new actor animation systems;
- unrelated optimization-only work.

Death surge may be implemented only if the existing surge visual/runtime can be reused without a new renderer system and references clearly define the trigger. Otherwise separate it from ordinary surge and document it as deferred.

## Core architecture files to inspect

At minimum, inspect these before editing related logic:

- `js/main.js`
- `js/battle/BcuCombatModel.js`
- `js/battle/AbilityModel.js`
- `js/battle/BattleAttackProfile.js`
- `js/battle/BattleAttackResolver.js`
- `js/battle/DamageCalculator.js`
- `js/battle/DamageAbilityResolver.js`
- `js/battle/ProcResolver.js`
- `js/battle/BattleSceneProcApplyPatch.js`
- `js/battle/BattleSceneBcuProcRuntimePatch.js`
- `js/battle/bcu-runtime/BcuProcRuntime.js`
- `js/battle/bcu-runtime/BcuResistRuntime.js`
- `js/battle/BattleActorProcStatusPatch.js`
- `js/battle/BattleSceneBcuStatusEffectRenderPatch.js`
- `js/battle/BcuProcImmunityPatch.js`
- `js/battle/BattleActorBarrierShieldPatch.js`
- `js/battle/BattleActorZombieRevivePatch.js`
- `js/battle/BattleSoulstrikePatch.js`
- `js/battle/BattleWaveRuntimePatch.js`
- `js/battle/BattleSurgeRuntimePatch.js`
- `js/battle/BattleBaseProjectileProcPatch.js`
- `js/battle/BcuKnockbackRuntimePatch.js`
- `js/battle/BcuKnockbackProcPriorityPatch.js`
- every asset loader and bundle builder related to status/ability effects.

Search for all wrappers and state fields before touching any of them:

```bash
rg -n "queueAttackDamage|takeDamage|resolvePostDamage|applyBcuProc|DamageCalculator\.calculate|ProcResolver\.resolve|captureTargets|runTickPhase|isTargetable|isAlive|bcuProcStatuses|bcuBarrier|bcuDemonShield|bcuZombie|bcuWave|bcuSurge|deathSurge|miniWave|miniSurge|blast|targetOnly|lethal|strengthen|bounty|counterSurge|burrow|warp|curse|seal|weaken|freeze|slow|toxic|bcuStatus" js
rg -n "weaken|weak|attack.*down|strength|survive|lethal|status|ability|effect" public assets scripts js references/bcu
```

## Protected runtime contracts

Treat these as high-risk contracts:

- `BattleScene.prototype.queueAttackDamage`
- `BattleScene.prototype.runTickPhase`
- `BattleActor.prototype.takeDamage`
- `BattleActor.prototype.resolvePostDamage`
- `BattleActor.prototype.tick`
- `BattleAttackResolver.captureTargets`
- `DamageCalculator.calculate`
- `DamageAbilityResolver.resolve`
- `ProcResolver.resolve`
- `BattleActor.applyBcuProc`
- status-effect rendering and actor attachment positions;
- wave/surge container lifetime and damage timing;
- zombie revive / corpse / soulstrike state;
- barrier and demon shield gate order;
- knockback state transitions;
- status expiration and movement/attack suppression.

Do not replace wrapper chains with direct calls. If wrapping, capture the current method and call it with the same `this` and compatible arguments, for example:

```js
const originalQueueAttackDamage = proto.queueAttackDamage;
proto.queueAttackDamage = function wrapped(attacker, target, targetType, event, meta = {}) {
  const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
  // local extension here
  return result;
};
```

Do not reorder imports in `js/main.js` unless the analysis document proves the existing order is wrong. Later patches may intentionally wrap earlier patches.

## Implementation rules for ability parity

1. **Preserve player-visible reference behavior over Java class shape.**
   Do not mechanically port Java/Kotlin patterns that create avoidable JS overhead.

2. **Keep logic local and reversible.**
   Prefer small helpers over broad rewrites. Avoid changing unrelated rendering, UI, or asset loading except the required status/ability asset bundle work.

3. **Separate parse, resolve, apply, visualize, and post-damage phases.**
   - `BcuCombatModel` should parse CSV/reference data.
   - `AbilityModel` should expose semantic flags without losing raw data.
   - `DamageAbilityResolver` should handle damage multipliers and damage-only gates.
   - `ProcResolver` should roll and describe procs after target compatibility is known.
   - `BattleSceneProcApplyPatch` / `BcuProcRuntime` / actor patches should apply runtime state.
   - status effect render patches should only visualize state that already exists on the actor.
   - actor `takeDamage` / `resolvePostDamage` patches should handle shields, barriers, survive, zombie, bounty, and death effects in reference order.

4. **Do not double-roll probability.**
   A proc should be rolled once for a hit unless reference behavior explicitly rolls again. If multiple wrappers observe the same proc, use the existing result, not a fresh random roll.

5. **Do not double-apply procs.**
   If both `BattleSceneProcApplyPatch` and `BcuProcRuntime` see the same proc, dedupe by key/hit/event or mark already-applied. Preserve the existing dedupe style unless replacing it with a proven safer one.

6. **Use deterministic battle RNG where existing code provides it.**
   Respect `BattleDeterministicRandomPatch` and `meta.random`. Do not introduce raw `Math.random()` in battle logic when a scene RNG is available.

7. **Status logic must be frame-based where reference uses frames.**
   Convert to milliseconds only at boundaries already used by the runtime. Avoid mixing ms and frame counters without documenting it.

8. **Target traits must come from combat model flags.**
   Do not infer traits from display text or names. Do not duplicate same effect for multi-trait targets unless reference does.

9. **Base/castle behavior must be explicit.**
   When logic differs for `targetType === 'base'`, state the reference reason. Do not accidentally apply actor-only procs to base.

10. **Bundle existing ability assets before relying on them.**
    If a status/buff icon or animation is required and already exists in assets, bundle it through the existing build pipeline and load it from the bundle. Do not rely on raw fallback paths in normal runtime.

## Suggested implementation sequence

Use small commits. One logical area per commit.

1. Add or update the `docs/ability-logic/...` analysis document.
2. Inspect and, if needed, extend the existing ability/status effect asset bundle builder. Rebuild the bundle and manifest with terminal commands.
3. Add a shared trait/proc compatibility helper, with self-checks or tests if the repo has no test runner.
4. Route `ProcResolver.resolve(...)` through target compatibility without changing unrelated payload formats.
5. Correct status overwrite/value semantics in `BattleActorProcStatusPatch.js`.
6. Correct curse/seal filtering according to references.
7. Implement non-projectile damage/state abilities:
   - strengthen;
   - lethal survive;
   - bounty;
   - targetOnly;
   - wave/surge/toxic full immunity gates;
   - barrier/shield gate-order corrections;
   - zombie killer / soulstrike corrections.
8. Wire friendly buff visuals through the existing status-effect attachment path if assets are available.
9. Explicitly separate deferred visual/effect abilities, especially counterSurge/blast/summon/burrow when not safely reusable.
10. Run verification commands and update the analysis document with results.

If a later step reveals a prior assumption was wrong, update the analysis document before continuing.

## Verification requirements

Do not ask for browser/manual tests. Codex may not be able to run a browser.

Use terminal-based checks. If the repository has no package scripts, say so in the analysis/summary and use syntax/static checks instead.

Recommended commands:

```bash
find references/bcu -maxdepth 3 -type f | sort
rg -n "relevant keyword" references/bcu js public assets scripts
rg -n "queueAttackDamage|takeDamage|resolvePostDamage|ProcResolver|DamageCalculator|applyBcuProc" js/battle
node --check js/battle/<changed-file>.js
node --check js/ui/<changed-file>.js
node --check scripts/<changed-script>.mjs
```

If bundle scripts are changed, run the bundle script and verify the ZIP contents with a local command such as:

```bash
python3 - <<'PY'
import zipfile, sys
for p in sys.argv[1:]:
    with zipfile.ZipFile(p) as z:
        print(p)
        for n in sorted(z.namelist()):
            print(' ', n)
PY public/assets/bundles/<bundle>.zip
```

For every changed JavaScript module, run `node --check` when the local Node version supports it. If this is not available, state that syntax validation was not executed.

Before finalizing, verify:

- no protected wrapper was bypassed;
- no new duplicate proc roll was added;
- no new duplicate proc application was added;
- target trait compatibility is applied before proc runtime application;
- base/castle behavior is not accidentally treated as actor behavior;
- wave/surge containers still tick at the same phase if touched;
- status/buff visuals anchor to the affected actor;
- status/ability assets are loaded from bundle paths, not loose raw paths, in normal runtime;
- `js/main.js` import order was preserved unless deliberately documented;
- debug/global output changes are documented if any.

## Reporting format for Codex summaries

When summarizing a completed change, include:

- objective;
- references inspected;
- changed files;
- exact behavior fixed;
- abilities implemented;
- ability/status assets bundled and their internal paths;
- abilities deliberately deferred;
- verification commands and results;
- remaining risks.

Do not claim full BCU parity unless all relevant reference branches were inspected and implemented. Prefer precise wording: `implemented for normal actor hits`, `implemented for base hits`, `deferred because it requires visual runtime`, etc.

## Change style

- Keep commits small and reviewable.
- Avoid broad formatting churn.
- Avoid renaming public fields unless required.
- Preserve existing debug fields unless removing or changing them is documented.
- Do not mix ability logic fixes with optimization-only work.
- Do not mix large renderer refactors with ability parity work.
- If behavior parity is uncertain and cannot be resolved from local references, document the blocker and stop instead of guessing.
