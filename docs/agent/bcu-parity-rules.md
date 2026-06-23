# BCU Parity Rules

Detailed BCU parity rules for agents working on `Rainforest-2/rhg`.

## Status vocabulary

Use these terms consistently:

- `code-complete-candidate`: BCU source evidence, current JS owner/wiring, semantic bundle evidence where relevant, and deterministic checks exist. Browser appearance is not yet accepted.
- `human-visual-review-needed`: logic/effect wiring is supported, but exact browser appearance has not been manually accepted.
- `partial`: a source holder, real-data loader, runtime path, broad fixture set, or deterministic check remains incomplete.
- `unconfirmed`: the BCU source owner, serialization format, or compatibility rule is not established.
- `negative-evidence`: BCU source disproves the proposed owner. Do not implement it under that owner.
- `logic-only-unless-future-visual-proof`: gameplay/economy behavior is source-backed but no dedicated battle visual owner is proven.

Do not use bare `complete`.

## Evidence rule

A broad parity claim needs all applicable evidence:

1. BCU source behavior from local references under `references/bcu/`.
2. A current rhg parser/loader and runtime-owner audit.
3. Correct numeric rules: probability, frames, percentages, distance, random range, rounding, level scaling, order, overwrite, and suppression.
4. Matching battle-phase ownership and wrapper order.
5. Production assets from semantic ZIP bundles, never loose raw runtime fallback.
6. Deterministic tests that fail on the asserted behavior.
7. Loader-backed fixtures when the claim concerns real custom data.
8. Manual browser review when the claim says visible behavior matches BCU.

A parser field, headless trace, old README, or one synthetic fixture does not establish broad parity by itself.

## Reference priority

1. Checked-in BCU common source ZIP.
2. Checked-in BCU Android source ZIP.
3. Other checked-in BCU source/reference material.
4. Current rhg code, semantic bundle inventories, and deterministic checks.
5. PC draw-side sources only where common/Android cannot decide a rendering/UI claim.
6. Historical docs only as supporting context, never as sole proof of current rhg behavior.

## Runtime asset rule

Production runtime resolves generated semantic ZIP bundles. Files under `public/assets/bcu/**` are source material and must not become a silent browser fallback.

When a required asset is absent:

1. prove the BCU asset owner/alias;
2. extend the appropriate bundle builder;
3. regenerate bundle/manifests;
4. inspect entries with `unzip -l`;
5. add deterministic loader/alias tests;
6. update the effect/bundle audit.

Never hand-edit ZIP contents.

## Current priority groups

1. **W0 — proof harness and docs:** keep tests and current status truthful.
2. **W1 — real custom-pack SUMMON loading:** runtime exists; real data discovery/loading is the gap.
3. **W2 — persistence scope:** distinguish repository-local browser persistence from BCU save/lineup compatibility; surface storage failure.
4. **W3 — real-data trait/modifier fixtures:** `targetForms`, combo, orb, treasure, talent, and PCoin acceptance.
5. **W4 — manual browser review:** visible effects/UI with fixed BCU fixtures.
6. **W5 — non-basic cannon visual assets/timing:** ATK/EXT aliases plus extend/waved frame behavior.
7. **W6 — performance cleanup:** only after behavior-bearing paths are protected by checks.

Do not reimplement a current code-complete-candidate or human-visual-review-needed row unless a source comparison or deterministic check proves a concrete regression.

## Current critical boundaries

### SUMMON

The explicit proc-object runtime exists. The remaining hard boundary is automatic real custom-pack proc-object discovery/loading. A normal unit/enemy CSV holder is unproven and must not be invented.

### Persistence

`localStorage` persistence proves only rhg’s own browser-state continuity. It does not prove BCU save or lineup import/export compatibility. Identify the BCU serialization owner and add round-trip fixtures before claiming compatibility.

### Trait/modifier coverage

Focused `targetForms` and modifier fixtures exist. Broad claims require real loader-backed custom data plus capture/proc/targetOnly and in-battle acceptance coverage.

### Visual acceptance

P_DELAY, shield families, burrow, spirit, castle guard, zombie revive, basic/non-basic cannon behavior, and BASE_WALL need manual browser review where the current checklist says so.

### Negative evidence

Do not build a generic castle-owned attack runtime. Plain BCU `ECastle` does not own one; boss bases use `EEnemy`, and HP/kill trigger spawns are stage-owned.

## Documentation requirements

Update existing docs in the same change batch:

- `../ability-logic/current-ability-parity-status.md`
- `../ability-logic/bcu-unresolved-evidence-blockers.md`
- `../ability-logic/bcu-visual-review-checklist.md` only after actual browser review
- `../ability-logic/effect-zip-audit.md` when effects/bundles change
- `../ability-logic/bcu-parity-codex-workplan.md` when priority changes
- `../bcu-migration-status.md` when the high-level audit changes
- root `README.md` / `AGENTS.md` when the public or agent-facing summary changes

For an incomplete row, state exactly whether the missing piece is source evidence, data loader, runtime owner, deterministic test, browser review, or serialization compatibility.

## Naming discipline

- `strengthen`: attack-up `P_STRONG` threshold state.
- `strongAttack`: `P_SATK`.
- `strong`: `AB_GOOD` damage family.
- `weaken`: `P_WEAK`.
- `freeze`: internal name for `P_STOP`; document the BCU name too.
- `toxic`: internal name for `P_POIATK`; document the BCU name too.
- `surge`: BCU volcano / 烈波.
- `blast`: 爆波.
- `seal`: only with proven BCU `P_SEAL` source; never conflate it with curse.