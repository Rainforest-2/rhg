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
