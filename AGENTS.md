# AGENTS.md — BCU Runtime Zip-First Migration Contract

Repository: `rhgrive2/game`

This file is the authoritative implementation contract for converting the current BCU runtime from raw-path loading to zip-bundle loading.

The current repository already has partial semantic bundle infrastructure, but it is not enough. The goal of this contract is stricter:

> Runtime-loadable BCU data must be loaded from generated zip bundles, not from `public/assets/bcu/...`.

Raw BCU files may remain as build inputs and diagnostics, but production/browser runtime must not fetch them.

---

## 0. Current confirmed problems

The current codebase still has multiple raw runtime paths. Fix all of them.

### 0.1 Boot metadata still reads raw manifest / CSV / TXT

`BcuBootLoader.loadGame()` currently loads `public/assets/bcu-manifest.json`, initializes `SemanticAssetProvider`, and then still builds `BcuLangStore`, `BcuEnemyRepository`, `BcuUnitRepository`, `BcuBackgroundRepository`, `BcuCastleRepository`, and `BcuStageRepository` through `readText`.

This means web boot still reads raw metadata.

Required fix: boot must use generated zip-backed runtime DB, especially `public/assets/bundles/core/core-db.zip` and `public/assets/bundles/lang/jp.zip`.

### 0.2 `BcuManifestLoader.readText()` is a raw fetch gateway

`BcuManifestLoader.readText(path)` calls `fetch(toFetchPath(path))` in browser.

Required fix: production runtime must not use this for `public/assets/bcu/...` or `public/assets/bcu-manifest.json`.

### 0.3 Unit and enemy repositories still read raw CSV

`BcuUnitRepository.build()` still reads unit stats CSV such as:

```text
public/assets/bcu/000004/org/unit/<id3>/unit<id3>.csv
```

`BcuEnemyRepository.build()` still reads:

```text
public/assets/bcu/000001/org/data/t_unit.csv
```

Required fix: these repositories must be constructed from core bundle JSON, not raw CSV, in production runtime.

### 0.4 Stage CSV still can fall back to raw path

`BattleScene` currently stores only `selectedStageId` and `stageCsvPath` from selected stage metadata, dropping `stageKey` and `bundleRef`.

`StageDefinitionLoader` can read semantic stage bundle, but still falls back to `stageConfig.stageCsvPath`.

Required fix: stage runtime must preserve `stageKey` and `bundleRef`, and must not fetch raw `stageCsvPath` for any bundled stage.

### 0.5 Formation icons bypass bundles

`FormationEditor.renderIconMarkup()` renders:

```html
<img src="c.uiIcon.primary">
```

`PlayableCharacterRegistry` still sets `uiIcon.primary`, `fallback`, and `runtimeImage` to raw paths under:

```text
./public/assets/bcu/000002/org/enemy/...
./public/assets/bcu/000004/org/unit/...
```

Required fix: Formation icons must resolve through `SemanticAssetProvider` and actor bundles, not raw image paths.

### 0.6 Background and castle loaders still have raw fallback paths

`StageBackgroundLoader` and `BcuCastleAssetLoader` try semantic bundles but still fall back to raw image/imgcut candidates.

Required fix: if a background or castle has a bundle entry, raw fallback is forbidden.

### 0.7 `BcuPathResolver` still constructs raw paths

`BcuPathResolver` returns raw `baseDir`, `imagePath`, `imgcutPath`, `modelPath`, `animationPaths`, background candidates, and castle image candidates.

Required fix: these raw paths may exist only in generated diagnostics or `rawOnly` records. Runtime loaders must not use them for bundled assets.

### 0.8 Existing checks are insufficient

`check-no-raw-runtime-paths.mjs` has broad allowlists that include runtime files such as:

```text
BcuStageEnemyResolver.js
PlayableCharacterRegistry.js
StageBackgroundLoader.js
BcuEnemyRepository.js
BcuUnitRepository.js
previewAssets.js
```

Required fix: remove broad allowlists and add dynamic tests that fail if runtime fetches or image-loads `public/assets/bcu/...`.

---

## 1. Target architecture

Runtime must have two asset layers and one bootstrap layer.

### 1.1 Raw source layer

Path:

```text
public/assets/bcu/
```

Purpose:

- build input only
- audit input only
- generated diagnostics only
- explicit `rawOnly` development diagnostics only

Production/browser runtime must not fetch from this tree.

### 1.2 Runtime bundle layer

Path:

```text
public/assets/bundles/
```

Runtime-loadable BCU data must come from these zip bundles:

```text
public/assets/bundles/core/core-db.zip
public/assets/bundles/lang/jp.zip              # optional only if Japanese language data is not embedded in core-db.zip
public/assets/bundles/actor/enemy/<id3>.zip
public/assets/bundles/actor/unit/<id3>-<form>.zip
public/assets/bundles/stage/map/<safe-stage-group>.zip
public/assets/bundles/background/<bgId>.zip
public/assets/bundles/castle/enemy/<group><id3>.zip
public/assets/bundles/castle/nyanko/<safe-id>.zip
public/assets/bundles/ui/<safe-key>.zip
public/assets/bundles/effect/<safe-key>.zip
```

### 1.3 Bootstrap index layer

These generated JSON files may be fetched at runtime because they are not raw BCU assets:

```text
public/assets/generated/bcu-runtime-bootstrap.json
public/assets/generated/bcu-bundle-manifest.json
public/assets/generated/bcu-canonical-index.json
public/assets/generated/bcu-actor-index.json
public/assets/generated/bcu-stage-index.json
public/assets/generated/bcu-background-index.json
public/assets/generated/bcu-castle-index.json
public/assets/generated/bcu-core-index.json
public/assets/generated/bcu-language-index.json
```

If possible, prefer a compact single bootstrap file:

```text
public/assets/generated/bcu-runtime-bootstrap.json
```

containing only what runtime needs to locate bundles.

Do not use `public/assets/bcu-manifest.json` as production runtime bootstrap.

---

## 2. Strict runtime rule

### 2.1 Forbidden runtime URLs

Production browser runtime must not fetch, image-load, or otherwise request:

```text
public/assets/bcu/
./public/assets/bcu/
public/assets/bcu-manifest.json
./public/assets/bcu-manifest.json
```

This applies to:

```text
fetch()
Image.src
HTMLImageElement.src
CSS url()
audio/image/video tags
createImageBitmap(fetch(raw))
any custom loader
```

### 2.2 Allowed runtime URLs

Production runtime may fetch:

```text
public/assets/generated/*.json
public/assets/bundles/**/*.zip
application JS/CSS/HTML files
non-BCU UI assets
```

### 2.3 Raw-only diagnostics mode

A development-only mode may exist:

```text
raw-only-diagnostics
```

but it must not be default. It must require an explicit query parameter or developer option.

Default mode must be:

```text
semantic-strict
```

In `semantic-strict`, raw BCU runtime access must throw.

---

## 3. Core DB bundle contract

### 3.1 Purpose

`core/core-db.zip` is the runtime database bundle.

It replaces runtime reads of raw metadata CSV/TXT/JSON.

### 3.2 Required zip contents

`public/assets/bundles/core/core-db.zip` must contain parsed JSON, not only raw CSV files.

Required entries:

```text
bundle.json
manifest-lite.json
units.json
enemies.json
names-jp.json
backgrounds.json
castles.json
stages.json
stage-aliases.json
asset-keys.json
diagnostics-summary.json
```

Optional entries:

```text
raw-source-map.json
```

Raw CSV files may be included under `raw/` for diagnostics, but runtime code must not parse them when parsed JSON exists.

### 3.3 `units.json`

Must contain one normalized record per unit form.

Example shape:

```json
{
  "schemaVersion": 1,
  "forms": {
    "unit:259:f": {
      "unitId": 259,
      "id3": "259",
      "form": "f",
      "formIndex": 0,
      "name": {
        "value": "日本語名",
        "locale": "jp",
        "source": "lang:jp"
      },
      "stats": {},
      "rawStats": [],
      "asset": {
        "semanticKey": "unit:259:f",
        "bundleRef": {
          "bundleKey": "actor:unit:259:f",
          "bundlePath": "public/assets/bundles/actor/unit/259-f.zip"
        }
      }
    }
  }
}
```

### 3.4 `enemies.json`

Must contain one normalized record per enemy.

Example shape:

```json
{
  "schemaVersion": 1,
  "enemies": {
    "enemy:186": {
      "enemyId": 186,
      "id3": "186",
      "name": {
        "value": "日本語名",
        "locale": "jp",
        "source": "lang:jp"
      },
      "stats": {},
      "rawStats": [],
      "asset": {
        "semanticKey": "enemy:186",
        "bundleRef": {
          "bundleKey": "actor:enemy:186",
          "bundlePath": "public/assets/bundles/actor/enemy/186.zip"
        }
      }
    }
  }
}
```

### 3.5 `names-jp` policy

`core/core-db.zip` must contain:

```text
names-jp.json
```

Production boot should be able to build the full Japanese runtime DB from `core/core-db.zip` alone.

`lang/jp.zip` may also be generated for compatibility or diagnostics, but it must not be required for the normal boot path unless the implementation explicitly documents why a separate language bundle is needed.

Runtime must load only Japanese. No runtime locale other than `jp` is allowed.

### 3.6 Core DB generator

Add or update:

```text
scripts/build-bcu-core-index.mjs
scripts/build-bcu-core-db-bundle.mjs
```

The generator must:

1. read raw CSV/TXT/JSON from `public/assets/bcu/`,
2. parse them at build time,
3. emit normalized JSON,
4. write `core/core-db.zip`,
5. write `bcu-core-index.json`,
6. include source provenance in diagnostics,
7. exclude non-Japanese language files.

Do not make browser runtime parse raw CSV for normal boot.

---

## 4. SemanticAssetProvider contract

Update:

```text
js/bcu/SemanticAssetProvider.js
```

### 4.1 Required APIs

Provider must expose:

```js
await provider.load();
await provider.readCoreDb();
await provider.readCoreJson(internalPath);
await provider.readLanguageJson(locale, internalPath);

await provider.getActorBundle(actorKey);
await provider.getActorIconUrl(actorKey);
await provider.getActorImageUrl(actorKey);
await provider.readActorText(actorKey, internalPath);

await provider.readStageCsv(stageKey);
await provider.readBackgroundBundle(backgroundKey);
await provider.readCastleBundle(castleKey);

provider.hasBundleForKey(key);
provider.assertNoRawForBundledKey(key, rawPath);
provider.assertNoRawBcuUrl(url, context);
provider.clearObjectUrls();
```

### 4.2 Caching

Provider must cache:

```text
bundle fetch promises
parsed zip archives
parsed JSON entries from core-db.zip
object URLs
actor icon URLs
actor image URLs
```

Avoid reparsing zip entries repeatedly.

### 4.3 ZIP format

Current code supports STORE-only zip. Keep STORE-only unless adding a tested DEFLATE reader.

If STORE-only remains, generator must write STORE-only zips.

Unsupported compression method must throw with a clear error.

---

## 5. Boot loader contract

Update:

```text
js/bcu/BcuBootLoader.js
js/bcu/BcuManifestLoader.js
```

### 5.1 Production boot flow

Production/default boot must be:

```text
BcuBootLoader.loadGame()
  -> SemanticAssetProvider.load()
  -> provider.readCoreDb()
  -> construct BcuAssetDatabase from parsed core JSON
  -> no runtime fetch from public/assets/bcu/
  -> no runtime fetch from public/assets/bcu-manifest.json
```

### 5.2 Do not use raw manifest in production

`BcuManifestLoader.load({ manifestPath: './public/assets/bcu-manifest.json' })` is allowed only for:

```text
scripts/
tests explicitly marked raw-only-diagnostics
local diagnostics
```

`BcuBootLoader.loadGame()` must not call it in `semantic-strict`.

### 5.3 Repository construction

Add `fromCoreDb` or equivalent methods:

```js
BcuLangStore.fromCoreDb(coreDb)
BcuUnitRepository.fromCoreDb(coreDb, names)
BcuEnemyRepository.fromCoreDb(coreDb, names)
BcuBackgroundRepository.fromCoreDb(coreDb, names)
BcuCastleRepository.fromCoreDb(coreDb, names)
BcuStageRepository.fromCoreDb(coreDb, names)
```

In `semantic-strict`, these must not call `readText` for raw CSV/TXT.

The objects returned by `fromCoreDb` must preserve the existing runtime interfaces expected by `BcuAssetDatabase` and battle code:

```text
names.loadedLocales
names.resolve()
units.get()
units.getForm()
units.getFormStats()
units.list()
enemies.get()
enemies.getStats()
enemies.fromStageRawId()
enemies.list()
backgrounds.get()
backgrounds.list()
castles.enemy.get()
castles.enemy.list()
stages.get()
stages.list()
assets.resolveUnitAsset()
assets.resolveEnemyAsset()
assets.resolveBackgroundAsset()
assets.resolveEnemyCastleAsset()
```

`manifest-lite.json` must contain any fields still consumed by `BcuAssetDatabase.getSummary()` or the UI, such as pack/file counts, semantic mode, playable exclusions, and generated index references. Do not keep the full raw `bcu-manifest.json` as a production boot dependency just to satisfy these fields.


---

## 6. Language runtime contract

### 6.1 Supported locale

Only:

```text
jp
```

### 6.2 Required behavior

`BcuLangStore` must not fetch language TXT files at runtime.

It must be built from:

```text
core-db.zip:names-jp.json
```

`lang/jp.zip` is allowed only as an optional implementation detail. If it exists, it may contain Japanese-only data, but production boot must still avoid non-Japanese language files.

### 6.3 Forbidden behavior

No runtime fallback to:

```text
en
ko
tw
fr
it
de
es
th
zh
```

No runtime request for non-Japanese language TXT.

---

## 7. Actor bundle runtime contract

### 7.1 Actor bundles

Actor bundles must be used for model runtime and UI icons.

Required actor bundle entries for a full runtime actor:

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

Optional actor bundle entry:

```text
icon.png
```

If `icon.png` is absent, UI may use `image.png` or a local non-BCU placeholder. It must not use raw BCU icon paths.

### 7.2 BcuAssetLoader

Update:

```text
js/bcu/BcuAssetLoader.js
```

Rules:

```text
semanticKey + bundle exists -> bundle only
semanticKey + bundle missing -> error unless rawOnly
bundle read failure -> error
raw baseDir under public/assets/bcu -> throw in semantic-strict
```

Do not use `provider.allowRawFallback` for bundled keys.

### 7.3 Stage enemy asset defs

Update:

```text
js/battle/BcuStageEnemyResolver.js
```

`buildBcuEnemyAssetDef(enemyId)` must return semantic actor asset definitions when bundles exist.

It must not return raw `baseDir` for bundled enemies.

### 7.4 Playable character asset defs

Update:

```text
js/battle/PlayableCharacterRegistry.js
```

Remove raw fields from runtime `assetDef` and `uiIcon` for bundled actors.

Required output:

```js
assetDef: {
  id: 'enemy-000',
  kind: 'enemy',
  semanticKey: 'enemy:0',
  bundleRef: {...},
  renderMode: 'animated-unit'
}

uiIcon: {
  kind: 'enemy',
  semanticKey: 'enemy:0',
  preferredInternalPaths: ['icon.png', 'image.png']
}
```

For units:

```js
assetDef: {
  semanticKey: 'unit:259:f'
}

uiIcon: {
  semanticKey: 'unit:259:f',
  preferredInternalPaths: ['icon.png', 'image.png']
}
```

No `uiIcon.primary`, `uiIcon.fallback`, or `uiIcon.runtimeImage` may point to `public/assets/bcu/...` in production runtime.

---

## 8. Formation UI icon contract

Update:

```text
js/ui/FormationEditor.js
```

### 8.1 Do not render raw src

Do not render:

```html
<img src="${c.uiIcon.primary}">
```

when `uiIcon` is semantic.

### 8.2 Required behavior

Render placeholders first:

```html
<img data-semantic-icon="enemy:0">
```

Then asynchronously resolve icons:

```js
const url = await db.semanticProvider.getActorIconUrl(actorKey);
img.src = url;
```

### 8.3 Raw prohibition

If the actor has a bundle, Formation UI must not load:

```text
edi_*.png
enemy_icon_*.png
uni*.png
public/assets/bcu/**/*.png
```

Fallback must be:

1. `icon.png` in actor bundle,
2. `image.png` in actor bundle,
3. non-BCU local placeholder.

---

## 9. Stage bundle runtime contract

Update:

```text
js/battle/StageRegistry.js
js/battle/BattleScene.js
js/battle/StageDefinitionLoader.js
```

### 9.1 Stage selection

`StageRegistry` must return semantic entries containing:

```text
stageKey
bundleRef
semanticEntry
legacyStageCsvPath as diagnostics only
```

### 9.2 BattleScene must preserve semantic fields

`BattleScene` constructor must store:

```js
this.stage = {
  ...,
  selectedStageId: selectedStage.stageId,
  stageKey: selectedStage.stageKey,
  semanticKey: selectedStage.stageKey,
  bundleRef: selectedStage.bundleRef,
  legacyStageCsvPath: selectedStage.legacyStageCsvPath || null
}
```

Do not store raw `stageCsvPath` as primary source.

### 9.3 StageDefinitionLoader

`StageDefinitionLoader.load(stageConfig)` must use:

```text
stageKey -> provider.readStageCsv(stageKey)
```

If `stageKey` or `bundleRef` has a bundle, raw `stageCsvPath` fetch is forbidden.

Raw `stageCsvPath` may be used only for explicit `rawOnly` diagnostics stages.

---

## 10. Background bundle runtime contract

Update:

```text
js/battle/StageBackgroundLoader.js
```

If `background:<bgId>` has a bundle, load only:

```text
metadata.json
image.png
imgcut.imgcut
```

from the bundle.

Do not raw fallback to:

```text
org/img/bg/*.png
org/battle/bg/*.imgcut
org/battle/bg.csv
```

for bundled backgrounds.

If bundle is incomplete, fail with diagnostics or use a non-BCU placeholder. Do not fetch raw BCU assets.

---

## 11. Castle bundle runtime contract

Update:

```text
js/battle/BcuCastleAssetLoader.js
```

If `enemyCastle:<id>` or `enemyCastle:<group><id3>` has a bundle, load only from castle bundle.

Do not raw fallback to:

```text
org/img/rc/*.png
org/img/ec/*.png
org/img/wc/*.png
org/img/sc/*.png
org/castle/**/*
```

for bundled castles.

If bundle is incomplete, fail with diagnostics or use a non-BCU placeholder.

---

## 12. Preview and legacy asset contract

Update:

```text
js/data/previewAssets.js
js/preview/PreviewApp.js
```

Preview assets must not use raw BCU paths in production battle mode.

Allowed options:

1. convert preview assets to semantic keys,
2. disable legacy preview asset loading in production,
3. keep raw preview only behind `raw-only-diagnostics`.

The production Apply Battle path must not depend on `PREVIEW_ASSETS` raw BCU paths.

---

## 13. Runtime raw-access guard

Add:

```text
js/bcu/RuntimeAssetGuard.js
```

### 13.1 Required APIs

```js
export function isRawBcuUrl(url);
export function assertRuntimeUrlAllowed(url, context);
export function installRuntimeRawBcuGuard({ mode, provider });
```

### 13.2 Guard behavior

In `semantic-strict`, any runtime request to `public/assets/bcu/...` must throw or be blocked.

Guard all practical raw URL entry points:

```text
fetch()
Image.src
HTMLImageElement.prototype.src
Element.setAttribute('src', ...)
innerHTML-created image elements
CSS url() where applicable
```

Where possible, install a development/runtime guard that wraps:

```js
globalThis.fetch
HTMLImageElement.prototype.src
Element.prototype.setAttribute
```

Also add a MutationObserver safety net that detects newly inserted `<img src="...">` elements pointing to `public/assets/bcu/...`.

This guard is not a replacement for code fixes. It is a safety net. Static code must still avoid constructing raw BCU URLs in production paths.

### 13.3 Diagnostics

Blocked attempts must be recorded in:

```js
db.semanticProvider.diagnostics.blockedRawReads
```

---

## 14. Build scripts

Add or update:

```text
scripts/prune-bcu-language-assets.mjs
scripts/build-bcu-manifest.mjs
scripts/build-bcu-canonical-index.mjs
scripts/build-bcu-actor-index.mjs
scripts/build-bcu-stage-index.mjs
scripts/build-bcu-background-index.mjs
scripts/build-bcu-castle-index.mjs
scripts/build-bcu-core-index.mjs
scripts/build-bcu-language-index.mjs
scripts/build-bcu-core-db-bundle.mjs
scripts/build-bcu-semantic-bundles.mjs
```

### 14.1 Bundle generator requirements

`build-bcu-core-db-bundle.mjs` is the canonical owner of `public/assets/bundles/core/core-db.zip`.

`build-bcu-semantic-bundles.mjs --all` may invoke/reuse `build-bcu-core-db-bundle.mjs`, but it must not overwrite `core-db.zip` with a different raw-CSV-only format.

`build-bcu-semantic-bundles.mjs --all` must generate or ensure the existence of:

```text
actor bundles
stage bundles
background bundles
castle bundles
core-db.zip with parsed JSON
lang/jp.zip if separate Japanese language bundle is used
ui/effect bundles if runtime uses them
```

### 14.2 Full generation required

Sample mode may exist only for local diagnostics.

Completion requires:

```bash
node scripts/build-bcu-semantic-bundles.mjs --all
```

and:

```json
{
  "generationMode": "all"
}
```

in `bcu-bundle-manifest.json`.

---

## 15. Required checks

Add or update these checks.

```text
scripts/check-runtime-uses-zip-bundles.mjs
scripts/check-bundled-assets-never-load-raw.mjs
scripts/check-no-raw-runtime-paths.mjs
scripts/check-no-non-jp-lang-assets.mjs
scripts/check-core-db-runtime.mjs
scripts/check-formation-icons-use-bundles.mjs
scripts/check-stage-runtime-uses-bundles.mjs
scripts/check-background-castle-use-bundles.mjs
```

### 15.1 Static checks must fail on raw runtime paths

Fail if any runtime file contains production raw BCU paths.

No broad allowlist.

Allowed only in:

```text
scripts/
docs/
AGENTS.md
generated diagnostics sourceRawPath
raw-only-diagnostics branches with explicit guard
```

### 15.2 Dynamic checks

Implement Node/browser-like dynamic tests with mocked `fetch` and mocked `Image`.

The tests must fail if Apply Battle boot or initialization requests:

```text
public/assets/bcu/
public/assets/bcu-manifest.json
```

Required scenarios:

```text
BcuBootLoader.loadGame semantic-strict
FormationEditor render icons
BattleScene init
StageDefinitionLoader load selected stage
StageBackgroundLoader load stage background
BcuCastleAssetLoader load enemy castle
BcuAssetLoader load enemy actor
BcuAssetLoader load unit actor
```

### 15.3 Expected dynamic behavior

Allowed requests:

```text
public/assets/generated/*.json
public/assets/bundles/**/*.zip
```

Forbidden requests:

```text
public/assets/bcu/**
public/assets/bcu-manifest.json
```

### 15.4 Core DB check

`check-core-db-runtime.mjs` must verify:

```text
BcuBootLoader semantic-strict reads core-db.zip
core-db.zip contains parsed units.json, enemies.json, names-jp.json, backgrounds.json, castles.json, and stages.json
BcuBootLoader semantic-strict does not read bcu-manifest.json
BcuEnemyRepository semantic-strict does not read t_unit.csv
BcuUnitRepository semantic-strict does not read unit<id>.csv
BcuLangStore semantic-strict does not read raw txt
```

### 15.5 Formation icon check

`check-formation-icons-use-bundles.mjs` must verify:

```text
PlayableCharacterRegistry uiIcon has semanticKey
FormationEditor does not render uiIcon.primary raw src
SemanticAssetProvider.getActorIconUrl is called
public/assets/bcu icon paths are not requested
```

---

## 16. Required verification command sequence

The task is not complete unless all commands pass:

```bash
node scripts/prune-bcu-language-assets.mjs
node scripts/build-bcu-manifest.mjs
node scripts/build-bcu-canonical-index.mjs
node scripts/build-bcu-actor-index.mjs
node scripts/build-bcu-stage-index.mjs
node scripts/build-bcu-background-index.mjs
node scripts/build-bcu-castle-index.mjs
node scripts/build-bcu-core-index.mjs
node scripts/build-bcu-language-index.mjs
node scripts/build-bcu-core-db-bundle.mjs
node scripts/build-bcu-semantic-bundles.mjs --all

node scripts/check-bcu-semantic-bundles.mjs
node scripts/check-runtime-uses-zip-bundles.mjs
node scripts/check-bundled-assets-never-load-raw.mjs
node scripts/check-no-raw-runtime-paths.mjs
node scripts/check-no-non-jp-lang-assets.mjs
node scripts/check-core-db-runtime.mjs
node scripts/check-formation-icons-use-bundles.mjs
node scripts/check-stage-runtime-uses-bundles.mjs
node scripts/check-background-castle-use-bundles.mjs

node scripts/check-battle-scene-stage-runtime-wiring.mjs
node scripts/check-stage-asset-tracing.mjs
node scripts/check-bcu-stage-spawn-runtime.mjs
node scripts/check-battle-attack-timeline.mjs
```

Do not claim completion if any check fails.

---

## 17. Browser verification

After running full generation and checks, verify in browser.

### 17.1 Network filter

Open DevTools Network and filter:

```text
/bcu/|/bundles/|core-db|jp.zip
```

Expected after web load:

```text
public/assets/generated/...
public/assets/bundles/core/core-db.zip
public/assets/bundles/lang/jp.zip   # only if separate Japanese language bundle is used
```

Expected after Apply Battle:

```text
public/assets/bundles/actor/...
public/assets/bundles/stage/...
public/assets/bundles/background/...
public/assets/bundles/castle/...
```

Forbidden:

```text
public/assets/bcu/**
public/assets/bcu-manifest.json
```

### 17.2 Console verification

Run:

```js
const db = globalThis.__BCU_DB__;
console.log(db?.semanticMode);
console.log(db?.semanticProvider?.diagnostics);
console.log(Object.keys(db?.semanticProvider?.indexes?.bundleManifest?.bundles ?? {}).length);
```

Expected:

```text
semanticMode = semantic-strict
bundleReads > 0
blockedRawReads = 0
rawOnlyReads = 0 in normal production path
```

### 17.3 DOM icon verification

Run:

```js
[...document.querySelectorAll('.formation-ui img')]
  .map(img => img.src)
  .filter(src => src.includes('/public/assets/bcu/'))
```

Expected:

```js
[]
```

Formation icon URLs should be:

```text
blob:...
```

or non-BCU placeholders.

---

## 18. Documentation requirements

Update:

```text
docs/bcu-migration-status.md
```

Must include:

```text
core-db.zip contents
lang/jp.zip contents
full bundle generation count by kind
runtime boot request summary
Apply Battle request summary
blocked raw read count
Formation icon source verification
known rawOnly diagnostics entries
manual browser verification result
```

Do not write “complete” unless browser Network verification confirms no production raw BCU requests.

---

## 19. Definition of Done

Complete only when all are true:

1. Runtime boot does not fetch `public/assets/bcu-manifest.json`.
2. Runtime boot does not fetch raw BCU CSV/TXT.
3. Runtime boot reads `core/core-db.zip`.
4. Runtime language reads only Japanese data from `core-db.zip:names-jp.json` or an explicitly documented Japanese-only `lang/jp.zip`.
5. Formation icons use actor bundles or non-BCU placeholders.
6. Actor image/imgcut/model/anim data loads from actor zip bundles.
7. Stage CSV loads from stage zip bundles.
8. Background data/images load from background zip bundles.
9. Castle images load from castle zip bundles.
10. Runtime raw BCU URL guard is installed in `semantic-strict`.
11. Static checks do not hide raw runtime paths with broad allowlists.
12. Dynamic checks fail on any raw BCU runtime request.
13. Full bundle generation uses `--all`.
14. Browser Network shows zip bundle requests and no production `public/assets/bcu/**` requests.
15. Documentation records actual verification results.

---

## 20. Codex instruction

Implement this contract, not just a plan.

Do not stop after adding checks.

Do not stop after generating zips.

Do not leave boot/repository/formation/stage/background/castle runtime paths using raw BCU files.

Do not claim success while any runtime path still fetches `public/assets/bcu/...`.

Do not claim success while `core/core-db.zip` merely exists but is not used by `BcuBootLoader`.

Do not claim success without browser Network verification notes.
