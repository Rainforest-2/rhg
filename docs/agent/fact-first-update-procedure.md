# Fact-First Update Procedure

The canonical procedure is maintained at:

- `../ability-logic/bcu-fact-first-update-procedure.md`

Use that file for the full required order and final-report details. The core rule is:

```txt
fact -> existing JS audit -> minimal update -> deterministic check -> docs/status update
```

Do not duplicate or fork that procedure here. If it changes, update the canonical file and keep this page as a pointer for agents reading `docs/agent/`.

## Stop Conditions

Stop and document a blocker instead of editing when:

- the BCU holder/source is not proven.
- the JS loader cannot provide the source data.
- the change requires guessing a CSV index.
- wrapper order cannot be audited.
- non-BCU actors would change behavior.
- deterministic negative cases cannot be written.
