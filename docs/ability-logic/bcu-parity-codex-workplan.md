# BCU parity workplan

Updated: 2026-06-24.

This is the current implementation order for `Rainforest-2/rhg`. It reflects the latest BCU audit: most central runtime work is no longer a blank implementation problem; the priority is source completeness, compatibility boundaries, and visual acceptance. A 2026-06-24 source-verified re-audit added one non-visual runtime divergence (W7, same-frame attack-resolution ordering) and resolved the modifier-registry fail-open visibility gap.

## Status rules

- `code-complete-candidate`: source evidence, current JS owner, and deterministic tests exist.
- `human-visual-review-needed`: runtime evidence exists; browser appearance is not accepted.
- `partial`: source loading, real-data fixtures, runtime coverage, or tests are incomplete.
- `unconfirmed`: source owner or schema has not been established.
- `negative-evidence`: BCU disproves the proposed owner; do not implement it there.

Never use historical README findings as current defects without a fresh code comparison.

## Required order for every change

```text
BCU fact -> current JS owner audit -> minimal change -> deterministic check -> focused docs update
```

No runtime fallback to loose `public/assets/bcu/**`. Preserve wrapper chains and random behavior. Do not invent CSV fields or generic visual aliases.

## Priority order

> Status (2026-06-23): the non-visual loader/data work in **W1, W2, and W3 is
> complete** — each is proven by a real BCU-format fixture file threaded through
> the existing runtime by a deterministic check (`check-bcu-summon-procobject-loader-parity`,
> `check-bcu-trait-targetforms-loader-parity`, `check-bcu-modifier-realdata-sweep-parity`,
> `check-bcu-zombie-extra-revive-source-range-parity`, `check-formation-storage-failure-visibility`).
> The remaining work is **W4 visual acceptance** and **W5 cannon asset parity**, both
> of which require manual browser review, plus **W7 same-frame attack-resolution
> ordering** (a confirmed non-visual divergence that needs a fixture + core-loop
> change + browser confirmation before any parity-complete claim).

### W0 — keep the proof harness and docs truthful

Before any behavior change:

- read `current-ability-parity-status.md`, `bcu-unresolved-evidence-blockers.md`, and the source evidence inventory;
- add or strengthen a deterministic check before changing a behavior-bearing owner;
- update the focused status/blocker docs in the same batch;
- update the visual checklist only after real manual browser review.

### W1 — real custom-pack SUMMON loader coverage

**Why first:** SUMMON runtime exists, but real data may never reach it.

Required work:

1. discover/load real custom pack proc-object `CustomEntity.atks[].proc.SUMMON` sources;
2. preserve the existing `attachBcuProcObjectSummonsToAttackHits()` handoff boundary;
3. validate immediate/on-hit/on-kill, side, inheritance, layer, allow/group, same_health, bond_hp, and ignore_limit with real loader-backed fixtures;
4. do not add a normal unit/enemy CSV SUMMON parser without source proof.

### W2 — persistence scope and failure handling

**Why second:** browser-local state is currently mistaken easily for BCU compatibility.

Required work:

1. keep current repository-local migrations stable;
2. make `FormationStore` / `StageRegistry` storage read/write failure observable;
3. explicitly separate self-compatibility from BCU import/export compatibility;
4. before any BCU import/export feature, identify the BCU save/lineup serialization owner and add round-trip fixtures.

### W3 — real-data modifier and trait fixtures

**Why third:** primary modifier hooks exist, but broad compatibility claims lack real data coverage.

Required work:

- add real custom `Trait.targetForms` / `targetType` loader fixtures;
- test capture, proc, targetOnly, and damage-family paths together;
- sweep real combo/orb/treasure/talent/PCoin combinations;
- keep source-proven resistance holders centralized; do not add enemy toxic immunity.

Done (2026-06-24): combo / talent (PCoin) registry **load-failure** is now observable
via `BcuModifierDiagnostics` (`check-bcu-modifier-registry-failure-visibility`)
instead of a silent fail-open buried in `__BATTLE_BOOT_PATCH_ERRORS__`. Surfacing the
warning in the battle UI for a player who configured combos/talents is a remaining
Codex-owned UI follow-up, not a loader gap.

### W4 — visual acceptance ledger

**Why fourth:** visible behavior cannot be marked complete from traces alone.

Review in this order:

1. P_DELAY and barrier/demon shield/shield breaker;
2. spirit and castle guard;
3. zombie revive and mini-death-surge;
4. basic cannon firing/wave;
5. non-basic cannon sweep and BASE_WALL;
6. SUMMON entry once W1 supplies a real fixture.

For every review record fixture, BCU reference, browser/device, result, and mismatch evidence.

### W5 — non-basic cannon asset parity

Add exact per-cannon ATK/EXT bitmap-animation aliases and then compare extend/waved behavior frame by frame. Do not replace missing assets with generic traces or unit proc effects.

### W6 — optional performance cleanup

Only after behavior-bearing paths are covered by tests:

- remove/gate diagnostic allocations that do not affect logic;
- preserve wrapper calls, effect creation, coordinate metadata, and renderer ordering;
- run the relevant safe suite after every cleanup.

### W7 — same-frame attack-resolution ordering (status: partial / blocked on browser)

**BCU fact.** `StageBasis.updateEntities` (`battle/StageBasis.java:1086–1102`) runs
player-side (`dire != 1`) `update2()`, then `la.forEach(capture); la.forEach(excuse)`
(damage + death applied), then base `update2()`, then enemy-side (`dire != -1`)
`update2()`. A unit killed by the player's excuse this frame has its `update2()`
skipped (dead), so it never creates its own strike — BCU gives the player side
same-frame precedence.

**Current JS owner.** The tick (`BattleSceneBcuStageBasisTickPatch.js`) already
splits capture (`hit-target-capture`) from excuse (`damage-resolve` →
`processDeferredAttackDamage` in `BattleSceneBcuAttackPhasePatch.js`) and excuses
player-first via FIFO/dire-sort. The gap: both sides' due hits are collected and
captured before any damage, and all HP damage/death lands together in the
`knockback-death` phase (`KBRuntime.resolvePostDamage`); excuse only skips an
already-dead **target** (`BattleSceneBcuAttackPhasePatch.js:51`), never a
same-frame-killed **attacker**. Net: rhg permits symmetric same-frame mutual kills
that BCU suppresses on the player side.

**Required work (in order).**
1. add a deterministic same-frame mutual-kill fixture/check that pins the BCU
   outcome (player kills enemy this frame → enemy strike does **not** land);
2. restructure the tick so player excuse + death resolves before enemy strikes are
   captured/excused (interleave like BCU), as a minimal change to the existing
   phase model — do not rewrite the wrapper chain;
3. browser-confirm against a fixed BCU capture before any parity-complete claim.
   Do not land the core-loop change from a deterministic trace alone.

## Explicit non-tasks

- Do not create a generic castle-owned attack runtime: BCU evidence assigns plain castles no attack owner.
- Do not treat a direct parser field as proof that a corresponding runtime is missing or complete.
- Do not claim BCU save compatibility from `localStorage` persistence.
- Do not promote headless traces to visual acceptance.

## Common checks

```bash
node scripts/check-bcu-parser-indexes.mjs
node scripts/check-projectile-damage-parity.mjs
node scripts/check-proc-immunity-resistance-parity.mjs
node scripts/check-bcu-delay-runtime.mjs
node scripts/check-bcu-summon-runtime-parity.mjs
node scripts/check-bcu-spirit-bundle-manifest-parity.mjs
node scripts/check-bcu-castle-guard-parity.mjs
node scripts/check-bcu-wallet-runtime-parity.mjs
node scripts/check-bcu-non-basic-cat-cannon-runtime-parity.mjs
node scripts/check-ability-partial-blockers.mjs
```

Run only the checks relevant to touched files, but never silently skip a missing required check. Run `node --check` on every changed JS/MJS file.