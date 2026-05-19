# AGENTS.md

Repository-wide instructions for AI coding agents working on `rhgrive2/game`.

This project is a browser-based Battle Cats Ultimate (BCU) parity / preview runtime. Player-facing battle behavior should match the reference game. The implementation is JavaScript, but the source of truth for battle logic is the local BCU reference material under `references/bcu/`.

## Scope

These instructions apply to the whole repository unless a more specific `AGENTS.md` exists in a subdirectory.

## Current priority: non-visual ability parity

The immediate implementation campaign is to fix and complete ability/proc logic that does **not** require new visual assets or new effect animation systems.

Implement logic first. Do not add or redesign visual effects in this pass. Do not implement new projectile/effect emitters unless explicitly requested in the task after this file is updated.

Examples in scope for the non-visual pass:

- target trait compatibility for damage abilities and procs;
- proc status overwrite semantics;
- weaken/freeze/slow/curse/seal/toxic logic corrections;
- strengthen / attack-up at low HP;
- lethal survive / survive at 1 HP;
- bounty / extra money on kill;
- target-only / only-attacks behavior;
- wave/surge immunity as damage gates, not merely proc-application filters;
- barrier / demon shield logic corrections that do not need new art;
- zombie-killer / soulstrike / revive corrections that do not need new art;
- existing damage ability parity corrections;
- existing wrapper-chain correctness for `queueAttackDamage`, `takeDamage`, and `resolvePostDamage`.

Examples out of scope for the first non-visual pass unless explicitly requested:

- new blast / explosion visual runtime;
- new summon visual/runtime system;
- new counter-surge emitter;
- new death-surge emitter, unless the task specifically allows using the existing surge visual runtime;
- burrow / underground movement if it requires new movement animation or visual state work;
- broad renderer refactors;
- optimization-only work unrelated to ability parity.

## Reference source policy

Codex-style agents cannot see files attached in ChatGPT. Use local repository files only.

Before changing ability or battle logic, inspect the local references under:

- `references/bcu/BCU_java_util_common.zip`
- `references/bcu/BCU_Android-master.zip`
- every relevant `*.md` file under `references/bcu/`

The user will place the important special-ability logic Markdown file under `references/bcu/`. Find it with local search, for example:

```bash
find references/bcu -maxdepth 2 -type f | sort
rg -n "波動|小波動|烈波|小烈波|爆波|呪い|古代の呪い|効果|能力|属性|上書き|毒撃|バリア|シールド|ゾンビ|魂攻撃|攻撃力アップ|生き残る|お金" references/bcu
```

Treat the Markdown as a high-level gameplay explanation, not executable code. Treat the BCU Java/Kotlin reference ZIPs as the primary source for exact control flow, field names, timing, and state transitions.

Use `BCU_java_util_common.zip` and `BCU_Android-master.zip` as the primary gameplay references. Do not use PC-only Kotlin sources as the first gameplay source when the non-PC references answer the same question. PC code may still be useful for rendering/UI details.

When reference files are inspected, document the exact ZIP path, class, and method used. If a reference file is missing, stop and document what is missing instead of guessing.

## Required analysis artifact before runtime changes

Before editing runtime code for ability parity, commit or update a design/analysis document under:

- `docs/ability-logic/`

Use a descriptive filename, for example:

- `docs/ability-logic/non-visual-ability-parity-plan.md`
- `docs/ability-logic/proc-targeting-and-status-overwrite.md`

The document must include:

- objective in one sentence;
- exact user-requested scope;
- explicit non-goals;
- all local reference files/classes/methods inspected;
- all Markdown reference sections inspected;
- current JS files inspected;
- current import order from `js/main.js` for touched patches;
- wrapper chain for every touched method;
- data flow for attack capture, damage calculation, proc resolution, proc application, and post-damage resolution;
- list of abilities considered in scope;
- list of abilities explicitly deferred;
- current observed JS behavior;
- reference behavior;
- selected implementation plan;
- rejected implementation ideas and why they are risky;
- gameplay invariants that must remain true;
- static verification steps;
- executable local checks, if available;
- validation limits;
- rollback plan.

Do not edit runtime code until this document exists. If a change was already made without the document, add the missing document before further runtime edits.

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

### Non-visual abilities likely suitable for the first implementation pass

Verify exact names and rules before coding:

- strengthen / attack-up at low HP;
- lethal survive / survive at 1 HP;
- bounty / extra money on kill;
- target-only / only-attacks;
- wave immunity;
- surge immunity;
- toxic immunity;
- full proc immunities and, if reference mapping is clear, partial resistances;
- correct status overwrite;
- correct status value application for weaken;
- zombie killer revive suppression;
- soulstrike corpse targeting and revive cancellation;
- barrier breaker and shield pierce as damage-gate logic;
- demon shield regeneration on knockback if this does not require new visuals.

### Defer unless explicitly requested

- blast runtime and blast immunity;
- counter-surge runtime;
- summon;
- burrow / underground movement;
- new visuals for barrier/shield/wave/surge/hit smoke;
- renderer changes unrelated to the above logic.

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
- `js/battle/BcuProcImmunityPatch.js`
- `js/battle/BattleActorBarrierShieldPatch.js`
- `js/battle/BattleActorZombieRevivePatch.js`
- `js/battle/BattleSoulstrikePatch.js`
- `js/battle/BattleWaveRuntimePatch.js`
- `js/battle/BattleSurgeRuntimePatch.js`
- `js/battle/BattleBaseProjectileProcPatch.js`
- `js/battle/BcuKnockbackRuntimePatch.js`
- `js/battle/BcuKnockbackProcPriorityPatch.js`

Search for all wrappers and state fields before touching any of them:

```bash
rg -n "queueAttackDamage|takeDamage|resolvePostDamage|applyBcuProc|DamageCalculator\.calculate|ProcResolver\.resolve|captureTargets|runTickPhase|isTargetable|isAlive|bcuProcStatuses|bcuBarrier|bcuDemonShield|bcuZombie|bcuWave|bcuSurge|deathSurge|miniWave|miniSurge|blast|targetOnly|lethal|strengthen|bounty|counterSurge|burrow|warp|curse|seal" js
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
   Prefer small helpers over broad rewrites. Avoid changing unrelated rendering, UI, or asset loading.

3. **Separate parse, resolve, apply, and post-damage phases.**
   - `BcuCombatModel` should parse CSV/reference data.
   - `AbilityModel` should expose semantic flags without losing raw data.
   - `DamageAbilityResolver` should handle damage multipliers and damage-only gates.
   - `ProcResolver` should roll and describe procs after target compatibility is known.
   - `BattleSceneProcApplyPatch` / `BcuProcRuntime` / actor patches should apply runtime state.
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

10. **No new visual requirements.**
    If a logic fix would require a new visual effect to be correct, defer it unless the user explicitly requested visuals.

## Suggested first-pass implementation sequence

Use small commits. One logical area per commit.

1. Add or update the `docs/ability-logic/...` analysis document.
2. Add a shared trait/proc compatibility helper, with tests or debug self-checks if the repo has no test runner.
3. Route `ProcResolver.resolve(...)` through target compatibility without changing unrelated payload formats.
4. Correct status overwrite/value semantics in `BattleActorProcStatusPatch.js`.
5. Correct curse/seal filtering according to references.
6. Implement non-visual damage/state abilities:
   - strengthen;
   - lethal survive;
   - bounty;
   - targetOnly;
   - wave/surge/toxic full immunity gates;
   - barrier/shield gate-order corrections;
   - zombie killer / soulstrike corrections.
7. Explicitly separate deferred visual/effect abilities, especially deathSurge/counterSurge/blast/summon/burrow.
8. Add static verification notes to the analysis document.

If a later step reveals a prior assumption was wrong, stop and update the analysis document before continuing.

## Verification requirements

Do not ask for browser/manual tests. Codex may not be able to run a browser.

Use local static checks and any available non-browser checks. If the repository has no package scripts, say so in the analysis/summary and use syntax/static checks instead.

Recommended commands:

```bash
find references/bcu -maxdepth 2 -type f | sort
rg -n "relevant keyword" references/bcu js
rg -n "queueAttackDamage|takeDamage|resolvePostDamage|ProcResolver|DamageCalculator|applyBcuProc" js/battle
node --check js/battle/<changed-file>.js
```

For every changed file, run `node --check` when it is a JavaScript module and the local Node version supports it. If this is not available, state that syntax validation was not executed.

Before finalizing, verify:

- no protected wrapper was bypassed;
- no new duplicate proc roll was added;
- no new duplicate proc application was added;
- target trait compatibility is applied before proc runtime application;
- base/castle behavior is not accidentally treated as actor behavior;
- wave/surge containers still tick at the same phase if touched;
- no rendering or asset-loading code changed in the non-visual pass;
- `js/main.js` import order was preserved unless deliberately documented;
- debug/global output changes are documented if any.

## Reporting format for Codex summaries

When summarizing a completed change, include:

- objective;
- references inspected;
- changed files;
- exact behavior fixed;
- abilities implemented;
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
- Do not mix visual effect work with non-visual ability parity work.
- If behavior parity is uncertain, stop at analysis and document the risk instead of guessing.
