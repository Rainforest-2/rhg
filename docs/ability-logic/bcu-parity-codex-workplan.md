# BCU parity Codex workplan

This document is the current implementation order for moving `rhgrive2/game` BCU battle ability/proc/effect rows toward `code-complete` or `fully-complete` parity.

It is written for Codex-style agents that can read files, edit code, run terminal checks, inspect ZIP contents, and produce deterministic logs, but cannot perform manual browser visual inspection. Browser/manual checks are not blockers for `code-complete`. If a row has visual behavior, the agent must provide deterministic coordinate/effect traces and mark any remaining manual-only concern as `human-visual-review-needed` in docs.

## Required status vocabulary

Use these statuses in docs and final reports:

- `partial`: facts, implementation, tests, or bundle evidence are missing.
- `code-complete`: BCU source, JS implementation, ZIP evidence, deterministic tests, and coordinate/effect traces pass. Browser/manual inspection is not required.
- `human-visual-review-needed`: code-complete for logic/effect wiring, but exact human visual appearance has not been manually inspected.
- `fully-complete`: only use if code-complete evidence exists and a human/manual visual check has also been recorded.

Do not use `complete` ambiguously. Prefer `code-complete` or `fully-complete`.

## Current source of truth

Use the focused status docs first:

| Purpose | File |
|---|---|
| Current row status | `docs/ability-logic/current-ability-parity-status.md` |
| Current unresolved blockers | `docs/ability-logic/bcu-unresolved-evidence-blockers.md` |
| Manual visual review tracking | `docs/ability-logic/bcu-visual-review-checklist.md` |
| High-level migration summary | `docs/bcu-migration-status.md` |

Old task wording in this workplan must not override those files.

## Global implementation constraints

1. Preserve wrapper chains. Every wrapper must call the captured original with the same `this` and compatible arguments.
2. Do not read production runtime assets from loose `public/assets/bcu/**` paths. Runtime must use ZIP bundles.
3. Do not use direct HP mutation for damage that BCU routes through damage/proc guards.
4. Do not classify a row as `code-complete` without a deterministic test that can fail on regression.
5. Keep browser visual verification out of Codex hard requirements.
6. Update the focused status docs after each implementation batch.
7. Update `docs/ability-logic/effect-zip-audit.md` after every effect bundle change.

## Current baseline already implemented or covered by deterministic checks

These rows are no longer "runtime missing" tasks. Do not reimplement them from scratch unless a check or source comparison proves a concrete bug.

| Area | Current state | Required next step |
|---|---|---|
| `P_DELAY` runtime/effect | `human-visual-review-needed`; `BcuDelayRuntime`, effect bundle aliases, and coordinate traces are covered by deterministic checks. | Manual browser visual review only, unless a deterministic check fails. |
| Burrow lifecycle | `code-complete-candidate`; `BcuBurrowLifecycleRuntime` / `BattleActorBcuBurrowPatch` cover lifecycle, movement, targetability, collision, renderability, and cleanup. | Optional manual visual review for exact DOWN/MOVE/UP appearance. |
| Barrier / demon shield / shield breaker | `human-visual-review-needed`; gate order, phases, y offset, scale, layer, and demon shield regen timing are covered. | Manual browser visual review. |
| Castle/base guard | `human-visual-review-needed`; `BcuCastleGuardRuntime` / `BattleSceneBcuCastleGuardPatch` implement active/hold/break state and `check-bcu-castle-guard-parity.mjs` covers behavior. | Manual browser visual review for hold/break appearance. |
| Spirit lifecycle | `human-visual-review-needed`; parser and lifecycle runtime checks exist. | Manual browser visual review for actor/IMUATK appearance. |
| Standard zombie corpse / soulstrike / revive visual trace | `human-visual-review-needed`; `check-bcu-zombie-corpse-soulstrike-parity.mjs` covers standard revive, targetability, soulstrike cancellation, DOWN/REVIVE timing, render override, cleanup, and HP restoration. | Manual browser visual review plus extra/custom revive fixtures if broadening claims. |
| Summon explicit proc-object runtime | `partial`; explicit proc-object runtime and deterministic checks exist, but normal CSV holder and automatic custom/proc-object loading remain unresolved. | Implement source-backed loader/fixtures before status upgrade. |

## Current priority order

### W0 — keep proof harness current

Maintain and extend deterministic Node checks before behavior edits.

Required checks or equivalents:

```bash
node scripts/check-bcu-parser-indexes.mjs
node scripts/check-projectile-damage-parity.mjs
node scripts/check-proc-immunity-resistance-parity.mjs
node scripts/check-effect-bundle-aliases.mjs
node scripts/check-effect-coordinate-traces.mjs
node scripts/check-debug-allocation-guards.mjs
node scripts/check-bcu-delay-runtime.mjs
node scripts/check-bcu-burrow-lifecycle-parity.mjs
node scripts/check-bcu-death-animation-parity.mjs
node scripts/check-bcu-warp-lifecycle-parity.mjs
node scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs
node scripts/check-bcu-barrier-shield-effect-parity.mjs
node scripts/check-bcu-demon-shield-regen-timing.mjs
node scripts/check-bcu-summon-runtime-parity.mjs
node scripts/check-bcu-castle-guard-parity.mjs
node scripts/check-ability-partial-blockers.mjs
```

Only run commands relevant to the files touched. If a command references a missing script, add or update the script when it is part of the task rather than silently skipping.

### W1 — projectile damage source model

Projectile rows remain high priority whenever evidence shows projectile damage still risks inheriting the first direct target's final adjusted damage.

Target files may include:

- `js/battle/DamageCalculator.js`
- `js/battle/DamageAbilityResolver.js`
- `js/battle/BattleWaveRuntimePatch.js`
- `js/battle/BattleSurgeRuntimePatch.js`
- `js/battle/BattleBlastRuntimePatch.js`
- `js/battle/BattleSceneProcApplyPatch.js`
- `js/battle/BattleSceneBcuProcRuntimePatch.js`
- attack event metadata producers used by `BattleSceneBcuAttackPhasePatch.js`

Required behavior:

1. Preserve an explicit raw/projectile attack basis.
2. Do not reuse a first target's `finalDamage` as universal projectile damage unless BCU source and tests prove that exact behavior.
3. Preserve mini-wave and mini-surge 20% damage exactly once.
4. Preserve blast 100/70/40% falloff exactly once.
5. Prevent recursive projectile spawning from projectile damage unless BCU explicitly permits it.
6. Verify with `node scripts/check-projectile-damage-parity.mjs`.

### W2 — resistance and external modifier completeness

Keep full immunity, partial resistance, sage/AB_SKILL behavior, and external modifier sources centralized and evidence-backed.

Do not mark rows `code-complete` if they still depend on missing combo/orb/treasure/talent/PCoin loaders or targetForms fixtures.

Target areas:

- `js/battle/bcu-runtime/BcuResistRuntime.js`
- `js/battle/BcuProcImmunityPatch.js`
- `js/battle/BcuCombatModel.js`
- `js/battle/ProcResolver.js`
- `js/battle/BattleActorProcStatusPatch.js`
- `js/battle/DamageAbilityResolver.js`
- combo/orb/talent/treasure loader/model files once identified
- targetForms fixture/data loader path once identified

Required behavior:

1. Use BCU source-backed holder paths.
2. Do not invent CSV fields for missing holder sources.
3. Keep `IMUPOIATK` unit direct holder separate from unproven enemy direct CSV holder.
4. Add loader-backed fixtures before broad resolver changes.
5. Verify with `node scripts/check-proc-immunity-resistance-parity.mjs` and `node scripts/check-ability-partial-blockers.mjs`.

### W3 — source-backed summon completion

Summon runtime exists for explicitly supplied `Proc.SUMMON` objects. The remaining work is not a blank runtime implementation.

Remaining blockers:

1. Normal unit/enemy CSV `SUMMON` holder is not proven.
2. Automatic BCU custom/proc-object source loading is not implemented.
3. Source-backed stage `allow` / group semantics for summoned enemies are missing.
4. Exact `Entity.setSummon(anim_type)` entry appearance has not been manually reviewed.

Safe next steps:

- Load BCU custom/proc-object `SUMMON` data into per-hit attack events.
- Keep normal CSV parser unchanged unless a source holder is proven.
- Add source-backed stage allow/group fixtures.
- Keep the row `partial` until those blockers are resolved.

### W4 — zombie revive and death-surge edge completion

Standard zombie corpse / soulstrike / revive visual trace is covered by deterministic checks. Remaining work is narrower.

Remaining blockers:

1. Manual browser visual acceptance for DOWN/REVIVE appearance.
2. Mini-death-surge holder proof.
3. Extra/custom revive interactions and cleanup variants.

Safe next steps:

- Add loader-backed/custom holder proof before mini-death-surge behavior edits.
- Add end-to-end extra/custom revive lifecycle fixtures.
- Keep broad visual claims at `human-visual-review-needed` until manual review is recorded.

### W5 — effect scale and coordinate model maintenance

Stage/projectile/status/priority effects must carry explicit scale and coordinate metadata.

Required metadata should include, as relevant:

- `effectKey`
- `phase`
- `worldX`
- `worldY`
- `screenOffsetX`
- `bcuSmokeYOffset`
- `layer`
- `bcuScaleMode`
- `effectScale`
- `renderFlipX`
- `source`
- `bcuReference`

Do not fall back to one generic visual formula unless BCU proof says the effect class uses it.

Verify with:

```bash
node scripts/check-effect-bundle-aliases.mjs
node scripts/check-effect-coordinate-traces.mjs
```

### W6 — debug allocation cleanup without logic changes

Performance work is allowed only when behavior-bearing paths are protected by tests.

Targets include files writing heavy `globalThis.__BCU_*_DEBUG__`, `globalThis.__BATTLE_*_DEBUG__`, or large `last*Debug` objects per frame.

Rules:

1. Gate heavy debug objects behind an explicit debug flag or reduce to concise counters.
2. Do not remove behavior-bearing events, effect creation, wrapper calls, or renderer metadata.
3. Do not change wave/surge smoke kind, offsets, layer, lifetime, or effect filtering.
4. Verify with `node scripts/check-debug-allocation-guards.mjs` plus relevant battle checks.

## Required syntax checks

Run `node --check` on every touched JS/MJS file. Do not assume `package.json` exists.

For effect bundle work, also inspect ZIP entries with commands such as:

```bash
unzip -l public/assets/bundles/effect/status-effects.zip
unzip -l public/assets/bundles/effect/wave.zip
unzip -l public/assets/bundles/effect/kbeff.zip
```

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

Never report done without command output or an explicit statement that a required verification could not run.
