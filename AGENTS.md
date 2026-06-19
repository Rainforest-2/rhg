# AGENTS.md

Repository-wide entrypoint for AI coding agents working on `rhgrive2/game`.

## Mission

Complete Battle Cats Ultimate (BCU) battle parity for `rhgrive2/game` using local BCU references, current JS runtime analysis, deterministic checks, ZIP-bundle evidence, and maintainable incremental changes.

## Current source of truth

Read these before relying on older notes:

- `docs/ability-logic/current-ability-parity-status.md`
- `docs/ability-logic/bcu-unresolved-evidence-blockers.md`
- `docs/ability-logic/bcu-visual-review-checklist.md`
- `docs/ability-logic/bcu-parity-codex-workplan.md`
- `docs/ability-logic/bcu-fact-first-update-procedure.md`
- `docs/bcu-migration-status.md`
- `docs/agent/README.md`

Treat older docs as historical notes unless the current source-of-truth docs confirm the same claim.

## Fact-first update rule

Use this order for every BCU parity update:

```txt
fact -> existing JS audit -> minimal update -> deterministic check -> docs/status update
```

Do not change gameplay because a field or ability name looks familiar. First prove the BCU behavior, then prove where the current JS runtime owns that behavior.

Detailed procedure: `docs/ability-logic/bcu-fact-first-update-procedure.md`.

## Required details

- Agent doc index: `docs/agent/README.md`
- BCU parity rules, status vocabulary, evidence rule, source priority, runtime asset rule, naming discipline, and known gaps: `docs/agent/bcu-parity-rules.md`
- Fact-first procedure link and stop conditions: `docs/agent/fact-first-update-procedure.md`
- Checks and verification requirements: `docs/agent/checks-and-verification.md`
- Final report format: `docs/agent/report-format.md`
- Markdown/agent-instruction maintenance rules: `docs/agent/md-maintenance-rules.md`

## Prohibited shortcuts

Do not:

- mark rows `code-complete` based on comments, old docs, or visual appearance only.
- invent missing CSV indexes.
- infer effect aliases without `unzip -l` and loader verification.
- add browser runtime fallback to raw `public/assets/bcu` files.
- replace wrapper chains without auditing import order and callers.
- hide uncertain behavior behind broad try/catch.
- silently change random behavior.
- collapse unit/enemy side behavior unless BCU proves it identical.
- conflate `strong`, `strongAttack`, and `strengthen`.
- classify approximate visual placement as `fully-complete`.
- promote historical or unverified analysis to current source of truth without a passing deterministic check.
- change implementation code, public assets, ZIP bundles, or generated manifests during Markdown-only maintenance.

## Required checks

Prefer small deterministic Node scripts under `scripts/check-*.mjs`. Each script must exit nonzero on failure.

Use relevant checks from the current workplan and status docs. Common checks include:

- `scripts/check-bcu-parser-indexes.mjs`
- `scripts/check-projectile-damage-parity.mjs`
- `scripts/check-proc-immunity-resistance-parity.mjs`
- `scripts/check-effect-bundle-aliases.mjs`
- `scripts/check-effect-coordinate-traces.mjs`
- `scripts/check-bcu-delay-runtime.mjs`
- `scripts/check-bcu-burrow-lifecycle-parity.mjs`
- `scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs`
- `scripts/check-bcu-summon-runtime-parity.mjs`
- `scripts/check-bcu-spirit-bundle-manifest-parity.mjs`
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
