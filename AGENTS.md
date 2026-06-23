# AGENTS.md

Repository-wide entrypoint for coding agents working on `Rainforest-2/rhg`.

## Mission

Improve Battle Cats Ultimate (BCU) battle parity from local BCU references while preserving existing runtime behavior, semantic ZIP asset rules, deterministic checks, and documented uncertainty.

## Read first

Use these current documents before any historical note:

1. `README.md`
2. `docs/bcu-migration-status.md`
3. `docs/ability-logic/current-ability-parity-status.md`
4. `docs/ability-logic/bcu-unresolved-evidence-blockers.md`
5. `docs/ability-logic/bcu-visual-review-checklist.md`
6. `docs/ability-logic/bcu-ability-source-evidence.md`
7. `docs/ability-logic/bcu-parity-codex-workplan.md`
8. `docs/ability-logic/bcu-fact-first-update-procedure.md`
9. `docs/agent/README.md`

Treat old reports as historical unless current code and these docs confirm the same claim.

## Non-negotiable workflow

```text
BCU fact -> current JS owner audit -> minimal change -> deterministic check -> focused docs update
```

Before changing runtime behavior, identify:

- the BCU file/class/method and field/state transition;
- the current rhg file/function that owns the behavior;
- the exact test or fixture that can catch regression;
- whether the remaining issue is runtime, source loading, visual acceptance, or schema compatibility.

## Current audit priorities

Loader/data priorities 1–3 are now closed by real BCU-format fixture files threaded through the existing runtime (SUMMON proc-object, `Trait.targetForms`, combo/orb/treasure/talent/PCoin, extra/custom revive, and observable storage failure). The remaining priorities are visual:

1. Manual browser acceptance for visible effects/UI (P_DELAY, shields, spirit, guard, zombie corpse/revive, summon entry, cannon).
2. Non-basic cannon ATK/EXT aliases and extend/waved timing (visual).
3. Guardrails to preserve: do not invent a normal CSV SUMMON holder; repository-local `localStorage` state is self-persistence only, **not** a BCU save/lineup compatibility claim.

## Prohibited shortcuts

Do not:

- mark rows complete from comments, old docs, or one fixture;
- invent BCU CSV indexes, proc holders, save schemas, or effect aliases;
- silently fall back from semantic ZIP assets to loose `public/assets/bcu/**`;
- replace wrapper chains without auditing import order, original calls, and callers;
- hide uncertainty behind broad `try/catch` or silent fallback;
- change random behavior, target selection, or side ownership without source proof;
- create a generic castle-owned attack runtime—plain BCU castles do not own one;
- call browser-local persistence “BCU compatible” without a proven BCU serialization owner and round-trip fixtures;
- mark visual parity accepted from deterministic traces alone;
- change code, assets, ZIP bundles, or manifests during Markdown-only maintenance.

## Checks

Use focused Node checks under `scripts/check-*.mjs`. Common checks include:

```bash
node scripts/check-bcu-parser-indexes.mjs
node scripts/check-projectile-damage-parity.mjs
node scripts/check-proc-immunity-resistance-parity.mjs
node scripts/check-bcu-delay-runtime.mjs
node scripts/check-bcu-summon-runtime-parity.mjs
node scripts/check-bcu-summon-procobject-loader-parity.mjs
node scripts/check-bcu-trait-targetforms-loader-parity.mjs
node scripts/check-bcu-modifier-realdata-sweep-parity.mjs
node scripts/check-bcu-zombie-extra-revive-source-range-parity.mjs
node scripts/check-formation-storage-failure-visibility.mjs
node scripts/check-bcu-spirit-bundle-manifest-parity.mjs
node scripts/check-bcu-castle-guard-parity.mjs
node scripts/check-bcu-wallet-runtime-parity.mjs
node scripts/check-bcu-non-basic-cat-cannon-runtime-parity.mjs
node scripts/check-ability-partial-blockers.mjs
```

Run only relevant checks, but do not silently skip a required one. Run `node --check` on every changed JS/MJS file.

## Documentation maintenance

When a parity claim changes, update existing docs rather than adding a parallel status file:

1. `current-ability-parity-status.md`
2. `bcu-unresolved-evidence-blockers.md`
3. `bcu-visual-review-checklist.md` only after real browser review
4. `bcu-migration-status.md`
5. `README.md` / this file if the public or agent-facing summary changed

## Final implementation report

Every implementation batch ends with:

```md
## Summary
- Rows moved to code-complete-candidate:
- Rows moved to human-visual-review-needed:
- Rows still partial / unconfirmed:

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

Do not report parity completion without command output or an explicit statement of what could not be verified.