# AGENTS.md — Codex task guide for enemy assets, stage enemy spawning, and formation UI stability

Repository: `rhgrive2/game`
Target branch: `main`

## Purpose

Investigate and fix the following reported issues without changing unrelated systems:

1. Some enemy icons/assets are missing, including enemy IDs `388` and `609`–`613`; there are likely more.
2. Some enemies cannot appear in stages, including enemy `443`; there are likely more.
3. The formation character catalog changes visual order while scrolling because of the current virtualized DOM/list implementation.
4. Touching formation slots or selecting characters can reset the character catalog scroll position to the top.

The work must be evidence-driven. Do not guess mappings or patch symptoms without proving the cause in the current repository.

---

## Strict scope rules

### Allowed

- Add diagnostic scripts under `scripts/`.
- Add small, focused runtime diagnostics where needed.
- Fix enemy asset resolution if the resolver is too narrow or ignores semantic bundle metadata.
- Fix stage enemy spawn only after reproducing the exact rejection path.
- Fix formation catalog virtualization/scroll preservation in `js/ui/FormationEditor.js` and closely related UI patch files.
- Add CSS only if needed for the virtual grid/spacer layout.

### Avoid unless the failing test proves it is necessary

- Changing battle damage, proc, knockback, animation timing, movement, camera, economy, or base logic.
- Changing CSV stage parsing column semantics.
- Changing the meaning of BCU enemy IDs or applying global off-by-one transforms.
- Adding hard-coded one-off enemy remaps for `388`, `443`, `609`–`613` without proving BCU itself uses that mapping.
- Rewriting `BattleScene`, `BattleActorFactory`, `StageDefinitionLoader`, or `SemanticAssetProvider` wholesale.

### Never do in this task

- Do not hide failures by silently replacing missing enemies with dummy actors.
- Do not remove semantic-strict safety checks to make a spawn succeed.
- Do not disable virtual scrolling entirely unless you prove it is the only viable fix and document the performance cost.
- Do not make unrelated visual/UI redesigns.
- Do not touch stage selector category UI unless directly broken by this work.

---

## Current code facts to verify before editing

These facts are from the current code and should be rechecked locally before making changes.

### Enemy asset resolution

- `BcuEnemyRepository.build()` iterates `manifest.indexes.enemyIds`, computes `enemyId`, uses `resolveEnemyAsset(files, enemyId)`, and records missing assets when image/imgcut are absent.
- `BcuEnemyRepository.fromCoreDb()` builds enemies from `coreDb.enemies.enemies` and preserves `record.asset` if present.
- `BcuPathResolver.resolveEnemyAsset(files, enemyId)` currently looks for paths ending in `/org/enemy/${id3}/${id3}_e.png`, then tries base directories such as `000002` and `000010`.
- `BcuStageEnemyResolver.buildBcuEnemyAssetDef(enemyId)` first tries `db.assets.resolveEnemyAsset(enemyId)`, then semantic actor index `enemy:${enemyId}`, then a raw-path fallback under `000002`.

### Stage enemy ID resolution and spawning

- `StageDefinitionLoader.parse()` reads stage enemy rows and computes `enemyId = rawEnemyId - 2`.
- `buildStageEnemyUnitDef(row)` uses `row.enemyId` as `statsId` and builds the actor asset definition through `buildBcuEnemyAssetDef(row.enemyId)`.
- `BattleScene.spawnStageEnemy()` returns false and emits `stageEnemySpawnDeferred` when the actor template is not `SPAWN_READY` or `FULL_VISUAL`.
- `BattleActorFactory.preloadTemplate()` can fail because stats are missing, render core assets are missing, or required animations are missing.

### Formation catalog virtualization and scroll reset

- `FormationEditor.renderDynamic()` currently does `scroller.scrollTop = 0` before `renderCatalogWindow()`.
- `FormationEditor.renderCatalogWindow()` renders a top spacer, a slice of `catalogItems`, and a bottom spacer into `.formation-catalog-grid`.
- The spacer elements are grid children. If they are not full-width grid rows, they can disturb visual ordering in a CSS grid.
- `FormationEditorPerformancePatch.js` currently preserves scroll only for some character interactions. Prefer a direct, explicit fix in `FormationEditor.js` if possible.

---

## Required workflow

Work in small commits. For each issue:

1. Reproduce or prove the cause with a script, log, or focused browser check.
2. Make the smallest targeted fix.
3. Run syntax checks and the relevant diagnostic script again.
4. Record what changed and why in the final response.

Recommended branch name:

```bash
git checkout -b fix/enemy-assets-stage-spawn-formation-scroll
```

There may be no `package.json`; do not assume npm scripts exist. Prefer direct `node` scripts and `python3 -m http.server 8000` for browser testing.

---

## Task 1 — Audit enemy asset coverage before fixing icons

### Goal

Find why enemy icons/assets are missing for `388`, `609`, `610`, `611`, `612`, `613`, and discover other enemies with the same failure mode.

### Add diagnostic script

Create:

```text
scripts/audit-bcu-enemy-assets.mjs
```

The script should inspect whichever sources exist in the repo:

- `public/assets/core-db.json` or the core DB reachable through current project files, if present.
- `public/assets/bcu/**/org/enemy/**`, if present.
- `public/assets/bcu-manifest.json`, if present.
- `public/assets/semantic-index*.json` or semantic provider index files, if present.
- `asset-files.txt`, if assets are represented only by a file list.
- Existing generated reports under `tmp/` only as secondary hints, not as source of truth.

The script must output:

```text
tmp/enemy-asset-audit.json
tmp/enemy-asset-audit.md
```

Minimum report fields per enemy:

```js
{
  enemyId,
  id3,
  hasStats,
  hasName,
  hasSemanticActorEntry,
  semanticKey,
  bundleRef,
  hasImage,
  hasImgcut,
  hasMamodel,
  availableAnimations,
  resolvedByCurrentResolver,
  currentResolverAsset,
  candidateAssetFiles,
  failureReason
}
```

The report must include all target IDs:

```text
388, 443, 609, 610, 611, 612, 613
```

and a summary of all enemies that are missing image/imgcut/model/required animations.

### What to investigate

Determine whether the failure is caused by one of these:

- The enemy exists in BCU assets but `resolveEnemyAsset()` only checks too few pack locations or filename variants.
- The enemy exists in semantic actor indexes but `BcuEnemyRepository` or `BcuStageEnemyResolver` does not use the semantic bundle correctly.
- The enemy exists in stats/name data but does not have visual assets in the current asset set.
- The enemy has image/imgcut but required `.maanim` or `.mamodel` is missing.
- The enemy is excluded by an external missing/enemy error config.

### Acceptance criteria

- The audit script can be run with:

```bash
node scripts/audit-bcu-enemy-assets.mjs
```

- It explicitly reports the status of `388`, `443`, and `609`–`613`.
- It identifies other enemies with the same missing-asset pattern.
- No runtime code is changed until the audit explains the failure class.

---

## Task 2 — Fix enemy asset/icon resolution only after the audit

### Goal

Make enemy icons/assets resolve for enemies that genuinely have BCU assets, including `388` and `609`–`613` if assets exist.

### Likely files

- `js/bcu/BcuPathResolver.js`
- `js/bcu/BcuEnemyRepository.js`
- `js/battle/BcuStageEnemyResolver.js`
- `js/bcu/SemanticAssetProvider.js` only if semantic actor lookup is incomplete
- `js/bcu/BcuAssetDatabase.js` / asset repository only if `resolveEnemyAsset` is not forwarding data correctly

### Fix rules

- Prefer semantic bundle resolution over raw path guessing.
- Generalize path resolution by scanning actual manifest/file entries. Do not assume only `000002` or `000010` contain enemy assets.
- Support real BCU filename variants only if the audit proves they exist.
- Preserve semantic-strict behavior. Do not use raw fallback for bundled assets unless current architecture explicitly permits it.
- Keep diagnostics for missing image/imgcut/model/animations.

### Required validation

After fixing, rerun:

```bash
node scripts/audit-bcu-enemy-assets.mjs
```

The report must show that previously missing enemies with actual assets now resolve, and enemies without assets still report honest missing reasons.

Also run syntax checks on changed modules:

```bash
node --check js/bcu/BcuPathResolver.js
node --check js/bcu/BcuEnemyRepository.js
node --check js/battle/BcuStageEnemyResolver.js
```

Only include files that exist and were changed.

---

## Task 3 — Audit why enemy `443` cannot spawn in stages

### Goal

Find the exact failure path for enemy `443` and any similar enemies.

### Add diagnostic script

Create:

```text
scripts/audit-stage-enemy-spawn.mjs
```

This script should locate stage rows containing enemy `443`. Remember that current stage parsing computes:

```js
rawEnemyId = CSV E column
enemyId = rawEnemyId - 2
```

Therefore enemy `443` may appear as raw CSV enemy ID `445`.

For each matching row, report:

```js
{
  stageKey,
  stagePath,
  rawEnemyId,
  enemyId,
  rowIndex,
  stageName,
  enemyName,
  hasStats,
  hasAssetDef,
  hasSemanticBundle,
  preloadStatsOk,
  renderCoreOk,
  spawnReadyOk,
  failurePhase,
  failureMessage
}
```

The script should also support arbitrary enemy IDs:

```bash
node scripts/audit-stage-enemy-spawn.mjs --enemy 443
node scripts/audit-stage-enemy-spawn.mjs --enemy 388,609,610,611,612,613
```

### What to investigate

Do not assume the bug is stage parsing. Determine whether failure is from:

- wrong raw ID to enemy ID conversion,
- missing enemy stats,
- missing actor asset bundle,
- missing required animation,
- `BattleActorFactory.preloadTemplate()` failure,
- `spawnStageEnemy()` repeatedly returning false because template never reaches `SPAWN_READY`,
- group/max-enemy/kill-count conditions preventing spawn,
- stage selector selecting a different stage than expected.

### Acceptance criteria

- The audit script identifies at least one stage row for enemy `443` if present in assets.
- The script reports the exact failure phase.
- Do not change `StageDefinitionLoader` or `BattleSceneBcuStageSpawnPatch` until this audit explains the cause.

---

## Task 4 — Fix stage enemy spawning without broad battle changes

### Goal

Enemies that have valid stats and assets should become spawnable in stages. Enemy `443` is the target case.

### Likely files

- `js/battle/BcuStageEnemyResolver.js`
- `js/battle/BattleActorFactory.js`
- `js/battle/BattleScene.js`
- `js/battle/BattleSceneBcuStageSpawnPatch.js`
- `js/battle/StageDefinitionLoader.js` only if the audit proves stage row interpretation is wrong

### Fix rules

- If the issue is asset/template preload, fix asset/template resolution, not spawn timing.
- If the issue is missing required animation, confirm whether BCU uses a fallback animation or whether the asset set is incomplete.
- If `spawnStageEnemy()` defers while template is loading, confirm the runtime retries and eventually spawns. If not, fix retry/commit behavior narrowly.
- Do not bypass `SPAWN_READY` by spawning incomplete actors.
- Do not suppress errors by making missing enemies invisible.

### Required validation

- Rerun:

```bash
node scripts/audit-stage-enemy-spawn.mjs --enemy 443
```

- In browser, select a stage that contains enemy `443` and confirm the debug events show either:
  - `stageEnemySpawned` for enemy `443`, or
  - a clear, correct rejection reason if assets are genuinely absent.

Useful browser console checks:

```js
globalThis.__APP__?.battle?.debugEvents?.filter(e => String(e.enemyId) === '443' || String(e.rawEnemyId) === '445').slice(-20)
globalThis.__APP__?.battle?.actorFactory?.templates
```

---

## Task 5 — Fix formation catalog visual order changes while scrolling

### Goal

The formation character catalog must keep a stable order while virtualized scrolling loads/unloads cards.

### Current suspect

`FormationEditor.renderCatalogWindow()` renders spacer divs inside `.formation-catalog-grid` together with cards. In a CSS grid, spacer elements can participate as grid items unless they span all columns. This can make visible card order/layout appear to change while scrolling.

### Likely files

- `js/ui/FormationEditor.js`
- `css/ui-polish.css`
- `css/nyanko-formation-card-fix.css` or other formation CSS only if necessary

### Required investigation

In browser, compare these before and after scrolling:

```js
[...document.querySelectorAll('.formation-character-card')].map(el => [el.dataset.catalogIndex, el.dataset.character, el.querySelector('strong')?.textContent])
globalThis.__FORMATION_ICON_DEBUG__?.lastRender
```

Check whether:

- `catalogIndex` order is stable but visual grid position changes,
- `catalogItems` itself is being reordered,
- column estimation changes while scrolling,
- row height is wrong enough to jump windows,
- grid spacer elements are not full-width.

### Preferred fixes

Pick the smallest fix that matches the proven cause:

1. If spacer grid items cause visual order changes, ensure spacers span all columns:

```css
.formation-catalog-spacer { grid-column: 1 / -1; }
```

or render spacers outside the card grid in a dedicated virtual window structure.

2. If `catalogItems` order changes, make `getFilteredCharacters()` / caller preserve source order and never sort based on used/active state.

3. If dynamic column changes cause window misalignment, stabilize column estimation or recalculate without changing item ordering.

### Acceptance criteria

- Scrolling down/up does not change the relative order of visible cards.
- `data-catalog-index` increases in visual reading order.
- Virtualization remains enabled.
- No character identity changes for already rendered indices unless the search/filter changed.

---

## Task 6 — Fix catalog scroll reset when touching formation slots or selecting characters

### Goal

Interacting with formation slots or selecting a character should not reset the character catalog to the top.

### Current suspect

`FormationEditor.renderDynamic()` does:

```js
const scroller = this.root.querySelector('.formation-catalog-scroll');
if (scroller) scroller.scrollTop = 0;
```

This is too broad.

### Required implementation direction

Prefer a direct change in `FormationEditor.js` over additional global DOM patches.

Introduce an explicit scroll policy, for example:

```js
renderDynamic({ resetCatalogScroll = false } = {})
```

Then:

- Search/filter changes may reset to top.
- Slot focus changes must preserve scroll.
- Character selection must preserve scroll.
- Clear/reset formation should preserve scroll unless the catalog content itself changes.
- Page switching should preserve scroll unless there is a UX reason to reset.

If keeping compatibility with existing calls is easier, default `resetCatalogScroll` should be `false`, and only search/filter calls should pass `true`.

Remove or simplify redundant scroll-preservation logic in `FormationEditorPerformancePatch.js` / `NyankoUiBehaviorPatch.js` after the direct fix, but only if safe.

### Acceptance criteria

Browser checks:

```js
const s = document.querySelector('.formation-catalog-scroll');
s.scrollTop = 1200;
// tap a formation slot
s.scrollTop > 1000
// tap a character card
s.scrollTop > 1000
```

Search/filter may intentionally reset to top.

---

## Testing checklist

Run syntax checks for every changed JS/MJS file. At minimum, if touched:

```bash
node --check js/ui/FormationEditor.js
node --check js/ui/FormationEditorPerformancePatch.js
node --check js/ui/NyankoUiBehaviorPatch.js
node --check js/bcu/BcuPathResolver.js
node --check js/bcu/BcuEnemyRepository.js
node --check js/battle/BcuStageEnemyResolver.js
node --check js/battle/BattleActorFactory.js
node --check js/battle/BattleScene.js
node --check js/battle/BattleSceneBcuStageSpawnPatch.js
node --check scripts/audit-bcu-enemy-assets.mjs
node --check scripts/audit-stage-enemy-spawn.mjs
```

Start the app in Codespaces:

```bash
python3 -m http.server 8000
```

Manual browser checks:

1. Open formation screen.
2. Scroll character list; verify order remains stable.
3. Tap formation slots; verify catalog scroll does not jump to top.
4. Tap character cards; verify catalog scroll does not jump to top.
5. Open stage selector; verify category -> map -> stage hierarchy still works.
6. Select a stage containing enemy `443`; run until spawn conditions; inspect debug events.
7. Confirm target enemy icons/assets render for enemies with actual assets.

---

## Final response required from Codex

When done, summarize:

- Root cause for each issue.
- Files changed.
- Diagnostic scripts added and their outputs.
- Exact tests/commands run.
- Any remaining enemies that truly lack assets in the current asset set.
- Any unresolved risks.

Do not claim success for enemy `443` or missing icons unless the audit and runtime/browser checks prove it.
