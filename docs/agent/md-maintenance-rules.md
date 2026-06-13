# Markdown Maintenance Rules

Use these rules when organizing Markdown or agent instructions.

## Scope

- Keep `AGENTS.md` as a short agent README with mission, current source-of-truth links, fact-first rule, prohibited shortcuts, required checks, final report format, and links to detailed docs.
- Put long rule bodies under `docs/agent/` or the relevant existing `docs/ability-logic/` file.
- Do not weaken BCU compatibility rules while moving text.
- Do not change implementation code, public assets, ZIP bundles, generated manifests, or runtime behavior during Markdown-only maintenance.

## Current And Historical Docs

- Do not delete old docs during cleanup.
- Do not promote older analysis to current source of truth unless the current status docs confirm the same claim.
- Prefer adding index links that distinguish current source-of-truth docs from historical notes.

## Claude Code Sync

`CLAUDE.md` must be a symbolic link to `AGENTS.md` so Codex and Claude Code read the same entrypoint.

If `CLAUDE.md` already exists as a regular file, inspect it before replacement. If it contains important information not present in `AGENTS.md` or `docs/agent/`, integrate that information first.

Use:

```bash
if [ -e CLAUDE.md ] && [ ! -L CLAUDE.md ]; then
  cp CLAUDE.md /tmp/CLAUDE.md.before-agent-sync
  echo "Existing CLAUDE.md backed up to /tmp/CLAUDE.md.before-agent-sync"
fi
rm -f CLAUDE.md
ln -s AGENTS.md CLAUDE.md
ls -la CLAUDE.md
```
