# AGENTS.md — BCU Runtime Zip-First Migration Contract

Repository: `rhgrive2/game`

This file is the authoritative working contract for Codex and future agents working on the Battle Cats Ultimate / BCU runtime migration.

Generated indexes, generated manifests, and bundles are **not empty**. GitHub API / contents views may show `content: ""` for large generated files. That does **not** mean those files are empty. Inspect raw links, local generated artifacts, ZIP bundles, and generated indexes before making claims.

Do not regress into these incorrect assumptions:

- `public/assets/generated/*` is empty.
- `public/assets/bundles/*` is empty.
- Battle fails because generated manifests are empty.
- The zip migration is not implemented at all.

The current problem is:

- zip-first migration is partially implemented,
- runtime read paths are still too heavy,
- UI icons still open actor ZIPs,
- some raw BCU runtime paths remain,
- Safari/WebKit hides useful error details,
- KBEff still risks raw-path loading,
- ZIP parse work can duplicate,
- background/castle/actor bundle diagnostics are too coarse,
- BCU runtime structure is still too monolithic and not close enough to BCU common / BCU PC.

Runtime-loadable BCU data must come from:

```text
public/assets/generated/*.json
public/assets/bundles/**/*.zip
```

Runtime-loadable BCU data must **not** come from:

```text
public/assets/bcu/**
./public/assets/bcu/**
public/assets/bcu-manifest.json
./public/assets/bcu-manifest.json
```

Raw BCU files may remain only as:

- build inputs,
- audit inputs,
- diagnostics inputs,
- explicitly marked raw-only development mode inputs.

Production/browser runtime must not fetch them.

---

# 0. Immediate runtime problems to fix first

## 0.1 Formation icons open too many actor ZIPs

Current behavior to check:

```text
js/ui/FormationEditor.js
js/bcu/SemanticAssetProvider.js
```

Problem flow:

```text
FormationEditor.renderDynamic()
  -> resolveSemanticIcons()
  -> walks every img[data-semantic-icon]
  -> provider.getActorIconUrl(key)
  -> actor runtime bundle ZIP open
  -> icon.png or image.png fallback
  -> blob URL creation
```

This can cause:

- many actor ZIP requests,
- many ZIP parses,
- many blob URLs,
- high memory pressure,
- heavy loading before Battle starts,
- Safari instability.

Required:

- Formation/catalog/slot icons must not open full actor runtime bundles by default.
- Formation/catalog/slot icons must not use one ZIP per icon.
- Missing UI icons must use a non-BCU placeholder or `image-missing` state.
- Do not catalog-wide fallback to actor `image.png`.
- UI icons must use aggregated icon ZIPs described in section 1.

---

## 0.2 `SemanticAssetProvider.archive()` needs in-flight parse caching

Required additions:

```js
this.bundleArchivePromises = new Map();
this.coreDbPromise = null;
```

`archive(bundleRef)` must cache in-flight ZIP parse promises.

`readCoreDb()` must only execute once per provider instance and retry after failure.

Required `archive()` pattern:

```js
async archive(bundleRef) {
  const url = normalizeFetchPath(bundleRef.bundlePath);

  if (this.bundleArchives.has(url)) {
    return this.bundleArchives.get(url);
  }

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

Required `readCoreDb()` pattern:

```js
async readCoreDb() {
  if (!this.coreDbPromise) {
    this.coreDbPromise = (async () => {
      // existing core DB read logic
    })().catch((error) => {
      this.coreDbPromise = null;
      throw error;
    });
  }

  return await this.coreDbPromise;
}
```

Must verify:

- `core-db.zip` is parsed at most once per provider instance during simultaneous first reads.
- `enemy.zip`, `unit-f.zip`, `unit-c.zip`, `unit-s.zip`, and `unit-u.zip` are parsed at most once per provider instance.

---

## 0.3 KBEff still risks raw BCU reads

Known raw KBEff family:

```text
public/assets/bcu/000001/org/battle/a/000_a.png
public/assets/bcu/000001/org/battle/a/000_a.imgcut
public/assets/bcu/000001/org/battle/a/kb.mamodel
public/assets/bcu/000001/org/battle/a/kb_hb.maanim
public/assets/bcu/000001/org/battle/a/kb_sw.maanim
public/assets/bcu/000001/org/battle/a/kb_ass.maanim
```

In `semantic-strict`, these must not be fetched.

Required:

- add semantic KBEff bundle, or
- gate KBEff loading until a semantic effect bundle exists.

Suggested semantic bundle:

```text
public/assets/bundles/effect/kbeff.zip
```

Suggested entries:

```text
bundle.json
image.png
imgcut.imgcut
model.mamodel
kb_hb.maanim
kb_sw.maanim
kb_ass.maanim
```

`BattleConfig.kbEffect.baseDir` must not be the production runtime authority.

---

## 0.4 Safari/WebKit hides errors

Safari sometimes shows only:

```text
Error {}
```

This hides whether the failure came from:

- actor bundle,
- background bundle,
- castle bundle,
- KBEff,
- raw guard,
- ZIP parse,
- missing entry,
- object URL / image decode.

Add detailed logging in:

```text
js/preview/PreviewApp.js
js/ui/FormationEditor.js
```

Required logging shape:

```js
console.error('[PreviewApp] applyFormationToBattle failed detail', {
  name: e?.name,
  message: e?.message,
  stack: e?.stack,
  cause: e?.cause,
  error: e
});
```

FormationEditor apply failure should log the same shape.

UI hints must show:

```js
err?.message || String(err)
```

---

## 0.5 Background / castle / actor bundle diagnostics are too weak

For actor/background/castle/effect/icon bundle failures, push diagnostics with:

```js
{
  kind,
  semanticKey,
  bundlePath,
  internalPath,
  missingEntries,
  originalErrorName,
  originalErrorMessage,
  message
}
```

Do not treat semantic bundle failure as raw fallback in `semantic-strict`.

Target files:

```text
js/bcu/BcuAssetLoader.js
js/battle/StageBackgroundLoader.js
js/battle/BcuCastleAssetLoader.js
js/battle/BcuKbeffLoader.js
js/bcu/SemanticAssetProvider.js
```

---

## 0.6 Runtime raw path checks must be regression tests

Any browser runtime request to these is a failure in `semantic-strict`:

```text
public/assets/bcu/**
./public/assets/bcu/**
public/assets/bcu-manifest.json
./public/assets/bcu-manifest.json
```

Checks must fail if:

- Apply Battle requests `public/assets/bcu/**`.
- Formation display requests `public/assets/bcu/**`.
- Formation display requests actor bundles just to show catalog icons.
- Formation display requests one ZIP per icon.
- Production bar requests actor bundles just to show card icons.
- KBEff requests `public/assets/bcu/000001/org/battle/a/**`.
- `blockedRawReads` or `rawFallbacks` is non-empty after successful Apply.

---

# 1. Required icon architecture: aggregated ZIPs only

## 1.1 Rejected design

Do **not** generate one ZIP per icon:

```text
public/assets/bundles/icon/enemy/<id3>.zip
public/assets/bundles/icon/unit/<id3>-<form>.zip
```

This design is rejected because Formation/catalog rendering would still download many ZIP files.

The point of this task is to keep both of these small:

- downloaded ZIP count,
- parsed ZIP count.

A one-ZIP-per-icon layout only moves the problem from actor ZIPs to icon ZIPs. That is not acceptable.

---

## 1.2 Required design

Use aggregated icon bundles:

```text
public/assets/bundles/icon/enemy.zip
public/assets/bundles/icon/unit-f.zip
public/assets/bundles/icon/unit-c.zip
public/assets/bundles/icon/unit-s.zip
public/assets/bundles/icon/unit-u.zip
```

`u` form is included when present.

This means:

- enemy icons are grouped into one enemy icon ZIP,
- unit icons are grouped by form,
- Formation can load a small number of icon ZIPs,
- runtime can reuse one parsed archive for many icons.

---

## 1.3 `enemy.zip` structure

Required:

```text
public/assets/bundles/icon/enemy.zip
  bundle.json
  enemy/000.png
  enemy/001.png
  enemy/002.png
  enemy/003.png
  ...
```

`enemy/000.png` maps to:

```text
enemy:0
```

`enemy/001.png` maps to:

```text
enemy:1
```

and so on, unless the audit proves a non-1:1 mapping is needed.

---

## 1.4 Unit form ZIP structure

Required:

```text
public/assets/bundles/icon/unit-f.zip
  bundle.json
  unit/000-f.png
  unit/001-f.png
  unit/002-f.png
  ...

public/assets/bundles/icon/unit-c.zip
  bundle.json
  unit/000-c.png
  unit/001-c.png
  unit/002-c.png
  ...

public/assets/bundles/icon/unit-s.zip
  bundle.json
  unit/000-s.png
  unit/001-s.png
  unit/002-s.png
  ...

public/assets/bundles/icon/unit-u.zip
  bundle.json
  unit/000-u.png
  unit/001-u.png
  unit/002-u.png
  ...
```

The `u` form is part of this contract.

Do not omit `unit-u.zip` if generated unit form data contains `u` form icons.

---

## 1.5 ZIP compression rule

Each icon ZIP should use STORE/no-compression unless the runtime ZIP reader is upgraded and tested for DEFLATE.

If the existing runtime parser only supports STORE ZIPs, the generator must write STORE ZIPs.

Unsupported compression must fail with a clear error.

---

# 2. Icon source audit

## 2.1 Dog/enemy source policy

Enemy/dog icons should prefer the `000010` source family.

Do not silently use:

```text
000002
000003
actor bundle image.png
actor sprite sheet image.png
raw public/assets/bcu/**/*.png at runtime
```

Audit first. If mapping is ambiguous, mark it as ambiguous and use placeholder or explicit mapping.

---

## 2.2 Audit outputs

Required:

```text
public/assets/generated/bcu-icon-source-audit.json
public/assets/generated/bcu-icon-source-audit.md
```

Audit record shape:

```json
{
  "semanticKey": "enemy:0",
  "currentSourcePath": "public/assets/bcu/...",
  "desiredSourcePath": "public/assets/bcu/000010/...",
  "status": "needs-remap|ok|missing|ambiguous",
  "notes": []
}
```

Enemy source priority:

1. explicit mapping file,
2. audited `000010` source if unambiguous,
3. non-BCU placeholder.

Unit source priority:

1. explicit mapping file,
2. audited unit source family,
3. non-BCU placeholder.

Do not silently pick ambiguous icons.

---

# 3. Generated icon index

Required generated file:

```text
public/assets/generated/bcu-icon-index.json
```

Each actor key maps to:

- aggregate ZIP path,
- aggregate bundle key,
- internal PNG path,
- audited source path,
- source status.

## 3.1 Enemy index example

```json
{
  "key": "enemy:0",
  "kind": "enemy",
  "bundleRef": {
    "bundleKey": "icon:enemy",
    "bundlePath": "public/assets/bundles/icon/enemy.zip"
  },
  "internalPath": "enemy/000.png",
  "sourcePath": "public/assets/bcu/000010/...",
  "sourceStatus": "audited"
}
```

## 3.2 Unit index example

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

Also add aggregate icon bundle records to `bcu-bundle-manifest.json` if it is the global bundle registry.

---

# 4. Required scripts

Add or update:

```text
scripts/audit-bcu-icon-sources.mjs
scripts/build-bcu-icon-index.mjs
scripts/build-bcu-icon-bundles.mjs
scripts/check-icon-bundles-are-aggregated.mjs
scripts/check-icon-bundles-never-load-actor-bundles.mjs
scripts/check-formation-icons-use-icon-bundles.mjs
scripts/check-production-icons-use-icon-bundles.mjs
scripts/check-bundled-assets-never-load-raw.mjs
```

Integrate icon generation into:

```text
scripts/build-bcu-semantic-bundles.mjs --all
```

if that is the top-level generator.

---

# 5. Required runtime provider behavior

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
2. open aggregate ZIP only,
3. read indexed PNG,
4. cache blob URL,
5. reuse the same parsed archive,
6. never open actor bundle for UI icon fallback,
7. never fetch `public/assets/bcu/**`.

Required diagnostics for icon failure:

```js
{
  kind: 'icon',
  semanticKey: actorKey,
  bundlePath,
  internalPath,
  missingEntries: [internalPath],
  message
}
```

---

# 6. Required UI changes

## 6.1 FormationEditor

Update:

```text
js/ui/FormationEditor.js
```

Required:

- render placeholders first,
- use `data-semantic-icon`,
- use `IntersectionObserver`,
- concurrency limit = 6,
- no duplicate icon work,
- call `provider.getActorUiIconUrl()`,
- never call `provider.getActorIconUrl()` for catalog icons,
- never open actor ZIPs for catalog display,
- never download one ZIP per character.

---

## 6.2 PlayerProductionBar

Update:

```text
js/ui/PlayerProductionBar.js
```

Required:

- use `provider.getActorUiIconUrl()`,
- never open actor ZIPs for card icons,
- never use raw BCU paths.

---

# 7. Strict runtime rules

Forbidden in runtime:

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
public/assets/bundles/actor/**/*.zip      # battle actor runtime only
public/assets/bundles/icon/enemy.zip
public/assets/bundles/icon/unit-f.zip
public/assets/bundles/icon/unit-c.zip
public/assets/bundles/icon/unit-s.zip
public/assets/bundles/icon/unit-u.zip
public/assets/bundles/effect/**/*.zip
non-BCU placeholders
```

Before Battle Apply:

```text
Formation display must NOT request actor bundles.
```

---

# 8. BCU structural problems to fix after immediate runtime blockers

The current code is not only heavy. It is also structurally not close enough to BCU common / BCU PC.

These are not optional forever. They are the next migration track after immediate Battle-start blockers.

---

## 8.1 Missing `StageRuntime` equivalent

BCU common separates:

```text
Stage
SCDef
EStage
StageBasis
```

Current game code has no complete equivalent to BCU `EStage`.

Instead, battle-time stage state is distributed across:

```text
BattleScene
BcuStageSpawnRuntime
StageDefinitionLoader
BattleConfig
```

Required direction:

Add or evolve explicit runtime structures:

```text
StageDefinition
StageRuntime
SpawnScheduleRuntime
```

They must handle:

- spawn conditions,
- respawn,
- kill counter,
- group/will constraints,
- castle HP window,
- stage length,
- base position,
- camera clamp.

---

## 8.2 `BattleScene` is too monolithic

Current `BattleScene` owns too much:

- parsed stage state,
- spawn control,
- production,
- camera,
- effects,
- combat,
- cleanup,
- render orchestration.

BCU parity requires splitting responsibilities.

Target modules:

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

`BattleScene` should orchestrate these, not implement all of them.

---

## 8.3 Stage CSV parser is too shallow

BCU `SCDef.Line` contains:

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

Current parser must not collapse this into a simplified object that loses fields.

Required:

- preserve `castle_0 / castle_1`,
- preserve `layer_0 / layer_1`,
- preserve `mult_atk`,
- preserve `kill_count`,
- preserve `score`,
- preserve group/will limitations,
- preserve first spawn / respawn random ranges.

---

## 8.4 Background and castle fallback are too strong

Problem:

- `StageBackgroundLoader` can hide bad `bgId` by falling back to default.
- `BcuCastleAssetLoader` can hide bad `castleId` by falling back to default castle.

This makes the game look “kind of working” while semantic IDs are wrong.

Required:

- In `semantic-strict`, do not silently default.
- If bundled background/castle exists but fails, throw a concrete bundle error.
- Diagnostics must include semantic key, bundle path, internal path, and missing entries.

---

## 8.5 Ability / proc runtime is thin

BCU common `Proc` is broad.

It includes many effects such as:

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

Current `AbilityModel` / `DamageAbilityResolver` is not enough for BCU parity.

Required direction:

- introduce or expand `ProcResolver`,
- separate damage calculation from proc application,
- add attack timeline support,
- preserve BCU proc fields from parsed stats,
- do not drop fields simply because current runtime does not consume them yet.

---

## 8.6 Actor runtime completeness

A battle actor runtime bundle is complete only if it provides:

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

`icon.png` is UI-only and must not be treated as actor runtime completeness.

Formation UI must not open `image.png` as icon fallback.

---

## 8.7 Animation asset model

BCU animation assets are a set:

```text
sprite sheet image
.imgcut
.mamodel
.maanim
```

Runtime must preserve this model.

Do not treat a PNG alone as a complete actor asset.

---

# 9. Verification

Required checks:

```bash
node scripts/audit-bcu-icon-sources.mjs
node scripts/build-bcu-icon-index.mjs
node scripts/build-bcu-icon-bundles.mjs
node scripts/check-icon-bundles-are-aggregated.mjs
node scripts/check-icon-bundles-never-load-actor-bundles.mjs
node scripts/check-formation-icons-use-icon-bundles.mjs
node scripts/check-production-icons-use-icon-bundles.mjs
node scripts/check-bundled-assets-never-load-raw.mjs
```

Expected requests before Battle Apply:

```text
public/assets/generated/*.json
public/assets/bundles/core/core-db.zip
public/assets/bundles/icon/enemy.zip
public/assets/bundles/icon/unit-f.zip
public/assets/bundles/icon/unit-c.zip
public/assets/bundles/icon/unit-s.zip
public/assets/bundles/icon/unit-u.zip
```

Only the unit form ZIPs actually needed/visible may be requested.

Not expected:

```text
public/assets/bundles/actor/**/*.zip
public/assets/bundles/icon/enemy/*.zip
public/assets/bundles/icon/unit/*.zip
public/assets/bcu/**
public/assets/bcu-manifest.json
```

Console checks:

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
```

Expected:

- `blockedRawReads = []`
- `rawFallbacks = []`
- no actor ZIP flood during Formation display
- only aggregate icon ZIPs loaded

---

# 10. Documentation requirements

Update:

```text
docs/bcu-migration-status.md
```

Include:

- icon source audit summary,
- whether enemy icons use `000010`,
- ambiguous/missing mappings,
- aggregate icon bundle list,
- number of icons inside `enemy.zip`,
- number of icons inside each `unit-<form>.zip`,
- Formation initial actor bundle request count,
- Formation initial icon bundle request names,
- production card icon source,
- blocked raw read count,
- raw fallback count,
- browser Network verification result,
- KBEff semantic/gated status,
- Safari error logging status,
- archive/coreDb promise-cache status.

Do not write “complete” unless verification proves it.

---

# 11. Definition of Done

Complete only when all are true:

1. `bcu-icon-source-audit.json/md` exists.
2. Enemy/dog icons prefer audited `000010` source where valid.
3. Ambiguous mappings are reported, not guessed.
4. `bcu-icon-index.json` exists.
5. `public/assets/bundles/icon/enemy.zip` exists.
6. `public/assets/bundles/icon/unit-f.zip` exists when form `f` icons exist.
7. `public/assets/bundles/icon/unit-c.zip` exists when form `c` icons exist.
8. `public/assets/bundles/icon/unit-s.zip` exists when form `s` icons exist.
9. `public/assets/bundles/icon/unit-u.zip` exists when form `u` icons exist.
10. No one-ZIP-per-icon generation.
11. Icon index maps semantic key -> aggregate ZIP + internal path.
12. `getActorUiIconUrl()` uses aggregate ZIPs.
13. Aggregate ZIPs parse at most once.
14. FormationEditor uses UI icon API.
15. PlayerProductionBar uses UI icon API.
16. Formation display does not open actor bundles.
17. Formation display does not download one ZIP per character.
18. Formation and production card display do not request `public/assets/bcu/**`.
19. `archive()` and `readCoreDb()` have in-flight promise caching.
20. Safari error diagnostics exist.
21. KBEff raw-path risk is fixed or gated.
22. background/castle/actor/effect/icon diagnostics are concrete.
23. Apply Battle succeeds with `blockedRawReads = []` and `rawFallbacks = []`.
24. Verification results are documented in `docs/bcu-migration-status.md`.

---

# 12. Codex instruction

Implement this contract.

Do not regress into:

- “generated is empty”
- one ZIP per icon,
- actor ZIP icon loading,
- raw BCU runtime fetches,
- silent wrong icon source usage,
- silent background/castle fallback,
- weak `Error {}` diagnostics.

Prioritize:

1. detailed error logging,
2. archive/coreDb promise cache,
3. aggregated icon ZIPs,
4. UI icon API,
5. Formation/production icon switch,
6. raw runtime regression checks,
7. KBEff semantic/gated fix,
8. concrete bundle diagnostics,
9. BCU structural migration plan for StageRuntime / BattleScene split / proc runtime.

Verify with:

- Network panel,
- resource entries,
- diagnostics,
- generated audit files,
- docs update.

Do not claim success without verification.
