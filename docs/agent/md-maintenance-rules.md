# Markdown Maintenance Rules

Use these rules when organizing Markdown or agent instructions in `Rainforest-2/rhg`.

## Scope

- Keep `AGENTS.md` short: mission, source-of-truth links, fact-first rule, current audit priorities, prohibited shortcuts, checks, and report link.
- Keep detailed rules under existing `docs/agent/` or `docs/ability-logic/` files.
- Do not weaken BCU evidence rules while moving text.
- Do not change implementation code, assets, ZIP bundles, manifests, or runtime behavior during Markdown-only maintenance.
- Do not create a parallel status document when an existing source-of-truth file can be updated.

## Current, evidence, and historical documents

Classify documentation before editing:

1. **Current status/workplan** must match current code, tests, and known boundaries.
2. **BCU source evidence** preserves durable BCU facts such as owners, fields, timing, and negative evidence.
3. **Historical audits/handoffs** provide context only; their claims about current rhg behavior must be revalidated.

The 2026-06-23 audit established these required distinctions in all current docs:

- runtime missing;
- runtime present but real data loading incomplete;
- runtime present but browser appearance unaccepted;
- source/schema compatibility unconfirmed;
- source owner disproven by negative evidence.

Do not collapse those categories into a generic “unfinished” or “complete.”

## Required synchronization

When current parity status changes, keep these existing files aligned:

- `README.md`
- `AGENTS.md`
- `docs/bcu-migration-status.md`
- `docs/ability-logic/current-ability-parity-status.md`
- `docs/ability-logic/bcu-unresolved-evidence-blockers.md`
- `docs/ability-logic/bcu-visual-review-checklist.md` only after real browser review
- `docs/ability-logic/bcu-parity-codex-workplan.md`
- `docs/agent/README.md`

When a source fact changes, update the source-evidence file too. When a bundle changes, update `effect-zip-audit.md` with actual entries.

## Markdown-only verification

Run the Markdown checks listed in `checks-and-verification.md`. Review cross-links and status vocabulary manually. State clearly in the final report that code/assets/tests were untouched when that is true.

## Claude Code sync

`CLAUDE.md` must remain a symbolic link to `AGENTS.md` so Codex and Claude Code read the same entrypoint.

If `CLAUDE.md` is a regular file, inspect and preserve any unique content before replacing it:

```bash
if [ -e CLAUDE.md ] && [ ! -L CLAUDE.md ]; then
  cp CLAUDE.md /tmp/CLAUDE.md.before-agent-sync
  echo "Existing CLAUDE.md backed up to /tmp/CLAUDE.md.before-agent-sync"
fi
rm -f CLAUDE.md
ln -s AGENTS.md CLAUDE.md
ls -la CLAUDE.md
```