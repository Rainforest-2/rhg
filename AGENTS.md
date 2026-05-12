# AGENTS.md — BCU Runtime Zip-First Migration Contract

Repository: `rhgrive2/game`

This file is the authoritative working contract for Codex and future agents working on the Battle Cats Ultimate / BCU runtime migration.

The project already has partial semantic bundle infrastructure. Do not restart from the assumption that generated indexes or generated manifests are empty.

Important correction:

- `public/assets/generated/*` and `public/assets/bundles/*` are not empty.
- GitHub API / contents views may show `content: ""` for large generated files. That does not mean the files are empty.
- When in doubt, inspect raw file contents, local ZIP/generated artifacts, and bundle indexes directly.
- The current problem is not “generated manifest is empty”. The current problem is that the runtime still has heavy or wrong read paths, some raw BCU paths remain, and diagnostics are too weak.

Runtime-loadable BCU data must be loaded from generated ZIP bundles and generated semantic indexes, not from `public/assets/bcu/...`.

Raw BCU files may remain as build inputs and diagnostics, but production/browser runtime must not fetch them.

---

## 0. Active current problems Codex must solve

### 0.1 Formation icons currently load too much

Current behavior to check in `js/ui/FormationEditor.js` and `js/bcu/SemanticAssetProvider.js`:

- `FormationEditor.renderDynamic()` renders all visible catalog card HTML.
- It then calls `resolveSemanticIcons()`.
- `resolveSemanticIcons()` walks every `img[data-semantic-icon]` under the formation UI.
- For each unresolved image it calls `provider.getActorIconUrl(key)` immediately.
- `getActorIconUrl()` opens the actor bundle and reads `icon.png`, falling back to `image.png`.

This means opening the Formation screen can cause many actor ZIP requests, ZIP parses, and blob URL creations before the user starts Battle.

Required fix:

- Formation/catalog/slot icons must not open full actor runtime bundles by default.
- Add a lightweight UI icon bundle layer.
- Add lazy icon loading with `IntersectionObserver`.
- Limit concurrent icon loads to 4–8; use 6 unless a stronger reason exists.
- Do not catalog-wide fallback to actor `image.png`.
- Missing UI icon should use a non-BCU placeholder or `image-missing` state, not full actor bundle fallback.

### 0.2 Dog/enemy icon source appears wrong and must be audited

User requirement:

- Dog army / enemy UI icons should use the photos/images from the `000010` source family, not the currently suspected `000002` / `000003` source family.
- Verify this from actual source files and generation scripts before changing mappings.
- Do not guess from runtime code alone; the displayed icon depends on which raw source file the generator packed as `icon.png`.

Required fix:

- Add an icon source audit that records, per semantic actor key, the current generated icon source and the desired source.
- For enemy/dog icons, prefer the `000010` source family where the ID mapping is valid.
- For unit/cat icons, use the correct unit icon source family after auditing the actual asset tree.
- If `000010` contains mixed or non-1:1 assets, add an explicit mapping file rather than hardcoding guesses.

### 0.3 UI icon bundles must be separated from actor bundles

Actor bundles are for battle runtime. UI icons are for Formation and production cards.

Required new bundle family:

```text
public/assets/bundles/icon/enemy/<id3>.zip
public/assets/bundles/icon/unit/<id3>-<form>.zip
```

Each UI icon ZIP must be small and contain only:

```text
bundle.json
icon.png
```

Required generated index:

```text
public/assets/generated/bcu-icon-index.json
```

Minimum entry shape:

```json
{
  "key": "enemy:0",
  "kind": "enemy",
  "bundleRef": {
    "bundleKey": "icon:enemy:0",
    "bundlePath": "public/assets/bundles/icon/enemy/000.zip"
  },
  "internalPath": "icon.png",
  "sourcePath": "public/assets/bcu/...",
  "sourceStatus": "audited"
}
```

Runtime UI must use this icon index and these icon bundles for Formation and production cards.

### 0.4 `SemanticAssetProvider.archive()` lacks in-flight ZIP parse caching

Current cache families include fetch promises, parsed archives, core JSON cache, actor icon URL cache, actor image URL cache, and object URLs.

Problem:

- `fetchBundle()` coalesces simultaneous fetches.
- `archive()` can still parse the same ZIP more than once during simultaneous first reads because it does not cache an in-flight parse promise.
- `readCoreDb()` also needs an in-flight `coreDbPromise` so repeated calls do not start duplicate JSON reads and ZIP parse work.

Required fix:

- Add `this.bundleArchivePromises = new Map()`.
- Add `this.coreDbPromise = null`.
- `archive(bundleRef)` must cache the parse promise and delete it on failure so retry is possible.
- `readCoreDb()` must run once per provider instance and retry after failure.

Required pattern:

```js
async archive(bundleRef) {
  const url = normalizeFetchPath(bundleRef.bundlePath);
  if (this.bundleArchives.has(url)) return this.bundleArchives.get(url);
  if (!this.bundleArchivePromises.has(url)) {
    this.bundleArchivePromises.set(url, (async () => {
      const archive = parseStoreZip(await this.fetchBundle(bundleRef));
      this.bundleArchives.set(url, archive);
      return archive;
    })().catch((error) => {
      this.bundleArchivePromises.delete(url);
      throw error;
    }));
  }
  return await this.bundleArchivePromises.get(url);
}
```

### 0.5 Safari/WebKit hides useful error details

Current symptom:

- Safari sometimes displays only `Error {}`.
- This hides whether the failure came from actor, background, castle, KBEff, raw guard, ZIP parse, missing entry, or object URL/image decode.

Required fix:

Add structured error logging to at least:

- `js/preview/PreviewApp.js` in `applyFormationToBattle()` catch.
- `js/ui/FormationEditor.js` in apply failure catch.

Required detail object:

```js
{
  name: error?.name,
  message: error?.message,
  stack: error?.stack,
  cause: error?.cause,
  error
}
```

The UI hint must also show `error?.message || String(error)`.

### 0.6 KBEff still uses raw BCU paths

Current known raw effect asset family:

```text
public/assets/bcu/000001/org/battle/a/000_a.png
public/assets/bcu/000001/org/battle/a/000_a.imgcut
public/assets/bcu/000001/org/battle/a/kb.mamodel
public/assets/bcu/000001/org/battle/a/kb_hb.maanim
public/assets/bcu/000001/org/battle/a/kb_sw.maanim
public/assets/bcu/000001/org/battle/a/kb_ass.maanim
```

Problem:

- `BcuKbeffLoader` and/or `BattleConfig.tuning.knockback.kbEffect.baseDir` may still point at `./public/assets/bcu/000001/org/battle/a/`.
- In `semantic-strict`, `RuntimeAssetGuard` blocks runtime reads from `public/assets/bcu/**`.
- If KBEff loads during Battle init, Battle can fail.

Required fix:

- Add an effect bundle such as `public/assets/bundles/effect/kbeff.zip`, or split by effect key if needed.
- Required entries for KBEff bundle:

```text
bundle.json
image.png
imgcut.imgcut
model.mamodel
kb_hb.maanim
kb_sw.maanim
kb_ass.maanim
```

- Add `SemanticAssetProvider` APIs for effect bundles or a specific KBEff reader.
- Until effect bundles are implemented, do not run KBEff `loadAll()` in `semantic-strict` unless a semantic effect bundle exists.
- `BattleConfig` must not make raw `baseDir` the production authority.

### 0.7 Background, castle, and actor bundle failures need concrete diagnostics

Current problem:

- Some loaders try semantic bundles and then call `provider.recordRawFallback(...)` on failure.
- In `semantic-strict`, raw fallback is disabled, so failures may become generic `Raw fallback disabled` errors.
- The actual missing bundle entry or parse failure can be hidden.

Required fix:

When a semantic bundle is selected, do not treat failure as a raw fallback path. Fail with a specific bundle error.

Push diagnostic entries like:

```js
{
  kind: 'actor' | 'background' | 'castle' | 'effect' | 'icon',
  semanticKey,
  bundlePath,
  internalPath,
  missingEntries,
  originalErrorName,
  originalErrorMessage,
  message
}
```

Target files:

- `js/bcu/BcuAssetLoader.js`
- `js/battle/StageBackgroundLoader.js`
- `js/battle/BcuCastleAssetLoader.js`
- `js/battle/BcuKbeffLoader.js`
- `js/bcu/SemanticAssetProvider.js`

### 0.8 Runtime raw path checks must include the new icon/effect work

Any browser runtime request to these is a failure in `semantic-strict`:

```text
public/assets/bcu/**
./public/assets/bcu/**
public/assets/bcu-manifest.json
./public/assets/bcu-manifest.json
```

Allowed runtime requests:

```text
public/assets/generated/*.json
public/assets/bundles/**/*.zip
application JS/CSS/HTML files
non-BCU placeholders
```

Add or update checks so they fail if:

- Formation initial display requests actor bundles just to show catalog icons.
- Formation initial display requests `public/assets/bcu/**` images.
- Production bar requests actor bundles just to show card icons.
- KBEff in `semantic-strict` requests raw `public/assets/bcu/000001/org/battle/a/**`.
- `core-db.zip` is parsed more than once for simultaneous first reads.

---

## 1. BCU source-reading conclusions that must guide implementation

This project has local BCU source materials, including BCU common and BCU PC ZIPs. The next implementation must respect their structure.

### 1.1 BCU common structure

BCU common is not just a data definition repo. It contains battle runtime logic.

Important classes/concepts:

- `util/stage/Stage.java` — stage battle CSV model.
- `util/stage/SCDef.java` and `SCDef.Line` — enemy spawn row model.
- `util/stage/EStage.java` — battle-time spawn runtime state.
- `battle/StageBasis.java` — central battle runtime.
- `battle/entity/Entity.java` — actor runtime for movement, attack, KB, damage, proc, status, death.
- `battle/attack/*` — attack capture/hit/effects logic.
- `util/anim/*` — `.imgcut`, `.mamodel`, `.maanim` model and runtime concepts.

Do not flatten all of this into `BattleScene` indefinitely.

### 1.2 BCU PC rendering structure

BCU PC uses `BattleBox` as the main visual reference for battle rendering.

Important rendering concepts to preserve when changing battle/runtime assets:

- World X projection follows the BCU formula conceptually equivalent to `x * ratio + off`, then screen scale/position.
- Base positions and stage length come from stage runtime, not visual fallback positions.
- Actor render Y depends on road height and current layer.
- Castle, actor, effect, background, and HP/UI draw order should follow BCU PC logic where already known.

### 1.3 Actor bundle completeness

A battle actor runtime bundle is complete only if it can provide the runtime animation set.

Required actor runtime entries:

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

`icon.png` is not a substitute for actor runtime data.

UI icons must be treated as a separate lightweight asset family.

### 1.4 Stage/spawn parity remains a structural issue

BCU `SCDef.Line` carries more than a simple enemy/time/count tuple. Preserve or plan for:

```text
enemy
number
boss
multiple
group
spawn_0 / spawn_1
respawn_0 / respawn_1
castle_0 / castle_1
layer_0 / layer_1
mult_atk
kill_count
score
```

Longer-term work must add a real `StageRuntime` / `SpawnScheduleRuntime` analogous to BCU `EStage`, rather than keeping all spawn logic inside `BattleScene`.

---

## 2. Target architecture

Runtime must have three asset layers and one bootstrap layer.

### 2.1 Raw source layer

Path:

```text
public/assets/bcu/
```

Purpose:

- build input only
- audit input only
- generated diagnostics only
- explicit `raw-only-diagnostics` development mode only

Production/browser runtime must not fetch from this tree.

### 2.2 Runtime bundle layer

Path:

```text
public/assets/bundles/
```

Runtime-loadable BCU data must come from generated ZIP bundles:

```text
public/assets/bundles/core/core-db.zip
public/assets/bundles/lang/jp.zip              # optional if Japanese names are embedded in core-db.zip
public/assets/bundles/actor/enemy/<id3>.zip
public/assets/bundles/actor/unit/<id3>-<form>.zip
public/assets/bundles/stage/map/<safe-stage-group>.zip
public/assets/bundles/background/<bgId>.zip
public/assets/bundles/castle/enemy/<group><id3>.zip
public/assets/bundles/castle/nyanko/<safe-id>.zip
public/assets/bundles/effect/<safe-key>.zip
public/assets/bundles/icon/enemy/<id3>.zip
public/assets/bundles/icon/unit/<id3>-<form>.zip
```

### 2.3 UI icon bundle layer

UI icons are not actor runtime assets.

Formation and production icons must load from:

```text
public/assets/bundles/icon/enemy/*.zip
public/assets/bundles/icon/unit/*.zip
```

They must not load from:

```text
public/assets/bundles/actor/**/*.zip
public/assets/bcu/**/*.png
```

except in explicit diagnostics/audit scripts.

### 2.4 Bootstrap index layer

Generated JSON files may be fetched at runtime because they are not raw BCU assets:

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
public/assets/generated/bcu-icon-index.json
```

---

## 3. Strict runtime rule

### 3.1 Forbidden runtime URLs

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
Element.setAttribute('src', ...)
innerHTML-created image elements
CSS url()
audio/image/video tags
createImageBitmap(fetch(raw))
any custom loader
```

### 3.2 Allowed runtime URLs

Production runtime may fetch:

```text
public/assets/generated/*.json
public/assets/bundles/**/*.zip
application JS/CSS/HTML files
non-BCU UI placeholder assets
```

### 3.3 Raw-only diagnostics mode

A development-only mode may exist:

```text
raw-only-diagnostics
```

It must not be default. It must require an explicit query parameter or developer option.

Default mode must be:

```text
semantic-strict
```

In `semantic-strict`, raw BCU runtime access must throw and be recorded in diagnostics.

---

## 4. Core DB bundle contract

`core/core-db.zip` is the runtime database bundle. It replaces runtime reads of raw metadata CSV/TXT/JSON.

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

Production boot must be:

```text
BcuBootLoader.loadGame()
  -> SemanticAssetProvider.load()
  -> provider.readCoreDb()
  -> construct BcuAssetDatabase from parsed core JSON
  -> no runtime fetch from public/assets/bcu/
  -> no runtime fetch from public/assets/bcu-manifest.json
```

`readCoreDb()` must be promise-cached.

---

## 5. SemanticAssetProvider required changes

Update:

```text
js/bcu/SemanticAssetProvider.js
```

Required cache families:

```text
bundle fetch promises
bundle archive parse promises
parsed zip archives
core DB read promise
parsed JSON entries from core-db.zip
object URLs
actor image URLs
UI icon URLs
```

Required APIs after this task:

```js
await provider.load();
await provider.readCoreDb();
await provider.readCoreJson(internalPath);

await provider.getActorBundle(actorKey);
await provider.getActorImageUrl(actorKey);
await provider.readActorText(actorKey, internalPath);

await provider.getActorUiIconUrl(actorKey);
await provider.readIconBundle(actorKey);

await provider.readStageCsv(stageKey);
await provider.readBackgroundBundle(backgroundKey);
await provider.readCastleBundle(castleKey);

provider.hasBundleForKey(key);
provider.assertNoRawForBundledKey(key, rawPath);
provider.assertNoRawBcuUrl(url, context);
provider.clearObjectUrls();
```

Important:

- Keep `getActorIconUrl(actorKey)` only as a compatibility wrapper if needed.
- Formation and production UI must use `getActorUiIconUrl(actorKey)`, not actor runtime bundle fallback.
- `getActorUiIconUrl()` must prefer `bcu-icon-index.json` and icon bundles.
- It must not open full actor bundles for catalog-wide fallback.

---

## 6. New task: split UI icons from actor runtime bundles

This is the immediate task to implement after documenting current problems.

### 6.1 Goal

FormationEditor and PlayerProductionBar must not open full actor bundles just to show UI icons.

Generate lightweight icon bundles separated by enemy and unit, then load them through `SemanticAssetProvider`.

### 6.2 Required new/updated scripts

Add or update scripts with clear names. Suggested names:

```text
scripts/audit-bcu-icon-sources.mjs
scripts/build-bcu-icon-index.mjs
scripts/build-bcu-icon-bundles.mjs
scripts/check-formation-icons-use-icon-bundles.mjs
scripts/check-production-icons-use-icon-bundles.mjs
scripts/check-icon-bundles-never-load-actor-bundles.mjs
```

If existing `build-bcu-semantic-bundles.mjs --all` is the top-level generator, integrate the icon generator into it.

### 6.3 Icon source audit

The audit must answer these questions with actual file evidence:

- For each `enemy:<id>`, what source image currently becomes the UI icon, if any?
- Is the current source under `000002`, `000003`, actor image, or elsewhere?
- Is there a matching desired icon under the `000010` source family?
- What exact path under `000010` should be used?
- Does the ID mapping appear 1:1, shifted, named, or ambiguous?
- For each `unit:<id>:<form>`, what is the correct unit icon source family?

Emit:

```text
public/assets/generated/bcu-icon-source-audit.json
public/assets/generated/bcu-icon-source-audit.md
```

Required JSON shape:

```json
{
  "schemaVersion": 1,
  "enemy": {
    "0": {
      "semanticKey": "enemy:0",
      "currentSourcePath": "public/assets/bcu/...",
      "desiredSourcePath": "public/assets/bcu/000010/...",
      "status": "needs-remap|ok|missing|ambiguous",
      "notes": []
    }
  },
  "unit": {
    "0:f": {
      "semanticKey": "unit:0:f",
      "currentSourcePath": "public/assets/bcu/...",
      "desiredSourcePath": "public/assets/bcu/...",
      "status": "ok|missing|ambiguous",
      "notes": []
    }
  }
}
```

Do not silently pick ambiguous icons. Mark them and use a non-BCU placeholder until the mapping is explicit.

### 6.4 Icon source priority

Enemy/dog icon source priority:

1. Explicit mapping file if it exists.
2. Audited `000010` source path if the ID mapping is unambiguous.
3. Non-BCU placeholder.

Forbidden for Formation/catalog-wide enemy icons:

```text
actor bundle image.png fallback
public/assets/bcu/000002 or 000003 source if 000010 is available and correct
raw public/assets/bcu/**/*.png at runtime
```

Unit/cat icon source priority:

1. Explicit mapping file if it exists.
2. Audited unit icon source family.
3. Non-BCU placeholder.

Forbidden for Formation/catalog-wide unit icons:

```text
actor bundle image.png fallback
raw public/assets/bcu/**/*.png at runtime
```

### 6.5 Icon bundle output

Enemy icon bundle path:

```text
public/assets/bundles/icon/enemy/<id3>.zip
```

Unit icon bundle path:

```text
public/assets/bundles/icon/unit/<id3>-<form>.zip
```

Each ZIP must be STORE/no-compression unless the ZIP reader is expanded and tested.

Each ZIP must contain:

```text
bundle.json
icon.png
```

Example `bundle.json`:

```json
{
  "schemaVersion": 1,
  "kind": "actor-icon",
  "semanticKey": "enemy:0",
  "actorKind": "enemy",
  "sourcePath": "public/assets/bcu/000010/...",
  "internalPath": "icon.png"
}
```

### 6.6 Generated icon index

Emit:

```text
public/assets/generated/bcu-icon-index.json
```

Minimum shape:

```json
{
  "schemaVersion": 1,
  "entries": [
    {
      "key": "enemy:0",
      "kind": "enemy",
      "bundleRef": {
        "bundleKey": "icon:enemy:0",
        "bundlePath": "public/assets/bundles/icon/enemy/000.zip"
      },
      "internalPath": "icon.png",
      "sourcePath": "public/assets/bcu/000010/...",
      "sourceStatus": "audited"
    }
  ],
  "byKey": {
    "enemy:0": {
      "key": "enemy:0",
      "kind": "enemy",
      "bundleRef": {
        "bundleKey": "icon:enemy:0",
        "bundlePath": "public/assets/bundles/icon/enemy/000.zip"
      },
      "internalPath": "icon.png",
      "sourcePath": "public/assets/bcu/000010/...",
      "sourceStatus": "audited"
    }
  }
}
```

Also add icon bundle records to `bcu-bundle-manifest.json` if that file is the global bundle registry.

### 6.7 Runtime provider behavior

`SemanticAssetProvider.load()` must load `bcu-icon-index.json` as optional generated index.

`getActorUiIconUrl(actorKey)` must:

1. Look up `actorKey` in `bcu-icon-index.json`.
2. Read the icon bundle ZIP.
3. Create a blob URL for `icon.png`.
4. Cache by actor key.
5. On missing icon bundle or missing `icon.png`, record diagnostics and return `null` or a non-BCU placeholder URL.
6. Never open actor bundle `image.png` for Formation/catalog-wide fallback.

Required diagnostics for icon failure:

```js
{
  kind: 'icon',
  semanticKey: actorKey,
  bundlePath,
  internalPath: 'icon.png',
  missingEntries: ['icon.png'],
  message
}
```

### 6.8 FormationEditor behavior

Update:

```text
js/ui/FormationEditor.js
```

Required:

- Render placeholders first with `data-semantic-icon`.
- Resolve UI icons with `provider.getActorUiIconUrl(key)`.
- Use `IntersectionObserver` to load only visible or near-visible icons.
- Use max concurrent icon loads: 6.
- Avoid duplicate loads across search/filter/rerender.
- If no icon exists, mark `image-missing` and keep placeholder.
- Do not call `provider.getActorIconUrl(key)` from FormationEditor.
- Do not open actor runtime bundles while merely displaying the catalog.

### 6.9 PlayerProductionBar behavior

Update:

```text
js/ui/PlayerProductionBar.js
```

Required:

- Use `provider.getActorUiIconUrl(key)` for production card icons.
- Do not load actor runtime bundles just to draw production cards.
- Do not use raw icon paths.
- Preserve existing cooldown/cost UI behavior.

### 6.10 Checks for this task

Checks must prove:

- Formation initial render requests icon bundles, not actor bundles.
- Formation initial render does not request `public/assets/bcu/**`.
- Production card render requests icon bundles, not actor bundles.
- Enemy icon audit confirms `000010` source usage where available.
- Ambiguous/missing enemy icon mappings are reported, not silently guessed.
- `SemanticAssetProvider.getActorUiIconUrl()` caches object URLs.
- `SemanticAssetProvider.archive()` does not parse the same ZIP multiple times during simultaneous first reads.

Suggested check commands:

```bash
node scripts/audit-bcu-icon-sources.mjs
node scripts/build-bcu-icon-index.mjs
node scripts/build-bcu-icon-bundles.mjs
node scripts/build-bcu-semantic-bundles.mjs --all
node scripts/check-formation-icons-use-icon-bundles.mjs
node scripts/check-production-icons-use-icon-bundles.mjs
node scripts/check-icon-bundles-never-load-actor-bundles.mjs
node scripts/check-bundled-assets-never-load-raw.mjs
```

---

## 7. Background, castle, stage, actor, and effect bundle rules

### 7.1 Actor bundles

Actor runtime bundles are for battle animation/model runtime only.

Required entries:

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

UI icon bundles are separate. Do not use actor `image.png` for catalog-wide icons.

### 7.2 Stage bundles

Stage runtime must preserve:

```text
stageKey
bundleRef
semanticEntry
legacyStageCsvPath as diagnostics only
```

If a stage has a bundle, `StageDefinitionLoader` must use `provider.readStageCsv(stageKey)`. Raw `stageCsvPath` is forbidden except in explicit `raw-only-diagnostics`.

### 7.3 Background bundles

If `background:<bgId>` has a bundle, load only from the bundle:

```text
metadata.json
image.png
imgcut.imgcut
```

Do not raw fallback to:

```text
org/img/bg/*.png
org/battle/bg/*.imgcut
org/battle/bg.csv
```

for bundled backgrounds.

### 7.4 Castle bundles

If `enemyCastle:<id>` or another castle semantic key has a bundle, load only from the castle bundle.

Do not raw fallback to:

```text
org/img/rc/*.png
org/img/ec/*.png
org/img/wc/*.png
org/img/sc/*.png
org/castle/**/*
```

for bundled castles.

### 7.5 Effect bundles

KBEff must become semantic or be gated in strict mode.

Do not runtime fetch:

```text
public/assets/bcu/000001/org/battle/a/**
```

in `semantic-strict`.

---

## 8. Required runtime raw-access guard

`js/bcu/RuntimeAssetGuard.js` or equivalent must guard:

```text
fetch()
Image.src
HTMLImageElement.prototype.src
Element.setAttribute('src', ...)
MutationObserver for inserted img[src]
```

Blocked attempts must be recorded in:

```js
db.semanticProvider.diagnostics.blockedRawReads
```

This guard is a safety net. It is not a substitute for fixing code paths.

---

## 9. Required verification after this icon task

Do not claim completion unless all relevant checks pass and browser behavior is verified.

### 9.1 DevTools Network expectations

Open the app and filter:

```text
/bcu/|/bundles/|icon|actor|core-db
```

Expected after boot and opening Formation:

```text
public/assets/generated/*.json
public/assets/bundles/core/core-db.zip
public/assets/bundles/icon/enemy/*.zip
public/assets/bundles/icon/unit/*.zip
```

Not expected during Formation display only:

```text
public/assets/bundles/actor/**/*.zip
public/assets/bcu/**
public/assets/bcu-manifest.json
```

Expected only after Battle Apply / actor preload:

```text
public/assets/bundles/actor/**/*.zip
```

### 9.2 Console checks

Run after opening Formation:

```js
const p = globalThis.__BCU_DB__?.semanticProvider;
console.log('mode', p?.mode);
console.log('bundleErrors', p?.diagnostics?.bundleErrors);
console.log('blockedRawReads', p?.diagnostics?.blockedRawReads);
console.log('rawFallbacks', p?.diagnostics?.rawFallbacks);
console.log('actor zip resources', performance.getEntriesByType('resource').filter(e => e.name.includes('/bundles/actor/')).length);
console.log('icon zip resources', performance.getEntriesByType('resource').filter(e => e.name.includes('/bundles/icon/')).length);
```

Expected before Battle Apply:

```text
mode = semantic-strict
blockedRawReads = []
rawFallbacks = []
actor zip resources should be low/zero for icon display
icon zip resources should increase only for visible/lazy-loaded icons
```

### 9.3 DOM checks

```js
[...document.querySelectorAll('.formation-ui img')]
  .map(img => img.src)
  .filter(src => src.includes('/public/assets/bcu/'))
```

Expected:

```js
[]
```

---

## 10. Documentation requirements

Update:

```text
docs/bcu-migration-status.md
```

Add:

```text
icon source audit summary
number of enemy icon bundles
number of unit icon bundles
how many enemy icons use 000010 source
ambiguous/missing icon mappings
Formation initial actor bundle request count
Formation initial icon bundle request count
production card icon request source
blocked raw read count
browser Network verification result
```

Do not write “complete” unless browser Network verification confirms no production raw BCU requests and no Formation-only actor bundle flood.

---

## 11. Definition of Done for the current icon task

Complete only when all are true:

1. `bcu-icon-source-audit.json/md` exists and documents current vs desired icon sources.
2. Enemy/dog icons prefer audited `000010` source where valid.
3. Ambiguous icon mappings are reported, not guessed.
4. `bcu-icon-index.json` exists.
5. Enemy icon ZIPs exist under `public/assets/bundles/icon/enemy/`.
6. Unit icon ZIPs exist under `public/assets/bundles/icon/unit/`.
7. Each icon ZIP contains `bundle.json` and `icon.png` only unless explicitly documented.
8. `SemanticAssetProvider.getActorUiIconUrl()` exists and uses icon bundles.
9. FormationEditor uses `getActorUiIconUrl()` and lazy loading with concurrency limit.
10. PlayerProductionBar uses `getActorUiIconUrl()`.
11. Formation display does not open full actor bundles just to show icons.
12. Formation display does not request `public/assets/bcu/**`.
13. Production card icon display does not request `public/assets/bcu/**`.
14. `SemanticAssetProvider.archive()` has in-flight parse promise caching.
15. `readCoreDb()` has in-flight promise caching.
16. Safari/WebKit error detail logging is added to apply paths.
17. KBEff raw strict-mode risk is either fixed with effect bundle or gated so strict Battle init does not raw fetch it.
18. Checks and browser verification are recorded in `docs/bcu-migration-status.md`.

---

## 12. Codex implementation instruction

Implement this contract, not just a plan.

Do not stop after adding checks.

Do not stop after generating icon ZIPs.

Do not leave Formation or production card icons opening full actor bundles.

Do not runtime-fetch `public/assets/bcu/...` for icons.

Do not assume generated manifests are empty.

Do not claim success without checking Network/resources and recording the result.

Do not silently use the wrong dog/enemy icon source. Audit the current source and prefer the `000010` source family where the mapping is valid.
