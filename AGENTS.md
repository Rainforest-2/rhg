# AGENTS.md — Codex task guide for optimized enemy icon generation, asset coverage, and formation UI stability

Repository: `rhgrive2/game`
Target branch: `main`

## Purpose

Fix enemy asset/icon/spawn coverage across the full enemy set without making the browser load large actor assets just to display formation/catalog icons. Keep formation catalog virtualization and scroll behavior stable. Work evidence-first; do not guess mappings.

Known examples:

- `388` is not present as `000010/org/enemy/388/enemy_icon_388.png`; `000010` skips it. The repo does have battle actor files under `public/assets/bcu/000003/org/enemy/388/`, including `388_e.png`, `388_e.imgcut`, animations, and `edi_388.png`.
- `610`, `611`, `612` currently fail in formation UI because `public/assets/bundles/icon/enemy.zip` lacks `enemy/610.png`, `enemy/611.png`, `enemy/612.png`.
- `560` and `699` still fail in some contexts and may be bundle/index/manifest problems.
- There are more affected enemies than these examples.

Goal: every enemy with valid usable data/assets must be visible in UI and spawnable when stage rules request it. Enemies with genuinely missing/broken assets must remain unresolved with precise reasons.

---

## Critical performance policy

### Do not do heavy actor fallback generation at runtime

Do **not** make `provider.getActorUiIconUrl()` load actor bundle zips, raw `{id}_e.png`, or raw `{id}_e.imgcut` for many enemies during formation/catalog rendering.

Reason: virtual scrolling would still cause many icon requests over time, and a fallback that opens actor zips or raw actor images in the browser can become heavier than the original missing-icon problem.

Runtime should only:

1. read lightweight icon indexes/manifests,
2. lazily read small UI icon zip entries for visible cards,
3. reuse cached object URLs,
4. return an explicit missing result when no generated icon exists.

### Required optimized design

Use a pre-generation pipeline:

```text
Audit all enemies
  -> find enemies missing explicit/aggregate UI icons
  -> for only those enemies, generate small UI thumbnails from actor sprite + imgcut
  -> write a generated fallback icon zip and index
  -> runtime loads that generated icon zip/index like a normal icon source
```

The generated fallback must be produced before runtime by a script, not by mass runtime fallback.

Recommended generated outputs:

```text
public/assets/bundles/icon/enemy-fallback.generated.zip
public/assets/generated/bcu-generated-icon-index.json
```

If the generated fallback set becomes large, chunk it instead of making one huge zip:

```text
public/assets/bundles/icon/enemy-fallback-000-099.generated.zip
public/assets/bundles/icon/enemy-fallback-100-199.generated.zip
...
```

Chunk when either threshold is exceeded:

```text
fallback icons > 100 per zip
or generated zip > 2 MiB
```

The index must map each generated icon directly:

```js
{
  "enemy:388": {
    "source": "actor-imgcut-thumbnail-generated",
    "bundlePath": "public/assets/bundles/icon/enemy-fallback-300-399.generated.zip",
    "internalPath": "enemy/388.png",
    "sourceImagePath": "public/assets/bcu/000003/org/enemy/388/388_e.png",
    "sourceImgcutPath": "public/assets/bcu/000003/org/enemy/388/388_e.imgcut",
    "width": 64,
    "height": 64,
    "sha256": "..."
  }
}
```

Runtime `SemanticAssetProvider.getActorUiIconUrl()` should use this generated index before attempting any expensive fallback.

---

## Critical icon policy

### Do not use `edi_*.png` for this web UI fallback

Even though BCU Java can use `Enemy.getIcon() -> anim.getEdi()` and therefore can display `edi_388.png`, this project should **not** use `edi_*.png` as the fallback icon source for this task.

Reason: the requested UI policy is to avoid `edi.png`. Treat `edi_*.png` as diagnostic evidence only, not as a selected UI icon.

### Required fallback source for generated icons

If an enemy lacks an explicit/aggregate enemy icon, generate a UI thumbnail from the battle actor sprite source:

```text
{id}_e.png + {id}_e.imgcut
```

or the equivalent generated actor bundle entries:

```text
image.png + imgcut.imgcut
```

This must happen in the pre-generation script, not by repeated runtime fallback.

Recommended icon source priority at runtime:

1. Explicit icon index entry, if valid.
2. Aggregate icon bundle entry, e.g. `public/assets/bundles/icon/enemy.zip` + `enemy/N.png`, if valid.
3. Generated fallback icon index entry, e.g. `enemy-fallback.generated.zip` + `enemy/N.png`, if valid.
4. Existing actor bundle `icon.png`, only if already indexed as a lightweight UI icon source.
5. Missing icon placeholder with precise diagnostic reason.

Disallowed as selected UI icon sources:

```text
edi_*.png
raw runtime actor zip scan as normal UI path
random generic enemy icon as success
invisible/dummy image as success
```

### Thumbnail generation requirements

When the generation script creates a thumbnail from actor sprite + imgcut:

- Parse the `.imgcut` data using existing repo parsing utilities if available. If none exist, implement a minimal parser backed by diagnostics.
- Do not assume the first cut is always correct unless diagnostics prove it. Prefer a deterministic representative cut:
  - valid cut rectangle inside PNG bounds,
  - non-zero width/height,
  - preferably the largest or first main-body frame used by model metadata.
- Render to a 64x64 transparent PNG unless existing UI requires another size.
- Preserve aspect ratio and center the crop.
- Write generated icons into the generated fallback zip.
- Report icon source as `actor-imgcut-thumbnail-generated`.
- If imgcut is missing or invalid, report `actor-imgcut-missing` or `actor-imgcut-invalid`, not generic failure.
- The generator must be deterministic: same inputs produce same zip contents and index order.

---

## Current evidence from repository reports

Existing `tmp/enemy-asset-audit.md` currently reported roughly:

```text
enemiesAudited: 778
runtimeBundleUsable: 757
missingUiIcon: 3
missingRequiredAnimation: 3
problemEnemies: 21
```

Known remaining problem enemies from the last report included at least:

```text
478, 552, 554, 556, 560, 561, 562, 585, 586, 587, 588, 589, 590, 591, 610, 611, 612, 698, 699, 700, 701
```

Do not assume this list is exhaustive. Re-run and improve the audit.

---

## Non-negotiable constraints

### Do not make narrow ID hacks

Do not add special cases like:

```js
if (enemyId === 610) ...
```

unless the exact same rule is applied generically to all enemies with the same proven pattern.

### Do not fake success

- Do not replace broken enemies with dummy actors.
- Do not make invisible placeholders count as success.
- Do not hide missing actor assets behind a generic icon while the actor cannot render.
- Do not bypass semantic-strict globally.
- Do not remove `StageDefinitionLoader` or `BattleActorFactory` safety checks.

### Keep battle logic stable

Avoid battle damage/proc/knockback/timing/camera/economy/base changes unless diagnostics prove the issue is there. For `560`/`699`, first prove whether failure is data, icon, actor bundle, template preload, or spawn timing.

---

## Required workflow

Work in small commits.

1. Run/extend diagnostics.
2. Prove the failure class.
3. Implement the smallest general fix.
4. Generate fallback icon zip/index if needed.
5. Rerun diagnostics.
6. Run syntax checks.
7. Browser-check representative enemies from each failure class.

Recommended branch:

```bash
git checkout -b fix/complete-enemy-asset-coverage
```

---

## Task 1 — Upgrade the enemy asset audit to classify all remaining failures precisely

File:

```text
scripts/audit-bcu-enemy-assets.mjs
```

Extend the audit so every enemy reports separated status for these layers:

```js
{
  enemyId,
  id3,
  hasStats,
  hasName,
  hasSemanticActorEntry,
  semanticStatus,

  actorBundlePath,
  actorBundleExistsOnDisk,
  actorBundleInManifest,
  actorBundleArchiveReadable,
  actorBundleHasImage,
  actorBundleHasImgcut,
  actorBundleHasModel,
  actorBundleHasMove,
  actorBundleHasIdle,
  actorBundleHasAttack,
  actorBundleHasKb,
  actorBundleImageDecodeOk,
  actorBundleRuntimeUsable,

  rawEnemyImagePath,
  rawEnemyImgcutPath,
  rawEnemyImageExists,
  rawEnemyImgcutExists,
  rawEnemyThumbnailFallbackAvailable,

  aggregateIconBundlePath,
  aggregateIconInternalPath,
  aggregateIconZipReadable,
  aggregateIconEntryExists,
  aggregateIconDecodeOk,

  explicitIconEntry,
  explicitIconEntryExists,
  explicitIconDecodeOk,

  generatedFallbackIconEntry,
  generatedFallbackBundlePath,
  generatedFallbackInternalPath,
  generatedFallbackEntryExists,
  generatedFallbackDecodeOk,

  // EDI is diagnostic only. Do not count as chosen UI icon source.
  ediPath,
  ediExists,

  chosenUiIconSource,
  bcuPathResolverResolved,
  bcuStageEnemyResolverWouldResolve,
  preloadStatsOk,
  renderCoreOk,
  spawnReadyOk,
  failureClass,
  failureReason
}
```

Required failure classes:

```text
ok
ui-icon-explicit-ok
ui-icon-aggregate-ok
ui-icon-generated-fallback-ok
ui-icon-aggregate-missing-but-generation-possible
ui-icon-missing-no-generation-source
actor-bundle-not-in-manifest-but-file-exists
actor-bundle-file-missing
actor-bundle-bad-zip
actor-image-decode-failed
actor-image-bad-signature-or-trailing-bytes
actor-imgcut-missing
actor-imgcut-invalid
actor-model-missing
actor-animation-missing
semantic-invalid-but-runtime-usable
semantic-invalid-not-runtime-usable
semantic-partial-not-runtime-usable
resolver-mismatch
unknown
```

Output:

```text
tmp/enemy-asset-audit.json
tmp/enemy-asset-audit.md
```

Add a summary table grouped by `failureClass` and a target section containing at least:

```text
388, 443, 560, 609, 610, 611, 612, 613, 695, 696, 697, 699
```

---

## Task 2 — Build a generated fallback icon bundle instead of runtime-heavy fallback

Create or update a generator script:

```text
scripts/generate-enemy-fallback-icons.mjs
```

Required CLI:

```bash
node scripts/generate-enemy-fallback-icons.mjs --dry-run
node scripts/generate-enemy-fallback-icons.mjs --apply
```

Default must be dry-run if no flag is supplied.

The generator must:

1. Read `tmp/enemy-asset-audit.json` or run equivalent detection.
2. Select only enemies whose explicit/aggregate icon is missing and whose actor sprite + imgcut source is valid.
3. Generate deterministic 64x64 PNG thumbnails from `{id}_e.png + {id}_e.imgcut` or `image.png + imgcut.imgcut`.
4. Write generated icons into one or more fallback zip files under `public/assets/bundles/icon/`.
5. Write `public/assets/generated/bcu-generated-icon-index.json`.
6. Update any runtime icon manifest only if the existing architecture requires it; prefer loading the generated index separately to avoid corrupting generated upstream indexes.
7. Write a report:

```text
tmp/generated-enemy-fallback-icons-report.json
tmp/generated-enemy-fallback-icons-report.md
```

Report fields per generated icon:

```js
{
  enemyId,
  sourceImagePath,
  sourceImgcutPath,
  selectedCut,
  outputBundlePath,
  outputInternalPath,
  width,
  height,
  sha256,
  reason
}
```

The script must not use `edi_*.png`.

---

## Task 3 — Wire runtime to generated fallback index cheaply

Likely files:

```text
js/bcu/SemanticAssetProvider.js
js/bcu/BcuAssetLoader.js
js/ui/FormationEditor.js
```

Runtime behavior:

- Load `public/assets/generated/bcu-generated-icon-index.json` as small metadata.
- When explicit/aggregate icon lookup fails, check generated fallback index.
- Read the generated fallback zip entry for the requested visible icon only.
- Cache zip handles and object URLs.
- Do not open actor bundle zips or raw actor images in the normal UI icon path.
- Deduplicate expected missing icon diagnostics per semantic key.

Acceptance:

- `610/611/612` no longer spam repeated red console errors merely because `enemy/610.png` etc. are missing from aggregate icon zip.
- Enemies with generated fallback icons show visible icons.
- `chosenUiIconSource` reports `actor-imgcut-thumbnail-generated`.
- Runtime does not batch-load actor assets for all enemies while opening formation/catalog UI.

---

## Task 4 — Determine whether actor bundle zip files are missing or only omitted from indexes/manifests

For every remaining problem enemy, inspect:

- `public/assets/bundles/actor/...`
- `public/assets/generated/bcu-actor-index.json`
- `public/assets/generated/bcu-bundle-manifest.json`
- `public/assets/generated/bcu-icon-index.json`
- `public/assets/bundles/icon/enemy.zip`
- raw source paths under `public/assets/bcu/**/org/enemy/{id3}/`

Add report section:

```text
Remaining Problem Enemy Root Cause Matrix
```

Columns:

```text
enemyId | actor bundle exists | in manifest | archive ok | all runtime files | image decode | imgcut ok | generated fallback possible | root cause | recommended fix
```

For `388`, explicitly verify:

```text
000010 enemy_icon_388.png missing
000003/org/enemy/388/388_e.png present if repo contains it
000003/org/enemy/388/388_e.imgcut present if repo contains it
edi_388.png may exist but must not be chosen as UI icon
```

---

## Task 5 — Fix actor bundle manifest/index coverage for enemies with real usable bundles

Enemies such as `560` and `699` should not fail just because generated indexes or manifests omitted an otherwise valid actor bundle.

If a generator exists, use it. If no generator exists, create a focused dry-run-first repair script:

```text
scripts/repair-bcu-actor-bundle-index.mjs
```

Usage:

```bash
node scripts/repair-bcu-actor-bundle-index.mjs
node scripts/repair-bcu-actor-bundle-index.mjs --apply
```

Rules:

- If a bundle zip exists and contains all runtime files but is omitted from the manifest because of tolerable warnings, add a generic tolerance rule.
- If image decode fails in browser, do not mark runtime usable.
- If source files exist but bundle zip is missing, generate/rebuild only if repo conventions support it; otherwise report exact missing generation step.
- If raw source files are absent, leave unresolved and report it.

---

## Task 6 — Recheck stage spawning for all remaining problem enemies

File:

```text
scripts/audit-stage-enemy-spawn.mjs
```

Required CLI:

```bash
node scripts/audit-stage-enemy-spawn.mjs --enemy all-problem
node scripts/audit-stage-enemy-spawn.mjs --enemy 560,699,610,611,612
```

`all-problem` should read `tmp/enemy-asset-audit.json` and include all enemies whose `failureClass !== 'ok'` plus user examples.

For every target:

```js
{
  enemyId,
  rawEnemyId,
  rowsFound,
  stagesFound,
  spawnReadyRows,
  failedRows,
  failurePhases,
  representativeRows
}
```

Acceptance:

- `443` remains `spawnReadyRows > 0` and `failedRows = 0`.
- `560` and `699` are explicitly reported as spawn-ready or with exact failure phase.
- Remaining impossible enemies trace back to data/asset/index state.

---

## Task 7 — Browser runtime validation

Run:

```bash
python3 -m http.server 8000
```

Icon checks:

```js
globalThis.__FORMATION_ICON_DEBUG__?.recentIconFailures
globalThis.__BCU_DB__?.semanticProvider?.diagnostics?.inferredIconEntries?.slice(-30)
globalThis.__BCU_DB__?.semanticProvider?.diagnostics?.generatedIconFallbacks?.slice(-30)
```

Confirm examples:

```text
388, 443, 560, 609, 610, 611, 612, 613, 695, 696, 697, 699
```

Each must be one of:

- visible with explicit icon,
- visible with aggregate icon,
- visible with generated actor-imgcut-thumbnail icon,
- intentionally unresolved with precise reason.

Spawn checks:

```js
globalThis.__APP__?.battle?.debugEvents
  ?.filter(e => ['560','699','443','610','611','612'].includes(String(e.enemyId)) || ['562','701','445','612','613','614'].includes(String(e.rawEnemyId)))
  ?.slice(-50)
```

Do not claim live spawn success without `stageEnemySpawned` or equivalent actor/template state.

---

## Task 8 — Keep formation catalog virtualization stable

Keep the existing spacer full-width behavior. Verify:

```js
[...document.querySelectorAll('.formation-character-card')]
  .map(el => [Number(el.dataset.catalogIndex), el.dataset.character, el.querySelector('strong')?.textContent])
```

Acceptance:

- Visual order does not change while scrolling.
- `catalogIndex` increases in visual reading order.
- Tapping formation slots does not reset `.formation-catalog-scroll.scrollTop` to 0.
- Tapping character cards does not reset scroll to 0.
- Search/filter may reset intentionally.

Do not redesign formation UI in this task.

---

## Testing checklist

Syntax-check changed files, for example:

```bash
node --check scripts/audit-bcu-enemy-assets.mjs
node --check scripts/generate-enemy-fallback-icons.mjs
node --check scripts/audit-stage-enemy-spawn.mjs
node --check scripts/repair-bcu-actor-bundle-index.mjs
node --check js/bcu/SemanticAssetProvider.js
node --check js/bcu/BcuAssetLoader.js
node --check js/bcu/BcuPathResolver.js
node --check js/bcu/BcuEnemyRepository.js
node --check js/battle/BcuStageEnemyResolver.js
node --check js/battle/BattleActorFactory.js
node --check js/ui/FormationEditor.js
```

Run diagnostics/generation:

```bash
node scripts/audit-bcu-enemy-assets.mjs
node scripts/generate-enemy-fallback-icons.mjs --dry-run
node scripts/generate-enemy-fallback-icons.mjs --apply
node scripts/audit-bcu-enemy-assets.mjs
node scripts/audit-stage-enemy-spawn.mjs --enemy 443
node scripts/audit-stage-enemy-spawn.mjs --enemy 560,699,610,611,612
node scripts/audit-stage-enemy-spawn.mjs --enemy all-problem
```

Browser validation is required before claiming live success.

---

## Final response required from Codex

Report:

1. Root cause classes found.
2. Exact enemy IDs still unresolved and why.
3. Whether unresolved enemies lack source assets, have bad zips, bad PNG decode, missing imgcut, missing animations, or merely missing aggregate icons.
4. Generated fallback icon zip/index files produced.
5. Number of generated fallback icons and total generated zip size.
6. Files changed.
7. Scripts added/updated.
8. Commands run.
9. Browser checks performed.
10. Whether `560`, `699`, `610`, `611`, `612`, `695`, `696`, `697` are visible/spawnable or intentionally unresolved.
11. Confirm that `edi_*.png` is not used as the selected UI icon fallback.
12. Confirm that runtime does not bulk-load actor images/imgcuts for formation/catalog icons.

Do not say “all fixed” unless the full audit and browser checks prove it.
