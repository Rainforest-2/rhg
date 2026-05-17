# AGENTS.md — Codex task guide for complete enemy asset coverage and formation UI stability

Repository: `rhgrive2/game`
Target branch: `main`

## Purpose

Fix the remaining enemy asset/icon/spawn coverage problems across the full enemy set, not only the example IDs. Also keep the formation catalog virtualization and scroll behavior stable.

User-reported examples are only examples:

- `388` and `609`/`613` now work, but they rely on actor-bundle icon fallback rather than `enemy-icon.png` style aggregate icons.
- `610`, `611`, `612` still fail in the UI with console errors such as:
  - `Icon bundle file missing: enemy/610.png`
  - `Icon bundle file missing: enemy/611.png`
  - `Icon bundle file missing: enemy/612.png`
- `560` and `699` still do not appear/spawn correctly in some contexts.
- There are more affected enemies than the examples.

The goal is complete coverage for every enemy that has real usable data/assets in the current repository. Do not hard-code only the mentioned IDs.

---

## Current evidence from the repository

### Existing audit output

`tmp/enemy-asset-audit.md` currently reports:

- `enemiesAudited: 778`
- `missingStats: 0`
- `missingSemanticActorEntry: 0`
- `semanticNotFull: 28`
- `runtimeBundleUsable: 757`
- `missingUiIcon: 3`
- `missingRequiredAnimation: 3`
- `problemEnemies: 21`

The target table currently says:

- `388`: ok, UI icon source `actor-bundle-icon-fallback`
- `443`: ok
- `609`: ok
- `610`: `semantic-status-invalid, bundle-not-in-manifest, ui-icon-missing`
- `611`: `semantic-status-invalid, bundle-not-in-manifest, ui-icon-missing`
- `612`: `semantic-status-invalid, bundle-not-in-manifest, ui-icon-missing`
- `613`: ok, UI icon source `actor-bundle-icon-fallback`

The report lists these remaining problem enemies at minimum:

```text
478, 552, 554, 556, 560, 561, 562, 585, 586, 587, 588, 589, 590, 591, 610, 611, 612, 698, 699, 700, 701
```

Do not assume this list is exhaustive unless the latest audit confirms it.

### Current icon-loading path

`FormationEditor.renderIconMarkup()` emits:

```html
<img data-semantic-icon="..." class="image-missing">
```

`FormationEditor.scheduleIconLoad()` calls:

```js
provider.getActorUiIconUrl(key)
```

and currently logs every failure as `console.error('[FormationEditor] icon load failed detail', ...)`.

`SemanticAssetProvider.getActorUiIconUrl()` calls `readIconBundle()`. `readIconBundle()` currently tries:

1. explicit icon index entry, if present,
2. inferred aggregate icon entry, e.g. `public/assets/bundles/icon/enemy.zip` + `enemy/610.png`,
3. actor-bundle fallback only for some missing inferred entries.

For `610/611/612`, the UI failure shows the aggregate icon entry is inferred but the zip entry is missing.

### Current actor asset-loading path

`BcuStageEnemyResolver.buildBcuEnemyAssetDef(enemyId)` tries:

1. `db.assets.resolveEnemyAsset(enemyId)`
2. semantic actor entry `enemy:${enemyId}`
3. raw path fallback under `000002`

`BcuAssetLoader.tryLoadSemanticActor()` requires a semantic actor entry with bundleRef and `provider.hasBundleForKey(def.semanticKey)` unless raw fallback is allowed. It then reads `image.png`, `imgcut.imgcut`, `model.mamodel` and required animation files.

`SemanticAssetProvider.hasBundleForKey()` checks the bundle manifest and has a special tolerance for invalid actor entries only when `isRuntimeUsableActorBundleEntry(entry)` returns true.

---

## Non-negotiable constraints

### Do not make narrow ID hacks

Do not add special cases like:

```js
if (enemyId === 610) ...
```

unless the exact same rule is applied generically to all enemies with the same proven asset pattern.

### Do not fake success

- Do not replace broken enemies with dummy actors.
- Do not make invisible placeholders count as success.
- Do not hide missing asset errors by returning a random generic icon while the actor cannot render.
- Do not bypass semantic-strict globally.
- Do not remove `StageDefinitionLoader` or `BattleActorFactory` safety checks.

### Keep battle logic stable

Avoid battle damage/proc/knockback/timing/camera/economy/base changes unless the audit proves the issue is there. For `560/699`, first prove whether failure is asset/template/spawn-ready related before touching spawn timing.

---

## Required workflow

Work in small commits.

For each fix:

1. Run/extend diagnostics.
2. Prove the failure class.
3. Implement the smallest general fix.
4. Rerun diagnostics.
5. Run syntax checks.
6. Browser-check at least one representative enemy from each failure class.

Recommended branch:

```bash
git checkout -b fix/complete-enemy-asset-coverage
```

---

## Task 1 — Upgrade the enemy asset audit to classify all remaining failures precisely

### File

```text
scripts/audit-bcu-enemy-assets.mjs
```

### Required improvements

The current audit is useful but not detailed enough for remaining failures. Extend it so every enemy has separated status for these layers:

```js
{
  enemyId,
  id3,

  // data layer
  hasStats,
  hasName,
  hasSemanticActorEntry,
  semanticStatus,

  // actor bundle layer
  actorBundlePath,
  actorBundleExistsOnDisk,
  actorBundleInManifest,
  actorBundleArchiveReadable,
  actorBundleEntries,
  actorBundleHasImage,
  actorBundleHasImgcut,
  actorBundleHasModel,
  actorBundleHasMove,
  actorBundleHasIdle,
  actorBundleHasAttack,
  actorBundleHasKb,
  actorBundleImageDecodeOk,
  actorBundleImageProblem,
  actorBundleRuntimeUsable,

  // aggregate UI icon layer
  aggregateIconBundlePath,
  aggregateIconInternalPath,
  aggregateIconZipReadable,
  aggregateIconEntryExists,
  aggregateIconDecodeOk,

  // explicit icon-index layer
  explicitIconEntry,
  explicitIconBundlePath,
  explicitIconInternalPath,
  explicitIconEntryExists,
  explicitIconDecodeOk,

  // fallback layer
  actorBundleIconFallbackAvailable,
  chosenUiIconSource,

  // runtime resolver layer
  bcuPathResolverResolved,
  bcuStageEnemyResolverWouldResolve,
  preloadStatsOk,
  renderCoreOk,
  spawnReadyOk,

  failureClass,
  failureReason
}
```

### Failure classes to use

Use deterministic failure classes, not loose strings:

```text
ok
ui-icon-aggregate-missing-but-actor-fallback-ok
ui-icon-missing-no-actor-fallback
actor-bundle-not-in-manifest-but-file-exists
actor-bundle-file-missing
actor-bundle-bad-zip
actor-image-decode-failed
actor-image-bad-signature-or-trailing-bytes
actor-imgcut-missing
actor-model-missing
actor-animation-missing
semantic-invalid-but-runtime-usable
semantic-invalid-not-runtime-usable
semantic-partial-not-runtime-usable
resolver-mismatch
unknown
```

### Required output

Continue writing:

```text
tmp/enemy-asset-audit.json
tmp/enemy-asset-audit.md
```

Add a new summary table grouped by `failureClass`.

### Important

The audit must include all 778 enemies, not just target IDs. The examples `388, 443, 560, 609, 610, 611, 612, 613, 695, 696, 697, 699` must be present in the target section.

---

## Task 2 — Determine whether bundle zip files are truly missing or only omitted from the manifest

### Problem

The current report says many enemies are `semantic-status-invalid, bundle-not-in-manifest`, including `560` and `699`. This does not prove the zip file is absent. It may mean:

1. the bundle zip exists but is omitted from `bcu-bundle-manifest.json`,
2. the zip exists but has bad signatures / decode problems,
3. the generated actor index rejected it too aggressively,
4. the raw BCU source files exist but no generated bundle exists,
5. the source files themselves are absent.

### Required investigation

For every remaining problem enemy, inspect:

- `public/assets/bundles/actor/...` for an actor bundle zip,
- `public/assets/generated/bcu-actor-index.json`,
- `public/assets/generated/bcu-bundle-manifest.json`,
- `public/assets/generated/bcu-icon-index.json`,
- `public/assets/bundles/icon/enemy.zip`,
- raw source paths if available in diagnostics/sourceCandidates.

Add a report section:

```text
Remaining Problem Enemy Root Cause Matrix
```

with columns:

```text
enemyId | actor bundle exists | in manifest | archive ok | all runtime files | image decode | icon source possible | root cause | recommended fix
```

---

## Task 3 — Fix UI icons for every enemy with a valid actor image

### Goal

Every enemy with a valid actor image should get a usable formation/catalog UI icon. Do not require `enemy.zip` aggregate icons to contain every enemy if actor-bundle image fallback is available.

### Likely files

- `js/bcu/SemanticAssetProvider.js`
- `js/ui/FormationEditor.js`
- generated icon/bundle files only if a generator exists and needs rerun

### Required behavior

`provider.getActorUiIconUrl('enemy:N')` should choose the best available source in this order:

1. explicit icon index entry if valid,
2. aggregate icon bundle entry if valid,
3. actor bundle `icon.png` if present,
4. actor bundle `image.png` if present and decodable,
5. optionally generated runtime object URL from actor image if valid.

If 1 or 2 is missing, do not immediately log a user-visible error if 3/4 succeeds.

For enemies such as `388`, `613`, `695`, `696`, `697`, using actor-bundle fallback is acceptable if aggregate `enemy.zip` lacks icons. But the chosen fallback should be reported as `actor-bundle-icon-fallback` or `actor-bundle-image-fallback` in diagnostics.

### Console behavior

Formation UI should not spam `console.error` for expected missing aggregate icon entries when a fallback succeeds or when the enemy is known unresolved. Use one of:

- no log for successful fallback,
- `console.warn` once per semantic key for unresolved but non-fatal icon absence,
- keep `console.error` only for unexpected exceptions.

### Acceptance criteria

- `610/611/612` no longer produce repeated red console errors merely because `enemy/610.png` etc. are missing from aggregate icon zip.
- If their actor bundles are not runtime-usable, they should show a clear fallback/missing visual and one diagnostic entry, not repeated errors.
- All enemies with valid actor-bundle image/icon get visible UI icons.
- Rerun `node scripts/audit-bcu-enemy-assets.mjs` and reduce `missingUiIcon` to only enemies with truly no usable actor image/icon.

---

## Task 4 — Fix actor bundle manifest/index coverage for enemies with real usable bundles

### Goal

Enemies such as `560` and `699` should not fail just because generated indexes or manifests omitted an otherwise valid actor bundle.

### Required investigation

Find whether a build/generation script exists for:

- `public/assets/generated/bcu-actor-index.json`
- `public/assets/generated/bcu-bundle-manifest.json`
- `public/assets/bundles/actor/...`
- `public/assets/bundles/icon/...`

If there is no generator in this repo, create a focused repair script under `scripts/` that:

1. scans actual actor bundle zip files,
2. validates required entries,
3. validates image decode as far as Node/browser tooling permits,
4. safely adds usable bundles to a generated repair report,
5. optionally patches generated manifest/index only when invoked with `--apply`.

Suggested script:

```text
scripts/repair-bcu-actor-bundle-index.mjs
```

Default mode must be dry-run:

```bash
node scripts/repair-bcu-actor-bundle-index.mjs
node scripts/repair-bcu-actor-bundle-index.mjs --apply
```

### Fix rules

- If a bundle zip exists and contains all runtime files, but is omitted from the manifest only because of tolerable image warnings such as trailing bytes, add a generic tolerance rule. Do not special-case IDs.
- If a bundle image cannot decode in browser, do not add it to runtime usable. Instead report it as requiring asset regeneration/decode repair.
- If source files exist but bundle zip is missing, generate or rebuild the bundle only if existing repo conventions support it. Otherwise report the exact missing generation step.
- If raw source files are absent, leave the enemy unresolved and report it.

### Acceptance criteria

After fixes:

```bash
node scripts/audit-bcu-enemy-assets.mjs
```

must show:

- no enemies in `actor-bundle-not-in-manifest-but-file-exists` if their bundle is otherwise usable,
- `560` and `699` either become runtime usable, or have a precise non-fixable reason such as `actor-image-decode-failed` or `actor-bundle-file-missing`,
- no broad semantic-strict bypass.

---

## Task 5 — Recheck stage spawning for all remaining problem enemies, not only 443

### File

```text
scripts/audit-stage-enemy-spawn.mjs
```

### Required improvement

The stage-spawn audit must accept:

```bash
node scripts/audit-stage-enemy-spawn.mjs --enemy all-problem
node scripts/audit-stage-enemy-spawn.mjs --enemy 560,699,610,611,612
```

`all-problem` should read the latest `tmp/enemy-asset-audit.json` and test all enemies whose `failureClass !== 'ok'` plus all user examples.

For every target enemy, report:

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

### Acceptance criteria

- `443` remains `spawnReadyRows > 0` and `failedRows = 0`.
- `560` and `699` are explicitly reported with either spawn-ready success or exact failure phase.
- Any enemies still impossible to spawn have a reason that traces back to data/asset/index state.

---

## Task 6 — Browser runtime validation for representative enemies

### Required manual checks

After implementing fixes, run:

```bash
python3 -m http.server 8000
```

In browser console, check icons and spawn events.

### Icon checks

Open formation screen and inspect:

```js
globalThis.__FORMATION_ICON_DEBUG__?.recentIconFailures
globalThis.__BCU_DB__?.semanticProvider?.diagnostics?.inferredIconEntries?.slice(-30)
```

Confirm these examples:

```text
388, 443, 560, 609, 610, 611, 612, 613, 695, 696, 697, 699
```

Each must be one of:

- visible with explicit icon,
- visible with aggregate icon,
- visible with actor-bundle fallback,
- intentionally unresolved with precise reason.

### Spawn checks

For stages containing target enemies, inspect:

```js
globalThis.__APP__?.battle?.debugEvents
  ?.filter(e => ['560','699','443','610','611','612'].includes(String(e.enemyId)) || ['562','701','445','612','613','614'].includes(String(e.rawEnemyId)))
  ?.slice(-50)
```

Also inspect template failures:

```js
[...globalThis.__APP__?.battle?.actorFactory?.templates?.entries?.() || []]
  .filter(([key]) => /enemy-(560|699|443|610|611|612)/.test(key))
```

Do not claim a live spawn fix unless a `stageEnemySpawned` event or equivalent actor/template state proves it.

---

## Task 7 — Keep formation catalog virtualization stable

The previous work changed `FormationEditor.js` so spacer elements include inline `grid-column:1/-1`. Keep and verify this behavior.

Required checks:

```js
[...document.querySelectorAll('.formation-character-card')]
  .map(el => [Number(el.dataset.catalogIndex), el.dataset.character, el.querySelector('strong')?.textContent])
```

Acceptance:

- Visual order does not change while scrolling.
- `catalogIndex` increases in visual reading order.
- Tapping formation slots does not reset `.formation-catalog-scroll.scrollTop` to 0.
- Tapping character cards does not reset scroll to 0.
- Search/filter may reset scroll intentionally.

Do not redesign the formation UI in this task.

---

## Testing checklist

Run syntax checks for changed JS/MJS files, for example:

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

Only check files that exist and/or were changed.

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

When done, report:

1. Root cause classes found.
2. Exact enemy IDs still unresolved and why.
3. Whether unresolved enemies lack source assets, have bad zips, bad PNG decode, missing animations, or merely missing aggregate icons.
4. Files changed.
5. Scripts added/updated.
6. Commands run.
7. Browser checks performed.
8. Whether `560`, `699`, `610`, `611`, `612`, `695`, `696`, `697` are visible/spawnable or intentionally unresolved.

Do not say “all fixed” unless the full audit and browser checks prove it.
