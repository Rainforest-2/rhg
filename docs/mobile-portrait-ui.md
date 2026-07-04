# Mobile portrait UI (non-battle screens)

Portrait-phone layout layer for the formation editor, stage selector, settings,
tuning overlay, and custom stage screens. Landscape phones keep the tuned
`css/mobile-landscape-fit.css` / `FormationPhoneLandscapeLayoutPatch.js` pass;
everything here is guarded by `(orientation: portrait)`.

## Owners

- `css/mobile-portrait-fit.css` — all portrait geometry (formation shell,
  header, slots, 3-column catalog, action rail, stage-selector toolbar/cards,
  settings/tuning safe-area). Linked from `index.html` after the
  stage-selector sheets and before `nyanko-premium-polish.css` (which must
  stay the last stylesheet — see `scripts/check-formation-premium-motion.mjs`).
  Also owns the `@media (hover: none)` pass that stops `:hover` lift/glow from
  sticking after taps on touch devices (any orientation).
- `js/ui/FormationPhonePortraitLayoutPatch.js` — keeps the catalog virtual
  scroller in sync with the stylesheet and re-renders once the editor becomes
  visible and on rotation. Registered in `js/boot/groups/uiPatches.js` before
  `FormationPremiumMotionPatch.js` (which must stay last).

## Row-height contracts (do not break silently)

| List | CSS | Virtual metric |
| --- | --- | --- |
| Catalog (portrait) | card `132px` + grid gap `6px` in `mobile-portrait-fit.css` | `rowHeight 138` in `FormationPhonePortraitLayoutPatch.js` |
| Map/stage cards (portrait) | card `66px` + list gap `8px` | first-render estimate `STAGE_WINDOW_MOBILE_ROW_HEIGHT = 74` |
| Map/stage cards (all viewports) | whatever the winning sheet paints | `measuredStageRowHeight()` in `FormationEditorPerformancePatch.js` measures a painted card + row gap on same-view re-renders, replacing the estimate |

`measuredStageRowHeight` exists because the fixed estimates (74/92) did not
match the painted rows on landscape phones (54+7) or desktop (80+10), which
made long virtualized map lists jump while scrolling.

## Behavior improvements bundled with this layer

- Enter (mobile keyboard 検索 key) commits the catalog search and blurs the
  input (`FormationEditor.onKeyDown`); the stage-map search already did this.
- Both search inputs carry `enterkeyhint='search' autocomplete/autocorrect/
  autocapitalize=off spellcheck=false`.
- Tapping the dimmed backdrop closes the stage overlay (parity with the
  settings overlay).
- `html,body { overscroll-behavior:none }` (touch-fix.css) kills Android
  pull-to-refresh; `interactive-widget=resizes-visual` in the viewport meta
  stops the software keyboard from squashing the 100dvh layout.

## Verification

Needs a running preview server (see `scripts/dev-verify-env.sh`, which runs
both UI checks automatically):

```bash
npm run build && npm run preview -- --host 127.0.0.1 --port 4173 &
UI_POLISH_URL=http://127.0.0.1:4173/ node scripts/check-nonbattle-ui-polish.mjs   # landscape/desktop
UI_POLISH_URL=http://127.0.0.1:4173/ node scripts/check-mobile-portrait-ui.mjs    # portrait phones
```

The portrait check asserts: no horizontal overflow, header title not
ellipsized, catalog paints 3 columns with virtual rowHeight == painted rows,
action-rail labels not clipped, selected-stage pill visible, map-list virtual
rowHeight == painted rows after one scroll, backdrop close, and Enter commit.
Screenshots land in `tmp/ui-polish-screens/portrait-*.png`.
