# Manual AI Development Loop

Use this when `claude` or `codex` cannot run non-interactively, is not installed, or is not authenticated in the current environment.

## Steps

1. Give Claude `.ai/prompts/claude-review.md` together with the current logs from `.ai/logs/`, `git status --short`, and `git diff`.
2. Paste Claude's full output into `.ai/review.md`.
3. Give Codex `.ai/prompts/codex-fix.md` together with `.ai/review.md`.
4. Let Codex implement only the `Next Codex Task`.
5. Run:

```bash
npm run check
npm test
npm run lint --if-present
npm run build --if-present
```

6. Save the command output in `.ai/logs/` or paste the relevant failure details into the next Claude review context.
7. Return the new logs to Claude and repeat the loop until all stop conditions are satisfied. Verification success alone is not enough to stop before the audit is complete.

The loop is complete only when at least 5 rounds have run, Claude reports no Critical or High tasks, `.ai/state.md` lists no unaudited major areas, and the verification commands pass.
