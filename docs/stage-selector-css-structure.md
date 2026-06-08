# Stage selector CSS structure

This cleanup keeps runtime logic and visual output unchanged while separating CSS responsibilities.

## Current load order

`index.html` loads the relevant final UI styles in this order:

1. `css/nyanko-stage-selector-game-ui.css`
2. `css/nyanko-loading-background-fix.css`
3. `css/nyanko-stage-selector-photo-ui.css`

The last file, `nyanko-stage-selector-photo-ui.css`, owns the final red-bar appearance for map and stage cards.

## Ownership rules

### `css/nyanko-loading-background-fix.css`

Owns only:

- `#boot-status-panel`
- `.app-loading-overlay`
- `.app-loading-overlay[data-loading-mode="battle"]`

It must not contain selector card/grid/font rules.

### `css/nyanko-stage-selector-game-ui.css`

Owns the existing broad game-style selector skin and shared selector controls. It is intentionally left unchanged in this cleanup to avoid visual regressions.

### `css/nyanko-stage-selector-photo-ui.css`

Owns the final Battle Cats reference red-bar override for:

- `.formation-stage-card[data-stage-map]`
- `.formation-stage-card[data-stage-id]`
- the local `FOT-大江戸勘亭流 Std E.otf` font face used by those cards

## Non-goals

- No DOM changes.
- No click/filter/difficulty logic changes.
- No selector visual redesign.
- No stylesheet load-order change.
- No attempt to remove all `!important` usage in this pass.

## Why this cleanup exists

The previous state had map/stage red-bar rules duplicated inside `nyanko-loading-background-fix.css`, whose name and purpose are loading-screen-only. Because `nyanko-stage-selector-photo-ui.css` is loaded later and already contains the final red-bar rules, removing the misplaced duplicate rules from the loading CSS should not change rendered UI, but it makes future changes safer.
