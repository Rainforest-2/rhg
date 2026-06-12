# AGENTS.md

Repository-wide instructions for AI coding agents working on `rhgrive2/game`.

## Mission

Complete Battle Cats Ultimate (BCU) battle parity for `rhgrive2/game` using local BCU references, current JS runtime analysis, deterministic checks, ZIP-bundle evidence, and maintainable incremental changes.

## Current source of truth

Use these files before relying on older notes:

- `docs/ability-logic/current-ability-parity-status.md`
- `docs/ability-logic/bcu-unresolved-evidence-blockers.md`
- `docs/ability-logic/bcu-visual-review-checklist.md`
- `docs/ability-logic/bcu-parity-codex-workplan.md`
- `docs/bcu-migration-status.md`

Treat older docs as historical notes unless these current status files confirm the same claim.

## Status vocabulary

Use these statuses consistently in docs and final reports:

- `partial`: facts, implementation, tests, or bundle evidence are missing.
- `code-complete`: local BCU reference, JS parser/runtime implementation, ZIP evidence, deterministic tests, and coordinate/effect traces pass.
- `human-visual-review-needed`: code-complete for logic/effect wiring, but exact manual visual appearance has not been inspected by a human.
- `fully-complete`: code-complete evidence exists and a human/manual visual review has also been recorded.

Do not use bare `complete` ambiguously. Prefer `code-complete` or `fully-complete`.

## Codex verification boundary

Codex-style agents cannot perform manual browser visual inspection. Therefore:

- Do not require browser/manual visual verification before marking a row `code-complete`.
- For visual/effect rows, require deterministic coordinate/effect traces instead.
- If exact appearance still needs human judgment, mark the row `human-visual-review-needed`, not `partial`, provided code/bundle/runtime/test evidence is complete.
- If code evidence is missing, keep the row `partial`.

## Evidence rule

A row may be marked `code-complete` only when applicable evidence exists:

1. BCU source behavior is identified from local references under `references/bcu/`.
2. JS parser/runtime behavior is implemented for the relevant holder/source.
3. Numeric rules match BCU: probability, frames, percent, distance, random range, rounding, level scaling, ordering, overwrite, and suppression.
4. Runtime hooks fire at the matching logical battle phase and ordering point.
5. Required visual/effect animation is loaded from production ZIP bundles, not loose raw assets.
6. Effect timing/position/direction/camera scale/layer/lifetime/phase are represented in deterministic debug traces.
7. Focused automated checks exist and pass.
8. Documentation records references, hooks, tests, ZIP entries, and remaining human visual review status.

Do not mark a row code-complete because it only appears to work.

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

Follow `docs/ability-logic/bcu-parity-codex-workplan.md`.

Current priority groups:

1. W0: keep proof harness scripts current.
2. W1: projectile source model.
3. W2: resistance and external modifier completeness.
4. W3: source-backed summon completion.
5. W4: zombie revive and death-surge edge completion.
6. W5: effect scale and coordinate model maintenance.
7. W6: debug allocation cleanup without logic changes.

Do not reimplement rows that current status docs already classify as `code-complete-candidate` or `human-visual-review-needed` unless a deterministic check or source comparison proves a concrete bug.

## Current known gaps

### Projectile source model

Wave, surge, and blast must preserve source attack data for each target-specific resolution. Do not reuse a first target's already-adjusted result as a universal projectile result unless BCU source and tests prove that exact behavior.

### Resistance and external modifiers

Keep full immunity and partial resistance centralized. Do not mark external modifier rows code-complete until combo/orb/treasure/talent/PCoin loaders and targetForms fixtures are source-backed and tested.

### Source-backed summon completion

The explicit proc-object summon runtime exists, but normal CSV summon holder, automatic BCU custom/proc-object loading, source-backed stage `allow` / group semantics, and exact summon entry appearance remain blockers.

### Zombie revive and death-surge edge completion

The standard zombie corpse / soulstrike / revive visual trace path is covered. Remaining blockers are manual browser acceptance, mini-death-surge holder proof, and extra/custom revive interactions.

### Visual review-only rows

Do not call the following runtime-missing unless a current check proves regression:

- `P_DELAY` runtime/effect
- burrow lifecycle
- barrier / demon shield / shield breaker
- castle/base guard states
- spirit lifecycle
- standard zombie corpse / soulstrike / revive trace path

These may still be `human-visual-review-needed`, but that is not the same as missing runtime implementation.

### Effect coordinate model

Stage/projectile effects require explicit scale and coordinate metadata. Do not rely on one generic visual formula unless BCU proof says that is correct for that effect class. Add deterministic coordinate traces.

### Debug allocation cleanup

Reduce or gate per-frame debug object allocation only after behavior-bearing paths are protected by tests. Do not change rendering, combat, proc, or wrapper semantics for optimization alone.

## Required tests/checks

Prefer small deterministic Node scripts under `scripts/check-*.mjs`. Each script must exit nonzero on failure.

Use relevant checks from the current workplan and status docs. Common checks include:

- `scripts/check-bcu-parser-indexes.mjs`
- `scripts/check-projectile-damage-parity.mjs`
- `scripts/check-proc-immunity-resistance-parity.mjs`
- `scripts/check-effect-bundle-aliases.mjs`
- `scripts/check-effect-coordinate-traces.mjs`
- `scripts/check-debug-allocation-guards.mjs`
- `scripts/check-bcu-delay-runtime.mjs`
- `scripts/check-bcu-burrow-lifecycle-parity.mjs`
- `scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs`
- `scripts/check-bcu-summon-runtime-parity.mjs`
- `scripts/check-bcu-castle-guard-parity.mjs`
- `scripts/check-ability-partial-blockers.mjs`

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

- `docs/ability-logic/current-ability-parity-status.md`
- `docs/ability-logic/bcu-unresolved-evidence-blockers.md`
- `docs/ability-logic/bcu-visual-review-checklist.md`, only after actual human/manual visual review
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
