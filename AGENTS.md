# AGENTS.md — Codex task guide for regenerated enemy icons, Wanko player-unit coverage, and formation stability

Repository: `rhgrive2/game`
Target branch: `main`

## Mission

Fix the current actor-asset issues with a narrow, evidence-driven scope:

1. Regenerate **all enemy UI icons** from actual enemy actor assets, rendering the actor's **initial/default pose**, then store the result in `public/assets/bundles/icon/enemy.zip`.
2. Fix **Wanko-family player-unit spawn coverage**. Enemy characters are usable as player-side actors in this project, so do not audit stage enemy spawning as the primary path.
3. Preserve formation catalog virtualization and scroll stability.

This is not a narrow fix for a few example IDs. Enemy icon generation must cover the full enemy set. Spawnability investigation must focus on Wanko-family actors only.

---

## Scope corrections

### Do not spend effort proving stage enemy spawning

Do not run a broad stage enemy audit merely to prove whether enemies spawn from stage CSV rows. In this project, enemy actors can be used as player-side characters, so the reported “can’t deploy character” class should be validated through the player/formation production path.

Stage enemy spawn checks are optional regression checks only when a change directly touches stage enemy loading. They are not required for this task.

### Spawnability target: Wanko-family only

The spawnability audit must focus on Wanko-family actors only. Do not audit every enemy or every playable character for spawnability unless required to build the Wanko candidate set.

Codex must determine the Wanko-family candidate set from repository data instead of relying only on a hard-coded ID list. Use all available evidence, such as:

- localized enemy names containing `ワンコ`, `わんこ`, or close variants,
- English/localized names such as `Doge` if available,
- known Wanko-series naming in BCU language/name files,
- existing formation/catalog entries that are Wanko enemy-as-player actors,
- semantic actor metadata that links those actors to enemy IDs.

The script must output the detected Wanko candidate list and explain why each actor was included.

---

## Definitions

### Actor

An actor means a renderable battle actor. For this task, two actor groups matter:

- all enemy actors for icon generation, e.g. `enemy:388`, `enemy:610`, `enemy:699`,
- Wanko-family actors for player-side deployability, e.g. Wanko/Doge-like enemy actors exposed in formation/player production.

### Expected missing actor

An actor may be intentionally unavailable only if the repository explicitly marks it as expected missing/invalid in an error allowlist such as `error.json` or an equivalent project-maintained validation file.

Codex must locate and document the exact allowlist file(s). If no allowlist exists for an unavailable Wanko actor, treat the actor as a defect unless the source asset data is genuinely absent.

### Bug/invalid actor

If source asset data itself is absent from `assets/bcu` / generated actor bundles / semantic indexes, the actor may be a bug character, invalid content entry, or unsupported content. That is acceptable only when proven by diagnostics and reported with exact missing files and IDs.

Do not silently hide these actors.

---

## Non-negotiable principles

### Evidence before edits

For every issue class:

1. reproduce or audit it,
2. identify failure phase,
3. apply the smallest generic fix,
4. rerun diagnostics,
5. browser-test representative cases.

Do not guess mappings or add ID-specific hacks.

### No fake success

Do not:

- replace broken Wanko actors with dummy actors,
- spawn invisible placeholders,
- return generic icons and call that fixed,
- use `edi_*.png` as a selected icon source,
- bypass semantic-strict globally,
- suppress errors without diagnostics,
- remove `BattleActorFactory`, production, or asset safety checks.

### Keep battle logic stable

Do not change damage, procs, knockback, animation timing, economy, base HP, camera, stage timing, or spawn scheduling unless a diagnostic proves that exact logic is the failure source.

Most expected fixes should be in asset discovery, generated indexes, icon generation, actor bundle validation, or player/enemy-as-player actor mapping.

---

## Known regression examples

These IDs are examples for icon/asset regressions, not a complete spawn audit target:

```text
enemy:388
enemy:443
enemy:560
enemy:609
enemy:610
enemy:611
enemy:612
enemy:613
enemy:695
enemy:696
enemy:697
enemy:699
```

Known observations:

- `000010.asset.bcuzip` / `public/assets/bcu/000010` is an enemy icon pack but skips some IDs such as `388`.
- `enemy:388` has actor source files under `public/assets/bcu/000003/org/enemy/388/`, including `388_e.png` and `388_e.imgcut`.
- `610`, `611`, and `612` have shown UI icon failures because `public/assets/bundles/icon/enemy.zip` lacks `enemy/610.png`, `enemy/611.png`, and `enemy/612.png`.
- `560` and `699` have shown availability issues and may involve bundle/index/manifest omissions.
- Combination/assembled enemies, for example enemies whose sprite sheet contains multiple parts, must not be represented by a random single cut.

---

## Required enemy icon strategy

### Replace the current mixed enemy-icon strategy

Do not keep a mixed model where some enemy icons come from:

- `enemy_icon_*.png`,
- aggregate icon zip entries,
- actor bundle `icon.png`,
- `edi_*.png`,
- runtime fallback from raw actor files.

Instead, build one canonical enemy icon bundle:

```text
public/assets/bundles/icon/enemy.zip
```

Every generated enemy icon must be stored as:

```text
enemy/{enemyId}.png
```

Example:

```text
enemy/388.png
enemy/610.png
enemy/699.png
```

### Source for all enemy icons

Generate every enemy icon from the actual actor assets:

```text
{id}_e.png
{id}_e.imgcut
{id}_e.mamodel
{id}_e00.maanim / equivalent default or idle animation
```

or the equivalent generated actor bundle entries:

```text
image.png
imgcut.imgcut
model.mamodel
move.maanim / idle.maanim / default maanim equivalent
```

Use raw BCU source paths or generated actor bundles only during generation. Runtime must not perform raw actor/imgcut/model/animation fallback.

### Do not use EDI as icon source

`edi_*.png` may exist and may be used by BCU Java internally, but this project must not use it as the selected UI icon source for this task.

Treat `edi_*.png` as diagnostic-only evidence.

### Enemy icon dimensions

Generate icons as:

```text
128x128 PNG
transparent background
aspect-ratio preserved
centered
```

Do not use 64x64.

### Icon target pose: initial/default state

The icon must represent the actor's initial/default visual state, not an arbitrary sprite-sheet crop.

For normal single-part enemies, the initial/default visual may be equivalent to a representative rendered part.

For combination/assembled enemies, Codex must render the assembled actor pose using the model and animation data:

```text
sprite sheet + imgcut + mamodel + initial/default maanim frame
```

The generated icon should be the composed visible actor at frame 0 of the default/idle/move animation, whichever the repository's animation system uses as the actor's neutral initial state.

Do not use the attack animation, knockback animation, death animation, or an arbitrary frame unless the neutral animation is missing and the fallback is explicitly reported.

### Initial-pose composition requirements

The generator must support assembled/combination enemies. For each enemy, attempt icon generation in this order:

1. **Composed initial pose** from image + imgcut + mamodel + default/idle/move maanim frame 0.
2. If no default/idle/move animation exists, use a documented neutral candidate only if validated by diagnostics.
3. If model or animation is genuinely unavailable, fall back to a deterministic single-cut thumbnail only as a degraded fallback.
4. If no valid cut exists, report failure.

The generated report must record the method:

```text
composed-initial-pose
single-cut-degraded-fallback
failed
```

For composed icons, report:

```js
{
  compositionMethod: "composed-initial-pose",
  sourceImagePath,
  sourceImgcutPath,
  sourceMamodelPath,
  sourceMaanimPath,
  frame: 0,
  composedBounds,
  partsRendered,
  partsSkipped
}
```

For degraded fallback icons, report:

```js
{
  compositionMethod: "single-cut-degraded-fallback",
  fallbackReason,
  selectedCut
}
```

### Determinism

The generator must be deterministic:

- stable enemy ordering,
- stable zip entry ordering,
- stable timestamps if the zip writer supports it,
- same inputs produce byte-equivalent outputs when feasible,
- report SHA-256 for every generated PNG.

### Single-cut fallback selection

Single-cut fallback is allowed only when composed initial pose generation is impossible and the reason is recorded.

When using `.imgcut` without model/animation composition:

1. parse valid cut rectangles,
2. ignore zero-area/out-of-bounds cuts,
3. prefer the largest valid visible rectangle unless model/animation metadata proves a better main-body part,
4. preserve aspect ratio when fitting into 128x128.

If a sprite has no valid crop, report it as `imgcut-invalid` instead of inventing a crop.

---

## Required scripts

## Task 1 — Audit expected-missing allowlists

Create or update:

```text
scripts/audit-actor-error-allowlist.mjs
```

Purpose: find repository-maintained allowlists for actors/assets that are intentionally missing or invalid, including `error.json` if present.

The script must output:

```text
tmp/actor-error-allowlist-audit.json
tmp/actor-error-allowlist-audit.md
```

Report:

```js
{
  discoveredFiles: [],
  parsedEntries: [],
  enemyIds: [],
  playerCharacterIds: [],
  actorKeys: [],
  unparsedFiles: [],
  notes: []
}
```

Rules:

- If an actor is missing but listed in the allowlist, classify as `expected-missing`.
- If a Wanko actor is missing and not listed, classify as a defect unless source assets are provably absent.
- If an allowlist file cannot be parsed, fail loudly in the report.

---

## Task 2 — Full enemy asset and icon source audit

Create or update:

```text
scripts/audit-bcu-enemy-assets.mjs
```

The audit must cover all known enemies for icon generation, not only visible examples.

For every enemy, report:

```js
{
  enemyId,
  actorKey: "enemy:N",
  id3,
  name,
  hasStats,
  hasName,
  isListedInErrorAllowlist,
  rawActorDir,
  rawImagePath,
  rawImgcutPath,
  rawMamodelPath,
  rawDefaultMaanimPath,
  rawMoveMaanimPath,
  rawIdleMaanimPath,
  rawRequiredAnimations,
  rawImageExists,
  rawImgcutExists,
  rawMamodelExists,
  rawDefaultOrNeutralAnimationExists,
  rawRequiredAnimationsPresent,
  actorBundlePath,
  actorBundleExists,
  actorBundleInManifest,
  actorBundleReadable,
  actorBundleHasImage,
  actorBundleHasImgcut,
  actorBundleHasModel,
  actorBundleHasDefaultOrNeutralAnimation,
  actorBundleRequiredAnimationsPresent,
  semanticActorEntry,
  semanticStatus,
  runtimeAssetResolvable,
  currentEnemyZipEntry,
  currentEnemyZipEntryExists,
  regeneratedEnemyZipEntry,
  regeneratedEnemyZipEntryExpected,
  regeneratedEnemyZipEntryExists,
  iconGenerationSource,
  iconGenerationPossible,
  iconCompositionMethod,
  iconGenerationFailureClass,
  iconGenerationFailureReason,
  actorAssetFailureClass,
  actorAssetFailureReason
}
```

Output:

```text
tmp/enemy-asset-audit.json
tmp/enemy-asset-audit.md
```

The markdown must include:

- summary by `actorAssetFailureClass`,
- summary by `iconGenerationFailureClass`,
- summary by `iconCompositionMethod`,
- all enemies not listed in allowlist that cannot generate an icon,
- all enemies requiring degraded single-cut fallback,
- target section for the regression IDs listed above.

This script is for icon/source coverage, not broad stage spawn validation.

---

## Task 3 — Regenerate the entire enemy icon zip

Create or update:

```text
scripts/generate-enemy-icons.mjs
```

Required CLI:

```bash
node scripts/generate-enemy-icons.mjs --dry-run
node scripts/generate-enemy-icons.mjs --apply
```

Default mode must be dry-run.

The generator must:

1. read the full enemy audit or compute equivalent source discovery,
2. generate 128x128 PNG icons for every enemy with valid actor visual assets,
3. use composed initial pose generation whenever `image + imgcut + mamodel + neutral maanim` are available,
4. use deterministic single-cut fallback only when composition is impossible and the reason is documented,
5. write all generated icons into:

```text
public/assets/bundles/icon/enemy.zip
```

6. store entries as `enemy/{enemyId}.png`,
7. replace the previous `enemy.zip` only in `--apply` mode,
8. create a backup or write a git-friendly report of what changed,
9. never use `edi_*.png`,
10. write reports:

```text
tmp/generated-enemy-icons-report.json
tmp/generated-enemy-icons-report.md
```

Per-enemy report:

```js
{
  enemyId,
  actorKey,
  sourceImagePath,
  sourceImgcutPath,
  sourceMamodelPath,
  sourceMaanimPath,
  compositionMethod,
  frame,
  composedBounds,
  partsRendered,
  partsSkipped,
  selectedCut,
  fallbackReason,
  outputZipPath: "public/assets/bundles/icon/enemy.zip",
  outputInternalPath: "enemy/N.png",
  width: 128,
  height: 128,
  sha256,
  status,
  failureClass,
  failureReason,
  listedInErrorAllowlist
}
```

Acceptance:

- All enemies with valid source visual data get `enemy/{id}.png` in `enemy.zip`.
- Combination/assembled enemies are rendered from initial/default pose, not a random single part.
- Every `single-cut-degraded-fallback` is listed with a reason.
- Enemies without source data are listed with exact reasons.
- Expected missing/error-listed actors are separated from defects.
- `388`, `440`, `610`, `611`, `612`, `695`, `696`, `697`, and `699` are explicitly reported.

---

## Task 4 — Simplify runtime enemy icon resolution

After regenerating `enemy.zip`, runtime should treat it as the canonical enemy icon source.

Likely files:

```text
js/bcu/SemanticAssetProvider.js
js/ui/FormationEditor.js
js/bcu/BcuAssetLoader.js
```

Required runtime behavior:

1. For `enemy:N`, read only:

```text
public/assets/bundles/icon/enemy.zip -> enemy/N.png
```

2. Cache zip handles and object URLs.
3. Do not scan raw actor directories or actor bundles during formation/catalog icon loading.
4. Do not use `edi_*.png`.
5. Missing enemy icon means either:
   - actor is expected-missing/error-listed, or
   - generation failed and must be reported.

Console behavior:

- No repeated red console spam for missing icons.
- Deduplicate icon failures by actor key.
- Use diagnostics for expected missing entries.
- Use `console.error` only for unexpected exceptions or data corruption.

Acceptance:

- Formation/catalog UI does not bulk-load actor images/imgcuts/model/maanim.
- `enemy.zip` lookup is the only normal enemy icon path.
- Missing entries are traceable to generation report/audit.

---

## Task 5 — Detect Wanko-family player-unit candidates

Create or update:

```text
scripts/audit-wanko-candidates.mjs
```

Purpose: build the exact Wanko-family candidate set to use for player-side spawn validation.

The script must inspect all relevant available data:

- enemy names from BCU language/name files,
- semantic actor indexes,
- formation/catalog entries,
- generated enemy asset audit,
- any known player-side enemy-as-unit mapping files,
- allowlists such as `error.json`.

Detection should include names containing:

```text
ワンコ
わんこ
Doge
```

and close Wanko-family variants if repository data clearly indicates them. Do not include unrelated enemies merely because they are enemies.

Output:

```text
tmp/wanko-candidate-audit.json
tmp/wanko-candidate-audit.md
```

Per candidate:

```js
{
  actorKey,
  enemyId,
  name,
  localizedNames,
  matchedBy,
  formationCharacterId,
  playerActorKey,
  hasEnemyAssetSource,
  hasPlayerMapping,
  listedInErrorAllowlist,
  inclusionReason
}
```

Acceptance:

- The Wanko candidate set is explicit and reviewable.
- Every included actor has a documented reason.
- Non-Wanko enemies are not included in spawnability scope.

---

## Task 6 — Audit Wanko player-unit spawn coverage

Create or update:

```text
scripts/audit-wanko-player-spawn.mjs
```

Purpose: verify that Wanko-family candidates can be deployed as player-side units through the actual formation/production path.

Use the Wanko candidate list from `tmp/wanko-candidate-audit.json`.

For every Wanko candidate:

```js
{
  actorKey,
  enemyId,
  enemyName,
  playerCharacterId,
  playerActorKey,
  sourceRoster,
  hasFormationCatalogEntry,
  hasPlayerMapping,
  hasStats,
  semanticActorEntry,
  semanticStatus,
  actorBundlePath,
  actorBundleExists,
  actorBundleInManifest,
  requiredAnimationsPresent,
  runtimeAssetResolvable,
  preloadTemplateOk,
  spawnReadyOk,
  productionValidationOkWithTestMoney,
  listedInErrorAllowlist,
  failurePhase,
  failureReason
}
```

Output:

```text
tmp/wanko-player-spawn-audit.json
tmp/wanko-player-spawn-audit.md
```

Failure phases:

```text
ok
expected-missing
not-wanko
catalog-missing
player-mapping-missing
source-unit-missing
stats-missing
semantic-actor-missing
semantic-status-invalid
actor-bundle-missing
actor-bundle-not-in-manifest
required-animation-missing
template-preload-failed
production-validation-failed
spawn-ready-failed
unknown
```

Acceptance:

- Only Wanko-family candidates are audited for spawnability.
- Every non-allowlisted Wanko deploy failure has a precise reason.
- Do not modify battle/production logic before the audit proves the failure phase.

---

## Task 7 — Fix Wanko player-unit spawn coverage

If `scripts/audit-wanko-player-spawn.mjs` finds failures:

- mapping failure: fix enemy-as-player / formation catalog mapping only,
- stats failure: fix stats lookup/mapping only,
- semantic/bundle/index failure: fix generic actor bundle/index path,
- preload failure: fix asset/template resolution,
- production validation failure: confirm whether cost/cooldown/slot state is expected before changing logic.

Likely files:

```text
js/battle/PlayableCharacterRegistry.js
js/battle/CharacterCatalog.js
js/battle/BattleScene.js
js/battle/BattleActorFactory.js
js/bcu/SemanticAssetProvider.js
js/bcu/BcuAssetLoader.js
```

Do not change combat formulas, proc logic, or animation timing unless diagnostics prove it is required.

Acceptance:

- Rerun `node scripts/audit-wanko-player-spawn.mjs`.
- All Wanko candidates either reach `spawnReadyOk: true` or are precisely unresolved/expected-missing.
- Browser confirms previously failing Wanko actors can be deployed and emit `playerSpawned`.

---

## Task 8 — Repair actor bundle/index/manifest coverage if needed

Create or update only if diagnostics require it:

```text
scripts/repair-bcu-actor-bundle-index.mjs
```

CLI:

```bash
node scripts/repair-bcu-actor-bundle-index.mjs --dry-run
node scripts/repair-bcu-actor-bundle-index.mjs --apply
```

Default must be dry-run.

Rules:

- If a valid actor bundle exists but is omitted from manifest/index, repair generically.
- If source files exist but bundle zip is missing, rebuild only if project conventions support it.
- If image decode fails, do not mark runtime usable.
- If raw source assets are absent and not allowlisted, report as defect.

---

## Task 9 — Formation catalog stability must remain fixed

Do not regress prior UI fixes.

Verify:

```js
[...document.querySelectorAll('.formation-character-card')]
  .map(el => [Number(el.dataset.catalogIndex), el.dataset.character, el.querySelector('strong')?.textContent])
```

Acceptance:

- visual order does not change while scrolling,
- `catalogIndex` increases in visual reading order,
- tapping formation slots does not reset `.formation-catalog-scroll.scrollTop` to 0,
- tapping character cards does not reset scroll to 0,
- search/filter may reset intentionally.

Do not redesign formation UI in this task.

---

## Required browser validation

Run:

```bash
python3 -m http.server 8000
```

Enemy icon checks:

```js
globalThis.__FORMATION_ICON_DEBUG__?.recentIconFailures
globalThis.__BCU_DB__?.semanticProvider?.diagnostics
```

Regression targets must be visible or precisely unresolved:

```text
388, 440, 443, 560, 609, 610, 611, 612, 613, 695, 696, 697, 699
```

Wanko player spawn checks:

```js
globalThis.__BATTLE_PRODUCTION_DEBUG__?.failures?.slice(0, 20)
globalThis.__APP__?.battle?.debugEvents
  ?.filter(e => ['playerSpawnRejected','playerSpawned'].includes(e.type))
  ?.slice(-50)
```

Do not claim live player-unit success without `playerSpawned` or equivalent actor/template state.

---

## Testing checklist

Syntax-check changed files:

```bash
node --check scripts/audit-actor-error-allowlist.mjs
node --check scripts/audit-bcu-enemy-assets.mjs
node --check scripts/generate-enemy-icons.mjs
node --check scripts/audit-wanko-candidates.mjs
node --check scripts/audit-wanko-player-spawn.mjs
node --check scripts/repair-bcu-actor-bundle-index.mjs
node --check js/bcu/SemanticAssetProvider.js
node --check js/bcu/BcuAssetLoader.js
node --check js/bcu/BcuPathResolver.js
node --check js/bcu/BcuEnemyRepository.js
node --check js/battle/BcuStageEnemyResolver.js
node --check js/battle/BattleActorFactory.js
node --check js/battle/BattleScene.js
node --check js/battle/PlayableCharacterRegistry.js
node --check js/battle/CharacterCatalog.js
node --check js/ui/FormationEditor.js
```

Only check files that exist and/or were changed.

Required diagnostic/generation sequence:

```bash
node scripts/audit-actor-error-allowlist.mjs
node scripts/audit-bcu-enemy-assets.mjs
node scripts/generate-enemy-icons.mjs --dry-run
node scripts/generate-enemy-icons.mjs --apply
node scripts/audit-bcu-enemy-assets.mjs
node scripts/audit-wanko-candidates.mjs
node scripts/audit-wanko-player-spawn.mjs
```

Do not run broad stage enemy spawn audits unless a touched file requires a regression check.

---

## Final response required from Codex

Report all of the following:

1. Root cause classes found.
2. Exact enemy IDs whose icons still cannot be generated and why.
3. Which unresolved actors are listed in `error.json` or equivalent allowlist.
4. Which unresolved actors have no source asset data and are likely bug/invalid actors.
5. Confirmation that `public/assets/bundles/icon/enemy.zip` was regenerated from actor assets for all possible enemies.
6. Number of generated 128x128 enemy icons and total zip size.
7. Number of icons generated by `composed-initial-pose` vs `single-cut-degraded-fallback`.
8. Exact enemies that required degraded single-cut fallback and why.
9. Confirmation that `edi_*.png` was not used as selected UI icon source.
10. Confirmation that runtime enemy icon loading uses `enemy.zip` and does not bulk-load actor images/imgcuts/model/maanim.
11. Exact Wanko-family candidates detected and why.
12. Exact Wanko candidates still not deployable as player units and why.
13. Files changed.
14. Scripts added/updated.
15. Commands run.
16. Browser checks performed.
17. Whether regression targets `388`, `440`, `443`, `560`, `609`, `610`, `611`, `612`, `613`, `695`, `696`, `697`, `699` are visible or intentionally unresolved.
18. Whether every non-allowlisted Wanko candidate can be deployed as a player unit.

Do not say “all fixed” unless the full audit, generated reports, and browser checks prove it.
