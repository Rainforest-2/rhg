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
7. If any verification command fails, return the new logs to Claude and repeat the loop.

The loop is complete when Claude's `Stop Condition` is satisfied and the verification commands pass.
