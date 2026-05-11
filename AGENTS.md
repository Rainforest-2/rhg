# AGENTS.md — BCU Semantic Bundle Migration Contract

This file is the authoritative implementation contract for agents working on `rhgrive2/game`.

The task is to migrate BCU asset loading from raw file-path based loading to semantic key based bundle loading while preserving correctness, diagnostics, and fallback safety.

This document is intentionally strict. Follow it exactly.

---

## 0. Mission

Convert BCU asset runtime access from direct raw paths like:

```text
./public/assets/bcu/000001/org/...
./public/assets/bcu/000002/org/...
./public/assets/bcu/000004/org/...
public/assets/bcu/<pack>/org/...
```

to semantic key based lookup through generated indexes and runtime bundles.

The final runtime should prefer semantic bundles, not raw GitHub/GitHub Pages paths.

Raw paths may remain only as:

1. generator input under `scripts/`
2. diagnostic metadata such as `sourceRawPath`
3. explicit migration fallback guarded by `allowRawFallback === true`
4. documentation/examples explaining legacy behavior

Never make raw paths the primary runtime source after this migration.

---

## 1. Non-negotiable rules

### 1.1 Do not mutate raw BCU assets

Never delete, move, rename, rewrite, normalize, or reformat files under:

```text
public/assets/bcu/
```

That directory is the immutable raw source layer.

It represents original BCU pack/update structure and must remain reproducible.

### 1.2 Do not silently drop unknown assets

If an asset cannot be classified semantically, keep it in audit output and diagnostics.

Unknown assets are valid raw assets until proven otherwise.

They must be reported, not ignored.

### 1.3 Do not invent missing files

If an actor is missing `mamodel`, `imgcut`, or animation files, mark the entry as `partial` or `invalid`.

Do not fabricate dummy files during bundle generation.

Runtime fallback policy may be defined, but generated indexes must preserve the truth.

### 1.4 Do not confuse icon assets with runtime actor assets

Enemy icon files such as:

```text
enemy_icon_*.png
edi_*.png
```

and unit icon files such as:

```text
edi*.png
uni*_??00.png
```

are UI/icon candidates unless explicitly proven to be runtime image assets.

They must not be selected as actor runtime model images when proper runtime assets exist.

### 1.5 Do not assume stage filenames are numeric triplets

Stage CSVs may use names such as:

```text
stageRNA001_00.csv
MapStageDataNA_000.csv
stageNormal0_0_Z.csv
PlayDungeonD_000.csv
```

Do not assume a `0-0-0.csv` or `mapId-stageId` numeric triplet pattern.

### 1.6 Do not use basename as a unique stage key

Many stage CSV basenames are duplicated across packs/directories.

Stage selection must use stable semantic keys and aliases with conflict reporting.

### 1.7 Do not resolve background assets by filename alone

Background resolution must respect metadata from relevant CSV/JSON sources where available:

```text
org/battle/bg/bg.csv
org/battle/bg.csv
org/data/bg.csv
org/data/bg*.json
```

Do not rely only on `bgXXX.png`.

### 1.8 Do not mix enemy castles and nyanko castles

Enemy castle images under:

```text
org/img/rc/
org/img/ec/
org/img/wc/
org/img/sc/
```

are different from nyanko/cat castle assets under:

```text
org/castle/
```

They must have separate indexes, keys, and bundle families.

### 1.9 Do not break the app when only sample bundles are committed

If only representative sample bundles are committed, runtime must not globally require bundles for every asset.

One of the following must be true:

1. all assets required by the default app flow are present as committed bundles, or
2. migration fallback is enabled explicitly for missing bundles in development/demo mode, or
3. the app is configured to use legacy raw loading until full bundles are generated.

Do not combine "sample bundles only" with "raw fallback disabled by default" in a way that makes the default app fail.

---

## 2. Asset architecture

The project must use three distinct layers.

### 2.1 Raw source layer

Path:

```text
public/assets/bcu/<pack>/org/...
```

Purpose:

- immutable source
- audit input
- canonical index source
- fallback source during migration
- diagnostics source

Runtime must not treat this layer as primary after semantic bundle integration.

### 2.2 Generated semantic index layer

Path:

```text
public/assets/generated/
```

Required generated files:

```text
public/assets/generated/bcu-asset-audit.json
public/assets/generated/bcu-asset-audit.md
public/assets/generated/bcu-canonical-index.json
public/assets/generated/bcu-actor-index.json
public/assets/generated/bcu-stage-index.json
public/assets/generated/bcu-background-index.json
public/assets/generated/bcu-castle-index.json
public/assets/generated/bcu-bundle-manifest.json
public/assets/generated/bcu-diagnostics.json
```

These files are generated from raw assets and are the source of truth for semantic runtime lookup.

### 2.3 Runtime semantic bundle layer

Path:

```text
public/assets/bundles/
```

Required bundle families:

```text
public/assets/bundles/actor/enemy/<id3>.zip
public/assets/bundles/actor/unit/<id3>-<form>.zip
public/assets/bundles/stage/map/<safe-stage-group>.zip
public/assets/bundles/background/<bgId>.zip
public/assets/bundles/castle/enemy/<group><id3>.zip
public/assets/bundles/castle/nyanko/<safe-id>.zip
public/assets/bundles/core/<bundle>.zip
```

If committing all generated bundle files would make the repository too large, implement full generation and commit representative sample bundles only. In that case, document the exact full-generation command and ensure all runtime/index code supports full generation.

---

## 3. Canonical semantic keys

Use these canonical key formats.

### 3.1 Actors

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

### 3.2 Stages

Use a unique primary stage entry key and separate human/search aliases.

Primary stage entry key:

```text
stage:<packId>:<category>/<groupDir>/<basename>
```

Non-conflicting aliases may use:

```text
stage:<stageId>
stage:<basename>
stage-map:<packId>/<category>/<groupDir>
```

Examples:

```text
stage:000001:A/StageRNA/stageRNA001_00
stage:000001:A/MSDNA/MapStageDataNA_000
stage:stageRNA001_00        # alias only if non-conflicting
stage-map:000001/A/StageRNA
stage-map:000001/A/MSDNA
```

Do not treat `stage:<basename>` as a primary key unless the basename is proven unique.

### 3.3 Backgrounds

```text
background:<bgId>
```

Example:

```text
background:185
```

### 3.4 Castles

Enemy castle keys:

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

Nyanko/cat castle keys:

```text
nyankoCastle:<partId>
nyankoCastle:<compositeId>
```

### 3.5 Core data

```text
lang:<locale>
stats:unit:<unitId>:<form>
stats:enemy:<enemyId>
```

Examples:

```text
lang:jp
stats:unit:259:f
stats:enemy:186
```

---

## 4. Required scripts

Add or update these scripts:

```text
scripts/audit-bcu-assets.mjs
scripts/build-bcu-canonical-index.mjs
scripts/build-bcu-actor-index.mjs
scripts/build-bcu-stage-index.mjs
scripts/build-bcu-background-index.mjs
scripts/build-bcu-castle-index.mjs
scripts/build-bcu-semantic-bundles.mjs
scripts/check-bcu-semantic-bundles.mjs
scripts/check-no-raw-runtime-paths.mjs
```

Existing script `scripts/build-bcu-manifest.mjs` may be reused and extended, but do not break existing callers.

All scripts must be deterministic. Re-running scripts without source asset changes should produce equivalent semantic output. If timestamps are generated, checks must either normalize them or allow a stable `--no-timestamp` / `SOURCE_DATE_EPOCH` mode.

---

## 5. Audit script contract

### 5.1 Script

```text
scripts/audit-bcu-assets.mjs
```

### 5.2 Inputs

Preferred:

```text
public/assets/bcu-manifest.json
```

Fallback:

scan:

```text
public/assets/
public/assets/bcu/
```

### 5.3 Outputs

```text
public/assets/generated/bcu-asset-audit.json
public/assets/generated/bcu-asset-audit.md
```

### 5.4 Required audit data

The audit output must include:

- total file count
- total byte size
- pack count
- per-pack file count and size
- extension counts
- top-level `org/` category counts
- unit actor candidates grouped by `unitId + form`
- enemy actor candidates grouped by `enemyId`
- stage CSV classification
- background-related file classification
- castle files grouped as enemyCastle and nyankoCastle
- data/page/effect/battle file classification
- unknown/unclassified files
- duplicate basenames
- path conflicts
- case conflicts
- missing file pairs
- files included in no classification

### 5.5 Classification completeness

Every file in the manifest must be represented in at least one audit classification.

It is acceptable for a file to be in a broad category such as `unknown`, but it is not acceptable for a file to disappear from the audit.

---

## 6. Canonical index contract

### 6.1 Script

```text
scripts/build-bcu-canonical-index.mjs
```

### 6.2 Output

```text
public/assets/generated/bcu-canonical-index.json
```

### 6.3 Purpose

This file ties all semantic indexes together.

It should reference:

```text
bcu-actor-index.json
bcu-stage-index.json
bcu-background-index.json
bcu-castle-index.json
bcu-bundle-manifest.json
```

It must include global diagnostics summary and schema version.

---

## 7. Actor semantic index contract

### 7.1 Script

```text
scripts/build-bcu-actor-index.mjs
```

### 7.2 Output

```text
public/assets/generated/bcu-actor-index.json
```

Optional human-readable output:

```text
public/assets/generated/bcu-actor-index.md
```

### 7.3 Scope

Actors include:

```text
enemy:<enemyId>
unit:<unitId>:<form>
```

Enemy runtime candidates are usually under:

```text
public/assets/bcu/<pack>/org/enemy/<id3>/
```

Unit runtime candidates are usually under:

```text
public/assets/bcu/<pack>/org/unit/<id3>/<form>/
```

### 7.4 Actor entry schema

Each actor entry must include:

```json
{
  "key": "unit:259:f",
  "kind": "unit",
  "id": 259,
  "id3": "259",
  "form": "f",
  "status": "full",
  "selected": {
    "sourcePack": "100200",
    "files": {
      "image": "public/assets/bcu/100200/org/unit/259/f/259_f.png",
      "imgcut": "public/assets/bcu/100200/org/unit/259/f/259_f.imgcut",
      "model": "public/assets/bcu/100200/org/unit/259/f/259_f.mamodel",
      "animations": {
        "move": "public/assets/bcu/100200/org/unit/259/f/259_f00.maanim",
        "idle": "public/assets/bcu/100200/org/unit/259/f/259_f01.maanim",
        "attack": "public/assets/bcu/100200/org/unit/259/f/259_f02.maanim",
        "kb": "public/assets/bcu/100200/org/unit/259/f/259_f03.maanim"
      },
      "icon": null
    }
  },
  "sourceCandidates": [],
  "missing": [],
  "warnings": [],
  "bundleRef": {
    "bundleKey": "actor:unit:259:f",
    "bundlePath": "public/assets/bundles/actor/unit/259-f.zip"
  },
  "diagnostics": {
    "sourceRawPaths": []
  }
}
```

### 7.5 Actor status values

Use only these status values:

```text
full
partial
iconOnly
invalid
```

### 7.6 Full actor criteria

An actor is `full` only if all required runtime files exist:

```text
image
imgcut
mamodel
anim00
anim01
anim02
anim03
```

### 7.7 Animation role mapping

Use this mapping:

```text
anim00 -> move
anim01 -> idle
anim02 -> attack
anim03 -> kb
```

### 7.8 Partial actor criteria

An actor is `partial` if it has some runtime files but not all full criteria.

Examples:

```text
image + imgcut + mamodel + attack only
image + imgcut + animations but missing mamodel
```

Partial actors must list missing fields.

### 7.9 Icon-only criteria

An actor candidate is `iconOnly` if it only contains icon-like images and no usable runtime model set.

Icon-only entries must never be selected as runtime if any runtime candidate exists.

### 7.10 Actor selection rules

1. Prefer `full` runtime candidates.
2. If multiple `full` candidates exist, prefer the newer pack ID using stable pack ordering.
3. Do not select icon-only packs as runtime assets.
4. Preserve all source candidates in diagnostics.
5. Preserve partial candidates.
6. Do not synthesize missing runtime files.
7. Do not silently discard invalid candidates.

### 7.11 Pack ordering

Pack IDs are strings, but most are numeric-like. Use a stable deterministic ordering.

Recommended:

1. numeric comparison when both pack IDs are numeric
2. lexical comparison as fallback
3. preserve exact pack ID in diagnostics

---

## 8. Stage semantic index contract

### 8.1 Script

```text
scripts/build-bcu-stage-index.mjs
```

### 8.2 Output

```text
public/assets/generated/bcu-stage-index.json
```

Optional human-readable output:

```text
public/assets/generated/bcu-stage-index.md
```

### 8.3 Scope

Scan every CSV under:

```text
public/assets/bcu/<pack>/org/stage/**/*.csv
```

Do not restrict to currently hardcoded stages.

### 8.4 Stage entry schema

Each stage CSV entry must include:

```json
{
  "key": "stage:000001:A/StageRNA/stageRNA001_00",
  "legacyStageKey": "stage:stageRNA001_00",
  "stageId": "stageRNA001_00",
  "kind": "stage-definition",
  "packId": "000001",
  "category": "A",
  "groupDir": "StageRNA",
  "relativeStagePath": "A/StageRNA/stageRNA001_00.csv",
  "basename": "stageRNA001_00",
  "extension": ".csv",
  "aliases": [
    "stageRNA001_00",
    "stageRNA001_00.csv",
    "A/StageRNA/stageRNA001_00.csv",
    "000001:A/StageRNA/stageRNA001_00.csv"
  ],
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

Primary `key` must be unique. `legacyStageKey` or `stage:<basename>` aliases are lookup aliases only and must be marked conflicting if duplicated.

### 8.5 Supported stage kind values

Use only these values:

```text
stage-definition
map-stage-data
random-dungeon
play-dungeon
unknown-stage-csv
```

### 8.6 Stage classification hints

Classify conservatively.

Examples:

```text
stageRNA001_00.csv -> stage-definition
MapStageDataNA_000.csv -> map-stage-data
PlayDungeonD_000.csv -> play-dungeon
```

If uncertain, use:

```text
unknown-stage-csv
```

and report in diagnostics.

### 8.7 Duplicate handling

If basenames repeat across packs or directories:

- do not discard any entry
- do not use basename as unique primary key
- populate `duplicateGroup`
- report alias conflicts
- ensure lookup API can require disambiguation

### 8.8 Runtime rule

Stage runtime loading must use:

```text
stageKey
bundleRef
SemanticAssetProvider.readStageCsv(stageKey)
```

Legacy `stageCsvPath` may exist only as migration fallback and must not be the primary runtime path.

---

## 9. Background semantic index contract

### 9.1 Script

```text
scripts/build-bcu-background-index.mjs
```

### 9.2 Output

```text
public/assets/generated/bcu-background-index.json
```

### 9.3 Scope

Scan all relevant background sources:

```text
public/assets/bcu/<pack>/org/battle/bg/bg.csv
public/assets/bcu/<pack>/org/battle/bg.csv
public/assets/bcu/<pack>/org/data/bg.csv
public/assets/bcu/<pack>/org/data/bg*.json
public/assets/bcu/<pack>/org/img/bg/*.png
public/assets/bcu/<pack>/org/battle/bg/*.imgcut
```

### 9.4 Background entry schema

Each background entry should include:

```json
{
  "key": "background:185",
  "bgId": 185,
  "sourcePack": "000001",
  "metadataSources": [],
  "csv": {
    "skyTop": null,
    "skyBottom": null,
    "groundTop": null,
    "groundBottom": null,
    "imgcutId": null,
    "showUpper": null,
    "imageReferenceId": null,
    "raw": null,
    "sourceFile": null
  },
  "selected": {
    "image": null,
    "imgcut": null
  },
  "candidates": {
    "images": [],
    "imgcuts": []
  },
  "bundleRef": {
    "bundleKey": "background:185",
    "bundlePath": "public/assets/bundles/background/185.zip",
    "readMode": "zip"
  },
  "missing": [],
  "warnings": [],
  "diagnostics": {
    "sourceRawPaths": []
  }
}
```

### 9.5 Background selection rules

1. Prefer metadata-backed resolution from `bg.csv` / JSON where available.
2. Respect `imageReferenceId`.
3. Respect `imgcutId`.
4. Preserve all candidate images and imgcuts.
5. If metadata is absent, fallback to filename-based candidates but mark warning.
6. Do not assume `bgId === imageId`.
7. Do not assume `bgXXX.png` and `bgXX.imgcut` use the same numeric width or same number of digits.

---

## 10. Castle semantic index contract

### 10.1 Script

```text
scripts/build-bcu-castle-index.mjs
```

### 10.2 Output

```text
public/assets/generated/bcu-castle-index.json
```

### 10.3 Scope

Enemy castles:

```text
public/assets/bcu/<pack>/org/img/rc/*.png
public/assets/bcu/<pack>/org/img/ec/*.png
public/assets/bcu/<pack>/org/img/wc/*.png
public/assets/bcu/<pack>/org/img/sc/*.png
```

Nyanko/cat castles:

```text
public/assets/bcu/<pack>/org/castle/**/*
```

### 10.4 Enemy castle rules

Enemy castle groups:

```text
rc
ec
wc
sc
```

Numeric ID convention:

```text
numericId = groupIndex * 1000 + localCastleId
```

with group order:

```text
rc -> 0
ec -> 1
wc -> 2
sc -> 3
```

### 10.5 Enemy castle entry schema

```json
{
  "key": "enemyCastle:rc000",
  "numericKey": "enemyCastle:0",
  "numericId": 0,
  "group": "rc",
  "groupIndex": 0,
  "localId": 0,
  "localId3": "000",
  "variants": [],
  "selected": {
    "image": null,
    "locale": null,
    "sourcePack": null
  },
  "bundleRef": {
    "bundleKey": "enemyCastle:rc000",
    "bundlePath": "public/assets/bundles/castle/enemy/rc000.zip"
  },
  "warnings": [],
  "diagnostics": {
    "sourceRawPaths": []
  }
}
```

### 10.6 Locale variant rules

Preserve variants such as:

```text
_en
_ko
_tw
```

Selection priority:

1. requested locale variant if known
2. default/no suffix
3. any available fallback
4. report fallback in diagnostics

### 10.7 Nyanko castle rules

Nyanko/cat castle assets must be indexed separately.

Do not merge with enemy castle entries.

---

## 11. Bundle generation contract

### 11.1 Script

```text
scripts/build-bcu-semantic-bundles.mjs
```

### 11.2 Output

```text
public/assets/bundles/**
public/assets/generated/bcu-bundle-manifest.json
public/assets/generated/bcu-diagnostics.json
```

### 11.3 Bundle manifest schema

```json
{
  "schemaVersion": 1,
  "generatedAt": "1970-01-01T00:00:00.000Z",
  "bundles": {
    "actor:enemy:186": {
      "kind": "actor",
      "key": "enemy:186",
      "bundlePath": "public/assets/bundles/actor/enemy/186.zip",
      "status": "full",
      "sizeBytes": 0,
      "hash": null
    }
  }
}
```

### 11.4 Actor bundle format

Actor bundles must contain:

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

Only include files that exist.

Full actor bundles must include all required runtime files.

Partial bundles may omit missing files but `bundle.json` must contain:

```json
{
  "status": "partial",
  "missing": ["idle", "kb"],
  "fallbackPolicy": "raw-fallback-or-runtime-policy"
}
```

### 11.5 Stage map bundle format

Group stage bundles by:

```text
packId + category + groupDir
```

unless a better stable grouping is explicitly implemented and documented.

Stage map bundles must contain:

```text
bundle.json
<stage csv files>
```

`bundle.json` must list included stage keys and internal paths.

Internal paths must be unique inside the ZIP. If basenames collide within a bundle group, preserve a relative path or deterministic disambiguated path such as:

```text
StageRNA/stageRNA001_00.csv
stageRNA001_00__000001__A__StageRNA.csv
```

Do not let later files overwrite earlier files in the same bundle.

### 11.6 Background bundle format

Background bundles must contain:

```text
bundle.json
metadata.json
image.png
imgcut.imgcut
```

Only include files that exist.

If image or imgcut is missing, bundle may be partial but must report missing files.

### 11.7 Castle bundle format

Castle bundles must contain:

```text
bundle.json
image.png
```

For locale variants, either:

1. include only selected image and preserve variants in index, or
2. include all variants and record selected/default in `bundle.json`

Document the choice.

### 11.8 Bundle size limits

No generated bundle should exceed:

```text
50 MB
```

If a bundle would exceed 50 MB:

- split it deterministically
- report split in `bcu-diagnostics.json`
- update `bcu-bundle-manifest.json`

Never create a bundle exceeding GitHub's hard file limits.

---

## 12. Runtime provider contract

### 12.1 Required file

Add or update:

```text
js/bcu/SemanticAssetProvider.js
```

### 12.2 Required capabilities

The provider must:

- load `public/assets/generated/bcu-bundle-manifest.json`
- load generated semantic indexes
- fetch bundles
- cache bundle fetch promises
- cache parsed bundle archives
- read bundle internal files as text
- read bundle internal files as `Blob`
- read bundle internal files as `ArrayBuffer`
- create object URLs for images
- revoke/clear object URLs
- support explicit raw fallback only when `allowRawFallback === true`
- emit diagnostics for bundle source/fallback source

### 12.3 Required API

Provide APIs equivalent to:

```js
await provider.load();

await provider.readTextByBundleRef(bundleRef);
await provider.readBlobByBundleRef(bundleRef);
await provider.readArrayBufferByBundleRef(bundleRef);

await provider.readActorBundle(actorKey);
await provider.readStageCsv(stageKey);
await provider.readBackgroundBundle(backgroundKey);
await provider.readCastleBundle(castleKey);

provider.clearObjectUrls();
```

Exact method names may differ if documented and used consistently.

### 12.4 Zip dependency and ZIP format rule

Prefer existing project dependencies if available.

If adding a new dependency is necessary:

- document the reason
- update package files
- ensure Codex/test environment can install/use it
- do not depend on network access at runtime

If dependency installation is not reliable, implement a minimal zip reader and make generated ZIP files compatible with it.

The ZIP format must be explicit. Choose one of these approaches and document it:

1. generated ZIPs use STORE/no-compression only, and the project includes a minimal STORE-only ZIP reader, or
2. generated ZIPs use DEFLATE, and the project includes a tested DEFLATE-capable reader, either vendored or dependency-based.

Do not generate compressed ZIPs unless the browser runtime can actually read them.

---

## 13. Runtime integration contract

### 13.1 BcuBootLoader / BcuAssetDatabase

`BcuBootLoader` must initialize or expose semantic index/provider support.

`BcuAssetDatabase` should expose semantic indexes and provider access in a stable way.

### 13.2 BcuAssetLoader

`BcuAssetLoader` must prefer actor semantic bundles when an actor has a semantic key.

Loading order:

1. semantic actor bundle
2. explicit raw fallback if `allowRawFallback === true`
3. diagnostic failure

Preserve existing parsers for:

```text
imgcut
mamodel
maanim
```

Do not replace parser semantics during bundle migration.

### 13.3 StageRegistry

`StageRegistry` must use generated stage index as primary source.

Resolution order:

1. exact stage key
2. exact stage ID
3. non-conflicting alias
4. explicit legacy fallback, if enabled
5. default semantic stage

Do not silently resolve conflicting aliases.

### 13.4 StageDefinitionLoader

Stage loading should accept semantic stage entries.

Preferred flow:

```text
stageKey -> SemanticAssetProvider.readStageCsv(stageKey) -> parse(text, logicalPath)
```

Legacy `stageCsvPath` may remain only as explicit fallback.

### 13.5 StageBackgroundLoader

Background loading should use semantic background index and provider.

Preferred flow:

```text
background:<bgId> -> background bundle -> metadata/image/imgcut
```

Raw path fallback must be explicit.

### 13.6 BcuCastleAssetLoader

Castle loading should use semantic castle index and provider.

Preferred flow:

```text
enemyCastle:<key> -> castle bundle -> image
```

Raw path fallback must be explicit.

### 13.7 Migration runtime mode

Until full bundles are committed or hosted, runtime must support an explicit migration mode.

Allowed modes:

```text
semantic-only
semantic-with-raw-fallback
legacy-raw
```

Default mode must not break the currently deployed app.

`semantic-only` is the final goal.
`semantic-with-raw-fallback` is allowed during migration and must emit diagnostics.
`legacy-raw` is allowed only as a temporary compatibility mode.

The selected mode must be visible in debug diagnostics.

---

## 14. Raw path prohibition check

### 14.1 Script

```text
scripts/check-no-raw-runtime-paths.mjs
```

### 14.2 Must fail on primary runtime usage of:

```text
./public/assets/bcu/
public/assets/bcu/000001
public/assets/bcu/000002
public/assets/bcu/000004
stageCsvPath: './public/assets/bcu/
baseDir: './public/assets/bcu/
fetch('./public/assets/bcu/
new Image().src = './public/assets/bcu/
```

### 14.3 Allowed locations

Raw paths are allowed in:

```text
scripts/
public/assets/generated/* as sourceRawPath or diagnostics
docs/
AGENTS.md
explicit fallback code guarded by allowRawFallback
```

The checker must distinguish primary runtime hardcoding from explicit migration fallback.

---

## 15. Required verification commands

The implementation is not complete unless these commands pass:

```bash
node scripts/build-bcu-manifest.mjs
node scripts/audit-bcu-assets.mjs
node scripts/build-bcu-canonical-index.mjs
node scripts/build-bcu-actor-index.mjs
node scripts/build-bcu-stage-index.mjs
node scripts/build-bcu-background-index.mjs
node scripts/build-bcu-castle-index.mjs
node scripts/build-bcu-semantic-bundles.mjs
node scripts/check-bcu-semantic-bundles.mjs
node scripts/check-no-raw-runtime-paths.mjs
node scripts/check-battle-scene-stage-runtime-wiring.mjs
node scripts/check-stage-asset-tracing.mjs
node scripts/check-bcu-stage-spawn-runtime.mjs
node scripts/check-battle-attack-timeline.mjs
```

If an existing check is outdated, update the check or clearly document why it cannot apply.

Do not claim success while required checks fail.

---

## 16. Documentation requirements

Update:

```text
docs/bcu-migration-status.md
```

with:

- generated index list
- generated bundle families
- full/partial actor counts
- known partial actor entries
- stage duplicate/alias conflict counts
- background missing/candidate counts
- castle variant/fallback counts
- raw fallback status
- exact validation command results
- unresolved risks
- manual browser verification checklist

---

## 17. Definition of Done

A semantic bundle migration PR is complete only if:

1. `public/assets/bcu/` remains untouched.
2. Every raw file is represented in audit output.
3. Generated semantic indexes exist.
4. Actor, stage, background, and castle indexes exist.
5. Semantic bundle manifest exists.
6. Semantic bundles exist or sample bundles exist with full generator support documented.
7. Runtime can load actor assets through semantic provider.
8. Runtime can resolve stage entries through generated stage index.
9. Runtime fallback to raw paths is explicit and diagnostic.
10. Primary runtime hardcoded raw BCU paths are removed or guarded.
11. All required checks pass or documented blockers are honest and specific.
12. `docs/bcu-migration-status.md` is updated.

---

## 18. Implementation priority

When constraints conflict, prioritize:

1. correctness of semantic mapping
2. preserving raw source assets
3. explicit diagnostics
4. runtime compatibility
5. deterministic generation
6. performance
7. repository size
8. code brevity

Never sacrifice correctness for fewer files, shorter code, or a cleaner-looking bundle layout.

---

## 19. Codex task instruction

When assigned this migration, implement this contract in one PR if feasible.

If the full PR becomes too large because of generated ZIP files, still implement:

- all scripts
- all semantic indexes
- runtime provider
- runtime integration
- checks
- documentation
- representative sample bundles

Then document the exact command to generate full bundles locally.

Do not stop after writing only a plan.

Do not remove raw assets.

Do not silently skip unknown assets.

Do not mark partial assets as full.

Do not use raw BCU paths as primary runtime paths.

Do not claim completion unless checks were run and results are documented.
