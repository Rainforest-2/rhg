# AGENTS.md — Apply Battle / BCU Semantic Runtime Regression Repair Contract

Repository: `rhgrive2/game`

Goal: fix `main` so **Apply Battle** behaves like the known-good branch `pre-zip-best-state2`, while preserving the semantic ZIP runtime. This is a regression-repair contract for Codex/agents. It is not a cosmetic prompt and not a “file exists” audit.

User report to satisfy:

```text
mainでApply Battle後の挙動がおかしい。
このブランチのようにならない理由を完全に見つけて直す。
写真読み込み失敗だけではない。
ズームできない・大きさがおかしいのは別問題として扱う。
BCU側も確認して修正する。
```

Comparison target:

```text
bad/current: main
good/reference: pre-zip-best-state2
repo: rhgrive2/game
```

Do not modify branches, PRs, workflow automation, or merge state unless the user explicitly asks.

---

## 0. Required mental model

The regression is not one bug.

`pre-zip-best-state2` was mainly a raw BCU asset runtime. It read BCU files directly from paths like:

```text
public/assets/bcu/**
public/assets/bcu-manifest.json
```

`main` is now a semantic ZIP runtime. It boots through:

```text
SemanticAssetProvider
public/assets/generated/*.json
public/assets/bundles/**/*.zip
RuntimeAssetGuard
```

In semantic-strict mode, raw BCU runtime reads are blocked. Therefore, do not “fix” the regression by restoring raw runtime reads. The fix must make the semantic bundle/runtime path complete enough to match the old visible behavior.

Required end state:

```text
Apply Battle succeeds.
BattleScene.init completes.
sceneReady becomes true only after init success.
battleScene exists after Apply.
battleScene.camera exists after Apply.
Zoom and pan work after Apply.
Formation selected 10 slots show images.
Production cards show images.
Actors/background/bases/effects/stage data load from semantic bundles.
No runtime raw public/assets/bcu/** reads occur in semantic-strict.
Dog/player base visual is restored through semantic assets, not raw paths.
Enemy castle still uses the BCU right-edge anchor.
Scale/projection/anchor changes are checked against BCU, not guessed.
All failures include semanticKey, bundlePath, internalPath, and original error details.
```

---

## 1. Facts already verified from current code

Re-check these files before editing. These are verified starting points, not a substitute for reading the code.

### 1.1 Boot path changed fundamentally

In current `main`, `js/bcu/BcuBootLoader.js`:

```text
- creates SemanticAssetProvider
- calls semanticProvider.load()
- installs RuntimeAssetGuard
- in semantic-strict, reads core DB through semanticProvider.readCoreDb()
- builds repositories from core DB
```

In `pre-zip-best-state2`, `BcuBootLoader`:

```text
- reads ./public/assets/bcu-manifest.json
- uses raw manifest + readText
- builds repositories from raw BCU files
```

This means failures on `main` may happen before BattleScene assignment, and old raw paths that worked in the branch can now be illegal.

### 1.2 Runtime raw guard exists

Current `js/bcu/RuntimeAssetGuard.js` blocks raw BCU access through:

```text
fetch()
HTMLImageElement.src
Element.setAttribute("src")
MutationObserver-added img[src]
```

Forbidden in semantic-strict:

```text
public/assets/bcu/**
./public/assets/bcu/**
public/assets/bcu-manifest.json
./public/assets/bcu-manifest.json
```

Do not disable this guard as the final fix.

### 1.3 Formation icons changed from raw `<img src>` to semantic icon bundles

`pre-zip-best-state2` `js/ui/FormationEditor.js` used raw/fallback image src:

```html
<img src="uiIcon.primary" onerror="fallback">
```

Current `main` uses:

```text
data-semantic-icon
getBcuAssetDatabase()?.semanticProvider
provider.getActorUiIconUrl(key)
blob URL from icon bundle
IntersectionObserver / icon queue / concurrency
```

Therefore an icon can fail on `main` even if the raw PNG exists, when the icon index or aggregate icon ZIP is wrong.

### 1.4 Zoom failure is likely scene init failure first

`PreviewApp.resetBattle()` constructs `nextScene`, awaits `nextScene.init(...)`, then assigns:

```js
this.battleScene = nextScene;
this.sceneReady = true;
```

If `nextScene.init()` throws, `this.battleScene` remains null and `BattleCameraInputController` cannot retrieve a camera. That produces “zoom cannot work” even though the camera code itself may be correct.

Diagnose zoom in this order:

```text
A. Did BattleScene.init complete?
B. Does battleScene exist?
C. Does battleScene.camera exist?
D. Do input events reach BattleCameraInputController?
E. Does camera zoom/pan state change?
F. Is projection/clamp invalid?
```

Do not ship a zoom fix without proving which branch is true.

### 1.5 Player/dog base visual regressed independently of icon loading

In `pre-zip-best-state2`, `js/battle/BattleConfig.js` had:

```js
bases.dogBase.visualKind = 'castle-composite';
bases.dogBase.visualAssetId = 'castle-composite-000';
```

and `js/data/previewAssets.js` included `castle-composite-000` with nyanko castle layers.

In current `main`, `BattleConfig.js` has:

```js
bases.dogBase.visualKind = 'simple-placeholder';
bases.dogBase.visualAssetId = null;
```

and current `previewAssets.js` no longer contains `castle-composite-000`.

This is a direct visual parity regression. Do not dismiss it as “image loading failed.” Restore player base visuals through semantic castle/nyanko bundles.

### 1.6 Current renderer already contains BCU projection work

Current `js/battle/BattleSceneRenderer.js` already contains BCU-oriented helpers:

```text
projectBcuX(scene, worldX)
projectBattleX(scene, worldX)
getBcuRenderConstants()
getBcuLayerScreenY()
getBcuSpriteScale()
drawBcuEnemyCastle(): drawX = sx - drawW
```

Do not replace these with guessed screen-space math. If size or position is wrong, inspect the inputs feeding this renderer and compare against BCU.

---

## 2. Mandatory BCU reference inspection

Before changing stage, spawn, base, camera, draw, anchor, or scale logic, inspect BCU source. Use local copies if available. Otherwise use public repositories:

```text
battlecatsultimate/BCU_java_util_common
battlecatsultimate/BCU-java-PC
```

Read at minimum:

```text
BCU_java_util_common:
  util/stage/Stage.java
  util/stage/SCDef.java
  util/stage/EStage.java
  battle/StageBasis.java
  battle/entity/Entity.java
  battle/attack/*
  common/util/anim/* or util/anim/*

BCU-java-PC:
  page/battle/BattleBox.java
```

Extract and document:

```text
SCDef field order and meaning
StageBasis update order
enemy/player base coordinate source
spawn coordinate source
entity draw x/y formula
camera pos/siz/ratio semantics
road baseline and depth/layer formula
sprite scale
background draw/tile formula
base/castle draw anchors
attack timeline vs target capture vs damage application order
```

Do not claim “BCU parity” unless the PR or patch references the corresponding BCU class/method and the JS code/check that enforces it.

The BCU source paths above are reference targets, not guaranteed exact tree paths in every branch/tag. If a listed file moved, locate the equivalent class by repository search and document the actual path used.

---

## 3. Hard prohibitions

Do not ship any of these as the final fix:

```text
Only add try/catch.
Hide the loading/error overlay without fixing the cause.
Set sceneReady=true after failed init.
Make BattleCameraInputController ignore missing camera.
Disable RuntimeAssetGuard.
Switch semantic-strict to raw fallback by default.
Re-add public/assets/bcu/** runtime image paths.
Use actor image.png as a silent Formation icon fallback.
Generate one ZIP per icon.
Mark actor template ready when required battle animations are missing.
Let StageDefinitionLoader silently produce a playable fake fallback after semantic stage load failure.
Hardcode scale until it looks close.
Move combat/base coordinates using visual image width.
Rewrite renderer math without BCU inspection.
Assume generated JSON/ZIP files are empty from truncated GitHub previews.
```

---

## 4. P0 root-cause report first

Before changing behavior, add a repeatable Apply Battle diagnostic.

Expose this after every Apply Battle attempt:

```js
globalThis.__LAST_APPLY_BATTLE_REPORT__ = {
  ok,
  phase,
  sceneReady,
  hasBattleScene,
  hasCamera,
  cameraState,
  selectedStageId,
  stageKey,
  semanticMode,
  timings,
  failedSubsystem,
  error: {
    name,
    message,
    stack,
    cause,
    originalErrorName,
    originalErrorMessage
  },
  diagnostics: {
    bundleErrors,
    missingBundles,
    blockedRawReads,
    rawFallbacks,
    lastActorLoad,
    lastStageLoad,
    lastBackgroundLoad,
    lastCastleLoad,
    lastKbeffLoad
  }
};
```

`failedSubsystem` must be one of:

```text
boot
stage-definition
stage-runtime
background
enemy-castle
player-castle
actor-template
actor-animation
effect-kbeff
production-roster
camera
renderer
raw-guard
unknown
```

### 4.1.1 Expose the running app for verification

Current `js/main.js` starts the app with `await new PreviewApp({ bcuDb: db }).start();`, so browser snippets that read `globalThis.__APP__` or `globalThis.app` may not work unless the app instance is explicitly exposed.

Change boot/startup to keep the instance and expose it for diagnostics:

```js
const app = new PreviewApp({ bcuDb: db });
globalThis.__APP__ = app;
globalThis.app = app; // optional compatibility alias
await app.start();
```

Do not rely on `globalThis.__APP__` in verification unless this change exists.

Add detailed logs in:

```text
js/preview/PreviewApp.js
js/ui/FormationEditor.js
```

Use this error shape, especially for Safari/WebKit:

```js
console.error('[PreviewApp] applyFormationToBattle failed detail', {
  name: e?.name,
  message: e?.message,
  stack: e?.stack,
  cause: e?.cause,
  error: e
});
```

---

## 5. P0-A: Make BattleScene.init fail clearly, not half-run broken

If semantic stage/background/castle/actor/effect loading fails, strict mode must either:

```text
A. fail Apply Battle with detailed report and sceneReady=false
B. continue only with an explicit, verified fallback and report the fallback reason
```

Do not continue with a silent fake runtime that leaves camera/stage/base visuals broken.

Every loader used by `BattleScene.init` must preserve structured errors:

```js
{
  kind,
  semanticKey,
  bundlePath,
  internalPath,
  missingEntries,
  invalidEntries,
  sourceRawPath,
  originalErrorName,
  originalErrorMessage,
  message
}
```

Cover at least:

```text
StageDefinitionLoader.load()
StageBackgroundLoader.load()
BcuCastleAssetLoader.load()
BcuKbeffLoader.loadAll()
BattleActorFactory.preloadTemplate()
BcuAssetLoader.loadAssetSet()
BcuAssetLoader.loadAnimation()
SemanticAssetProvider.readIconBundle()
SemanticAssetProvider.readActorBundle()
SemanticAssetProvider.readStageCsv()
```

Acceptance:

```text
A failed Apply Battle clearly says which subsystem failed, which key/bundle/path failed, and why.
A successful Apply Battle creates battleScene and camera.
No user-facing failure is only Error {}.
```

---

## 6. P0-B: Restore player/dog base visual via semantic assets

The old branch showed a nyanko castle composite. Current main uses a placeholder. Fix this as a first-class visual/runtime issue.

Do not restore raw `previewAssets.js` castle paths as runtime paths.

Implement one of:

```text
js/battle/BcuPlayerCastleAssetLoader.js
or extend js/battle/BcuCastleAssetLoader.js
```

Required source:

```text
semantic castle index entries such as nyankoCastle:<partId>
or coreDb.castles.nyanko records
```

Required default composite intent:

```text
top    = nyanko castle part 000 equivalent
middle = nyanko castle part 002 equivalent
bottom = nyanko castle part 003 equivalent
```

If semantic nyanko castle bundles are not generated, update generation scripts so these exist:

```text
public/assets/generated/bcu-castle-index.json
public/assets/bundles/castle/nyanko/<partId>.zip
```

Each used bundle must contain valid browser-readable PNG bytes.

Do not leave final runtime as:

```js
bases.dogBase.visualKind = 'simple-placeholder';
bases.dogBase.visualAssetId = null;
```

Use a clear semantic visual kind, for example:

```js
visualKind: 'bcu-player-castle-composite'
```

or reuse `castle-composite` only if its layers are semantic, not raw.

Player base visual position must be BCU-derived:

```text
x: StageRuntime player base coordinate
y: BCU road/baseline calculation
scale: camera.siz and BCU draw scale rules
anchor: verified from BCU BattleBox/base draw path
```

Do not alter combat `x`, `frontX`, or `posBcu` based on visual image width.

Acceptance:

```text
Dog/player base is not gray placeholder after Apply Battle.
Enemy castle still uses right-edge anchor.
Base combat coordinates remain StageRuntime-derived.
Zooming does not mutate world coordinates.
```

---

## 7. P0-C: Fix zoom only after proving the failure mode

After Apply Battle, run:

```js
const app = globalThis.__APP__ || globalThis.app;
const scene = app?.battleScene;
console.log(scene);
console.log(scene?.camera?.getState?.());
console.log(app?.cameraInputController?.lastInputDebug);
```

If `scene` or `scene.camera` is missing, fix init/resource failure first.

If camera exists, verify:

```text
canvas receives wheel/pointer events
cameraInputController is attached once
formation overlay is hidden and not intercepting events
loading overlay is hidden and not intercepting events
production UI is not blocking canvas events
camera.zoomAtScreenPoint runs
camera.panByScreenDelta runs
camera clamp state is valid
stageLen is finite
visibleWorldWidth is finite
```

Add/keep debug:

```js
cameraInputController.lastInputDebug = {
  type,
  clientX,
  clientY,
  logicalX,
  logicalY,
  before: camera.getState(),
  after: camera.getState(),
  preventedDefault,
  targetTag,
  overlayAtPoint
};
```

Acceptance:

```text
wheel changes camera.siz/zoom
drag changes camera.pos
stageLen does not change during pan/zoom
worldToScreenX/screenToWorldX roundtrip remains valid
```

---

## 8. P0-D: Semantic actor runtime completeness

A battle actor bundle is not spawn-ready unless it contains all runtime-required entries:

```text
bundle.json
image.png
imgcut.imgcut
model.mamodel
move.maanim
idle.maanim
attack.maanim
kb.maanim
```

Add/update:

```text
scripts/check-actor-bundles-complete.mjs
```

For every battle-loadable actor in `public/assets/generated/bcu-actor-index.json`, verify:

```text
bundleRef.bundlePath exists
bundle.json exists
image.png exists and is valid PNG
imgcut.imgcut exists
model.mamodel exists
move.maanim exists
idle.maanim exists
attack.maanim exists
kb.maanim exists
```

Failure report shape:

```json
{
  "semanticKey": "enemy:0",
  "bundlePath": "public/assets/bundles/actor/enemy/000.zip",
  "missingEntries": [],
  "invalidEntries": [],
  "sourceRawPaths": []
}
```

Runtime must not mark templates as spawn-ready/full-visual when required animations are missing.

Animation failures must include:

```js
{
  kind: 'actor-animation',
  semanticKey,
  role: 'move|idle|attack|kb',
  bundlePath,
  internalPath,
  missingEntries,
  originalErrorName,
  originalErrorMessage,
  message
}
```

---

## 9. P0-E: Stage/runtime must not silently use fake fallback

In semantic-strict, if the selected stage has a semantic `stageKey` or `bundleRef` and loading fails:

```text
Apply Battle must fail clearly.
Do not silently create a playable fallback stage.
```

A fallback is allowed only in explicit diagnostic mode and must be reported as:

```text
failedSubsystem: stage-definition
reason: semantic-stage-load-failed
```

Acceptance after successful Apply:

```js
Number.isFinite(scene.stage.runtime.stageLen) === true
scene.camera.stageLen === scene.stage.runtime.stageLen
Array.isArray(scene.stage.runtime.enemyRows) === true
scene.stage.background.source is semantic or explicitly verified fallback
```

---

## 10. P0-F: Background, castle, and effect bundle integrity

### Background

Semantic background bundle must contain:

```text
bundle.json
image.png
imgcut.imgcut
```

Add/update:

```text
scripts/check-background-bundles-complete.mjs
```

Check entries from:

```text
public/assets/generated/bcu-background-index.json
```

### Castle

Enemy castle bundle must contain:

```text
bundle.json
image.png
```

Player/nyanko castle bundles must also be validated if used by player base visual.

Add/update:

```text
scripts/check-castle-bundles-complete.mjs
```

Check:

```text
public/assets/generated/bcu-castle-index.json
```

### KBEff

Strict mode must use:

```text
public/assets/bundles/effect/kbeff.zip
```

Required entries:

```text
bundle.json
image.png
imgcut.imgcut
model.mamodel
kb_hb.maanim
kb_sw.maanim
kb_ass.maanim
```

If missing, either gate KBEff safely or fail with structured error. Do not raw fallback.

---

## 11. P0-G: Icon fixes are required but not sufficient

Icons must use aggregate icon ZIPs:

```text
public/assets/bundles/icon/enemy.zip
public/assets/bundles/icon/unit-f.zip
public/assets/bundles/icon/unit-c.zip
public/assets/bundles/icon/unit-s.zip
public/assets/bundles/icon/unit-u.zip
```

Do not generate one ZIP per icon.

Runtime path:

```text
FormationEditor -> provider.getActorUiIconUrl(key)
PlayerProductionBar -> provider.getActorUiIconUrl(key)
SemanticAssetProvider -> bcu-icon-index.json -> aggregate ZIP -> internalPath -> Blob URL
```

Selected 10 Formation slot icons must load immediately, not through the catalog scroll observer.

Required shape:

```js
resolveSemanticIcons() {
  resolveSelectedSlotIconsImmediately(provider);
  observeCatalogIconsOnly(provider);
}
```

Failure cache rule:

```text
Do not permanently cache rejected icon promises.
Clear pending marker on failure.
Do not set iconResolved before image success.
Allow retry on rerender.
Log semanticKey/bundlePath/internalPath/error.
```

Enemy/dog icon policy:

```text
enemy:<id> prefers enemy_icon_<id3>.png
Search packs deterministically.
Do not hardcode only 000010.
IDs around/after 526 must not assume the old format.
If no valid enemy_icon_<id3>.png exists, show placeholder rather than silently using actor sprite sheet image.
```

PNG integrity for every icon bundle entry:

```text
PNG signature
IHDR first, length 13
valid dimensions
known browser-compatible bitDepth/colorType
chunk bounds
CRC
IEND
no unexpected trailing bytes unless documented
```

Required checks:

```text
scripts/check-icon-png-integrity.mjs
scripts/check-icon-index-paths-exist-in-zips.mjs
```

---

## 12. P0-H: Formation performance

Required:

```text
CharacterCatalog memoized by bcuDb identity + locale + revision/version.
getAvailableCharacters/getCharactersByFaction/getCharacterById use indexes.
FormationEditor does not rebuild full catalog per card.
FormationEditor virtualizes large catalog DOM.
Only visible/overscan catalog cards request icon blob URLs.
Selected 10 slot icons may load immediately.
Icon fetch/decode concurrency remains bounded.
```

Instrumentation:

```js
performance.mark('formation-render-start');
performance.mark('formation-render-end');
performance.measure('formation-render', 'formation-render-start', 'formation-render-end');
```

Track:

```text
catalog item count
rendered DOM card count
selected slot icon count
icon queue size
visible icon count
actor ZIP resources before Apply
raw BCU resources
long task count if available
```

Before Apply acceptance:

```text
actor bundle resources = 0
raw BCU resources = 0
selected 10 slots show icons
catalog DOM is windowed
scroll remains responsive
```

---

## 13. P1: BCU render/scale parity

Do not guess visual scale.

Inspect BCU `BattleBox` / `BBPainter` / entity draw code and compare to JS.

Verify before changing:

```text
BCU render offset/off
camera pos/siz/ratio
road height
layer/depth step
sprite scale
actor currentLayer
enemy castle right-edge anchor
player base anchor
background draw/tile formula
```

Current JS constants include:

```text
off: 200
roadH: 156
depthStep: 4
spriteScale: 0.8
```

Do not change them unless BCU inspection proves the correction.

If size is wrong, inspect inputs first:

```text
camera.siz / zoom
camera.midh
stage.runtime.stageLen
actor.scale
BATTLE_CONFIG.visualLayout.actorGlobalScale
bcuEntityRender.ignoreActorConfigScale
model/imgcut bounds
player base visual scale
background crop scale
devicePixelRatio / logical canvas size
```

Acceptance:

```text
zoom changes camera scale predictably
actors scale with camera consistently
base/castle size and anchor match BCU or the reference branch target
combat positions do not drift when visual size changes
```

---

## 14. P1: BCU stage/spawn/runtime parity

Preserve BCU responsibility boundaries:

```text
Stage / SCDef parse data
EStage runtime row state
StageBasis update order
Entity state/update
BattleBox draw order
```

JS target boundaries:

```text
StageDefinitionLoader: parse/preserve SCDef-like rows
StageRuntime: stage coordinates and base/spawn APIs
BcuStageSpawnRuntime: spawn timing/gating state
BattleScene: orchestration only
BattleCamera: projection/clamp only
BattleSceneRenderer: draw only
```

Preserve stage row fields even if not fully consumed yet:

```text
enemy
number/count
spawn_0
spawn_1
respawn_0
respawn_1
castle_0
castle_1
layer_0
layer_1
boss
multiple / magnification
group
mult_atk
kill_count
score
special spawn control
```

Do not discard raw BCU fields because current runtime has no implementation yet.

---

## 15. Required scripts/checks

Add or keep these commands and make them pass:

```bash
node scripts/check-bundled-assets-never-load-raw.mjs
node scripts/check-icon-bundles-are-aggregated.mjs
node scripts/check-icon-bundles-never-load-actor-bundles.mjs
node scripts/check-formation-icons-use-icon-bundles.mjs
node scripts/check-production-icons-use-icon-bundles.mjs
node scripts/check-icon-png-integrity.mjs
node scripts/check-icon-index-paths-exist-in-zips.mjs
node scripts/check-actor-bundles-complete.mjs
node scripts/check-background-bundles-complete.mjs
node scripts/check-castle-bundles-complete.mjs
node scripts/check-battle-scene-stage-runtime-wiring.mjs
node scripts/check-bcu-stage-spawn-runtime.mjs
node scripts/check-stage-asset-tracing.mjs
node scripts/check-renderer-coordinate-paths.mjs
node scripts/check-bcu-castle-runtime-geometry.mjs
```

If a script does not exist, add it.

Update `docs/bcu-migration-status.md` with exact checks run, browser/manual results, and unresolved blockers.

---

## 16. Browser acceptance checklist

Run in a real browser after build.

### Before Apply Battle

Expected:

```text
Formation visible
selected 10 slots show icons
catalog scroll responsive
no actor bundle ZIPs loaded
no raw public/assets/bcu/** loaded
no public/assets/bcu-manifest.json loaded
icon resources are aggregate ZIPs only
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
```

Expected:

```text
actor bundle resources before Apply: []
raw BCU resources: []
icon bundles: aggregate ZIPs only
```

### Apply Battle

Expected:

```text
overlay progress visible
BattleScene.init completes
sceneReady true
battleScene assigned
camera assigned
stage runtime finite
background visible
dog/player base not placeholder
enemy castle visible
production bar visible
no generic Error {}
```

### After Apply Battle

Expected:

```text
wheel zoom works
drag pan works
camera stageLen remains stable
actors render at BCU-derived scale
base/castle size and anchor are correct
production card images show
player unit spawning works
stage enemies spawn
blockedRawReads is []
rawFallbacks is []
```

Use:

```js
const app = globalThis.__APP__ || globalThis.app;
const p = globalThis.__BCU_DB__?.semanticProvider;
console.log(globalThis.__LAST_APPLY_BATTLE_REPORT__);
console.log(app?.battleScene?.camera?.getState?.());
console.log(p?.diagnostics?.blockedRawReads);
console.log(p?.diagnostics?.rawFallbacks);
console.log(p?.diagnostics?.bundleErrors);
```

---

## 17. Definition of done

Additional non-negotiable items:

```text
- enemy.zip index/ZIP/PNG integrity is verified.
- enemy.zip coverage is verified from the expected minimum enemy id, not merely for already-indexed entries.
- enemy.zip must not start halfway through the enemy id range unless all leading ids are explicitly diagnosed.
- enemy icons follow enemy_icon_<id3>.png source policy where available.
- selected Formation slot icons are not tied to catalog IntersectionObserver root.
- Formation catalog grid rows/columns are stable and do not overlap search/filter controls.
- Character swap/replacement updates only affected DOM/state and does not rebuild/reload the whole catalog.
- DOM image resolved/pending state is retry-safe.
- Apply Battle success/failure leaves DOM overlays and camera input in a verified state.
```


Done only when all are true:

```text
1. main Apply Battle works in browser.
2. Zoom/pan works after Apply Battle.
3. Selected Formation 10-slot images show.
4. Production card images show.
5. Player/dog base visual is restored through semantic assets, not raw paths.
6. Enemy castle still uses BCU right-edge anchor.
7. Stage/background/castle/actor/effect all load from semantic bundles in strict mode.
8. Runtime raw BCU access is zero.
9. Actor templates are not ready when required animations are missing.
10. Semantic failures produce actionable diagnostics, not generic Error {}.
11. Large catalog remains responsive.
12. All required node checks pass.
13. Browser resource audit passes.
14. docs/bcu-migration-status.md records completed, partial, unresolved, and manual verification results.
15. check-enemy-zip-complete-from-start.mjs proves enemy.zip does not start from the middle of the expected enemy id range.
16. bcu-icon-source-audit.json and bcu-icon-index.json preserve explicit enemy coverage diagnostics for missing leading ids and gap ranges.
17. Formation catalog row/column layout is verified in browser and by check-formation-catalog-grid-layout.mjs.
18. Character swap/replacement performance is verified and does not trigger full catalog rebuild or actor bundle loading before Apply.
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

Do not claim the regression is fixed unless the browser acceptance checklist has been run.


---

# P0-I. Fix aggregate `enemy.zip` corruption, stale entries, and source/index mismatch

This section is mandatory. It specifically covers the user-reported `enemy.zip` issue.

## Problem

`public/assets/bundles/icon/enemy.zip` may be present and non-empty, but still unusable because:

```text
the ZIP contains corrupt PNG entries
the ZIP is missing entries referenced by bcu-icon-index.json
bcu-icon-index.json points to an internalPath that does not exist in enemy.zip
the indexed sourcePath is not the desired enemy_icon_<id3>.png
some enemy icons after/around id 526 use a different source pattern than earlier icons
runtime caches a failed icon lookup and never retries
```

This is not a "file exists" problem. It is a content, index, and runtime validation problem.

## Required invariant

For every enemy icon entry in:

```text
public/assets/generated/bcu-icon-index.json
```

all of these must be true:

```text
bundleRef.bundlePath === public/assets/bundles/icon/enemy.zip
internalPath matches enemy/<id3>.png
enemy.zip contains that exact internalPath
the PNG bytes at that internalPath pass strict PNG validation
sourcePath points to a valid audited enemy_icon_<id3>.png when available
runtime getActorUiIconUrl("enemy:<id>") returns a blob: URL from enemy.zip
runtime does not open actor/enemy/<id3>.zip for Formation/Production icons
runtime does not read public/assets/bcu/** for Formation/Production icons
```

If any of these is false, the build/check must fail.

## Enemy icon source policy

For enemy key:

```text
enemy:<id>
```

preferred source basename is:

```text
enemy_icon_<id3>.png
```

Examples:

```text
enemy:0   -> enemy_icon_000.png
enemy:12  -> enemy_icon_012.png
enemy:525 -> enemy_icon_525.png
enemy:526 -> enemy_icon_526.png
```

Do not use these as final enemy UI icons when a valid `enemy_icon_<id3>.png` exists:

```text
edi_<id>.png
edi_<id3>.png
actor sprite sheet image.png
actor bundle image.png
```

For missing `enemy_icon_<id3>.png`, mark the icon as missing and show a non-BCU placeholder. Do not silently remap to actor image.

## Required enemy.zip rebuild behavior

`build-bcu-icon-index.mjs` and `build-bcu-icon-bundles.mjs` must be deterministic and must not preserve stale entries.

Required behavior:

```text
1. audit all enemy icon candidates
2. choose one valid source per enemy key
3. write bcu-icon-index.json from valid audited records only
4. rebuild enemy.zip from scratch
5. verify every index internalPath exists in enemy.zip
6. verify every PNG in enemy.zip is valid
7. fail if index and zip disagree
```

The generator must not do:

```js
.filter((entry) => entry.data)
```

in a way that drops ZIP entries without also removing the matching index records.

## Required scripts

Add or update:

```text
scripts/audit-bcu-icon-sources.mjs
scripts/build-bcu-icon-index.mjs
scripts/build-bcu-icon-bundles.mjs
scripts/check-icon-png-integrity.mjs
scripts/check-icon-index-paths-exist-in-zips.mjs
scripts/check-enemy-icon-source-policy.mjs
```

`check-enemy-icon-source-policy.mjs` must verify:

```text
enemy entries use enemy.zip
enemy internal paths are enemy/<id3>.png
desired source basename is enemy_icon_<id3>.png where available
enemy ids around and after 526 are audited
no enemy entry silently uses actor image.png
no enemy entry silently uses edi_*.png when enemy_icon_<id3>.png exists
```

## Required runtime diagnostics

When `getActorUiIconUrl("enemy:<id>")` fails, diagnostics must include:

```js
{
  kind: "icon",
  semanticKey: "enemy:<id>",
  bundlePath: "public/assets/bundles/icon/enemy.zip",
  internalPath: "enemy/<id3>.png",
  sourcePath,
  reason: "missing-index-entry|missing-zip-entry|invalid-png|image-decode-failed|zip-read-failed",
  originalErrorName,
  originalErrorMessage
}
```

Do not collapse this into generic `Error {}`.

---

# P0-I2. Fix `enemy.zip` incomplete range / midpoint-only contents

This section is mandatory and is the specific correction for the current user report:

```text
enemy.zip does not contain the full expected enemy icon range.
enemy.zip starts only from a middle enemy id / later range.
Early enemy ids are absent from the ZIP.
```

This is not only a corrupt-PNG issue and not only an index-to-ZIP consistency issue.

The core failure mode is:

```text
audit misses early enemy icon sources
  -> bcu-icon-index.json silently omits those enemy ids
  -> build-bcu-icon-bundles.mjs writes only indexed entries
  -> enemy.zip starts halfway through the enemy id range
```

Current code pattern to inspect:

```text
scripts/audit-bcu-icon-sources.mjs:
  enemyCandidates(entry) searches only paths ending with:
  /org/enemy/<id3>/enemy_icon_<id3>.png

scripts/build-bcu-icon-index.mjs:
  if desiredSourcePath is missing or invalid, the actor entry is skipped

scripts/build-bcu-icon-bundles.mjs:
  enemy.zip is generated only from bcu-icon-index.json entries
```

Therefore, existing checks that validate only entries already present in `bcu-icon-index.json` are insufficient. They can pass even when `enemy.zip` begins at a later enemy id.

## Required enemy coverage universe

Define the expected enemy icon universe from:

```text
public/assets/generated/bcu-actor-index.json
```

For every entry:

```text
kind === "enemy"
key === "enemy:<id>"
id is finite
```

there must be a coverage decision:

```text
included
missing-source
invalid-source
intentionally-excluded
```

It is forbidden for an enemy id to disappear silently between actor index, icon audit, icon index, and enemy.zip.

## Required coverage invariant

Let:

```text
expectedMinEnemyId = minimum enemy id in bcu-actor-index.json where kind === enemy
actualMinEnemyZipId = minimum enemy id represented by enemy/*.png inside enemy.zip
```

Then:

```text
actualMinEnemyZipId must equal expectedMinEnemyId
```

unless every id in the leading missing range is explicitly recorded as:

```text
missing-source
invalid-source
intentionally-excluded
```

with a documented reason.

If:

```text
expectedMinEnemyId = 0
actualMinEnemyZipId = 526
```

the build/check must fail with a clear error explaining that `enemy.zip` starts from the middle of the enemy id range.

## Required audit output

Update `public/assets/generated/bcu-icon-source-audit.json` so the enemy section includes:

```json
{
  "enemyCoverage": {
    "totalEnemyActors": 0,
    "included": 0,
    "missingSource": 0,
    "invalidSource": 0,
    "intentionallyExcluded": 0,
    "expectedMinEnemyId": 0,
    "expectedMaxEnemyId": 0,
    "actualFirstIncludedId": 0,
    "actualLastIncludedId": 0,
    "missingLeadingIds": [],
    "gapRanges": []
  }
}
```

Each enemy record must include:

```json
{
  "semanticKey": "enemy:000",
  "kind": "enemy",
  "id": 0,
  "id3": "000",
  "coverageStatus": "included|missing-source|invalid-source|intentionally-excluded",
  "selectedSourcePath": "public/assets/bcu/...png",
  "selectedSourceKind": "enemy_icon|edi|legacy-icon|none",
  "selectedSourcePack": "000010",
  "selectedReason": "same-pack-enemy-icon|newest-pack-enemy-icon|same-pack-edi|newest-pack-edi|legacy-compatible-source|missing-source",
  "candidates": [],
  "missingReason": null,
  "notes": []
}
```

The Markdown audit report must visibly print:

```text
expected min enemy id
actual first included enemy id
missing leading id range
gap ranges
ids using enemy_icon source
ids using edi/legacy source
ids with no valid source
```

## Required source discovery expansion

The enemy candidate finder must not search only:

```text
enemy_icon_<id3>.png
```

For each enemy id, scan all manifest files and include exact basename candidates:

```text
enemy_icon_<id3>.png
edi_<id3>.png
edi_<id>.png
```

Also include any explicitly documented legacy BCU enemy icon naming convention discovered in the current asset tree.

Do not use loose substring matching.

Do not use the actor sprite sheet as the normal UI icon source:

```text
<id3>_e.png
image.png
actor bundle image.png
```

unless explicitly documented as a diagnostic placeholder. Actor sprite sheet fallback must not be counted as real `enemy.zip` coverage.

Source selection priority:

```text
1. valid enemy_icon_<id3>.png in same source pack as selected actor runtime source
2. valid enemy_icon_<id3>.png in highest/newest numeric pack
3. valid edi_<id3>.png or edi_<id>.png in same source pack as selected actor runtime source
4. valid edi_<id3>.png or edi_<id>.png in highest/newest numeric pack
5. explicitly documented legacy icon source
6. missing-source
```

## Required icon index diagnostics

`public/assets/generated/bcu-icon-index.json` may omit missing-source enemies from runtime icon entries, but it must preserve diagnostics:

```json
{
  "enemyCoverage": {
    "expectedMinEnemyId": 0,
    "actualFirstIncludedId": 0,
    "missingLeadingIds": [],
    "gapRanges": [],
    "missing": [
      {
        "key": "enemy:001",
        "id": 1,
        "id3": "001",
        "reason": "missing-source"
      }
    ]
  }
}
```

Do not silently `continue` without adding a coverage record.

## Required `enemy.zip` bundle.json coverage metadata

The `bundle.json` inside `public/assets/bundles/icon/enemy.zip` must include:

```json
{
  "bundleKey": "icon:enemy",
  "kind": "icon",
  "iconKind": "enemy",
  "idRange": {
    "expectedMinEnemyId": 0,
    "expectedMaxEnemyId": 0,
    "minIncludedId": 0,
    "maxIncludedId": 0
  },
  "coverage": {
    "included": 0,
    "missingSource": 0,
    "invalidSource": 0,
    "intentionallyExcluded": 0,
    "missingLeadingIds": [],
    "gapRanges": []
  }
}
```

If `minIncludedId` is greater than `expectedMinEnemyId`, the build must fail unless the leading missing ids are explicitly documented in the coverage metadata.

## Required new check

Add:

```text
scripts/check-enemy-zip-complete-from-start.mjs
```

This is the key check for the current bug.

It must fail if:

```text
enemy.zip does not exist
enemy.zip contains no enemy/*.png entries
the smallest enemy id in enemy.zip is greater than the smallest expected enemy actor id
bcu-icon-index has leading enemy ids silently absent with no coverage diagnostics
any expected included enemy id is missing from enemy.zip
any enemy.zip internal path is not referenced by bcu-icon-index.json
any enemy.zip PNG fails validation
gap ranges are not documented
bundle.json coverage disagrees with actual ZIP entries
bcu-bundle-manifest icon:enemy iconCount disagrees with actual ZIP PNG count
```

Example failure:

```json
{
  "expectedMinEnemyId": 0,
  "actualMinEnemyZipId": 526,
  "missingLeadingIds": [0, 1, 2, 3],
  "gapRanges": [
    {
      "start": 0,
      "end": 525,
      "reason": "not-indexed"
    }
  ],
  "reason": "enemy.zip starts from middle of enemy id range"
}
```

## Required browser verification for incomplete-range bug

Before Apply, after Formation is visible:

```js
const imgs = [...document.querySelectorAll('img[data-semantic-icon^="enemy:"]')];
imgs.slice(0, 40).map(img => ({
  key: img.dataset.semanticIcon,
  src: img.currentSrc || img.src,
  naturalWidth: img.naturalWidth,
  naturalHeight: img.naturalHeight,
  pending: img.dataset.iconPending,
  resolved: img.dataset.iconResolved
}));

performance.getEntriesByType('resource')
  .filter(e => e.name.includes('/bundles/icon/enemy.zip'))
  .map(e => e.name);
```

Expected:

```text
early enemy ids have blob: URLs when included
missing early enemy ids have explicit missing-source diagnostics
enemy.zip is requested when enemy icons are displayed
enemy.zip does not start from a later id range without documented coverage
```

## Required documentation update

`docs/bcu-migration-status.md` must record:

```text
expected enemy id min/max
enemy.zip actual included min/max before fix
enemy.zip actual included min/max after fix
missing leading ids before fix
remaining missing-source ids after fix
gap ranges after fix
sourceKind counts: enemy_icon / edi / legacy / missing
enemy.zip PNG count
enemy.zip size/hash
check-enemy-zip-complete-from-start result
browser DOM verification result
```

---

# P0-J. DOM correctness for Formation and Apply Battle UI

This section is mandatory. It covers the DOM/observer issues discussed by the user.

## Problem

After the ZIP migration, UI icons and Battle interaction depend on more DOM state than before.

Known dangerous patterns:

```text
selected Formation slot icons are outside the catalog scroll container
catalog IntersectionObserver root is .formation-catalog-scroll
selected slot imgs may never intersect that root
img.dataset.iconResolved may be set before the image actually loads
failed icon promises may be cached forever
virtualized catalog may leave stale DOM nodes / stale data-semantic-icon values
overlays may keep intercepting pointer/wheel events after Apply
battleScene may be unset after failed init, so camera input has no target
```

These are separate from image-file corruption and must be fixed separately.

## Formation selected slot DOM rule

Selected 10 Formation slots must not depend on the catalog observer.

Required split:

```js
resolveSemanticIcons() {
  resolveSelectedSlotIconsImmediately();
  observeCatalogIconsOnly();
}
```

Selected slot query should be scoped to selected slots:

```js
this.root.querySelectorAll('.formation-slots img[data-semantic-icon]')
```

Catalog query should be scoped to catalog grid/list only:

```js
this.root.querySelectorAll('.formation-catalog-grid img[data-semantic-icon], .formation-catalog-list img[data-semantic-icon]')
```

Do not observe selected slot icons with:

```js
root: this.catalogScroll
```

Use immediate load or an observer with:

```js
root: null
```

for selected slots.

## Image load state rule

Do not mark an icon as resolved until the actual browser image load succeeds.

Forbidden:

```js
img.dataset.iconResolved = "1";
// before img.onload
```

Required behavior:

```text
set iconPending before async provider call
set img.src = blobUrl
wait for img.decode() or onload/onerror
only then set iconResolved
on failure: clear iconPending/iconResolved and allow retry
```

If `HTMLImageElement.decode()` is unavailable, use `onload/onerror`.

## Failed promise cache rule

Do not permanently cache failed icon loads.

If a key fails:

```text
delete the per-key in-flight work cache
do not cache the rejected promise
do not set iconResolved
record diagnostic
show non-BCU placeholder
allow retry on rerender or user action
```

## Virtualized DOM rule

If catalog virtualization is implemented:

```text
a reused DOM card must update all dataset fields
a reused img must reset src/dataset/iconPending/iconResolved when semanticKey changes
old object URLs must not be assigned to new cards
old click handlers must not point to stale characterId
selected state must be recomputed from current semanticKey/baseCharacterId
```

Add a check or test that scrolls the catalog and verifies that visible cards' labels, semantic keys, and icons remain aligned.

## Overlay/input DOM rule

After successful Apply Battle:

```text
formation overlay hidden
loading overlay hidden
production bar visible but not blocking canvas wheel/pan unexpectedly
canvas receives wheel/pointer events
BattleCameraInputController.getCamera() returns scene.camera
```

After failed Apply Battle:

```text
formation overlay visible
sceneReady false
battleScene either previous valid scene or null, but report explains failure
loading overlay shows detailed error
```

Do not set:

```js
sceneReady = true
```

unless `BattleScene.init()` completed and `battleScene.camera` exists.

## Required DOM/browser checks

Add or update:

```text
scripts/check-formation-dom-icon-loading.mjs
scripts/check-apply-battle-dom-state.mjs
```

The checks must cover:

```text
selected slot icons call getActorUiIconUrl immediately
catalog icons are lazy/virtualized
selected slot icons do not use catalog observer root
img resolved marker is set only after load/decode success
failed icon promise is retryable
no actor bundle loads before Apply from Formation UI
no raw BCU img src appears in DOM
after Apply success, canvas can receive wheel/pointer events
after Apply success, battleScene.camera exists
```

Browser console acceptance:

```js
[...document.querySelectorAll('.formation-slots img[data-semantic-icon]')]
  .map(img => ({
    key: img.dataset.semanticIcon,
    src: img.currentSrc || img.src,
    pending: img.dataset.iconPending,
    resolved: img.dataset.iconResolved
  }));

[...document.querySelectorAll('img')]
  .filter(img => (img.currentSrc || img.src).includes('/public/assets/bcu/'));

performance.getEntriesByType('resource')
  .filter(e => e.name.includes('/bundles/actor/'));
```

Expected before Apply:

```text
selected slot icons have blob: or non-BCU placeholder src
no /public/assets/bcu/ image src
actor bundle resources = []
```

Expected after Apply success:

```text
battleScene.camera exists
wheel/pointer input reaches BattleCameraInputController
loading overlay is not intercepting canvas input
```

---

# P0-J2. Fix Formation catalog grid row/column DOM layout regression

This section is mandatory. It covers the screenshot-visible bug where catalog cards do not load/render in a stable row/column grid and appear misaligned/overlapping.

## Problem

The Formation catalog must be a stable grid. Current broken symptoms include:

```text
cards appear in the wrong row
cards overlap the search/filter input area
cards appear shifted horizontally/vertically
virtualized cards are appended without a correct row wrapper/spacer
DOM order does not match visual order
only part of a row is mounted while other cells are misplaced
scrolling causes cards to jump or reuse stale positions
```

This is not an enemy.zip issue. It is a Formation DOM layout/virtualization issue.

## Required layout invariant

`FormationEditor` catalog rendering must satisfy:

```text
DOM order = visual order
visual rows are computed from the filtered character list
each row contains at most columnCount cards
columnCount is derived from catalog viewport width, card min width, and gap
rowHeight is measured or deterministic
virtualization window is row-based, not arbitrary card-based
top spacer height = firstRenderedRow * rowHeight
bottom spacer height = (totalRows - lastRenderedRow - 1) * rowHeight
rendered cards never overlap filter/search controls
selected slot area is outside the catalog virtual scroller
```

Do not virtualize by blindly slicing individual cards without preserving row/column placement.

## Required DOM structure

Use a structure equivalent to:

```html
<div class="formation-catalog-scroll">
  <div class="formation-catalog-spacer-top"></div>
  <div class="formation-catalog-window">
    <div class="formation-catalog-row" data-row="0">
      <button class="formation-card" data-character-id="..."></button>
      ...
    </div>
  </div>
  <div class="formation-catalog-spacer-bottom"></div>
</div>
```

or use CSS grid with a virtualized wrapper that still preserves row math.

Forbidden final states:

```text
catalog cards absolutely positioned with stale top/left values
catalog cards inserted into the wrong parent
catalog cards rendered above/over the filter/search input
catalog cards rendered in a single row when multiple rows are expected
catalog cards rendered without deterministic row index
```

## Column calculation

Add a single function, for example:

```js
computeCatalogGridMetrics() {
  return {
    viewportWidth,
    cardMinWidth,
    gap,
    columnCount,
    rowHeight,
    totalRows
  };
}
```

Rules:

```text
columnCount >= 1
columnCount updates on ResizeObserver
rowHeight includes card height + vertical gap
totalRows = Math.ceil(filteredCharacters.length / columnCount)
visible row range is computed from scrollTop and viewport height
overscanRows is small and fixed
```

When `columnCount` changes, rerender the visible window and clear stale DOM state.

## Required checks

Add or update:

```text
scripts/check-formation-catalog-grid-layout.mjs
```

It must verify by static/dynamic test where possible:

```text
FormationEditor has row-based virtualization or stable CSS grid virtualization
catalog cards are mounted under the catalog scroll/window container
selected slots are not inside catalog virtual row container
row/column metrics are recalculated on resize
DOM node reuse resets semanticKey/src/selected/card data
```

## Browser verification

Before Apply, run:

```js
const cards = [...document.querySelectorAll('.formation-card,[data-character-id]')];
const rects = cards.slice(0, 30).map(el => {
  const r = el.getBoundingClientRect();
  return {
    id: el.dataset.characterId,
    top: Math.round(r.top),
    left: Math.round(r.left),
    width: Math.round(r.width),
    height: Math.round(r.height)
  };
});
console.table(rects);
```

Expected:

```text
cards in the same row have the same top
cards in later rows have strictly larger top
cards do not overlap the filter/search controls
left positions repeat consistently per row
no card has zero width/height
```

---

# P0-H2. Fix Formation character swap / slot replacement performance

This section is mandatory. It covers the user-reported bug where swapping/replacing characters becomes extremely heavy.

## Problem

Selecting, replacing, or swapping a Formation character must not rebuild the entire catalog, recreate all cards, re-run icon loading for all visible/offscreen cards, or reparse/reopen icon ZIPs.

Broken symptoms include:

```text
clicking a character freezes the UI
replacing one selected slot rerenders the full catalog
all icon images reload after each slot change
IntersectionObservers/queues are recreated repeatedly
selected slot update triggers full CharacterCatalog rebuild
event listeners multiply after each render
object URLs are recreated for icons that are already cached
```

## Required performance invariant

A slot replacement must update only:

```text
the affected selected slot
previous/new selected state on visible catalog cards
production/formation derived state that actually changed
hint/status text
```

It must not:

```text
rebuild the full CharacterCatalog
recreate all catalog DOM nodes
reload all icon blob URLs
open actor bundles
open enemy.zip/unit icon zips again if URLs are already cached
create a new IntersectionObserver per render without disconnecting old one
attach duplicate click handlers per card
```

## Required architecture

Implement or verify these boundaries:

```text
CharacterCatalog is memoized by bcuDb identity + locale + revision/version.
filteredCharacters is memoized by filter/search/faction.
visibleRows are recalculated from scroll/resize only.
selected slots render independently from catalog window.
catalog visible card selected state is patched by semanticKey/baseCharacterId.
icon URL cache is keyed by semanticKey and stores only successful blob URLs.
in-flight icon work is deduplicated by semanticKey.
failed icon loads are not permanently cached.
event delegation is used for catalog clicks.
```

## Required slot replacement flow

A character swap/replacement should be equivalent to:

```js
applySlotChange(slotIndex, nextCharacterKey) {
  updateFormationStateOnly();
  renderSelectedSlotsOnly(slotIndex);
  patchVisibleCatalogSelectionState(previousKey, nextCharacterKey);
  updateApplyButtonState();
}
```

It must not call a full `renderDynamic()` / full catalog rebuild unless the filter/search/catalog dataset changed.

If the existing code uses `renderDynamic()` for all updates, split it into:

```text
renderStaticShell()
renderSelectedSlots()
renderFilterControls()
renderCatalogWindow()
patchCatalogSelectionState()
scheduleVisibleIconResolution()
```

## Required performance instrumentation

Add marks/measures around swap:

```js
performance.mark('formation-swap-start');
// slot replacement work
performance.mark('formation-swap-end');
performance.measure('formation-swap', 'formation-swap-start', 'formation-swap-end');
```

Log in debug mode:

```text
changedSlotIndex
previousCharacterKey
nextCharacterKey
catalogDomNodesBefore/After
iconRequestsStarted
actorBundleRequestsStarted
enemyZipRequestsStarted
renderedRowCount
durationMs
```

Acceptance target:

```text
single slot replacement should not trigger actor bundle requests
single slot replacement should not trigger full catalog DOM recreation
single slot replacement should complete without visible freeze
```

## Required checks

Add or update:

```text
scripts/check-formation-swap-performance.mjs
```

It must verify:

```text
slot replacement path does not call full catalog rebuild
catalog click uses event delegation or does not duplicate listeners
icon loading is cached/deduped
actor bundle resources are not requested before Apply
selected slot render can run independently
```

## Browser verification

Before Apply:

```js
performance.clearMeasures('formation-swap');
// perform one slot replacement in the UI, then:
performance.getEntriesByName('formation-swap').slice(-5).map(m => Math.round(m.duration));

performance.getEntriesByType('resource')
  .filter(e => e.name.includes('/bundles/actor/'))
  .map(e => e.name);

document.querySelectorAll('.formation-card,[data-character-id]').length;
```

Expected:

```text
formation-swap duration is small and stable
actor bundle resources remain []
catalog DOM node count does not explode
no full icon reload happens
```

---

# P0-K. Update final verification command list for enemy.zip and DOM

The full verification command list must include the enemy.zip and DOM checks:

```bash
node scripts/audit-bcu-icon-sources.mjs
node scripts/build-bcu-icon-index.mjs
node scripts/build-bcu-icon-bundles.mjs
node scripts/check-icon-png-integrity.mjs
node scripts/check-icon-index-paths-exist-in-zips.mjs
node scripts/check-enemy-icon-source-policy.mjs
node scripts/check-enemy-zip-complete-from-start.mjs
node scripts/check-icon-bundles-are-aggregated.mjs
node scripts/check-icon-bundles-never-load-actor-bundles.mjs
node scripts/check-formation-icons-use-icon-bundles.mjs
node scripts/check-production-icons-use-icon-bundles.mjs
node scripts/check-formation-dom-icon-loading.mjs
node scripts/check-apply-battle-dom-state.mjs
node scripts/check-formation-swap-performance.mjs
node scripts/check-formation-catalog-grid-layout.mjs
```

Do not claim completion unless these pass or a precise blocker is documented with:

```text
file
function
semanticKey
bundlePath
internalPath
DOM selector
reason
next required action
```
