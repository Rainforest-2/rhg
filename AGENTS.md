# AGENTS.md — Codex task guide for complete enemy asset coverage and formation UI stability

Repository: `rhgrive2/game`
Target branch: `main`

## Purpose

Fix enemy asset/icon/spawn coverage across the full enemy set, not only example IDs. Keep formation catalog virtualization and scroll behavior stable. Work evidence-first; do not guess mappings.

Known examples:

- `388` is not present as `000010/org/enemy/388/enemy_icon_388.png`; `000010` skips it. The repo does have battle actor files under `public/assets/bcu/000003/org/enemy/388/`, including `388_e.png`, `388_e.imgcut`, animations, and `edi_388.png`.
- `610`, `611`, `612` currently fail in formation UI because `public/assets/bundles/icon/enemy.zip` lacks `enemy/610.png`, `enemy/611.png`, `enemy/612.png`.
- `560` and `699` still fail in some contexts and may be bundle/index/manifest problems.
- There are more affected enemies than these examples.

Goal: every enemy with valid usable data/assets must be visible in UI and spawnable when stage rules request it. Enemies with genuinely missing/broken assets must remain unresolved with precise reasons.

---

## Critical icon policy

### Do not use `edi_*.png` for this web UI fallback

Even though BCU Java can use `Enemy.getIcon() -> anim.getEdi()` and therefore can display `edi_388.png`, this project should **not** use `edi_*.png` as the fallback icon source for this task.

Reason: the requested UI policy is to avoid `edi.png`. Treat `edi_*.png` as diagnostic evidence only, not as a selected UI icon.

### Required fallback design for missing enemy icons

If an enemy lacks an explicit/aggregate enemy icon, generate a UI thumbnail from the battle actor sprite source:

```text
{id}_e.png + {id}_e.imgcut
```

or the equivalent generated actor bundle entries:

```text
image.png + imgcut.imgcut
```

This fallback must be generic and apply to every enemy with the same asset pattern. Do not special-case IDs.

Recommended icon source priority:

1. Explicit icon index entry, if valid.
2. Aggregate icon bundle entry, e.g. `public/assets/bundles/icon/enemy.zip` + `enemy/N.png`, if valid.
3. Existing actor bundle `icon.png`, if present and valid.
4. Generated actor-sprite thumbnail from `image.png + imgcut.imgcut` or raw `{id}_e.png + {id}_e.imgcut`.
5. Missing icon placeholder only if no valid actor sprite thumbnail can be generated.

Disallowed as selected UI icon sources:

```text
edi_*.png
random generic enemy icon as success
invisible/dummy image as success
```

### Thumbnail generation requirements

When generating a thumbnail from actor sprite + imgcut:

- Parse the `.imgcut` data using existing repo parsing utilities if available. If none exist, implement a minimal parser backed by tests/diagnostics.
- Do not assume the first cut is always correct unless diagnostics prove it. Prefer a deterministic representative cut:
  - a valid cut rectangle inside the PNG bounds,
  - non-zero width/height,
  - preferably the largest or first main-body frame used by the model metadata.
- Render to a small canvas or generated bundle icon with transparent background.
- Cache generated object URLs or generated files; do not regenerate on every scroll render.
- Report icon source as `actor-imgcut-thumbnail-fallback`.
- If imgcut is missing or invalid, report `actor-imgcut-missing` or `actor-imgcut-invalid`, not generic failure.

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
4. Rerun diagnostics.
5. Run syntax checks.
6. Browser-check representative enemies from each failure class.

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
ui-icon-aggregate-missing-but-actor-thumbnail-fallback-ok
ui-icon-missing-no-actor-thumbnail-fallback
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

## Task 2 — Determine whether bundle zip files are missing or only omitted from indexes/manifests

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
enemyId | actor bundle exists | in manifest | archive ok | all runtime files | image decode | imgcut ok | thumbnail fallback possible | root cause | recommended fix
```

For `388`, explicitly verify:

```text
000010 enemy_icon_388.png missing
000003/org/enemy/388/388_e.png present if repo contains it
000003/org/enemy/388/388_e.imgcut present if repo contains it
edi_388.png may exist but must not be chosen as UI icon
```

---

## Task 3 — Fix UI icons using actor sprite + imgcut fallback

Likely files:

```text
js/bcu/SemanticAssetProvider.js
js/bcu/BcuAssetLoader.js
js/ui/FormationEditor.js
scripts/* repair/generation scripts, if needed
```

Required behavior for `provider.getActorUiIconUrl('enemy:N')`:

1. Use explicit icon index entry if valid.
2. Use aggregate icon bundle entry if valid.
3. Use actor bundle `icon.png` if valid.
4. Generate a thumbnail from actor bundle `image.png + imgcut.imgcut` if valid.
5. Generate a thumbnail from raw BCU `{id}_e.png + {id}_e.imgcut` if valid and no bundle thumbnail can be used.
6. Return a clear missing result if none are valid.

Do not use `edi_*.png`.

Console behavior:

- Missing aggregate icon entries should not produce repeated red errors if actor thumbnail fallback succeeds.
- Repeated failures for the same semantic key should be deduplicated.
- Use `console.error` only for unexpected exceptions; use diagnostics or one-time warnings for expected missing assets.

Acceptance:

- `610/611/612` no longer spam repeated red console errors only because `enemy/610.png` etc. are missing from aggregate icon zip.
- All enemies with valid `{id}_e.png + {id}_e.imgcut` or bundle `image.png + imgcut.imgcut` get a visible UI icon.
- `chosenUiIconSource` reports `actor-imgcut-thumbnail-fallback` for this fallback path.
- `missingUiIcon` is reduced to only enemies with no valid aggregate icon and no valid actor image/imgcut fallback.

---

## Task 4 — Fix actor bundle manifest/index coverage for enemies with real usable bundles

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

## Task 5 — Recheck stage spawning for all remaining problem enemies

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

## Task 6 — Browser runtime validation

Run:

```bash
python3 -m http.server 8000
```

Icon checks:

```js
globalThis.__FORMATION_ICON_DEBUG__?.recentIconFailures
globalThis.__BCU_DB__?.semanticProvider?.diagnostics?.inferredIconEntries?.slice(-30)
```

Confirm examples:

```text
388, 443, 560, 609, 610, 611, 612, 613, 695, 696, 697, 699
```

Each must be one of:

- visible with explicit icon,
- visible with aggregate icon,
- visible with actor-imgcut-thumbnail fallback,
- intentionally unresolved with precise reason.

Spawn checks:

```js
globalThis.__APP__?.battle?.debugEvents
  ?.filter(e => ['560','699','443','610','611','612'].includes(String(e.enemyId)) || ['562','701','445','612','613','614'].includes(String(e.rawEnemyId)))
  ?.slice(-50)
```

Do not claim live spawn success without `stageEnemySpawned` or equivalent actor/template state.

---

## Task 7 — Keep formation catalog virtualization stable

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

Run diagnostics:

```bash
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
4. Files changed.
5. Scripts added/updated.
6. Commands run.
7. Browser checks performed.
8. Whether `560`, `699`, `610`, `611`, `612`, `695`, `696`, `697` are visible/spawnable or intentionally unresolved.
9. Confirm that `edi_*.png` is not used as the selected UI icon fallback.

Do not say “all fixed” unless the full audit and browser checks prove it.
