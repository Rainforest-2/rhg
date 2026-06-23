# Fact-First Update Procedure

The canonical procedure is maintained at:

- `../ability-logic/bcu-fact-first-update-procedure.md`

Use that file for the full work order, change classification, verification, and report details. The core rule is:

```text
BCU fact -> current JS owner audit -> minimal update -> deterministic check -> focused docs update
```

Do not fork the full procedure here.

## Audit-aware stop conditions

Stop and document a blocker instead of editing when:

- the BCU holder, runtime owner, asset alias, or serialization schema is unproven;
- the current JS loader cannot supply the real data needed for the claim;
- a change requires guessing a CSV index, normal CSV SUMMON holder, effect alias, or BCU save format;
- wrapper order cannot be audited;
- non-BCU actors would change behavior;
- deterministic positive/negative cases cannot be written;
- a visual-complete claim would require manual browser acceptance that has not occurred;
- the proposed owner is contradicted by BCU negative evidence, such as a generic plain-castle attack owner.

For current priority and status boundaries, read `../ability-logic/bcu-parity-codex-workplan.md` and `../ability-logic/bcu-unresolved-evidence-blockers.md` after the canonical procedure.