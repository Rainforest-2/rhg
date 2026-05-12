# AGENTS.md — BCU ZIP Runtime Regression Fix Contract

Repository: `rhgrive2/game`

This file is the working contract for Codex and future agents working on the Battle Cats Ultimate / BCU runtime migration.

This task is not a “file exists” check. It is a user-facing regression fix.

The user-facing regressions are:

1. Battle worked before ZIP migration, but now Battle can fail or bug after ZIP migration.
2. After loading, the app becomes too heavy to operate normally.
3. Some PNG icons/images inside generated ZIPs are corrupted or unreadable.
4. The 10 selected Formation slots do not show card images.
5. Safari/WebKit sometimes shows only `Error {}` and hides the real failure.
6. Some runtime paths still risk raw `public/assets/bcu/**` access.
7. BCU parity is structurally incomplete: stage runtime, spawn runtime, actor runtime, proc runtime, and rendering responsibilities are still too monolithic.

The goal is:

```text
Battle starts.
Formation remains responsive.
Icons render correctly.
Selected 10 Formation slots show images.
No runtime raw BCU reads occur in semantic-strict.
Broken PNGs are detected before runtime.
Bundle failures produce actionable diagnostics.
```

Do not modify GitHub branches, commits, or pull requests unless the user explicitly asks.

---

## 0. Mandatory first step: read the real sources

Before making changes, inspect the actual current repository files and BCU reference sources.

### 0.1 Current game code to inspect

At minimum, read these current repo files:

```text
AGENTS.md

js/bcu/SemanticAssetProvider.js
js/bcu/BcuBootLoader.js
js/bcu/BcuAssetLoader.js
js/bcu/RuntimeAssetGuard.js

js/ui/FormationEditor.js
js/ui/PlayerProductionBar.js
js/battle/CharacterCatalog.js

js/battle/BattleScene.js
js/battle/BattleActorFactory.js
js/battle/BattleConfig.js
js/battle/BcuKbeffLoader.js
js/battle/StageBackgroundLoader.js
js/battle/BcuCastleAssetLoader.js
js/battle/StageDefinitionLoader.js
js/battle/BcuStageSpawnRuntime.js

scripts/bcu-semantic-utils.mjs
scripts/audit-bcu-icon-sources.mjs
scripts/build-bcu-icon-index.mjs
scripts/build-bcu-icon-bundles.mjs
scripts/build-bcu-semantic-bundles.mjs
scripts/check-icon-bundles-are-aggregated.mjs
scripts/check-icon-bundles-never-load-actor-bundles.mjs
scripts/check-production-icons-use-icon-bundles.mjs
scripts/check-bundled-assets-never-load-raw.mjs

public/assets/generated/bcu-icon-source-audit.json
public/assets/generated/bcu-icon-index.json
public/assets/generated/bcu-bundle-manifest.json
public/assets/generated/bcu-actor-index.json
public/assets/generated/bcu-core-index.json

public/assets/bundles/icon/enemy.zip
public/assets/bundles/icon/unit-f.zip
public/assets/bundles/icon/unit-c.zip
public/assets/bundles/icon/unit-s.zip
public/assets/bundles/icon/unit-u.zip
public/assets/bundles/effect/kbeff.zip

docs/bcu-migration-status.md
```

Important:

- GitHub API may show `content: ""` for large generated files.
- That does not mean the files are empty.
- For heavy generated JSON and ZIP files, inspect raw URLs or local files.
- Never conclude “generated is empty” from API preview alone.

### 0.2 BCU reference sources to inspect

Use local uploaded/source copies where available.

Read and use the BCU common / BCU PC source structure as reference:

```text
BCU common:
util/stage/Stage.java
util/stage/SCDef.java
util/stage/EStage.java
battle/StageBasis.java
battle/entity/Entity.java
battle/attack/*
common/util/anim/* or util/anim/*

BCU PC:
page/battle/BattleBox.java
```

Use these references for intent and responsibility boundaries.

Do not blindly rewrite everything at once, but do not ignore BCU structure either.

---

## 1. Non-negotiable correction: generated files and bundles are not empty

Generated indexes, generated manifests, and bundles are not empty.

Do not regress into these incorrect assumptions:

```text
public/assets/generated/* is empty
public/assets/bundles/* is empty
Battle fails because generated manifests are empty
ZIP migration is not implemented at all
```

The real state is:

```text
ZIP migration is partially implemented.
The runtime is still buggy/heavy.
Some generated icon PNGs are corrupt.
Some runtime paths are still wrong.
Some diagnostics are too weak.
Some UI paths do not load icons correctly.
```

---

# P0-A. Fix corrupted PNGs inside icon ZIPs

## Problem

Some generated aggregate icon ZIPs contain PNG entries that exist by name but are broken or unreadable.

Observed user report:

```text
ネコ軍: ZIP内のPNG自体がランダムに壊れている。
ワンコ軍: enemy_icon_<id>.png を使用してほしい。
          526番から形式が変わってしまっている。
```

This means the current generator must not trust source paths blindly.

The pipeline must prove that every PNG written into an icon ZIP is browser-readable enough for runtime display.

## Current risky behavior to inspect

In `scripts/build-bcu-icon-bundles.mjs`, check whether it silently does:

```js
data: await fileBufferOrNull(entry.sourcePath)
...
.filter((e) => e.data)
```

This can silently skip missing files and produce a mismatch:

```text
bcu-icon-index.json points to internalPath
bundle.json lists internalPath
but ZIP does not actually contain the PNG
```

That is forbidden.

## Required fix

Add strict PNG validation before an image can be included in any icon ZIP.

Validation must happen at build/audit time, not only at runtime.

At minimum validate:

```text
PNG signature: 89 50 4E 47 0D 0A 1A 0A
IHDR exists and is first chunk
IHDR length is 13
chunk boundaries do not exceed file length
IEND exists
IEND ends at file end or only valid trailing policy is explicitly documented
width > 0
height > 0
bitDepth/colorType combination is known browser-compatible
```

Prefer also verifying CRC for chunks.

If a file fails validation, mark it as:

```text
invalid-png
```

and do not place it into the icon ZIP.

Do not silently fall back to actor `image.png`.

Do not silently include corrupt PNG bytes.

## Required scripts

Add or update:

```text
scripts/check-icon-png-integrity.mjs
scripts/check-icon-index-paths-exist-in-zips.mjs
```

### `check-icon-png-integrity.mjs`

Must inspect:

```text
public/assets/bundles/icon/enemy.zip
public/assets/bundles/icon/unit-f.zip
public/assets/bundles/icon/unit-c.zip
public/assets/bundles/icon/unit-s.zip
public/assets/bundles/icon/unit-u.zip
```

For every `.png` inside these ZIPs:

```text
validate PNG structure
report corrupted entries
fail if any corrupt PNG exists
```

### `check-icon-index-paths-exist-in-zips.mjs`

Must verify:

```text
for every bcu-icon-index.json entry:
  bundleRef.bundlePath exists
  internalPath exists inside that ZIP
  internalPath points to valid PNG bytes
```

If any index entry points to a missing or corrupt PNG, fail.

## Required generated diagnostics

Update `public/assets/generated/bcu-icon-source-audit.json` to include for each record:

```json
{
  "semanticKey": "unit:123:f",
  "currentSourcePath": "public/assets/bcu/...",
  "desiredSourcePath": "public/assets/bcu/...",
  "status": "ok|needs-remap|missing|ambiguous|invalid-png",
  "pngValidation": {
    "valid": true,
    "reason": null,
    "width": 128,
    "height": 128,
    "sizeBytes": 12345,
    "signature": "89504e470d0a1a0a"
  },
  "notes": []
}
```

For invalid images:

```json
{
  "status": "invalid-png",
  "pngValidation": {
    "valid": false,
    "reason": "bad-signature|missing-ihdr|missing-iend|truncated-chunk|invalid-dimensions|crc-failed"
  }
}
```

## Required generator behavior

`build-bcu-icon-index.mjs` must include only valid sources.

`build-bcu-icon-bundles.mjs` must fail if an index entry has:

```text
missing sourcePath
invalid PNG
unreadable PNG
missing internalPath after ZIP write
```

The generator must not do this for icon entries:

```js
.filter((e) => e.data)
```

unless it also removes the corresponding index entry before writing `bcu-icon-index.json`.

The final invariant must be:

```text
Every bcu-icon-index entry resolves to an actual valid PNG inside its aggregate ZIP.
```

---

# P0-B. Fix enemy/dog icon source selection

## Problem

Enemy/dog icons must use:

```text
enemy_icon_<id3>.png
```

The previous assumption that `000010` always contains the correct enemy icon is incomplete.

User report:

```text
ワンコ軍に関しては enemy_icon_<id>.png を使用するようにしてほしい。
526番から形式が変わってしまっている。
```

## Required rule

For every enemy actor key:

```text
enemy:<id>
```

The preferred icon basename is:

```text
enemy_icon_<id3>.png
```

Example:

```text
enemy:0   -> enemy_icon_000.png
enemy:525 -> enemy_icon_525.png
enemy:526 -> enemy_icon_526.png
enemy:777 -> enemy_icon_777.png
```

Do not use these as final enemy UI icons if a valid `enemy_icon_<id3>.png` exists:

```text
edi_<id>.png
edi_<id3>.png
actor image.png
sprite sheet image.png
000002/000003 current icon fallback
```

## Pack search policy

Search all available BCU raw packs for:

```text
public/assets/bcu/<pack>/org/enemy/<id3>/enemy_icon_<id3>.png
```

Do not hardcode only `000010`.

Pack selection must be deterministic.

Recommended priority:

1. Valid `enemy_icon_<id3>.png` in the same pack family as the selected actor runtime source, if available.
2. Valid `enemy_icon_<id3>.png` in the newest/highest numeric pack.
3. Valid `enemy_icon_<id3>.png` in `000010`, if available and not superseded by rule 1/2.
4. Missing placeholder.

For IDs below 526, `000010` may often be correct.
For IDs 526 and above, do not assume `000010`; use the discovered valid `enemy_icon_<id3>.png`.

## Required audit output

Enemy audit records must show:

```json
{
  "semanticKey": "enemy:526",
  "currentSourcePath": "...",
  "desiredSourcePath": "public/assets/bcu/<pack>/org/enemy/526/enemy_icon_526.png",
  "status": "ok|needs-remap|missing|invalid-png",
  "notes": [
    "enemy-icon-basename-policy",
    "enemy-id-526-new-format"
  ]
}
```

If no valid `enemy_icon_<id3>.png` exists, do not use `edi_*.png` unless the user explicitly approves fallback.

For now, missing enemy icons should be omitted from `bcu-icon-index.json` and shown as image-missing placeholder.

---

# P0-C. Fix unit/cat icon corruption

## Problem

Unit/cat icon PNGs are randomly corrupted inside generated ZIPs.

This must be treated as a build pipeline/data validation bug, not a runtime rendering problem.

## Required rule

Unit icon source selection must validate the actual file bytes before inclusion.

For every unit icon source:

```text
unit:<id>:f
unit:<id>:c
unit:<id>:s
unit:<id>:u
```

The audit/generator must:

1. collect candidate icon paths from actor index and raw manifest,
2. validate each candidate PNG,
3. choose the first valid browser-readable PNG by deterministic priority,
4. mark invalid candidates,
5. omit missing/invalid records from runtime index,
6. never write invalid PNG bytes into aggregate icon ZIP.

## Candidate priority

For unit icons, deterministic priority should be:

1. explicit selected icon source if valid,
2. known unit icon candidate matching unit id + form if valid,
3. later/newer pack candidate if valid,
4. placeholder.

Do not use actor sprite sheet `image.png` as catalog-wide UI icon fallback.

## Required check

After bundle generation, inspect every PNG inside:

```text
unit-f.zip
unit-c.zip
unit-s.zip
unit-u.zip
```

and fail if any invalid PNG exists.

---

# P0-D. Fix selected Formation 10-slot icon display

## Problem

The selected Formation slot area, the 10 cards currently selected by the user, can fail to show images.

Likely current cause:

```text
Selected slot imgs have data-semantic-icon.
resolveSemanticIcons() sends all imgs through one IntersectionObserver.
The observer root is .formation-catalog-scroll.
Selected slots are outside .formation-catalog-scroll.
Therefore they may never intersect the root.
Therefore getActorUiIconUrl() may never run for slot imgs.
```

## Required fix

Selected Formation slots must not depend on the catalog scroll observer.

In `js/ui/FormationEditor.js`:

- Catalog images may use lazy IntersectionObserver.
- Selected slot images must load immediately or via a separate observer with `root: null`.
- Slot icons must call `provider.getActorUiIconUrl(key)` directly.
- Slot icon loading must run after every selection change and rerender.
- Slot icon rendering must not depend on catalog card image state.
- Slot icon rendering must not depend on whether the catalog card is currently visible.

Required implementation shape:

```js
resolveSemanticIcons() {
  resolveSelectedSlotIconsImmediately();
  observeCatalogIconsOnly();
}
```

Slot selector should target something like:

```js
'.formation-slots img[data-semantic-icon]'
```

Catalog selector should target something like:

```js
'.formation-catalog-grid img[data-semantic-icon]'
```

Do not observe selected slot imgs with root `.formation-catalog-scroll`.

## Required retry behavior

Do not set:

```js
img.dataset.iconResolved = '1'
```

before the image actually succeeds.

If an image load fails:

- remove or reset the pending/resolved marker,
- delete rejected work cache for that key,
- allow retry on rerender,
- record diagnostics.

Do not permanently cache rejected icon promises.

---

# P0-E. Fix Formation heaviness with catalog memoization and virtualized DOM

## Problem

After loading, the UI becomes too heavy to operate.

This is not solved only by aggregate icon ZIPs.

Likely heavy paths to inspect:

```text
js/battle/CharacterCatalog.js
js/ui/FormationEditor.js
```

Known danger pattern:

```js
function activeCatalog() {
  const db = globalThis.__BCU_DB__ || null;
  return db ? buildCharacterCatalog({ bcuDb: db, locale: db.locale }) : CHARACTER_CATALOG;
}
```

If `activeCatalog()` rebuilds the BCU catalog every time, then calls such as:

```text
getCharactersByFaction()
getAvailableCharacters()
getCharacterById()
getCharacterBaseId()
```

can repeatedly rebuild the entire catalog.

`FormationEditor.renderDynamic()` may call these functions many times during one render.

This can become extremely heavy after ZIP migration.

## Required fix 1: memoize CharacterCatalog

In `js/battle/CharacterCatalog.js`, cache the built catalog by:

```text
bcuDb object identity
locale
catalog revision/version if available
```

Build indexes once:

```text
byId
byFaction
byBaseId
available
```

Required behavior:

```js
activeCatalog()
```

must not rebuild on every call if the DB and locale have not changed.

## Required fix 2: avoid per-card global catalog lookup

In `FormationEditor.renderDynamic()`:

Do not call expensive functions per card if the data is already on the character record.

Avoid patterns like:

```js
usedBaseIds.has(getCharacterBaseId(c.characterId))
```

inside a loop over all catalog entries.

Instead, ensure each catalog entry contains:

```text
characterId
baseCharacterId
semanticKey
faction
form
```

Then use:

```js
const baseId = c.baseCharacterId || c.characterId;
```

## Required fix 3: virtualize catalog DOM

Rendering every catalog card at once is not acceptable for large BCU rosters.

Implement catalog virtualization/windowing.

Required behavior:

- render only visible rows/cards plus overscan,
- keep scroll height correct with spacer elements,
- do not create DOM nodes for every actor at once,
- do not create blob URLs for offscreen icons,
- do not decode offscreen images,
- preserve search/filter behavior,
- preserve selected state,
- preserve keyboard/mouse selection behavior.

Suggested structure:

```text
FormationCatalogVirtualList
  - sourceItems
  - rowHeight/cardHeight estimate
  - visibleStart
  - visibleEnd
  - overscan
  - topSpacer
  - bottomSpacer
  - renderedItems
```

If creating a new class is too large, implement the same behavior inside `FormationEditor` cleanly.

## Required fix 4: batch DOM and icon work

Use:

```text
requestAnimationFrame
small batches
icon decode concurrency = 6 or less
```

Avoid a single long main-thread task during Formation render.

## Required performance instrumentation

Add simple diagnostics:

```js
performance.mark('formation-render-start');
performance.mark('formation-render-end');
performance.measure('formation-render', 'formation-render-start', 'formation-render-end');
```

Record or log:

```text
catalog item count
rendered DOM card count
icon queue size
visible icon count
actor ZIP resource count before Battle Apply
icon ZIP resource names
raw BCU resource count
long task count if PerformanceObserver supports it
```

---

# P0-F. Fix Battle regression after ZIP migration

## Problem

Battle worked before ZIP migration. After ZIP migration, Battle can fail or bug.

This is a regression and must be handled as P0.

## Required diagnosis

On Battle Apply, identify the exact failing subsystem:

```text
actor bundle
actor animation
background bundle
castle bundle
stage bundle
KBEff bundle
raw asset guard
ZIP parse
missing PNG
missing imgcut
missing mamodel
missing maanim
image decode
```

Do not collapse these into generic `Error {}`.

## Required actor completeness

A battle actor runtime bundle is complete only if it contains:

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

`icon.png` is UI-only.

It is not enough for actor runtime.

## Required actor check script

Add:

```text
scripts/check-actor-bundles-complete.mjs
```

This must verify every actor bundle referenced by `bcu-actor-index.json`.

For each actor bundle:

```text
image.png exists and is valid PNG
imgcut.imgcut exists
model.mamodel exists
move.maanim exists
idle.maanim exists
attack.maanim exists
kb.maanim exists
```

Report:

```text
semanticKey
bundlePath
missingEntries
invalidPngEntries
source paths
```

Fail if a battle-loadable actor bundle is incomplete.

## Required runtime behavior

`BattleActorFactory` must not treat an actor template as spawn-ready/full-visual if required runtime entries are missing.

If `attack.maanim`, `kb.maanim`, `idle.maanim`, or `move.maanim` is missing, the failure must be explicit.

Do not allow:

```text
actor image/model loaded
animation missing
template still considered ready
battle bugs later
```

## Required diagnostics

Actor load failures must include:

```js
{
  kind: 'actor',
  semanticKey,
  bundlePath,
  internalPath,
  missingEntries,
  invalidEntries,
  originalErrorName,
  originalErrorMessage,
  message
}
```

Animation load failures must include:

```js
{
  kind: 'actor-animation',
  semanticKey,
  role,
  bundlePath,
  internalPath,
  missingEntries,
  originalErrorName,
  originalErrorMessage,
  message
}
```

---

# P0-G. KBEff must stay semantic or gated

KBEff raw paths are known:

```text
public/assets/bcu/000001/org/battle/a/000_a.png
public/assets/bcu/000001/org/battle/a/000_a.imgcut
public/assets/bcu/000001/org/battle/a/kb.mamodel
public/assets/bcu/000001/org/battle/a/kb_hb.maanim
public/assets/bcu/000001/org/battle/a/kb_sw.maanim
public/assets/bcu/000001/org/battle/a/kb_ass.maanim
```

In `semantic-strict`, these must not be fetched.

Required semantic bundle:

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

If KBEff semantic bundle is missing, strict runtime must either:

```text
disable/gate KBEff safely
```

or throw a clear bundle error.

It must not silently raw fallback.

---

# P0-H. Safari/WebKit error detail

Safari may display only:

```text
Error {}
```

Required detailed logs in:

```text
js/preview/PreviewApp.js
js/ui/FormationEditor.js
```

For apply failures:

```js
console.error('[PreviewApp] applyFormationToBattle failed detail', {
  name: e?.name,
  message: e?.message,
  stack: e?.stack,
  cause: e?.cause,
  error: e
});
```

Formation apply failures must log the same shape.

UI hint must show:

```js
err?.message || String(err)
```

Icon failures should log:

```js
console.error('[FormationEditor] icon load failed detail', {
  key,
  name: err?.name,
  message: err?.message,
  stack: err?.stack,
  cause: err?.cause,
  error: err
});
```

---

# 3. Aggregated icon ZIP contract

## 3.1 Rejected design

Do not generate one ZIP per icon:

```text
public/assets/bundles/icon/enemy/<id3>.zip
public/assets/bundles/icon/unit/<id3>-<form>.zip
```

This causes many downloads and defeats the purpose.

## 3.2 Required design

Use only aggregate icon ZIPs:

```text
public/assets/bundles/icon/enemy.zip
public/assets/bundles/icon/unit-f.zip
public/assets/bundles/icon/unit-c.zip
public/assets/bundles/icon/unit-s.zip
public/assets/bundles/icon/unit-u.zip
```

`unit-u.zip` is required when `u` form icons exist.

## 3.3 Required internal paths

Enemy:

```text
enemy/000.png
enemy/001.png
enemy/002.png
...
```

Unit:

```text
unit/000-f.png
unit/001-f.png

unit/000-c.png
unit/001-c.png

unit/000-s.png
unit/001-s.png

unit/000-u.png
unit/001-u.png
```

## 3.4 Required index

`public/assets/generated/bcu-icon-index.json` must map each semantic key to:

```json
{
  "key": "enemy:526",
  "kind": "enemy",
  "bundleRef": {
    "bundleKey": "icon:enemy",
    "bundlePath": "public/assets/bundles/icon/enemy.zip"
  },
  "internalPath": "enemy/526.png",
  "sourcePath": "public/assets/bcu/<pack>/org/enemy/526/enemy_icon_526.png",
  "sourceStatus": "audited"
}
```

Unit example:

```json
{
  "key": "unit:0:u",
  "kind": "unit",
  "form": "u",
  "bundleRef": {
    "bundleKey": "icon:unit:u",
    "bundlePath": "public/assets/bundles/icon/unit-u.zip"
  },
  "internalPath": "unit/000-u.png",
  "sourcePath": "public/assets/bcu/...",
  "sourceStatus": "audited"
}
```

---

# 4. Runtime icon provider contract

Update:

```text
js/bcu/SemanticAssetProvider.js
```

Required APIs:

```js
await provider.getActorUiIconUrl(actorKey);
await provider.readIconBundle(actorKey);
```

`getActorUiIconUrl(actorKey)` must:

1. use `bcu-icon-index.json`,
2. open aggregate icon ZIP only,
3. read the indexed PNG path,
4. create and cache blob URL by actor key,
5. reuse parsed archive,
6. never open actor bundle for UI icon fallback,
7. never fetch `public/assets/bcu/**`,
8. record structured diagnostics on missing/corrupt icons.

Required icon failure diagnostic:

```js
{
  kind: 'icon',
  semanticKey: actorKey,
  bundlePath,
  internalPath,
  missingEntries: [internalPath],
  invalidEntries: [],
  originalErrorName,
  originalErrorMessage,
  message
}
```

---

# 5. Required cache behavior

In `SemanticAssetProvider`:

```js
this.bundleArchivePromises = new Map();
this.coreDbPromise = null;
this.actorUiIconUrlCache = new Map();
```

`archive(bundleRef)` must cache in-flight parse promises.

`readCoreDb()` must be promise-cached.

Failed archive promises must be removed so retry is possible.

Failed icon promises must not be permanently cached.

---

# 6. Strict runtime raw access rule

Forbidden in `semantic-strict` runtime:

```text
public/assets/bcu/**
./public/assets/bcu/**
public/assets/bcu-manifest.json
./public/assets/bcu-manifest.json
public/assets/bundles/icon/enemy/<id3>.zip
public/assets/bundles/icon/unit/<id3>-<form>.zip
```

Allowed:

```text
public/assets/generated/*.json
public/assets/bundles/core/core-db.zip
public/assets/bundles/actor/**/*.zip      # only after Battle Apply / actor preload
public/assets/bundles/icon/enemy.zip
public/assets/bundles/icon/unit-f.zip
public/assets/bundles/icon/unit-c.zip
public/assets/bundles/icon/unit-s.zip
public/assets/bundles/icon/unit-u.zip
public/assets/bundles/effect/kbeff.zip
non-BCU placeholders
```

Before Battle Apply:

```text
Formation display must not request actor bundles.
Formation display must not request raw BCU files.
Formation display must not request one ZIP per icon.
```

---

# 7. BCU structural migration requirements

These are not all P0, but they must guide all fixes.

## 7.1 BCU stage runtime structure

BCU common separates:

```text
Stage
SCDef
EStage
StageBasis
```

Current game code must move toward equivalent responsibility boundaries:

```text
StageDefinition
StageRuntime
SpawnScheduleRuntime
BattleScene orchestration
```

Do not keep all stage/spawn/combat/effect/camera logic inside `BattleScene`.

## 7.2 Preserve SCDef.Line fields

BCU `SCDef.Line` includes:

```text
enemy
number
boss
multiple
group
spawn_0
spawn_1
respawn_0
respawn_1
castle_0
castle_1
layer_0
layer_1
mult_atk
kill_count
score
```

Do not discard these during parsing.

Required future direction:

```text
StageDefinitionLoader preserves these fields.
SpawnScheduleRuntime consumes them explicitly.
```

## 7.3 BattleScene must be split

Target responsibility split:

```text
StageDefinition
StageRuntime
SpawnScheduleRuntime
ProductionRuntime
ActorRuntime
AttackTimeline
DamageCalculator
ProcResolver
RenderTransform
CameraTransform
```

`BattleScene` should orchestrate, not own all logic.

## 7.4 Proc runtime is incomplete

BCU common `Proc` covers many effects:

```text
KB
STOP
SLOW
CRIT
WAVE
MINI WAVE
VOLCANO / SURGE
WEAK
BREAK
SHIELD BREAK
WARP
CURSE
POISON
```

Current `AbilityModel` / `DamageAbilityResolver` must not drop fields simply because runtime does not consume them yet.

Introduce or expand:

```text
ProcResolver
AttackTimeline
DamageCalculator
ActorRuntime
```

as separate migration tasks after P0 regressions are fixed.

---

# 8. Required verification commands

Add or update scripts so these commands exist and pass:

```bash
node scripts/audit-bcu-icon-sources.mjs
node scripts/build-bcu-icon-index.mjs
node scripts/build-bcu-icon-bundles.mjs
node scripts/check-icon-png-integrity.mjs
node scripts/check-icon-index-paths-exist-in-zips.mjs
node scripts/check-icon-bundles-are-aggregated.mjs
node scripts/check-icon-bundles-never-load-actor-bundles.mjs
node scripts/check-formation-icons-use-icon-bundles.mjs
node scripts/check-production-icons-use-icon-bundles.mjs
node scripts/check-bundled-assets-never-load-raw.mjs
node scripts/check-actor-bundles-complete.mjs
```

If `build-bcu-semantic-bundles.mjs --all` is the top-level command, it must run the icon audit/index/bundle steps in the correct order:

```text
audit icon sources
build icon index from valid audited records
build aggregate icon bundles
verify icon PNG integrity
verify index paths exist inside ZIPs
update manifest
```

---

# 9. Browser verification requirements

Use browser automation or manual DevTools verification.

Before Battle Apply, after opening Formation:

Expected resources:

```text
public/assets/generated/*.json
public/assets/bundles/core/core-db.zip
public/assets/bundles/icon/enemy.zip
public/assets/bundles/icon/unit-f.zip
public/assets/bundles/icon/unit-c.zip
public/assets/bundles/icon/unit-s.zip
public/assets/bundles/icon/unit-u.zip
```

Only needed unit form ZIPs may be requested.

Not expected:

```text
public/assets/bundles/actor/**/*.zip
public/assets/bundles/icon/enemy/*.zip
public/assets/bundles/icon/unit/*.zip
public/assets/bcu/**
public/assets/bcu-manifest.json
```

Console verification:

```js
const p = globalThis.__BCU_DB__?.semanticProvider;

console.log('mode', p?.mode);
console.log('bundleErrors', p?.diagnostics?.bundleErrors);
console.log('blockedRawReads', p?.diagnostics?.blockedRawReads);
console.log('rawFallbacks', p?.diagnostics?.rawFallbacks);

console.log(
  'actor zip resources',
  performance.getEntriesByType('resource')
    .filter(e => e.name.includes('/bundles/actor/'))
    .length
);

console.log(
  'icon zip resources',
  performance.getEntriesByType('resource')
    .filter(e => e.name.includes('/bundles/icon/'))
    .map(e => e.name)
);

console.log(
  'raw bcu resources',
  performance.getEntriesByType('resource')
    .filter(e => e.name.includes('/public/assets/bcu/'))
    .map(e => e.name)
);
```

Expected:

```text
blockedRawReads = []
rawFallbacks = []
actor zip resources = 0 before Battle Apply
raw bcu resources = []
icon zip resources = aggregate ZIPs only
```

Selected slot verification:

```js
[...document.querySelectorAll('.formation-slots img')]
  .map(img => ({
    semantic: img.dataset.semanticIcon,
    src: img.src,
    complete: img.complete,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    missing: img.classList.contains('image-missing')
  }));
```

Expected:

```text
selected slots with valid icon entries have naturalWidth > 0
legitimately missing icons are marked image-missing
no selected slot remains blank due to observer root
```

---

# 10. Documentation requirements

Update:

```text
docs/bcu-migration-status.md
```

Must include:

```text
icon source audit summary
enemy enemy_icon_<id3>.png policy result
enemy 526+ policy result
unit corrupted PNG validation result
invalid PNG count
missing icon count
aggregate icon ZIP list
number of valid PNGs inside each aggregate ZIP
index path -> ZIP entry verification result
Formation selected 10-slot icon verification result
Formation initial actor bundle request count
Formation initial icon bundle request names
raw BCU request count
blockedRawReads count
rawFallbacks count
Battle Apply result
KBEff semantic/gated status
Safari error logging status
archive/coreDb promise-cache status
performance/virtualized DOM summary
```

Do not write “complete” unless these are actually verified.

---

# 11. Definition of Done

Complete only when all are true:

1. Enemy icons use valid `enemy_icon_<id3>.png` sources.
2. Enemy 526+ icons are handled by the same `enemy_icon_<id3>.png` rule.
3. No enemy icon silently falls back to `edi_*.png` when `enemy_icon_<id3>.png` is missing.
4. Unit/cat icon source PNGs are validated before inclusion.
5. Corrupted unit PNGs are excluded and recorded as `invalid-png`.
6. `bcu-icon-source-audit.json/md` records PNG validation status.
7. `bcu-icon-index.json` contains only valid bundled icon entries.
8. Every index `internalPath` exists inside the referenced aggregate ZIP.
9. Every PNG inside aggregate icon ZIPs passes integrity validation.
10. `enemy.zip`, `unit-f.zip`, `unit-c.zip`, `unit-s.zip`, and `unit-u.zip` exist when corresponding icons exist.
11. No one-ZIP-per-icon paths are generated.
12. Formation catalog uses `getActorUiIconUrl()`.
13. Production cards use `getActorUiIconUrl()`.
14. Selected 10 Formation slots show icons independently of catalog lazy observer.
15. Selected 10 slots do not depend on `.formation-catalog-scroll` observer root.
16. Rejected icon loads are not permanently cached.
17. Formation catalog DOM is virtualized/windowed or otherwise proven not to render all cards at once.
18. `CharacterCatalog.activeCatalog()` is memoized.
19. Formation render avoids per-card full catalog rebuild.
20. Formation remains responsive after loading.
21. Formation display does not request actor ZIPs before Battle Apply.
22. Formation display does not request raw `public/assets/bcu/**`.
23. Battle Apply succeeds or fails with precise subsystem diagnostics.
24. Actor bundles are checked for runtime completeness.
25. Actor templates are not marked ready if required animations are missing.
26. KBEff uses semantic bundle or is safely gated.
27. `archive()` and `readCoreDb()` have in-flight promise caching.
28. Safari/WebKit detailed error logging exists.
29. `blockedRawReads = []` after successful runtime flow.
30. `rawFallbacks = []` after successful runtime flow.
31. Verification results are recorded in `docs/bcu-migration-status.md`.

---

# 12. Work order for Codex

Implement in this order:

1. Read all required current code and BCU reference sources.
2. Fix icon source audit:
   - enemy uses `enemy_icon_<id3>.png`,
   - enemy 526+ handled,
   - unit PNGs validated,
   - invalid PNGs recorded.
3. Fix icon index generation:
   - include only valid sources,
   - no silent currentSource fallback for enemy,
   - no invalid/corrupt source entries.
4. Fix icon bundle generation:
   - no silent `.filter(e => e.data)` mismatch,
   - fail on invalid source,
   - write aggregate ZIPs only.
5. Add icon ZIP integrity checks.
6. Fix selected 10 Formation slot icon loading.
7. Fix `CharacterCatalog` memoization and Formation render hot paths.
8. Add/implement catalog virtualization or equivalent DOM windowing.
9. Confirm Formation no longer loads actor ZIPs before Battle Apply.
10. Fix Battle actor completeness checks and animation readiness.
11. Ensure KBEff semantic/gated behavior.
12. Strengthen diagnostics.
13. Run verification commands.
14. Run browser Network/resource verification.
15. Update `docs/bcu-migration-status.md`.

Do not claim completion without verification.

Do not modify GitHub branches, commits, or pull requests unless explicitly asked by the user.
