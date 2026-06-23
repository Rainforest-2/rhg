# BCU fact-first update procedure

Use this procedure for every BCU parity update in `Rainforest-2/rhg`.

## Core rule

```text
BCU fact -> current JS owner audit -> minimal update -> deterministic check -> focused docs update
```

Do not change gameplay because a field, ability name, old README claim, or visual approximation looks familiar.

## Required order

1. **Define the smallest target.**
   - behavior / owner side / data source;
   - timing and state transition;
   - exact compatibility or visual claim to prove.

2. **Take BCU facts first.**
   - local BCU common source;
   - local BCU Android/PC source when the claim depends on draw/UI behavior;
   - checked-in BCU reference docs;
   - historical docs only after current code confirms their implementation claim.

3. **Audit the current rhg owner before editing.**
   - parser and source loader;
   - runtime state owner;
   - boot/import and wrapper chain;
   - renderer/UI owner when visible;
   - persistence owner when save/lineup compatibility is mentioned;
   - existing deterministic checks and fixtures.

4. **Classify the actual gap.**
   - runtime missing;
   - runtime exists but real source loading is incomplete;
   - runtime exists but browser appearance is unaccepted;
   - source owner/schema is unconfirmed;
   - proposed owner is disproven by negative evidence.

5. **Choose the safest change type.**
   - docs-only;
   - test-only;
   - loader-fixture;
   - runtime-minimal;
   - runtime-wrapper;
   - visual-acceptance record.

6. **Protect existing behavior.**
   - preserve wrapper order and original calls;
   - do not invent CSV indexes, proc holders, effect aliases, or save schemas;
   - do not add loose raw-asset runtime fallbacks;
   - do not silently alter RNG, targeting, or side ownership;
   - do not create a generic castle-owned attack owner;
   - do not call browser-local persistence BCU-compatible without source schema proof.

7. **Add or update focused checks.**
   - positive and negative case;
   - timing/order case;
   - source-loader fixture for data-coverage claims;
   - coordinate/effect trace for visible behavior;
   - blocked/quota storage case for persistence changes.

8. **Run the relevant verification.**

```bash
node scripts/check-bcu-ability-parity-safe-suite.mjs
```

Run the focused checks too. Do not silently skip an unavailable required command.

9. **Update existing documentation last.**
   - `docs/ability-logic/current-ability-parity-status.md`;
   - `docs/ability-logic/bcu-unresolved-evidence-blockers.md`;
   - `docs/ability-logic/bcu-visual-review-checklist.md` only after actual browser review;
   - `docs/bcu-migration-status.md`;
   - `README.md` and `AGENTS.md` when the public/agent summary changes.

## Stop conditions

Stop and record a blocker instead of guessing when:

- BCU holder/source/schema is unproven;
- current JS loader cannot supply real source data;
- a change requires a guessed CSV index, effect alias, or save format;
- wrapper order/callers cannot be audited;
- non-BCU behavior would change;
- deterministic negative cases cannot be written;
- a visual-complete claim would require a manual review that has not happened.

## Final report format

```text
BCU facts taken:
- ...

Existing JS logic audited:
- ...

Gap classification:
- runtime / loader / visual / schema / negative-evidence

Change type:
- docs-only / test-only / loader-fixture / runtime-minimal / runtime-wrapper

Files changed:
- ...

Existing behavior protected:
- ...

Checks run:
- ...

Remaining blockers:
- ...
```