# AGENTS.md — BCU Semantic Bundle Strict Runtime Contract

This repository is `rhgrive2/game`.

This file is the authoritative contract for agents working on the BCU asset pipeline and runtime loading system.

The current migration target is strict semantic bundle runtime:

- If semantic bundle data exists for an asset, runtime must not read the corresponding raw file from `public/assets/bcu/...`.
- Raw fallback is forbidden for bundled semantic data.
- Raw access is allowed only for assets that are explicitly unbundled and reported as `rawOnly`.
- Japanese is the only supported language target. Non-Japanese language text assets must be removed from the shipped asset set and excluded from manifests, indexes, bundles, and runtime loading.

Follow this document exactly.

---

## 0. Mission

Migrate BCU asset loading from raw path based loading to semantic key based bundle loading.

Forbidden as primary runtime paths:

```text
./public/assets/bcu/
public/assets/bcu/
public/assets/bcu/000001/
public/assets/bcu/000002/
public/assets/bcu/000004/
```

These paths may appear only in:

```text
scripts/
docs/
AGENTS.md
generated diagnostics fields named sourceRawPath
explicit rawOnly entries that have no bundle
```

They must not be used as runtime fallback for data that has a semantic bundle.

---

## 1. Hard rules

### 1.1 Bundled data must never fall back to raw

If `public/assets/generated/bcu-bundle-manifest.json` contains a bundle entry for a semantic key, then runtime access for that semantic key must be bundle-only.

Examples:

```text
enemy:186 has actor:enemy:186 bundle
=> enemy 186 image/imgcut/model/anims must not be read from public/assets/bcu/...

unit:259:f has actor:unit:259:f bundle
=> unit 259 f image/imgcut/model/anims must not be read from public/assets/bcu/...

stage:000001:A/StageRNA/stageRNA001_00 has stage-map bundle
=> that CSV must not be fetched from public/assets/bcu/...

background:185 has background bundle
=> image/imgcut/metadata must not be read from public/assets/bcu/...

enemyCastle:rc000 has castle bundle
=> image must not be read from public/assets/bcu/...
```

If bundle loading fails for a bundled semantic key, runtime must emit a diagnostic error and fail that load. It must not silently fetch raw.

### 1.2 Raw fallback is allowed only for unbundled rawOnly assets

Some unknown or intentionally excluded assets may remain unbundled.

They must be represented explicitly as:

```json
{
  "status": "rawOnly",
  "reason": "unclassified-asset",
  "sourceRawPath": "public/assets/bcu/..."
}
```

Runtime may read these only if all are true:

1. the asset has no semantic bundle entry,
2. the asset is marked `rawOnly`,
3. the caller explicitly requests rawOnly access,
4. the access is logged in diagnostics.

Raw access is never allowed for a key that has a semantic bundle.

### 1.3 Non-Japanese language assets must be removed from shipped runtime assets

Japanese is the only supported language target.

Non-Japanese language text assets must be removed from the published/runtime asset set and must not appear in runtime inputs:

```text
public/assets/bcu-manifest.json
public/assets/generated/bcu-asset-audit.json
public/assets/generated/bcu-canonical-index.json
public/assets/generated/bcu-actor-index.json
public/assets/generated/bcu-stage-index.json
public/assets/generated/bcu-background-index.json
public/assets/generated/bcu-castle-index.json
public/assets/generated/bcu-core-index.json
public/assets/generated/bcu-language-index.json
public/assets/generated/bcu-bundle-manifest.json
public/assets/bundles/**
runtime language loading
```

Exception: non-Japanese language file paths may appear only in deletion/exclusion reports such as:

```text
public/assets/generated/bcu-lang-prune-report.json
public/assets/generated/bcu-lang-prune-report.md
public/assets/generated/bcu-diagnostics.json
```

and only as evidence of deletion/exclusion, not as loadable runtime assets.

Japanese language files and language-neutral data may remain.

The pruning script must be deterministic and must produce a deletion/exclusion report.

### 1.4 Do not invent missing files

If a semantic asset is incomplete, mark it as incomplete.

Do not fabricate missing `.mamodel`, `.imgcut`, `.maanim`, `.png`, `.csv`, or `.txt` files.

### 1.5 Do not treat icons as runtime model assets

Icon/UI files are not runtime actor model files unless explicitly indexed as icons.

Enemy icon examples:

```text
enemy_icon_*.png
edi_*.png
```

Unit icon examples:

```text
edi*.png
uni*_??00.png
```

These must not be used as actor runtime `image.png` when proper actor runtime images exist.

### 1.6 Do not assume stage basename uniqueness

Stage CSV basenames are not globally unique.

Primary stage key must include pack and directory context:

```text
stage:<packId>:<category>/<groupDir>/<basename>
```

Example:

```text
stage:000001:A/StageRNA/stageRNA001_00
```

`stageRNA001_00` may be an alias only if non-conflicting.

### 1.7 Do not use stage raw path as primary runtime source

`stageCsvPath` may exist only as diagnostic or legacy metadata.

Runtime stage loading must use:

```text
stageKey -> bundleRef -> SemanticAssetProvider.readStageCsv(stageKey)
```

### 1.8 Do not resolve backgrounds by filename alone

Background lookup must respect metadata from available CSV/JSON data.

Relevant sources include:

```text
org/battle/bg/bg.csv
org/battle/bg.csv
org/data/bg.csv
org/data/bg*.json
org/img/bg/*.png
org/battle/bg/*.imgcut
```

Fallback filename matching may exist only in index generation diagnostics, not as silent runtime behavior for bundled backgrounds.

### 1.9 Do not mix enemy castles and nyanko castles

Enemy castle assets and nyanko/cat castle assets are separate semantic families.

Enemy castle groups:

```text
rc
ec
wc
sc
```

Nyanko castle source:

```text
org/castle/
```

Keep separate indexes, keys, bundles, and runtime loading paths.

---

## 2. Runtime modes

Supported runtime modes:

```text
semantic-strict
raw-only-diagnostics
```

### 2.1 semantic-strict

Default runtime mode.

Rules:

```text
bundled semantic key -> bundle only
unbundled rawOnly key -> raw access only if explicitly requested
missing bundle for semantic key -> error
bundle load failure -> error
```

No raw fallback is allowed for bundled keys.

### 2.2 raw-only-diagnostics

Development-only mode.

Purpose:

- audit raw assets
- compare old vs new loaders
- debug index generation

Rules:

- must not be default
- must not be used by production preview
- must clearly mark all raw reads in diagnostics
- must fail CI if enabled by default

Remove or disable old default modes such as:

```text
semantic-with-raw-fallback
legacy-raw
```

unless they are used only in tests that explicitly verify they are forbidden for bundled data.


### 2.3 Boot default

`BcuBootLoader.loadGame()` and the production preview app must default to:

```text
semantic-strict
```

If a developer needs `raw-only-diagnostics`, it must be passed explicitly and must be visibly reported in `db.semanticMode`, `db.getSummary().semantic`, and `docs/bcu-migration-status.md`.


---

## 3. Asset layers

### 3.1 Source layer

Raw BCU source tree:

```text
public/assets/bcu/
```

The source tree may be pruned only for non-Japanese language text assets according to this contract.

All other raw assets should remain as source unless a later explicit task says otherwise.

### 3.2 Generated semantic index layer

Generated files:

```text
public/assets/generated/bcu-asset-audit.json
public/assets/generated/bcu-asset-audit.md
public/assets/generated/bcu-canonical-index.json
public/assets/generated/bcu-actor-index.json
public/assets/generated/bcu-stage-index.json
public/assets/generated/bcu-background-index.json
public/assets/generated/bcu-castle-index.json
public/assets/generated/bcu-core-index.json
public/assets/generated/bcu-language-index.json
public/assets/generated/bcu-bundle-manifest.json
public/assets/generated/bcu-diagnostics.json
public/assets/generated/bcu-lang-prune-report.json
public/assets/generated/bcu-lang-prune-report.md
```

### 3.3 Runtime bundle layer

Bundles:

```text
public/assets/bundles/actor/enemy/<id3>.zip
public/assets/bundles/actor/unit/<id3>-<form>.zip
public/assets/bundles/stage/map/<safe-stage-group>.zip
public/assets/bundles/background/<bgId>.zip
public/assets/bundles/castle/enemy/<group><id3>.zip
public/assets/bundles/castle/nyanko/<safe-id>.zip
public/assets/bundles/core/core-db.zip
public/assets/bundles/lang/jp.zip
public/assets/bundles/ui/<safe-key>.zip
public/assets/bundles/effect/<safe-key>.zip
```

If a bundle is generated for a semantic key, runtime must use it.

---

## 4. Canonical semantic keys

### 4.1 Actor keys

```text
enemy:<enemyId>
unit:<unitId>:<form>
```

Examples:

```text
enemy:0
enemy:186
unit:0:f
unit:259:s
```

### 4.2 Stage keys

Primary key:

```text
stage:<packId>:<category>/<groupDir>/<basename>
```

Examples:

```text
stage:000001:A/StageRNA/stageRNA001_00
stage:000001:A/MSDNA/MapStageDataNA_000
```

Stage map bundle key:

```text
stage-map:<packId>/<category>/<groupDir>
```

Example:

```text
stage-map:000001/A/StageRNA
```

### 4.3 Background keys

```text
background:<bgId>
```

### 4.4 Castle keys

Enemy castle:

```text
enemyCastle:<group><localId3>
enemyCastle:<numericId>
```

Examples:

```text
enemyCastle:rc000
enemyCastle:ec000
enemyCastle:0
enemyCastle:1000
```

Nyanko castle:

```text
nyankoCastle:<partId>
nyankoCastle:<compositeId>
```

### 4.5 Core/language keys

```text
core:stats
core:manifest
lang:jp
stats:unit:<unitId>:<form>
stats:enemy:<enemyId>
```

No non-Japanese `lang:<locale>` keys are allowed in shipped generated indexes.

---

## 5. Required scripts

Add or update these scripts:

```text
scripts/prune-bcu-language-assets.mjs
scripts/audit-bcu-assets.mjs
scripts/build-bcu-canonical-index.mjs
scripts/build-bcu-actor-index.mjs
scripts/build-bcu-stage-index.mjs
scripts/build-bcu-background-index.mjs
scripts/build-bcu-castle-index.mjs
scripts/build-bcu-core-index.mjs
scripts/build-bcu-language-index.mjs
scripts/build-bcu-semantic-bundles.mjs
scripts/check-bcu-semantic-bundles.mjs
scripts/check-bundled-assets-never-load-raw.mjs
scripts/check-no-raw-runtime-paths.mjs
scripts/check-no-non-jp-lang-assets.mjs
```

Existing `scripts/build-bcu-manifest.mjs` may be reused, but it must not include deleted/excluded non-Japanese language text assets in the runtime manifest.

---

## 6. Language pruning contract

### 6.1 Script

```text
scripts/prune-bcu-language-assets.mjs
```

### 6.2 Purpose

Remove or exclude non-Japanese language text assets from the shipped asset set.

### 6.3 Supported target locale

Only:

```text
jp
```

### 6.4 Required behavior

The script must:

1. scan `public/assets/bcu/`,
2. identify language text assets,
3. preserve Japanese and language-neutral files,
4. delete or exclude non-Japanese language `.txt` files,
5. produce a report,
6. update regenerated manifests/indexes so non-Japanese language text files are absent,
7. never let runtime load non-Japanese language files.

### 6.5 Language file classification

Classify conservatively.

Language classification must be exact, not substring-based.

Preferred source of truth:

```text
manifest.langFiles
```

A file is a non-Japanese language text asset only if one of these is true:

1. it appears under `manifest.langFiles[locale]` where `locale !== "jp"`,
2. its basename uses an exact supported locale prefix such as `en-UnitName.txt`, `ko-EnemyName.txt`, `tw-StageName.txt`,
3. its path contains an exact locale path segment such as `/en/`, `/ko/`, `/tw/`,
4. it matches an explicitly documented BCU language naming rule.

Never classify by loose substring. For example, do not treat `EnemyName.txt` as English because it contains `en`, and do not treat ordinary paths containing words like `enemy`, `center`, `general`, or `stage` as locale paths.

Known non-Japanese locale identifiers include:

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

If uncertain whether a `.txt` is language text, do not delete it blindly. Mark it as:

```text
languageUnknown
```

in the prune report and require explicit handling.

### 6.6 Prune report

Output:

```text
public/assets/generated/bcu-lang-prune-report.json
public/assets/generated/bcu-lang-prune-report.md
```

Required fields:

```json
{
  "targetLocale": "jp",
  "deleted": [],
  "excluded": [],
  "keptJapanese": [],
  "keptNeutral": [],
  "languageUnknown": [],
  "errors": []
}
```

### 6.7 Runtime language loading

Runtime must load only:

```text
lang:jp
```

or language-neutral core data.

Any attempt to load another locale must fail with a clear diagnostic error.

### 6.8 Check

`check-no-non-jp-lang-assets.mjs` must fail if non-Japanese language `.txt` files remain as loadable runtime assets in:

```text
public/assets/bcu-manifest.json
public/assets/generated/bcu-asset-audit.json
public/assets/generated/bcu-canonical-index.json
public/assets/generated/bcu-actor-index.json
public/assets/generated/bcu-stage-index.json
public/assets/generated/bcu-background-index.json
public/assets/generated/bcu-castle-index.json
public/assets/generated/bcu-core-index.json
public/assets/generated/bcu-language-index.json
public/assets/generated/bcu-bundle-manifest.json
public/assets/bundles/**
runtime language indexes
```

It may allow non-Japanese language paths only inside:

```text
public/assets/generated/bcu-lang-prune-report.json
public/assets/generated/bcu-lang-prune-report.md
public/assets/generated/bcu-diagnostics.json
```

and only when those paths are marked deleted/excluded/non-runtime.

---

## 7. Actor index and runtime contract

### 7.1 Script

```text
scripts/build-bcu-actor-index.mjs
```

### 7.2 Output

```text
public/assets/generated/bcu-actor-index.json
```

### 7.3 Actor entry requirements

Each actor entry must include:

```json
{
  "key": "enemy:186",
  "kind": "enemy",
  "id": 186,
  "id3": "186",
  "form": null,
  "status": "full",
  "selected": {
    "sourcePack": "140200",
    "files": {
      "image": "public/assets/bcu/140200/org/enemy/186/186_e.png",
      "imgcut": "public/assets/bcu/140200/org/enemy/186/186_e.imgcut",
      "model": "public/assets/bcu/140200/org/enemy/186/186_e.mamodel",
      "animations": {
        "move": "public/assets/bcu/140200/org/enemy/186/186_e00.maanim",
        "idle": "public/assets/bcu/140200/org/enemy/186/186_e01.maanim",
        "attack": "public/assets/bcu/140200/org/enemy/186/186_e02.maanim",
        "kb": "public/assets/bcu/140200/org/enemy/186/186_e03.maanim"
      },
      "icon": null
    }
  },
  "bundleRef": {
    "bundleKey": "actor:enemy:186",
    "bundlePath": "public/assets/bundles/actor/enemy/186.zip",
    "readMode": "zip"
  },
  "sourceCandidates": [],
  "missing": [],
  "warnings": [],
  "diagnostics": {
    "sourceRawPaths": []
  }
}
```

### 7.4 Actor status values

Allowed:

```text
full
partial
iconOnly
invalid
rawOnly
```

### 7.5 Full criteria

An actor is `full` only when all required runtime files exist:

```text
image
imgcut
mamodel
anim00
anim01
anim02
anim03
```

Animation mapping:

```text
anim00 -> move
anim01 -> idle
anim02 -> attack
anim03 -> kb
```

### 7.6 Runtime rule

If an actor has a bundle entry, actor runtime must use:

```text
semanticKey -> actor bundle
```

and must not read:

```text
public/assets/bcu/<pack>/org/enemy/<id3>/*
public/assets/bcu/<pack>/org/unit/<id3>/<form>/*
```

for that actor.

---

## 8. Required actor runtime fixes

### 8.1 `BcuAssetLoader`

`BcuAssetLoader` must not silently fall back to raw when a bundle exists.

Required behavior:

```text
def.semanticKey exists and bundle exists -> bundle only
bundle read failure -> error
def.semanticKey exists but no bundle -> raw only if index marks rawOnly
def.semanticKey missing -> try to derive semanticKey from kind/id/form before raw
```

If `def.baseDir` points to `public/assets/bcu/` and a matching semantic bundle exists, loading must fail with a contract error instead of reading raw.

### 8.2 `BcuStageEnemyResolver`

`buildBcuEnemyAssetDef(enemyId)` must not build a primary raw `baseDir` asset when DB semantic data exists.

Required behavior:

1. read `getBcuAssetDatabase().assets.resolveEnemyAsset(enemyId)`,
2. if it has `semanticKey` and `bundleRef`, return it merged with stage metadata,
3. if semantic actor entry exists but bundle is missing, report an error unless it is `rawOnly`,
4. use raw fallback only for explicit `rawOnly` assets.

The old hardcoded path:

```text
./public/assets/bcu/000002/org/enemy/<id3>/
```

must not be used when `enemy:<id>` has a bundle.

### 8.3 `PlayableCharacterRegistry`

All battle actor `assetDef` outputs must include semantic identity when available.

Required:

```text
enemy -> semanticKey: enemy:<id>
unit -> semanticKey: unit:<id>:<form>
```

`uiIcon` paths must not point to raw BCU files when an icon or actor bundle exists.

If icon bundle support is not implemented yet:

- remove raw icon preloading from Apply Battle critical path,
- mark UI icon as deferred,
- or load icon through semantic provider.

Do not use raw icon paths for bundled actors during Apply Battle.


If actor bundles already include `icon.png`, `PlayableCharacterRegistry` and production/formation UI must use that icon through `SemanticAssetProvider`. If no icon exists in the actor bundle, UI must either defer icon loading or show a non-BCU placeholder. It must not fetch `edi_*.png`, `enemy_icon_*.png`, or `uni*.png` from `public/assets/bcu/` for an actor that has a semantic actor bundle.


### 8.4 `BattleActorFactory`

Before calling `BcuAssetLoader.loadAssetSet(assetDef)`, assert:

```text
if matching bundle exists, assetDef.semanticKey must exist
```

If not, throw a diagnostic contract error.

This prevents silent raw loading.

---

## 9. Stage index and runtime contract

### 9.1 Script

```text
scripts/build-bcu-stage-index.mjs
```

### 9.2 Output

```text
public/assets/generated/bcu-stage-index.json
```

### 9.3 Scope

Scan every CSV under:

```text
public/assets/bcu/<pack>/org/stage/**/*.csv
```

### 9.4 Stage entry requirements

Each entry must include:

```json
{
  "key": "stage:000001:A/StageRNA/stageRNA001_00",
  "stageId": "stageRNA001_00",
  "kind": "stage-definition",
  "packId": "000001",
  "category": "A",
  "groupDir": "StageRNA",
  "relativeStagePath": "A/StageRNA/stageRNA001_00.csv",
  "basename": "stageRNA001_00",
  "aliases": [],
  "duplicateGroup": null,
  "aliasConflicts": [],
  "bundleRef": {
    "bundleKey": "stage-map:000001/A/StageRNA",
    "bundlePath": "public/assets/bundles/stage/map/000001__A__StageRNA.zip",
    "internalPath": "stageRNA001_00.csv",
    "readMode": "zip-text"
  },
  "diagnostics": {
    "sourceRawPath": "public/assets/bcu/000001/org/stage/A/StageRNA/stageRNA001_00.csv"
  }
}
```

### 9.5 Stage runtime fixes

`StageRegistry` must return semantic stage entries.

`BattleScene` must preserve and pass all of these:

```text
stageKey
bundleRef
semanticKey
allowRawOnly
```

`BattleScene` must not discard `stageKey` / `bundleRef`.

`StageDefinitionLoader` must load:

```text
stageKey -> SemanticAssetProvider.readStageCsv(stageKey)
```

If a stage bundle exists, `StageDefinitionLoader` must not fetch `stageCsvPath`.

If `stageCsvPath` is present only as diagnostics, it must not be used for bundled stages.

---

## 10. Background index and runtime contract

### 10.1 Script

```text
scripts/build-bcu-background-index.mjs
```

### 10.2 Output

```text
public/assets/generated/bcu-background-index.json
```

### 10.3 Runtime rule

If `background:<bgId>` has a bundle entry, `StageBackgroundLoader` must load:

```text
metadata.json
image.png
imgcut.imgcut
```

from the bundle.

It must not fetch raw:

```text
public/assets/bcu/.../org/img/bg/*.png
public/assets/bcu/.../org/battle/bg/*.imgcut
public/assets/bcu/.../org/battle/bg.csv
```

for bundled backgrounds.

If a background bundle exists but is incomplete, fail with diagnostics. Do not raw fallback.

---

## 11. Castle index and runtime contract

### 11.1 Script

```text
scripts/build-bcu-castle-index.mjs
```

### 11.2 Output

```text
public/assets/generated/bcu-castle-index.json
```

### 11.3 Runtime rule

If a castle bundle exists, `BcuCastleAssetLoader` must read it from bundle.

It must not fetch raw:

```text
public/assets/bcu/.../org/img/rc/*.png
public/assets/bcu/.../org/img/ec/*.png
public/assets/bcu/.../org/img/wc/*.png
public/assets/bcu/.../org/img/sc/*.png
public/assets/bcu/.../org/castle/**/*
```

for bundled castles.

---

## 12. Core DB and language bundle contract

### 12.1 Scripts

```text
scripts/build-bcu-core-index.mjs
scripts/build-bcu-language-index.mjs
```

### 12.2 Outputs

```text
public/assets/generated/bcu-core-index.json
public/assets/generated/bcu-language-index.json
public/assets/bundles/core/core-db.zip
public/assets/bundles/lang/jp.zip
```

### 12.3 Core runtime rule

If `core:stats` or `lang:jp` bundle exists, boot repositories must not fetch raw CSV/TXT files from `public/assets/bcu/...`.

This applies to:

```text
BcuLangStore
BcuUnitRepository
BcuEnemyRepository
BcuBackgroundRepository
BcuCastleRepository
BcuStageRepository
BattleStatsLoader
```

They must read through `SemanticAssetProvider` or generated core indexes.

Raw metadata loading is allowed only for `raw-only-diagnostics`.

### 12.4 Non-Japanese language ban

Runtime must not request any locale except:

```text
jp
```

The following must fail checks if present in runtime indexes or bundles:

```text
lang:en
lang:ko
lang:tw
lang:fr
lang:it
lang:de
lang:es
lang:th
lang:zh
```

unless they appear only in deletion/prune reports.

---

## 13. Bundle generation contract

### 13.1 Script

```text
scripts/build-bcu-semantic-bundles.mjs
```

### 13.2 Full generation must be default for production verification

The script may support `--sample`, but production checks must use full generation.

Required full command:

```bash
node scripts/build-bcu-semantic-bundles.mjs --all
```

If sample mode exists, it must not be used to claim runtime completion.

### 13.3 Bundle manifest

Output:

```text
public/assets/generated/bcu-bundle-manifest.json
```

Required fields:

```json
{
  "schemaVersion": 1,
  "generationMode": "all",
  "bundles": {}
}
```

`check-bcu-semantic-bundles.mjs` must fail if:

```text
generationMode !== all
bundle count is sample-sized
any required full bundle family is missing
```

### 13.4 ZIP format

Runtime and generator must agree.

Allowed:

1. STORE-only ZIP with tested STORE-only reader
2. DEFLATE ZIP with tested dependency/reader

If using STORE-only ZIP, all generated ZIP entries must be STORE/no-compression.

Provider must reject unsupported compression methods with clear diagnostics.

---

## 14. SemanticAssetProvider contract

### 14.1 Required file

```text
js/bcu/SemanticAssetProvider.js
```

### 14.2 Required capabilities

Provider must:

- load bundle manifest
- load actor/stage/background/castle/core/language indexes
- resolve semantic keys
- fetch and cache bundles
- read text/blob/arrayBuffer from bundle entries
- create and revoke object URLs
- expose diagnostics
- reject raw fallback for bundled keys
- expose `hasBundleForKey(key)`
- expose `assertNoRawForBundledKey(key, rawPath)`

### 14.3 Diagnostics

Provider diagnostics must include:

```json
{
  "bundleReads": [],
  "rawOnlyReads": [],
  "blockedRawReads": [],
  "bundleErrors": [],
  "missingBundles": []
}
```

If raw access is blocked because a bundle exists, record:

```json
{
  "type": "blockedRawReadForBundledKey",
  "semanticKey": "enemy:0",
  "rawPath": "public/assets/bcu/000002/org/enemy/000/000_e.png"
}
```

---

## 15. Required checks

### 15.1 Full command sequence

The implementation is not complete unless all commands pass:

```bash
node scripts/prune-bcu-language-assets.mjs
node scripts/build-bcu-manifest.mjs
node scripts/audit-bcu-assets.mjs
node scripts/build-bcu-canonical-index.mjs
node scripts/build-bcu-actor-index.mjs
node scripts/build-bcu-stage-index.mjs
node scripts/build-bcu-background-index.mjs
node scripts/build-bcu-castle-index.mjs
node scripts/build-bcu-core-index.mjs
node scripts/build-bcu-language-index.mjs
node scripts/build-bcu-semantic-bundles.mjs --all
node scripts/check-bcu-semantic-bundles.mjs
node scripts/check-bundled-assets-never-load-raw.mjs
node scripts/check-no-raw-runtime-paths.mjs
node scripts/check-no-non-jp-lang-assets.mjs
node scripts/check-battle-scene-stage-runtime-wiring.mjs
node scripts/check-stage-asset-tracing.mjs
node scripts/check-bcu-stage-spawn-runtime.mjs
node scripts/check-battle-attack-timeline.mjs
```

### 15.2 `check-bundled-assets-never-load-raw.mjs`

This check must fail if any runtime code can load raw for bundled semantic data.

It must inspect and/or test:

```text
BcuAssetLoader
BcuStageEnemyResolver
PlayableCharacterRegistry
BattleActorFactory
StageRegistry
BattleScene
StageDefinitionLoader
StageBackgroundLoader
BcuCastleAssetLoader
BcuBootLoader
BcuLangStore
BcuUnitRepository
BcuEnemyRepository
BattleStatsLoader
```

Required assertions:

```text
stage enemy assetDef uses semanticKey when bundle exists
BattleScene preserves stageKey and bundleRef
StageDefinitionLoader does not fetch raw when bundleRef exists
BcuAssetLoader blocks raw when actor bundle exists
UI icon paths do not raw-load bundled actors during Apply Battle
metadata/lang repositories do not raw-load bundled core/lang data
```

### 15.3 `check-no-raw-runtime-paths.mjs`

Must fail on primary runtime usages of:

```text
./public/assets/bcu/
public/assets/bcu/
baseDir: './public/assets/bcu/
stageCsvPath: './public/assets/bcu/
fetch('./public/assets/bcu/
new Image().src = './public/assets/bcu/
```

Allowed only in:

```text
scripts/
docs/
AGENTS.md
generated diagnostics sourceRawPath
explicit rawOnly handling
```

Do not maintain broad allowlists that hide real raw runtime loading.

Any allowlist entry must have a reason and must not cover bundled data.


The checker must be data-aware where possible: it must compare raw paths against `bcu-bundle-manifest.json` and semantic indexes. A raw path is forbidden when it corresponds to a bundled actor, stage, background, castle, core, language, UI, or effect entry, even if the source file appears in a historical allowlist.


### 15.4 `check-no-non-jp-lang-assets.mjs`

Must fail if non-Japanese language TXT assets remain in shipped runtime manifests, generated indexes, bundles, or runtime loaders.

---

## 16. Browser verification contract

After full generation and checks, manually verify in browser.

### 16.1 Network check

In DevTools Network, apply battle and filter:

```text
/bcu/|/bundles/
```

Expected for bundled data:

```text
public/assets/bundles/...
```

Forbidden for bundled data:

```text
public/assets/bcu/.../*.png
public/assets/bcu/.../*.imgcut
public/assets/bcu/.../*.mamodel
public/assets/bcu/.../*.maanim
public/assets/bcu/.../*.csv
public/assets/bcu/.../*.txt
```

Raw requests may appear only for explicit `rawOnly` assets.

### 16.2 Console check

After Apply Battle:

```js
const db = globalThis.__BCU_DB__;
console.log(db.semanticMode);
console.log(db.getSummary?.().semantic);
console.log(db.semanticProvider?.diagnostics);
```

Expected:

```text
semanticMode = semantic-strict
bundleReads > 0
blockedRawReads = 0
rawOnlyReads only for explicit rawOnly assets
```

### 16.3 Actor check

Verify first spawned stage enemies and player units have assetDefs with:

```text
semanticKey
bundleRef
```

and do not have primary raw `baseDir`.

---

## 17. Documentation requirements

Update:

```text
docs/bcu-migration-status.md
```

Must include:

- language pruning result
- non-Japanese language deletion/exclusion counts
- full bundle generation result
- bundle count by kind
- actor full/partial/rawOnly counts
- stage duplicate/alias conflict counts
- background complete/partial/rawOnly counts
- castle complete/partial/rawOnly counts
- core/lang bundle status
- raw runtime blocking status
- browser Network verification result
- known remaining rawOnly assets

Do not write “complete” unless full generation and strict runtime checks pass.

---

## 18. Definition of Done

The task is complete only when all are true:

1. Non-Japanese language text assets are removed/excluded from shipped runtime assets.
2. `bcu-lang-prune-report` exists.
3. Full semantic bundles are generated with `generationMode: "all"`.
4. Actor bundles are used for bundled enemies/units.
5. Stage bundles are used for bundled stage CSVs.
6. Background bundles are used for bundled backgrounds.
7. Castle bundles are used for bundled castles.
8. Core/lang bundles are used for bundled metadata and Japanese language data.
9. Any asset with a bundle is prohibited from raw runtime loading.
10. Raw access remains only for explicit `rawOnly` assets.
11. `check-bundled-assets-never-load-raw.mjs` passes.
12. `check-no-raw-runtime-paths.mjs` passes without broad false allowlists.
13. `check-no-non-jp-lang-assets.mjs` passes.
14. Browser Network confirms bundled runtime loading.
15. `docs/bcu-migration-status.md` documents exact results.

---

## 19. Codex instruction

When implementing this contract:

- Do not stop at generating bundles.
- Fix runtime wiring.
- Remove soft raw fallback for bundled data.
- Remove/exclude non-Japanese language text assets.
- Add strict checks.
- Run the full command sequence.
- Update documentation with actual results.

Do not claim success if any bundled asset still loads from raw path.

Do not claim success if non-Japanese language text assets remain in the shipped runtime asset set.

Do not claim success if only sample bundles were generated.

Do not claim success without browser Network verification notes.
