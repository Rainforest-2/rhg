# Codex Fix Prompt

You are the implementation owner for this repository.

Implement only the `Next Codex Task` from `.ai/review.md`. Do not implement other review findings unless they are strictly required to complete that task.

Constraints:
- Do not make huge changes.
- Do not make unrequested specification changes.
- Preserve existing runtime behavior unless the task explicitly requires changing it.
- If facts are missing or the requested behavior cannot be proven, record the uncertainty in `.ai/state.md` under an `Unresolved` heading.
- Add or update focused tests when the change needs test coverage.
- Append a concise summary of your changes and verification notes to `.ai/changelog.md`.
- Do not commit.
- Do not push.

Before finishing, run the verification commands that are relevant to the files you changed when they are available in this environment.


# Runtime Context
Round: 1 of 5
Repository: /workspaces/rhg

## Claude Review
I now have a complete and verified picture. The prior `npm run check` task is fully implemented and consistent across all three locations (`orchestrator.sh:136-140`, `README.md:131`, `RUN_MANUALLY.md:14`), and the prior verification recorded `npm run check` → OK and `npm test` → 47/47. Here is the review.

# Review

Grounding for this round (confirmed by reading the tree):
- The previous round's task (add `npm run check` to verification) is **already complete and consistent** in all three places: `orchestrator.sh:136-140`, `README.md:131`, `RUN_MANUALLY.md:14`. The changelog records `check` → OK and `npm test` → 47/47.
- The orchestrator loop logic is sound: per-round log filenames are namespaced (`round-${round}-*`), `run_logged_command` correctly isolates failures with `set +e/-e` + `|| failed=1`, and the stop gate (`if run_verification`) is wired correctly.
- No confirmed Critical/High *code* defect remains. Remaining items are one concrete doc inaccuracy plus unverified-gate / unattended-mode risks.

## Critical
- None. The scaffolding does not touch runtime/battle behavior or BCU assets; the `rg` dependency removal remains verified-safe.

## High
- **Unverified hard stop-gate: `run_verification` runs `npm run build` (→ `vite build`) on *every* round (`orchestrator.sh:149`), but `build` has never been independently confirmed to pass.** The changelog only verified `check` and `test`. `--if-present` guards *absence*, not *failure* — and `build` exists (`package.json:33`), so `vite build` actually runs and is a hard gate. If it fails or is environment-sensitive, the loop can never reach `exit 0`: it burns all 5 rounds and `die`s (`orchestrator.sh:274`), reporting failure even when the substantive work passed. This is a "cannot converge / hides success" risk. It is verifiable simply by running `npm run build` once — so confirm it this round rather than leaving the gate untrusted.

## Medium
- **`run_claude`/`run_codex` invoke the CLIs with no non-interactive permission flag** (`orchestrator.sh:71` `claude -p`, `:90` `codex exec`). In an unattended loop, a permission/approval prompt can hang the orchestrator, or `codex exec` may be unable to apply edits at all (making the implementation step a silent no-op). Environment/CLI-version dependent; record, do not fix this round.

## Low
- **`README.md:108` is inaccurate**: "失敗時のラウンドログは … に保存されます" implies logs are written only on failure. The orchestrator writes the git/claude/codex/test logs and prompt files **every round unconditionally** (`orchestrator.sh:238-264`, and `run_verification` truncates `test_log` at start). → This is the smallest concrete, verifiable defect; selected as the Next Codex Task.
- `npm run lint --if-present` (`orchestrator.sh:148`, `README.md:131`, `RUN_MANUALLY.md:16`) is a permanent no-op — no `lint` script exists (`package.json:20-34`). Harmless; defer.
- `.ai/state.md` is stale (still "Current Task: Establish … scaffolding"; doesn't reflect the completed `npm run check` work). Bookkeeping, not a defect; defer.

## Next Codex Task
Correct the round-log description in `README.md` so it matches actual orchestrator behavior — a single-line, behavior-accurate documentation fix.

1. In `README.md:108`, change the bullet `- 失敗時のラウンドログは [.ai/logs](.ai/logs) に保存されます。` so it states that round logs are written **every round** (not only on failure) and are useful for investigating failures. Suggested wording: `- 各ラウンドのログは [.ai/logs](.ai/logs) に毎周保存され、失敗時の調査に利用できます。`
2. Do not change any other README content, the orchestrator, prompts, code, tests, or BCU assets. Do not add or remove verification steps. Do not commit or push.
3. Append a one-line entry to `.ai/changelog.md` noting the README wording correction and the verification result.

## Verification Commands
- `grep -n "各ラウンドのログ" README.md` (confirm the corrected wording is present)
- `grep -n "失敗時のラウンドログ" README.md` (confirm the old inaccurate phrasing is gone — expect no match)
- `npm run check` (expect `check-bcu-ability-parity-safe-suite: OK`)
- `npm test` (expect 47/47)
- `npm run build` (this round, also confirm the build stop-gate actually passes — addresses the High item; if it fails, record it under an `Unresolved` heading in `.ai/state.md` instead of editing build config)

## Stop Condition
Do not stop the loop this round. Continue after Codex applies the Next Codex Task. The effort is complete when: (a) `README.md` accurately describes per-round logging (`各ラウンドのログ` present, `失敗時のラウンドログ` absent); (b) `npm run check` → OK and `npm test` → 47/47 still pass; and (c) `npm run build` has been confirmed to pass (resolving the High item), so the loop's stop-gate is fully trustworthy. If `npm run build` fails, that becomes the next round's High-priority task and the loop must not be treated as converged.


## Latest Verification Output
No verification output for this round yet.
