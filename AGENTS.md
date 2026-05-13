# AGENTS.md — Fix Formation Virtual Icon Loading, Battle Spawn Failures, and BCU Actor Rendering Corruption

Repository: `rhgrive2/game`  
Target branch: `main`

This file is the task contract for Codex. Treat it as a concrete repair checklist, not a vague instruction. The current symptoms are not one bug. Fix them by tracing the exact runtime/data path, adding diagnostics, strengthening generated bundle checks, and comparing battle rendering behavior against BCU.

---

## 0. User-visible failures to solve

After the recent icon bundle fixes:

1. Formation/catalog icons now load from aggregate icon ZIPs, but the catalog can still show blank/text-only cards near the visible range. Example: `dog-enemy-033` through `dog-enemy-038` can appear without icons while later cards show icons. This looks like the virtual DOM / IntersectionObserver starts image loading too late, or the rendered visible window is not eagerly enqueued.
2. In battle, pressing a production card sometimes does not spawn a character.
3. In battle, spawned characters can render as broken large sprite fragments, for example a huge cropped cat face rectangle near the player base instead of a coherent animated actor.

The third issue is almost certainly not an icon issue. Treat it as a battle actor asset/runtime issue until disproven: actor bundle generation, image/imgcut/model/maanim compatibility, animation initialization, model transform, side flip, or renderer scale/projection.

---

## 1. Non-negotiable constraints

Do not ship any final fix that does any of the following:

```text
Disable semantic strict mode.
Disable RuntimeAssetGuard.
Restore runtime raw reads from public/assets/bcu/**.
Use actor sprite sheet image.png as a silent Formation/Production icon fallback.
Generate one ZIP per icon.
Hardcode actor scale/offset until it looks right.
Mark actor templates spawn-ready when required runtime assets are missing or incompatible.
Swallow preload/template/animation/render errors.
Set sceneReady=true after failed BattleScene.init.
Let a production click spend cooldown/money if actor creation actually failed, unless explicitly documented and diagnosed.
```

Required failure diagnostics must include, where applicable:

```text
semanticKey
characterId
side
bundlePath
internalPath
sourcePack
sourceRawPaths
role: move|idle|attack|kb
original error name/message/stack
```

---

## 2. Required BCU reference workflow

For BCU parity work, clone the reference repositories locally. Do not rely on partial snippets, GitHub previews, or memory.

Run something equivalent to:

```bash
mkdir -p /tmp/bcu-reference
cd /tmp/bcu-reference
git clone https://github.com/battlecatsultimate/BCU_java_util_common.git
git clone https://github.com/battlecatsultimate/BCU-java-PC.git
```

Then inspect the relevant files/classes. If paths differ, locate the moved equivalent by repository search.

```text
BCU_java_util_common:
  util/anim/ImgCut.java
  util/anim/MaModel.java
  util/anim/MaAnim.java
  util/anim/Part.java
  util/anim/EPart.java
  util/anim/EAnimD.java
  util/stage/Stage.java
  util/stage/SCDef.java
  util/stage/EStage.java
  battle/StageBasis.java
  battle/entity/Entity.java
  battle/entity/EUnit.java
  battle/entity/EEnemy.java
  battle/attack/*

BCU-java-PC:
  BattleBox / BBPainter / entity draw path
  any draw methods that call EAnimD / EPart rendering
```

Document exact class/method names used for:

```text
imgcut coordinate parsing and draw bounds
mamodel part fields and parent transform
maanim track application and interpolation
initial animation frame application before first draw
entity draw x/y, layer/depth, road baseline, camera pos/siz/ratio
player-vs-enemy direction/flip rules
unit/enemy spawn side and base coordinate rules
base/castle draw anchors
background draw/tile formula
attack timing vs target capture vs damage application order
```

Any transform, scale, anchor, spawn, or camera change must cite the BCU class/method in a code comment or in `docs/bcu-migration-status.md`.

---

## 3. Current code facts to re-check before editing

These are starting observations. Re-read the files before changing them.

### 3.1 Formation/catalog icon loading

`js/ui/FormationEditor.js` currently appears to:

```text
render icons as <img ... data-semantic-icon="...">
load selected slot icons immediately via resolveSelectedSlotIconsImmediately(provider)
load catalog grid icons through IntersectionObserver
use .formation-catalog-scroll as observer root
use rootMargin: '160px'
use virtual rows with rowHeight: 176, dynamic columns, overscanRows: 3
call renderCatalogWindow() and then resolveSemanticIcons() during scroll/rerender
```

The screenshot indicates the first visible/near-visible catalog icons are not being requested aggressively enough, or observer state is being lost/reused after virtual DOM replacement.

### 3.2 Semantic icon provider

`js/bcu/SemanticAssetProvider.js` caches icon object URLs by semantic key in `actorUiIconUrlCache`. `getActorUiIconUrl()` should read from:

```text
public/assets/generated/bcu-icon-index.json
public/assets/bundles/icon/enemy.zip
public/assets/bundles/icon/unit-f.zip
public/assets/bundles/icon/unit-c.zip
public/assets/bundles/icon/unit-s.zip
public/assets/bundles/icon/unit-u.zip
```

Do not replace this with actor bundle image fallback.

### 3.3 Actor runtime loading

`js/bcu/BcuAssetLoader.js` currently loads semantic actor bundles as:

```text
image.png
imgcut.imgcut
model.mamodel
move.maanim
idle.maanim
attack.maanim
kb.maanim
```

`js/battle/BattleActorFactory.js` then creates:

```text
BcuSpriteSheet(set.image, set.imgcut)
BcuModelInstance(set.model)
```

and should only claim higher readiness levels when required animations are present and compatible.

### 3.4 Actor bundle generation

`scripts/build-bcu-semantic-bundles.mjs` builds actor bundles from `entry.selected.files` in `bcu-actor-index.json` and writes:

```text
bundle.json
image.png
imgcut.imgcut
model.mamodel
move.maanim
idle.maanim
attack.maanim
kb.maanim
icon.png
```

Current generation must be audited. It must not silently drop missing files with filters such as:

```js
entries.filter((e) => e && e.data != null)
```

if the corresponding actor remains battle-loadable.

### 3.5 Playable dog/cat registry

`js/battle/PlayableCharacterRegistry.js` intentionally treats `enemy:0..777` as playable dog-side candidates and `unit:0..859:f` as cat-side candidates. A dog-side card with `semanticKey: enemy:<id>` is intentional. However, the produced actor still must spawn and render coherently on the player side.

---

## 4. P0 — Fix Formation virtual icon loading

### 4.1 Required diagnosis

Expose:

```js
globalThis.__FORMATION_ICON_DEBUG__ = {
  lastRender: {
    catalogItemCount,
    renderedDomCardCount,
    columns,
    rowHeight,
    overscanRows,
    start,
    end,
    scrollerClientHeight,
    scrollTop,
    firstVisibleRow,
    lastVisibleRow,
    eagerIconCount,
    observedIconCount,
    queuedIconCount,
    activeIconCount,
    resolvedIconCount,
    failedIconCount
  },
  recentIconFailures: []
};
```

Every failure should include:

```js
{
  semanticKey,
  bundlePath,
  internalPath,
  errorName,
  errorMessage
}
```

### 4.2 Required behavior

Fix `FormationEditor` so the first visible viewport and overscan are loaded immediately after each virtual render.

Required behavior:

```text
1. Selected 10 slot icons load immediately.
2. Currently rendered catalog icons in the visible viewport plus generous overscan load immediately.
3. IntersectionObserver remains only as backup for newly approaching items.
4. Overscan is large enough for iPad/Safari/touch scroll: start with at least 6-8 rows or roughly 2 viewport heights.
5. On every virtual window replacement, old pending DOM nodes are ignored safely and new visible nodes are enqueued.
6. Failed icon promises are not cached forever. Re-render can retry.
7. A DOM image is marked resolved only after load/decode succeeds, not immediately after assigning src.
```

Likely edits:

```text
Increase catalogVirtual.overscanRows from 3 or compute it from viewport height.
Increase IntersectionObserver rootMargin from '160px' to a larger value, e.g. '600px 0px 900px 0px', or compute from viewport height.
Add resolveVisibleCatalogIconsImmediately(provider).
Call resolveVisibleCatalogIconsImmediately(provider) after renderCatalogWindow().
Avoid duplicate queue entries for the same connected img.
Clear iconPending and allow retry on failure.
Rebuild iconObserver if the scroll root changes.
```

### 4.3 Required static check

Add or update:

```text
scripts/check-formation-virtual-icon-loading.mjs
```

It must verify:

```text
selected slot icons are loaded immediately
visible catalog icons are eagerly enqueued without relying only on IntersectionObserver
rootMargin is not the old small 160px
overscan is not the old 3-row-only value unless dynamic viewport overscan exists
failed icon state clears iconPending
rejected icon promises are not cached forever
```

---

## 5. P0 — Diagnose and fix battle production spawn failures

### 5.1 Required browser diagnostic

Expose:

```js
globalThis.__BATTLE_PRODUCTION_DEBUG__ = {
  lastClick: null,
  lastSpawnAttempt: null,
  failures: []
};
```

Each production card click must record:

```js
{
  characterId,
  slotId,
  semanticKey,
  unitDef,
  cost,
  cooldownRemaining,
  money,
  canAfford,
  canSpawn,
  factoryTemplateLevel,
  preloadError,
  spawnError,
  actorCountBefore,
  actorCountAfter
}
```

### 5.2 Required behavior

When a production card is pressed:

```text
If it cannot spawn, explain why in debug state and UI/logs.
If it can spawn, actor count must increase and the actor must have a valid template.
Do not silently swallow preload/template/animation errors.
Do not mark cooldown spent if spawn fails before actor creation, unless explicitly intended and documented.
```

Inspect and fix at least:

```text
js/ui/PlayerProductionBar.js
js/battle/BattleEconomy.js
js/battle/BattleScene.js
js/battle/BattleActorFactory.js
js/battle/CharacterCatalog.js
js/battle/PlayableCharacterRegistry.js
```

---

## 6. P0 — Diagnose and fix corrupted actor rendering

The giant cropped cat-face screenshot is the highest-priority battle rendering failure. Treat it as an actor asset compatibility/render bug until disproven.

### 6.1 Strong hypotheses to test in order

```text
1. Actor bundle source mismatch: image.png, imgcut.imgcut, model.mamodel, and role .maanim files are not all from a compatible BCU source pack/directory.
2. bcu-actor-index.json selected candidate is too permissive: partial/mixed candidate is treated as runtime-ready.
3. build-bcu-semantic-bundles.mjs silently drops missing entries and creates internally incomplete bundles.
4. check-actor-bundles-complete.mjs verifies existence but not compatibility.
5. BcuModelInstance does not apply an initial animation frame before first draw.
6. JS model transform differs from BCU EPart / EAnimD: parent scale, gsca, pivot, flip, opacity, z-order, coordinate sign.
7. Player-side use of enemy actor applies additional flip/scale incorrectly or double-flips.
8. Renderer applies camera scale or actor scale twice.
9. Actor is spawned before template reaches SPAWN_READY or FULL_VISUAL.
```

### 6.2 Required generation-side fixes

Update `scripts/build-bcu-semantic-bundles.mjs` and related utilities so actor bundles are all-or-fail for runtime actors.

For every selected battle-runtime actor:

```text
image.png source path exists
imgcut.imgcut source path exists
model.mamodel source path exists
move.maanim source path exists
idle.maanim source path exists
attack.maanim source path exists
kb.maanim source path exists
all runtime files are from the same candidate directory/sourcePack unless a documented BCU exception exists
no required entry is dropped by null filtering
bundle.json records sourcePack and exact sourceRawPaths per internal entry
```

If any required actor file is missing or incompatible:

```text
A. exclude the actor from playable battle rosters and mark it non-spawnable with a reason, or
B. fail generation/checks clearly
```

Do not create a battle-loadable actor bundle that is internally partial.

### 6.3 Required compatibility checks

Add or strengthen:

```text
scripts/check-actor-bundles-complete.mjs
scripts/check-actor-bundle-compatibility.mjs
scripts/check-playable-roster-actor-readiness.mjs
```

`check-actor-bundle-compatibility.mjs` must open every actor bundle used by playable dog/cat rosters and verify at minimum:

```text
ZIP contains required entries.
PNG signature/IHDR/CRC/IEND validates. Do not blindly apply icon-only trailing-byte policy to actor sprites unless proven safe.
imgcut.imgcut parses.
Every imgcut rectangle is inside image.png dimensions.
model.mamodel parses.
Every model part's imgcutIndex/partIndex is within parsed imgcut range, or documented as invisible/sentinel according to BCU.
Every .maanim parses.
Every animation track references valid model part ids, or follows documented BCU sentinel semantics.
Applying frame 0 of idle/move/attack/kb does not produce NaN/Infinity transforms.
Generated draw list has sane local bounds. Report outliers where width/height is far larger than the source image or expected viewport.
```

Failure output shape:

```json
{
  "semanticKey": "enemy:39",
  "bundlePath": "public/assets/bundles/actor/enemy/039.zip",
  "sourcePack": "...",
  "internalPath": "model.mamodel",
  "sourceRawPaths": [],
  "reason": "imgcut-rect-out-of-image | model-part-index-out-of-range | animation-part-id-out-of-range | initial-draw-bounds-outlier | missing-entry"
}
```

### 6.4 Required runtime fixes

Update runtime so corrupted rendering is impossible or diagnosed:

```text
In BcuAssetLoader.tryLoadSemanticActor(), validate bundle internals before returning the set. Include structured diagnostics.
In BattleActorFactory, do not return a template as render-ready/spawn-ready if sprite/model/required animations are incompatible.
In BattleActor or factory initialization, apply the correct initial idle frame before first render. Compare with BCU EAnimD / EPart initialization.
In BcuModelInstance, compare transform math against BCU. Fix parent transform, pivot, global scale, flip, opacity, z-order, coordinate sign only with BCU reference evidence.
In BattleSceneRenderer.drawActor, add a temporary diagnostic guard for impossible bounds. If bounds are absurd, log and skip drawing that actor rather than rendering a huge broken face rectangle.
```

The draw guard is not the final fix by itself. It exists to prevent broken rendering while surfacing the root cause.

### 6.5 Required browser diagnostic

Expose:

```js
globalThis.__LAST_ACTOR_RENDER_DEBUG__ = {
  semanticKey,
  characterId,
  side,
  sourcePack,
  bundlePath,
  image: { width, height },
  imgcut: { partCount, invalidRectCount },
  model: { partCount, invalidPartRefs },
  animations: { loadedRoles, missingRoles, invalidTrackRefs },
  firstFrameBounds,
  lastFrameBounds,
  transformExamples,
  skippedReason
};
```

---

## 7. P1 — Battle render parity with BCU

After compatibility is fixed, compare JS rendering against BCU. Do not guess.

Clone and inspect BCU, then document and enforce:

```text
BCU model coordinate origin and parent matrix order
BCU scale units, including baseScale, gsca, and per-part scale
BCU angle units and sign
BCU horizontal/vertical flip handling
BCU opacity multiplication
BCU part draw anchor/pivot behavior
BCU actor baseline and road depth/layer handling
BCU camera pos/siz/ratio/off behavior
BCU base/castle anchor behavior
```

If JS intentionally differs for preview/game-design reasons, document the intentional deviation in `docs/bcu-migration-status.md`.

---

## 8. P1 — UI layout and virtualization

Fix catalog layout if cards overlap toolbar/search or if virtual spacer causes visible blank rows.

Add or update:

```text
scripts/check-formation-catalog-grid-layout.mjs
```

It should verify constants/classes used by `FormationEditor` and CSS. Also record browser/manual verification notes in `docs/bcu-migration-status.md`.

---

## 9. Required verification commands

Run at minimum after fixes:

```bash
node scripts/build-bcu-manifest.mjs
node scripts/build-bcu-actor-index.mjs
node scripts/audit-bcu-icon-sources.mjs
node scripts/build-bcu-icon-index.mjs
node scripts/build-bcu-icon-bundles.mjs
node scripts/check-icon-png-integrity.mjs
node scripts/check-icon-index-paths-exist-in-zips.mjs
node scripts/build-bcu-semantic-bundles.mjs
node scripts/build-bcu-core-db-bundle.mjs
node scripts/build-bcu-core-index.mjs
node scripts/build-bcu-canonical-index.mjs

node scripts/check-bcu-database.mjs
node scripts/check-core-db-runtime.mjs
node scripts/check-actor-bundles-complete.mjs
node scripts/check-actor-bundle-compatibility.mjs
node scripts/check-playable-roster-actor-readiness.mjs
node scripts/check-formation-virtual-icon-loading.mjs
node scripts/check-bundled-assets-never-load-raw.mjs
node scripts/check-no-raw-runtime-paths.mjs
```

If a listed check does not exist, implement it.

---

## 10. Browser acceptance checklist

Run in a real browser, preferably the same iPad/Safari-like environment where the screenshots were taken.

### Before Apply Battle

```text
Formation selected slots show icons immediately.
First visible catalog row shows icons without extra scroll/re-render.
Catalog blank cards do not appear for entries that have icon index entries.
Scrolling remains responsive.
No actor bundle ZIPs are loaded before Apply Battle.
No raw public/assets/bcu/** resources are loaded.
Icon resources are aggregate ZIPs only.
```

Use:

```js
performance.getEntriesByType('resource')
  .filter(e => e.name.includes('/bundles/actor/'))
  .map(e => e.name);

performance.getEntriesByType('resource')
  .filter(e => e.name.includes('/bundles/icon/'))
  .map(e => e.name);

performance.getEntriesByType('resource')
  .filter(e => e.name.includes('/public/assets/bcu/') || e.name.includes('/assets/bcu/'))
  .map(e => e.name);

console.log(globalThis.__FORMATION_ICON_DEBUG__);
```

Expected:

```text
actor bundle resources before Apply: []
raw BCU resources: []
icon bundles: aggregate ZIPs only
```

### After Apply Battle

```text
Production cards appear and display images.
Pressing a production card either spawns a character or records actionable reason in __BATTLE_PRODUCTION_DEBUG__.
Spawned actors render as coherent animated characters, not giant sprite fragments.
No actor with impossible draw bounds is drawn without a diagnostic.
__LAST_ACTOR_RENDER_DEBUG__ shows valid image/imgcut/model/animation compatibility for spawned actors.
Zoom/pan still work.
semanticProvider.diagnostics.blockedRawReads and rawFallbacks are empty.
```

Use:

```js
const app = globalThis.__APP__ || globalThis.app;
const p = globalThis.__BCU_DB__?.semanticProvider;

console.log(globalThis.__BATTLE_PRODUCTION_DEBUG__);
console.log(globalThis.__LAST_ACTOR_RENDER_DEBUG__);
console.log(globalThis.__LAST_APPLY_BATTLE_REPORT__);
console.log(app?.battleScene?.camera?.getState?.());
console.log(p?.diagnostics?.blockedRawReads);
console.log(p?.diagnostics?.rawFallbacks);
console.log(p?.diagnostics?.bundleErrors);
```

---

## 11. Definition of done

The task is complete only when all are true:

```text
1. Formation visible-range icon loading is fixed and instrumented.
2. First visible catalog row is eagerly loaded, not dependent on late observer callbacks.
3. Production click failures are explained and valid clicks spawn actors.
4. Actor bundles used by playable rosters are complete and compatibility-checked.
5. Corrupted giant sprite-fragment actor rendering is fixed at its root cause.
6. Runtime refuses or diagnoses incompatible actor bundles instead of drawing broken actors.
7. BCU rendering differences are either corrected or documented with exact BCU references.
8. All new and existing checks pass.
9. Browser acceptance checklist is recorded in docs/bcu-migration-status.md.
10. No final fix weakens semantic strict mode or reintroduces raw BCU runtime reads.
```

If anything cannot be completed, leave a blocker with:

```text
file
function
semanticKey
bundlePath
internalPath
reason
next required action
```

Do not claim the issue is fixed unless the browser acceptance checklist has been run.
