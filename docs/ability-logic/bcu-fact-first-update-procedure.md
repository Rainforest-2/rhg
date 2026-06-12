# BCU fact-first update procedure

Use this procedure for every BCU parity update.

## Core rule

```txt
fact -> existing JS audit -> minimal update -> deterministic check -> docs/status update
```

Do not change gameplay because a field or ability name looks familiar. First prove the BCU behavior, then prove where the current JS runtime owns that behavior.

## Required order

1. Define the smallest target.
   - ability/proc/effect name
   - owner side or source
   - timing phase
   - expected output

2. Take BCU facts first.
   - prefer local BCU common source
   - then local BCU Android source
   - then local BCU markdown references
   - use existing docs only as historical notes

3. Audit existing JS before editing.
   - parser owner
   - runtime owner
   - boot/import owner
   - wrapper chain
   - checks already covering the path

4. Pick the safest change type.
   - docs-only
   - test-only
   - loader-fixture
   - runtime-minimal
   - runtime-wrapper

5. Protect existing behavior.
   - do not change default behavior without a proven BCU holder/source
   - preserve wrapper order and return shape
   - avoid broad refactors during parity fixes

6. Update minimally.
   - no guessed CSV indexes
   - no CSV shortcut for custom/proc-object-only behavior
   - no loose raw runtime asset fallback
   - no status upgrade without deterministic proof

7. Add or update focused checks.
   - positive case
   - negative case
   - timing/order case when relevant
   - trace/effect case when visual behavior is involved

8. Run the safe suite.

```bash
node scripts/check-bcu-ability-parity-safe-suite.mjs
```

9. Update docs last.
   - `docs/ability-logic/current-ability-parity-status.md`
   - `docs/ability-logic/bcu-visual-review-checklist.md` when visual review is involved

## Stop conditions

Stop and document a blocker instead of editing when:

- the BCU holder/source is not proven
- the JS loader cannot provide the source data
- the change requires guessing a CSV index
- wrapper order cannot be audited
- non-BCU actors would change behavior
- deterministic negative cases cannot be written

## Final report format

```txt
BCU facts taken:
- ...

Existing JS logic audited:
- ...

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
