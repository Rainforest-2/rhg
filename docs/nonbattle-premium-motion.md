# Non-battle premium motion layer (2026-06-12)

Commercial-quality motion/interaction pass for the non-battle shell (formation
editor, character tuning overlay, stage selector). No data flow, layout, or
asset pipeline changes; everything is additive motion + interaction fixes.

## Ownership

### `css/nyanko-premium-polish.css` (must stay the last stylesheet in `index.html`)

Owns only premium motion/interaction layers, never base appearance:

- transient animation classes consumed from `FormationPremiumMotionPatch.js`
  (`is-page-enter`, `is-catalog-enter`, `is-view-enter`, `is-opening`, `is-closing`)
- Apply Battle idle sheen sweep + disabled/busy state
- keyboard `:focus-visible` rings, tap-highlight removal, search input focus glow
- themed scrollbars for `.formation-catalog-scroll` / `.formation-stage-list`
- `prefers-reduced-motion` collapse for all of the above

### `js/ui/FormationPremiumMotionPatch.js` (must stay the last import in `installUiPatches.js`)

Applies transient classes only; wrappers must run outermost around the patched
`FormationEditor` prototype:

- `switchPage`: direction-aware slot slide (`data-page-dir` fwd/back)
- `renderDynamic`: catalog stagger on faction-filter swap or first catalog fill
  (count 0 -> N). Scroll-driven virtual re-renders never animate.
- `renderStageSelector`: spring open / fade close for the stage overlay, and
  hierarchy stagger when the category/map/stage view signature changes.
  Filter and virtual-scroll re-renders keep the same signature and never animate.

### `js/ui/FormationEditorBcuUnitLevelPatch.js` (injected style owns tuning overlay + long-press motion)

- Long-press charge: `.formation-slot.is-charging` squeeze + conic-gradient
  progress ring (`.formation-slot-charge`, `@property --formation-slot-charge`).
  Ring fade-in is delayed `LONG_PRESS_RING_DELAY_MS` so quick taps never flash.
  Sweep duration is derived from the same `LONG_PRESS_MS` constant as the timer.
- Fire: `.formation-slot.is-charge-fired` burst + optional `navigator.vibrate(12)`.
- Overlay open: `.is-opening` spring panel + staggered header/hero/body/footer.
  Close: `.is-closing` fade/pop-out, then classes and innerHTML are cleared.
- Settled re-renders (stepper clicks) set `data-tuning-settled` and suppress all
  entrance animations (including ui-polish `gameUiEnter` and the regression-fix
  `popIn`, via `panel.dataset.motionFixSeen`), so the panel never re-pops; only
  the readout ticks and the meter width transitions.
- Typing fix: `input` events update the draft live (`updateTuningDynamic`
  patches meters/steppers/summary in place) without re-rendering, so the field
  keeps focus; `change`/Enter commits with clamping and a full re-render.

## Verification (browser-free)

```bash
node scripts/check-formation-premium-motion.mjs
node scripts/check-formation-character-tuning-logic.mjs
```

`check-formation-premium-motion.mjs` cross-references every JS-toggled class
against its CSS rule, asserts the stylesheet/import ordering invariants above,
asserts reduced-motion guards exist, and pins the browser-review regressions
below.

## Browser review 2026-06-12 (Playwright, desktop 1440x900 + iPhone-class 932x430 coarse-pointer)

`scripts/check-nonbattle-ui-polish.mjs` passes on all 7 viewports with zero
console errors. Interactive review (long-press charge, tuning overlay, stage
selector hierarchy, page/filter transitions) was screenshot-verified; runtime
probes confirmed the charge ring sweeps in sync with the 520ms timer and that
tuning inputs keep focus while typing. Issues found and fixed:

- Charge ring was pale-yellow on parchment (invisible); now a gold-to-orange
  arc over a dark track with glow.
- Tuning preset chips rendered as stacked full-width bars (global style.css
  `button{width:100%}` leak); presets now use their own `auto-fit` grid.
- `閉じる` and stepper buttons clipped their labels (global `button` padding
  inside fixed heights); now inline-flex centered with explicit padding.
- Phone-landscape action rail collapsed into overflowing micro-chips (the
  <=980px 4-column rail rule leaked through); rail now pins
  `grid-template-columns:1fr` under the coarse-pointer landscape query.
- Phone-landscape tuning body was top-stuck with a dead lower half; now
  `align-content:safe center`.
- Brush fonts (5.7MB) only loaded on first overlay open and use
  `font-display:block` (invisible text risk); both are now preloaded from
  `index.html`.
- Active page tab (black plate) was ambiguous against the bright inactive tab;
  it now carries a gold selection ring (premium sheet).

Note: the phone-landscape layout requires `(pointer: coarse)`; Playwright
must emulate `isMobile`/`hasTouch` or the squeezed desktop layout renders
instead and the catalog appears empty.
