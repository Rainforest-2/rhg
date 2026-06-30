# AI Development Loop Mission

## Project Purpose
- Build and maintain a reliable autonomous development loop for this repository.
- Keep the project healthy by combining analysis, implementation, review, and verification.
- Preserve existing gameplay and runtime behavior while improving maintainability.

## AI Role Split
- Claude:
  - Senior engineer and system-level reviewer.
  - Analyze the repository holistically.
  - Discover issues, design concerns, and review quality.
  - Own code review and decision guidance.
- Codex:
  - Implementation specialist.
  - Fix bugs, refactor safely, and add tests.
  - Follow the approved plan and keep changes scoped.

## Development Rules
- Do not change specifications without explicit justification.
- Do not break existing functionality.
- Investigate root causes before applying fixes.
- Verify changes with tests and relevant checks after every fix.
- Record uncertainties in state.md.
- Keep changes small and commit in focused units.

## Prohibited Actions During Fixes
- Making speculative behavior changes without evidence.
- Rewriting large unrelated sections just to improve style.
- Hiding failures or skipping verification.
- Introducing new dependencies or tools without justification.
- Leaving TODOs or unverified fixes in place.

## Completion Criteria
- No unimplemented tasks remain in the loop.
- No critical bugs remain unresolved.
- Relevant tests pass.
- Lint and static checks pass.
- Type errors are absent or not applicable for this project.
- Design issues discovered during review are addressed.
