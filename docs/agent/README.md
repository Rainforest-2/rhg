# Agent Documentation

This directory holds the longer agent rules that used to live in `AGENTS.md`.
`AGENTS.md` stays as the short entrypoint so Codex and Claude Code can read the same rule set.

## Current Source Of Truth

Use these files before relying on older notes:

- `../ability-logic/current-ability-parity-status.md`
- `../ability-logic/bcu-unresolved-evidence-blockers.md`
- `../ability-logic/bcu-visual-review-checklist.md`
- `../ability-logic/bcu-parity-codex-workplan.md`
- `../ability-logic/bcu-fact-first-update-procedure.md`
- `../bcu-migration-status.md`

Treat older docs as historical notes unless these current status files confirm the same claim.

## Agent Rule Files

- `bcu-parity-rules.md`: status vocabulary, evidence rule, source priority, runtime asset rule, current gaps, and naming discipline.
- `fact-first-update-procedure.md`: agent-facing link to the canonical fact-first workflow.
- `checks-and-verification.md`: required checks and effect-bundle verification.
- `report-format.md`: required implementation-batch final report format.
- `md-maintenance-rules.md`: Markdown and agent-instruction maintenance rules, including `CLAUDE.md` symlink handling.

## Reference vs progress docs

`docs/` keeps two long-lived kinds of supporting docs:

- **BCU source-fact evidence** (e.g. `../ability-logic/bcu-ability-source-evidence.md`, `../ability-logic/bcu-priority-hit-effect-evidence.md`, `../bcu-unit-stat-flow.md`): durable records of BCU source behavior. Keep these.
- **Current status / structural docs** (the source-of-truth list above, plus the CSS-structure notes): keep current.

Dated progress, audit, handoff, and extraction snapshots are not preserved as live docs once their accurate claims are folded into a current source-of-truth doc; git history holds the originals. Do not promote any historical note to source of truth without a passing deterministic check.
