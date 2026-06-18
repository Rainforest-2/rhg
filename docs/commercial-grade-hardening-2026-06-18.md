# Commercial-grade hardening + UI/loading pass — 2026-06-18

Scope: raise the browser app to commercial-grade quality (robustness, tooling, security hygiene) and
fix three reported UI/loading behaviors. No BCU combat-parity rows changed; this pass is tooling, DOM
security, the stage selector, and the custom-stage-battle loading path. See
[`completion-audit.md`](./completion-audit.md) for the battle-parity completion state.

Method: read the real files, change minimally, verify with `node --check`, `npm test`
(`tests/*.test.mjs`), and the deterministic `scripts/check-*.mjs` suites.

## 1. Packaging / tooling

- `package.json` now declares `"type": "module"` (removes the `MODULE_TYPELESS_PACKAGE_JSON` warning
  emitted by every `scripts/check-*.mjs` that imports a `.js` module), plus `name`, `version`,
  `private: true`, `description`, and `license: "UNLICENSED"`.
- npm scripts: `check` (deterministic safe suite), `test` (`node --test tests/*.test.mjs`),
  `verify` (`check` + `test`), kept `verify:dev` / `preview:stop`.
- Removed `test:e2e` (`playwright test`): there is no Playwright config or `*.spec.*` file, and the
  default Playwright `testMatch` would mis-collect the `node:test` file `tests/bcu-combat-parity.test.mjs`
  and exit non-zero. The project uses Playwright as a library via `scripts/dev-verify-env.sh`, not the
  test runner.
- Verified safe: no CommonJS (`require`/`module.exports`) in any `.js` under `js/`, `scripts/`, `tools/`,
  `tests/`, and no `.cjs` files, so `type: module` does not break Node tooling; the browser ignores
  `package.json`. App remains a static ES-module site (no bundler; `index.html` → `./js/main.js`),
  deployed as-is to GitHub Pages — no build step added.

## 2. DOM security (HTML injection / self-XSS)

The codebase already escapes interpolated `innerHTML` via `esc()` / `safeHtml()` / `safeBootText()`
helpers in most UI files; the audit found the gaps and closed them:

- `js/ui/FormationEditor.js` — the catalog **search input value** (`this.searchDraft`, set from raw
  `input.value`) was reflected into `value='…'` unescaped, allowing attribute breakout. Added a local
  `esc()` and escaped the search value plus the catalog character label/id and stage card name/reason
  text (matches the `safeHtml` discipline already used in `FormationCatalogVirtualDomPatch`).
- `js/preview/PreviewUi.js` — the dev log panel rendered `l.msg` into `innerHTML` unescaped (default
  hidden, but enabled for diagnostics). Added `esc()` for the message/level/time text.

No user-controllable or external text now reaches `innerHTML` unescaped.

## 3. Asset loader diagnosability

- `js/bcu/BcuAssetLoader.js` `tryLoadImage` previously swallowed image-load failures with an empty
  `catch {}`. It now keeps the last error on the returned object (`error`) while preserving the
  candidate-fallback control flow, so a genuine load failure is diagnosable instead of silent.

## 4. Stage selector: scroll position preserved on back navigation

`js/ui/FormationEditorPerformancePatch.js` owns the category → map → stage selector. Returning from the
stage list to the map list previously snapped to the top (`renderStageItemWindow` reset
`list.scrollTop = 0` on every view-key change).

- `renderStageItemWindow` now restores the scroll position the target view was last left at (stored per
  view key in `editor.__stageSelectorScrollByKey`) and computes the virtual window from that position,
  so the rendered slice matches the restored scroll (no blank flash). First visit to a view still
  starts at the top.
- `patchedRenderStageSelector` re-applies the restore position after the `innerHTML` swap (and once more
  on the next animation frame) because replacing markup drops `scrollTop`.
- `patchedOnScroll` records the live `scrollTop` per view key, gated to `map`/`stage` levels so scrolling
  the (stale-keyed) category list cannot overwrite a saved map/stage position.

## 5. Custom stage battle: multi-stage loading shown in the overlay

`js/battle/BattleSceneCustomStageBattlePatch.js`. The custom-stage runtime already loaded **all** enemy
and player stages (`initializeCustomStageBattle` loops both lists), but it ran **after** the base
`BattleScene.init` had already reported progress up to `value: 1.0` (`ready`), and reported no progress
itself — so the loading overlay appeared finished while the remaining stages streamed in silently
(the "only the first stage's loading is shown" symptom).

- The patched `init` now, when custom stage battle is enabled, scales the base init's progress into
  `[0, 0.6]` and reserves `[0.6, 1.0]` for the custom stages (stored on `scene.__customStageProgress`,
  cleared in `finally`). Non-custom battles are unaffected (wrapper only applies when enabled and an
  `onProgress` callback is present).
- `initializeCustomStageBattle` reports per-stage progress (`カスタムステージを準備中… (n/total)`) as it
  loads each enemy/player stage, then a completion report at `value: 1`. The overlay's progress value is
  monotonic, so the bar climbs through the reserved band instead of freezing at 100%.

## 6. Optimization: concurrent per-stage template preload

`js/battle/BattleSceneCustomStageBattlePatch.js` `loadStageState` preloaded a stage's enemy templates
one-by-one (`for … await`). It now preloads them concurrently with `Promise.all`:

- Each `unitDef` has a unique `slotId`; `BattleActorFactory.preloadTemplate` de-dups in-flight loads by
  key and `BcuAssetLoader` de-dups by URL, so distinct templates load independently while shared assets
  share one request.
- Preloading is I/O-bound and consumes no RNG, so determinism is unchanged; per-unit error handling is
  preserved (each rejection caught locally → unit marked `unavailable`, `Promise.all` never rejects).
- Stages are still loaded sequentially so the per-stage progress (§5) stays meaningful; the
  parallelism is within each stage, where the bulk of the load time is.

## 7. Verified (no change)

- Stage search (catalog `data-search-input` and stage `data-stage-search-input`) commits **only** on the
  検索 button: `FormationEditor.onInput` / `FormationStageDifficultyPatch.setDraftFromTarget` update a
  draft on keystroke and never re-filter; `commitDraftFilter` + `catalog-search` run on click. No
  search-on-type regression exists.

## 8. Verification

- `node --check` on every changed file — OK.
- `npm test` (`node --test tests/*.test.mjs`) — 19 / 19 PASS.
- `node scripts/check-bcu-ability-parity-safe-suite.mjs` — OK (exit 0).
- Formation checks (`check-formation-virtual-icon-loading`, `-catalog-grid-layout`, `-premium-motion`,
  `-character-tuning-logic`) — PASS.
- No `scripts/check-*.mjs` references the stage-selector scroll internals or the custom-stage progress
  path, so these UI changes are outside the deterministic-check surface; they are covered by the safe
  suite staying green plus the verifications above.

## 9. Out of code scope

Actual commercial distribution remains blocked by third-party IP: the app reproduces PONOS *The Battle
Cats* assets/data/mechanics and bundles licensed commercial fonts. This pass raised code quality to a
commercial-grade bar; it does not (and cannot in code) make the bundled content distributable.
