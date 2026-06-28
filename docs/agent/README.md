# Agent Documentation

This directory holds the longer agent rules referenced by the repository-root `AGENTS.md`.

## Current source of truth

Read these in order before using older notes:

1. `../../README.md`
2. `../bcu-migration-status.md`
3. `../ability-logic/current-ability-parity-status.md`
4. `../ability-logic/bcu-unresolved-evidence-blockers.md`
5. `../ability-logic/bcu-visual-review-checklist.md`
6. `../ability-logic/bcu-ability-source-evidence.md`
7. `../ability-logic/bcu-parity-codex-workplan.md`
8. `../ability-logic/bcu-fact-first-update-procedure.md`

The 2026-06-23 audit established an important documentation rule: historical analysis can preserve source facts, but historical claims about the current rhg implementation are not current until code and deterministic checks confirm them.

To reduce startup context before opening full documents, use the generated shortcut:

```bash
npm run agent:context -- --topic "<area>"
```

The output is derived from the current files listed above and highlights matching open status rows, blockers, visual-review rows, source-evidence rows, and candidate checks. Treat it as an index, not a source of truth.

Runtime helpers for lower-token iteration:

- `npm run agent:find -- --topic "<area>"` ranks likely JS owners, checks, tests, and docs with compact snippets.
- `npm run agent:changed` prints changed files grouped by code/tests/docs/tooling without invoking full `git status`.
- `npm run agent:checks -- --topic "<area>" --file js/path/File.js` suggests focused commands; `--changed --run` derives them from the current diff and executes short OK/failure tails.
- `npm run agent:probe -- --expr "..."` runs one-off assertions with `assert` and `importProject()` injected, avoiding add/delete cycles for temporary test files.
- `npm run agent:run -- "command"` runs arbitrary command lines with compact tails for long or noisy checks.

## Agent rule files

- `bcu-parity-rules.md`: evidence hierarchy, status vocabulary, asset/runtime rules, and known constraints.
- `fact-first-update-procedure.md`: agent-facing link to the canonical fact-first workflow.
- `checks-and-verification.md`: deterministic checks, ZIP inspection, and verification requirements.
- `report-format.md`: final implementation-batch report format.
- `md-maintenance-rules.md`: Markdown and agent-instruction maintenance rules.

## Documentation classes

`docs/` contains three distinct kinds of information:

1. **Current status and workplan** — must remain synchronized with current code and checks.
2. **BCU source evidence** — durable facts about BCU ownership, fields, timing, and negative evidence.
3. **Historical reports** — useful context only; never a live defect list by themselves.

Do not create parallel status documents when an existing source-of-truth file can be updated. For a parity change, update the current status, blocker, visual-review ledger, migration summary, and root README/AGENTS summary when their scope changes.

## Current audit focus

- real custom-pack SUMMON source loading;
- persistence scope and failure visibility;
- real-data targetForms/modifier fixture coverage;
- browser visual acceptance;
- non-basic cannon visual asset aliases and sweep timing.

Do not treat repository-local `localStorage` persistence as BCU save compatibility, and do not create a generic castle-owned attack owner: BCU evidence rejects both claims.
