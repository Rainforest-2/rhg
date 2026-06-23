# Report Format

Every implementation or documentation-maintenance batch ends with a fact-bound report.

```md
## Summary
- Rows moved to code-complete-candidate:
- Rows moved to human-visual-review-needed:
- Rows still partial / unconfirmed / negative-evidence:

## BCU references inspected
- files/classes/methods:
- holder fields / state transitions:

## Current rhg owner audited
- parser/loader:
- runtime/wrapper:
- renderer/UI/persistence, when relevant:

## Gap classification
- runtime / real-data loader / visual acceptance / schema compatibility / negative-evidence:

## Changed files
- code:
- tests:
- docs:
- generated assets:

## Verification
- command or review fixture: result
- checks not run: reason

## Remaining risks
- risk:
- reason:
- next action:
```

For Markdown-only maintenance, explicitly state that no runtime, asset, or generated-bundle file changed and list the documentation consistency checks performed.

Never report broad BCU parity, BCU save compatibility, or visual acceptance without evidence matching that exact claim.