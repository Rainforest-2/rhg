# CODEX HANDOFF - BCU parity "100%" task

**Date:** 2026-06-19
**Status:** audit-corrected handoff. This file is not source of truth; it is a launch checklist for the next agent.
**User standing order (verbatim, JA):** 「部分実装や目視が必要なもの、未実装なものを、全て完璧と言える状況にすること。完成度を聞かれても100%と言えるまでしろ。99%でもダメ」

Interpretation: get every BCU parity row to a state that can be defended as 100%, but never fake completion. In this repo, `fully-complete` means code-complete evidence plus recorded human/manual visual review. If human visual review is not recorded, the honest status is `code-complete` or `human-visual-review-needed`, not `fully-complete`.

---

## 0. Read this first

Read `AGENTS.md` first. `CLAUDE.md` is a symlink to `AGENTS.md` in this checkout.

Then read the current source-of-truth docs before trusting this handoff or older notes:

- `docs/ability-logic/current-ability-parity-status.md`
- `docs/ability-logic/bcu-unresolved-evidence-blockers.md`
- `docs/ability-logic/bcu-visual-review-checklist.md`
- `docs/ability-logic/bcu-parity-codex-workplan.md`
- `docs/ability-logic/bcu-fact-first-update-procedure.md`
- `docs/bcu-migration-status.md`
- `docs/agent/README.md`
- `docs/agent/bcu-parity-rules.md`
- `docs/agent/checks-and-verification.md`
- `docs/agent/report-format.md`
- `docs/agent/md-maintenance-rules.md`

Mandatory workflow:

```txt
fact -> existing JS audit -> minimal update -> deterministic check -> docs/status update
```

Do not mark anything `fully-complete` from AI screenshot inspection alone. Codex/headless Playwright screenshots can provide evidence and can reveal bugs, but repo rules still require a recorded human/manual visual review for `fully-complete`.

---

## 1. Corrections to the previous handoff draft

The previous draft was useful but not safe enough. Treat these corrections as binding unless newer facts disprove them.

- Do not say "Codex can perform manual visual review." Codex can run a browser and capture screenshots; that is not the same as the human/manual review required by `docs/agent/bcu-parity-rules.md`.
- Do not promote visual rows to `fully-complete` until `docs/ability-logic/bcu-visual-review-checklist.md` records human acceptance.
- Do not classify summon, targetForms, PCoin, or extra-revive as "official-pack out of scope, therefore complete." Current docs keep them partial or blocker-scoped for specific reasons.
- Spirit asset-path work has now been implemented for attack-only spirit forms. Treat `scripts/check-bcu-spirit-bundle-manifest-parity.mjs` plus `scripts/check-bcu-spirit-lifecycle-parity.mjs` as the deterministic guard; human/manual visual review is still not recorded.
- `tmp/visual-spirit2.mjs` now uses `TEMPLATE_LOAD_LEVEL.SPAWN_READY`; the 2026-06-19 headless run captured spirit unit 729 spawning from conjurer 728, but this is still evidence capture rather than recorded human/manual visual acceptance.

---

## 2. Verified repo facts from this audit

These facts were checked while rewriting this handoff:

- `AGENTS.md` exists and `CLAUDE.md -> AGENTS.md`.
- `public/assets/generated/bcu-bundle-manifest.json` contains `actor:unit:728:f`.
- `public/assets/generated/bcu-bundle-manifest.json` now contains the 21 attack-only spirit form bundles derived from `DataUnit.ints[110]`, including `actor:unit:729:f`.
- `public/assets/generated/bcu-actor-index.json` has an entry for `unit:729:f` with `status: "partial"` and `bundleRef.bundleKey: "actor:unit:729:f"`.
- `public/assets/bundles/actor/unit/729-f.zip` exists and contains:
  - `bundle.json`
  - `image.png`
  - `imgcut.imgcut`
  - `model.mamodel`
  - `attack.maanim`
  - `icon.png`
- `public/assets/generated/bcu-diagnostics.json` no longer records runtime-usable attack-only spirit forms as skipped.
- `scripts/build-bcu-semantic-bundles.mjs` skips incomplete actor entries except derived spirit form actors whose image/imgcut/model/attack entries exist.
- `js/bcu/SemanticAssetProvider.js::hasBundleForKey()` only bypasses manifest presence for tolerated `status: "invalid"` entries with complete actor bundle files. It does not make `status: "partial"` spirit entries runtime-usable.
- `js/bcu/BcuAssetLoader.js` throws `Missing full actor bundle for semantic key ...` when a semantic actor entry has no manifest-backed bundle and raw fallback is not allowed.
- `js/battle/BattleActorFactory.js` currently loads `idle` and `move` at render-core, `attack` at spawn-ready, and `kb` at full-visual. A spirit form with attack-only assets needs more than just a manifest entry unless its actor definition/runtime loading path is adjusted with tests.

Important implication: attack-only spirit forms are handled by mapping their bootstrap animation ids to BCU attack `anim02`; no broad partial-actor fallback was added.

---

## 3. Spirit form assets - resolved to code/evidence level

### Symptom

Conjurer units resolve a spirit id from `DataUnit.ints[110]` and spawn a spirit unit form such as `unit:729:f`. This repo now registers attack-only spirit form ZIPs as manifest-backed partial actor bundles when the required runtime entries exist.

Former live failure shape:

```txt
Missing full actor bundle for semantic key unit:729:f
```

### BCU facts already documented

Current source-fact doc:

- `docs/ability-logic/bcu-ability-source-evidence.md`

Relevant BCU owners listed there:

- `battle/data/DataUnit.java`
- `battle/StageBasis.java`
- `battle/LineUp.java`
- `battle/entity/EUnit.java`

Documented behavior:

- Unit CSV `ints[110] -> SPIRIT.id`.
- Spirit lifecycle is `StageBasis` / production state, not a normal attack proc status.
- Spawn cooldown is 15 frames.
- Spawn position uses the BCU spirit range/clamp behavior.
- `EUnit.isSpirit` starts attack on add, rejects incoming damage via `P_IMUATK`, and self-kills after attack completion.

### Existing JS owners

- `js/battle/bcu-runtime/BcuSpiritLifecycleRuntime.js`
- `js/battle/BattleSceneBcuSpiritPatch.js`
- `js/battle/BcuCombatModel.js`
- `js/battle/BattleActorFactory.js`
- `js/bcu/BcuAssetLoader.js`
- `js/bcu/SemanticAssetProvider.js`
- `scripts/build-bcu-semantic-bundles.mjs`

### Known spirit ids

The previous scan found these attack-only spirit form ids with disk bundle present and manifest missing:

```txt
729, 732, 734, 739, 755, 761, 764, 775, 800, 802, 812, 816, 821, 825, 838, 855, 860
```

Do not hardcode this list as the only source. Derive it from current unit stats/proc data (`proc.spirit.id`) in the check/build path, then assert the derived set matches expectations.

### Completed fix shape

1. Added deterministic check `scripts/check-bcu-spirit-bundle-manifest-parity.mjs`.
   - Derive conjurer -> spirit ids from loader-backed unit stats.
   - Assert each spirit actor entry has a ZIP.
   - Assert each ZIP contains `bundle.json`, `image.png`, `imgcut.imgcut`, `model.mamodel`, `attack.maanim`.
   - Assert `SemanticAssetProvider.hasBundleForKey('unit:<id>:f')` is true after load.
   - Assert `BattleActorFactory.preloadTemplate(..., { level: TEMPLATE_LOAD_LEVEL.SPAWN_READY })` works for a real spirit unit def without raw fallback.

2. Updated `scripts/build-bcu-semantic-bundles.mjs`.
   - For derived spirit ids only, allow `entry.status === 'partial'`.
   - Keep `image`, `imgcut`, `model`, and `attack` required.
   - Do not invent missing CSV indexes.
   - Do not add loose `public/assets/bcu/**` runtime fallback.

3. Handled attack-only animation loading explicitly.
   - `resolveBcuSpiritUnitDef` marks spirit defs `bcuSpiritAttackOnly` and maps move/idle/attack/kb bootstrap ids to `anim02`.
   - `markBcuSpiritActor` now starts the attack animation on add.
   - No broad partial-actor runtime fallback was added.

4. Regenerated generated assets with the fixed builders.

5. Deterministic checks now pass. Browser visual capture remains useful, but human/manual visual acceptance is still required before `fully-complete`.

6. Updated current docs to keep spirit at `human-visual-review-needed`, not `fully-complete`.

---

## 4. Headless visual evidence already captured

Screenshots exist under `tmp/visual-shots/` for:

- wallet/worker button states
- cat cannon ready/fire frames
- BASE_WALL
- barrier / demon shield / delay direct-spawn effects
- castle/base guard hold/break effects
- zombie corpse/revive phases
- burrow down/move/up phases
- mini-death-surge

These screenshots are useful evidence, but the checklist still says `not-reviewed` for the tracked visual rows. The next agent may show these to the user or use them as debugging artifacts, but must not convert them to `accepted` without an actual human/manual review decision.

Current checklist file:

- `docs/ability-logic/bcu-visual-review-checklist.md`

Tracked rows there currently include:

- `P_DELAY runtime/effect`
- `barrier / demon shield / shield breaker`
- `burrow`
- `spirit lifecycle`
- `castle/base guard`
- `summon`
- `zombie revive visual`

There are also visual rows in `current-ability-parity-status.md` for wallet/cannon/base-wall/non-basic cannon work. Keep those aligned if human review is later recorded.

---

## 5. Current partial/blocker map

Use the current docs for exact wording. This is only a quick routing map.

### Visual/manual review blockers

Rows with code/effect evidence but no recorded human visual acceptance include:

- `P_DELAY`
- barrier / demon shield / shield breaker
- spirit lifecycle, with the asset-path caveat above
- castle/base guard
- standard zombie corpse/revive visuals
- mini-death-surge visuals
- wallet/worker and cat cannon UI/firing visuals where current status still says human review is needed
- BASE_WALL / non-basic cannon visual placement where current status still says human review is needed

### Still partial or source-loader blocked

Do not call these complete without additional loader/source/test work:

- Summon: explicit proc-object runtime exists, but normal CSV holder is not proven and broad real custom/proc-object loading is not implemented.
- Summon entry visuals: `Entity.setSummon(anim_type)` appearance is not manually reviewed.
- `targetForms` / special trait compatibility: focused fixtures exist, broad real custom trait/form loader fixtures and capture/proc edge coverage remain.
- Combo/orb/treasure/talent/PCoin external modifiers: many hooks exist, but broad real-data PCoin acceptance and in-battle visual acceptance remain blocker-scoped.
- AB_SKILL status resistance: PCoin/custom status resistance holder sources are still gated until proven.
- Zombie extra-revive/custom revive: focused fixture handoff exists, broad real extra-reviver source/range filtering and visual acceptance remain.
- Bounty/money visual: no stable battle visual owner/effect alias is proven; keep logic/economy-only unless future source proves otherwise.
- Enemy toxic immunity: current evidence is negative for supported enemy data. Do not add an enemy `IMUPOIATK` CSV holder.

---

## 6. Recommended next execution sequence

### Batch A - spirit asset-path truth (done)

Completed in the current batch. Keep these checks in future verification:

```bash
node --check scripts/build-bcu-semantic-bundles.mjs
node --check js/battle/bcu-runtime/BcuSpiritLifecycleRuntime.js
node --check js/battle/BattleActorFactory.js
node --check scripts/check-bcu-spirit-bundle-manifest-parity.mjs
node scripts/check-bcu-spirit-bundle-manifest-parity.mjs
node scripts/check-bcu-spirit-lifecycle-parity.mjs
node scripts/check-actor-bundle-compatibility.mjs
node scripts/check-actor-bundles-complete.mjs
node scripts/check-bcu-parser-indexes.mjs
```

Browser harnesses are still useful for evidence capture, but human/manual visual acceptance is still the gate for `fully-complete`.

### Batch B - visual checklist closure

Only after the user/human accepts screenshots or performs browser review:

1. Record exact screenshot paths, setup, and observed behavior in `docs/ability-logic/bcu-visual-review-checklist.md`.
2. Promote rows in `current-ability-parity-status.md` only where code-complete evidence and human/manual visual acceptance both exist.
3. Run Markdown and relevant deterministic checks.

### Batch C - remaining partial rows

Proceed one blocker at a time:

- summon custom/proc-object loader discovery
- targetForms real custom loader fixtures
- broad PCoin acceptance / in-battle acceptance
- extra/custom zombie revive source/range fixtures
- non-basic cannon ATK/EXT animation aliases and sweep timing

Do not blend these into one broad rewrite.

---

## 7. Useful tmp tooling

All listed files are currently under `tmp/` and untracked. Treat them as disposable unless you intentionally promote a deterministic check into `scripts/`.

- `tmp/visual-harness.mjs` - shared Playwright harness; static server base is `http://127.0.0.1:4173/`.
- `tmp/visual-ui-cannon.mjs` - wallet/cannon/BASE_WALL capture harness.
- `tmp/visual-effects-direct.mjs` - direct paused effect spawn for barrier/shield/delay/guard/zombie phases.
- `tmp/visual-burrow-zombie.mjs` - burrow lifecycle capture.
- `tmp/visual-spirit-surge.mjs` - mini-death-surge capture; spirit portions should be re-run after the spirit bundle/runtime changes if visual evidence is needed.
- `tmp/visual-spirit2.mjs` - spirit capture harness using `TEMPLATE_LOAD_LEVEL.SPAWN_READY`; 2026-06-19 output captured `dog-729-4` in attack state from conjurer 728.
- `tmp/probe-runtime-abilities.mjs` - runtime ability-id probe. Runtime IDs are authoritative over CSV scans when they disagree.
- `tmp/scan-enemy-abilities.mjs`, `tmp/scan-unit-abilities.mjs`, and related scanners - useful for source discovery but not completion evidence by themselves.

Known browser setup from the previous run:

```bash
python3 -m http.server 4173
```

Chromium headless shell path used previously:

```txt
/home/codespace/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell
```

Do not leave the server running at the end of a turn if it is only needed for your verification.

---

## 8. General verification rules

For any JS/MJS touched:

```bash
node --check <file>
```

For common BCU parity batches, use the current relevant subset from:

```bash
node scripts/check-bcu-ability-parity-safe-suite.mjs
```

For effect bundle changes, also run:

```bash
unzip -l public/assets/bundles/effect/status-effects.zip
unzip -l public/assets/bundles/effect/wave.zip
unzip -l public/assets/bundles/effect/kbeff.zip
```

Update `docs/ability-logic/effect-zip-audit.md` only when effect bundles change. The spirit asset work touches actor/unit bundles and generated manifests, not effect bundles, unless the fix unexpectedly changes effect assets.

For Markdown-only maintenance, run:

```bash
git diff --check
find . -maxdepth 3 \( -name "AGENTS.md" -o -name "CLAUDE.md" -o -path "./docs/*.md" -o -path "./docs/*/*.md" -o -path "./docs/*/*/*.md" \) -print | sort
test -L CLAUDE.md
readlink CLAUDE.md
```

---

## 9. Final report format

Every implementation batch must end with:

```md
## Summary
- Rows moved to code-complete:
- Rows moved to human-visual-review-needed:
- Rows still partial:

## BCU references inspected
- files/classes/methods:

## Changed files
- code:
- tests:
- docs:
- generated assets:

## Verification
- command: result

## Remaining risks
- risk:
- reason:
- next action:
```

Never report done without command output or an explicit statement that a required verification could not run.

---

## 10. Commands/results used while auditing this handoff

Key commands run during the handoff audit:

```bash
grep -n "actor:unit:729:f\|actor:unit:728:f\|729-f" public/assets/generated/bcu-bundle-manifest.json
grep -n "unit:729:f\|unit:728:f" public/assets/generated/bcu-actor-index.json
grep -n "actor:unit:729:f\|729-f.zip" public/assets/generated/bcu-diagnostics.json
unzip -l public/assets/bundles/actor/unit/729-f.zip
grep -n "isRuntimeUsableActorBundleEntry\|preloadTemplate\|TEMPLATE_LOAD_LEVEL" js/bcu/SemanticAssetProvider.js js/battle/BattleActorFactory.js
```

Important results:

- manifest grep found `actor:unit:728:f` but not `actor:unit:729:f`.
- actor index grep found `unit:729:f` with bundleRef.
- diagnostics grep found `actor-runtime-incomplete` for `actor:unit:729:f`.
- `unzip -l` confirmed the attack-only `729-f.zip` contents.
- factory grep confirmed `TEMPLATE_LOAD_LEVEL` values are strings and render-core currently requires idle/move.
