const STYLE_ID = 'character-modification-mobile-information-architecture-style';

const CSS = `
/*
 * Mobile information architecture
 *
 * The desktop editor keeps generous 44px controls. On phones, the visible
 * chrome is compacted while frequently-tapped icon controls retain an expanded
 * invisible hit zone. The editing canvas, not the surrounding bars, owns the
 * majority of the viewport.
 */
.cm-host-layer .cm-field-reset {
  width: 44px !important;
  min-width: 44px !important;
}

@media (max-width: 700px) {
  .cm-host-layer:not(.cm-host-layer-embedded) {
    inset: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    align-items: stretch !important;
    justify-content: stretch !important;
  }

  .cm-host-layer:not(.cm-host-layer-embedded) .cm-dialog,
  .cm-host-layer .cm-dialog-embedded {
    width: 100% !important;
    max-width: none !important;
    height: var(--cm-available-height, var(--cm-viewport-height, 100dvh)) !important;
    max-height: var(--cm-available-height, var(--cm-viewport-height, 100dvh)) !important;
    margin: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  html body.nyanko-ui-polish
    .formation-custom-spawn-modal-card.cm-embedded-container {
    width: 100vw !important;
    max-width: 100vw !important;
    height: var(--cm-available-height, var(--cm-viewport-height, 100dvh)) !important;
    max-height: var(--cm-available-height, var(--cm-viewport-height, 100dvh)) !important;
    margin: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  html body.nyanko-ui-polish
    .formation-custom-spawn-modal-card.cm-embedded-container
    > .cm-host-layer-embedded {
    width: 100% !important;
    height: 100% !important;
    max-height: 100% !important;
    margin: 0 !important;
    border-radius: 0 !important;
  }

  .cm-host-layer {
    --cm-mobile-header: 44px;
    --cm-mobile-toolbar: 40px;
    --cm-mobile-category: 36px;
    --cm-mobile-section: 32px;
    --cm-mobile-footer: 46px;
    font-size: 13px !important;
    line-height: 1.25 !important;
  }

  .cm-host-layer .cm-editor {
    grid-template-rows:
      var(--cm-mobile-header)
      var(--cm-mobile-toolbar)
      minmax(0, 1fr)
      var(--cm-mobile-footer) !important;
  }

  .cm-host-layer .cm-editor button {
    min-height: 34px !important;
    padding-inline: 8px !important;
    font-size: 12px !important;
    line-height: 1 !important;
  }

  .cm-host-layer .cm-icon-button,
  .cm-host-layer .cm-category,
  .cm-host-layer .cm-utility-command,
  .cm-host-layer [data-cm-action='reset-all'] {
    position: relative !important;
  }

  .cm-host-layer .cm-icon-button::after,
  .cm-host-layer .cm-category::after,
  .cm-host-layer .cm-utility-command::after,
  .cm-host-layer [data-cm-action='reset-all']::after {
    content: '';
    position: absolute;
    inset: -4px;
  }

  .cm-host-layer .cm-header {
    grid-template-columns: 36px 34px minmax(0, 1fr) auto !important;
    gap: 6px !important;
    min-height: var(--cm-mobile-header) !important;
    height: var(--cm-mobile-header) !important;
    max-height: var(--cm-mobile-header) !important;
    padding: 4px 6px !important;
  }

  .cm-host-layer .cm-close,
  .cm-host-layer .cm-header .cm-icon-button {
    width: 34px !important;
    min-width: 34px !important;
    min-height: 34px !important;
    padding: 0 !important;
    border-radius: 7px !important;
  }

  .cm-host-layer .cm-subject-icon {
    display: grid !important;
    place-items: center !important;
    width: 34px !important;
    height: 34px !important;
    border-width: 1px !important;
    border-radius: 7px !important;
  }

  .cm-host-layer .cm-identity {
    display: block !important;
    min-width: 0 !important;
  }

  .cm-host-layer .cm-subject-title {
    min-width: 0 !important;
  }

  .cm-host-layer .cm-subject-name {
    display: block !important;
    overflow: hidden !important;
    color: var(--cm-ink) !important;
    font-size: 13.5px !important;
    font-weight: 850 !important;
    line-height: 1.15 !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }

  .cm-host-layer .cm-subject-title small,
  .cm-host-layer .cm-title {
    display: none !important;
  }

  .cm-host-layer .cm-changed-count {
    min-width: 0 !important;
    min-height: 28px !important;
    height: 28px !important;
    padding: 0 7px !important;
    border-width: 1px !important;
    border-radius: 7px !important;
    font-size: 10.5px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
  }

  .cm-host-layer .cm-toolbar {
    grid-template-columns: minmax(72px, 1fr) 34px 88px 72px !important;
    align-items: center !important;
    gap: 4px !important;
    min-height: var(--cm-mobile-toolbar) !important;
    height: var(--cm-mobile-toolbar) !important;
    max-height: var(--cm-mobile-toolbar) !important;
    padding: 2px 6px !important;
  }

  .cm-host-layer .cm-search-label,
  .cm-host-layer .cm-ability-filter {
    min-width: 0 !important;
  }

  .cm-host-layer .cm-search {
    min-height: 36px !important;
    height: 36px !important;
    padding: 0 9px !important;
    border-width: 1px !important;
    border-radius: 7px !important;
    font-size: 13.5px !important;
    font-weight: 600 !important;
  }

  .cm-host-layer .cm-filter-check {
    position: relative !important;
    display: grid !important;
    place-items: center !important;
    width: 34px !important;
    min-width: 34px !important;
    min-height: 34px !important;
    height: 34px !important;
    padding: 0 !important;
    border: 1px solid var(--cm-line) !important;
    border-radius: 7px !important;
    background: var(--cm-surface) !important;
  }

  .cm-host-layer .cm-filter-check input {
    width: 19px !important;
    min-width: 19px !important;
    height: 19px !important;
  }

  .cm-host-layer .cm-filter-check span {
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    padding: 0 !important;
    margin: -1px !important;
    overflow: hidden !important;
    clip: rect(0, 0, 0, 0) !important;
    white-space: nowrap !important;
    border: 0 !important;
  }

  .cm-host-layer .cm-toolbar .cm-select {
    min-height: 36px !important;
    height: 36px !important;
    padding: 0 20px 0 7px !important;
    border-width: 1px !important;
    border-radius: 7px !important;
    font-size: 11px !important;
    font-weight: 700 !important;
  }

  .cm-host-layer .cm-history {
    display: grid !important;
    grid-template-columns: repeat(2, 34px) !important;
    gap: 4px !important;
    width: 72px !important;
  }

  .cm-host-layer .cm-history .cm-icon-button {
    width: 34px !important;
    min-width: 34px !important;
    min-height: 34px !important;
    padding: 0 !important;
    border-radius: 7px !important;
  }

  .cm-host-layer .cm-workspace {
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: var(--cm-mobile-category) minmax(0, 1fr) !important;
  }

  .cm-host-layer .cm-categories {
    flex-direction: row !important;
    align-items: center !important;
    gap: 4px !important;
    min-height: var(--cm-mobile-category) !important;
    height: var(--cm-mobile-category) !important;
    max-height: var(--cm-mobile-category) !important;
    padding: 2px 6px !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    border-right: 0 !important;
    border-bottom: 1px solid var(--cm-line) !important;
    scrollbar-width: none !important;
  }

  .cm-host-layer .cm-categories::-webkit-scrollbar {
    display: none !important;
  }

  .cm-host-layer .cm-category {
    flex: 0 0 auto !important;
    width: auto !important;
    min-width: 0 !important;
    min-height: 32px !important;
    height: 32px !important;
    padding: 0 10px !important;
    border-radius: 7px !important;
    font-size: 11.5px !important;
    font-weight: 800 !important;
    white-space: nowrap !important;
  }

  .cm-host-layer .cm-category.is-active {
    box-shadow: inset 0 -3px 0 var(--cm-primary) !important;
  }

  .cm-host-layer .cm-category-count {
    min-width: 18px !important;
    height: 18px !important;
    margin-left: 5px !important;
    font-size: 9px !important;
  }

  .cm-host-layer .cm-content {
    grid-template-rows: var(--cm-mobile-section) auto minmax(0, 1fr) !important;
  }

  .cm-host-layer .cm-content-head {
    min-height: var(--cm-mobile-section) !important;
    height: var(--cm-mobile-section) !important;
    max-height: var(--cm-mobile-section) !important;
    padding: 0 8px !important;
    background: var(--cm-soft) !important;
  }

  .cm-host-layer .cm-content-head h2 {
    font-size: 12.5px !important;
    line-height: 1 !important;
  }

  .cm-host-layer .cm-content-head [data-cm-action='reset-category'] {
    width: 32px !important;
    min-width: 32px !important;
    min-height: 32px !important;
    height: 32px !important;
    padding: 0 !important;
    overflow: hidden !important;
    border: 0 !important;
    font-size: 0 !important;
  }

  .cm-host-layer .cm-content-head [data-cm-action='reset-category'] i {
    font-size: 12px !important;
  }

  .cm-host-layer .cm-field-list {
    padding: 6px 6px 10px !important;
    scroll-padding-block: 6px !important;
  }

  .cm-host-layer .cm-field {
    grid-template-columns: minmax(0, 1fr) !important;
    column-gap: 0 !important;
    row-gap: 6px !important;
    margin: 0 0 6px !important;
    padding: 9px !important;
    border-radius: 8px !important;
    box-shadow: none !important;
  }

  .cm-host-layer .cm-field-head {
    grid-template-columns: minmax(0, 1fr) auto 34px !important;
    align-items: center !important;
    gap: 6px !important;
  }

  .cm-host-layer .cm-field-title h3 {
    font-size: 13.5px !important;
    line-height: 1.2 !important;
  }

  .cm-host-layer .cm-field-badges {
    display: flex !important;
    align-items: center !important;
    gap: 3px !important;
  }

  .cm-host-layer .cm-badge {
    min-height: 20px !important;
    padding: 2px 6px !important;
    border-radius: 999px !important;
    font-size: 9.5px !important;
    line-height: 1 !important;
  }

  .cm-host-layer .cm-field-reset {
    width: 34px !important;
    min-width: 34px !important;
    min-height: 34px !important;
    height: 34px !important;
    padding: 0 !important;
  }

  .cm-host-layer .cm-comparison,
  .cm-host-layer .cm-field-control {
    grid-column: 1 !important;
  }

  .cm-host-layer .cm-comparison {
    gap: 4px !important;
    max-width: none !important;
  }

  .cm-host-layer .cm-field:not(.is-read-only)
    .cm-comparison
    .cm-value-block:last-child {
    display: none !important;
  }

  .cm-host-layer .cm-value-block {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 8px !important;
    min-height: 0 !important;
    padding: 4px 7px !important;
    border: 0 !important;
    border-left: 3px solid var(--cm-line) !important;
    border-radius: 4px !important;
    background: var(--cm-soft) !important;
  }

  .cm-host-layer .cm-field.is-changed .cm-value-block {
    border-left-color: var(--cm-accent) !important;
  }

  .cm-host-layer .cm-value-block > span {
    font-size: 10px !important;
    line-height: 1 !important;
  }

  .cm-host-layer .cm-value-block output {
    overflow: hidden !important;
    font-size: 12.5px !important;
    line-height: 1 !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }

  .cm-host-layer .cm-number-input,
  .cm-host-layer .cm-field-control .cm-select {
    min-height: 38px !important;
    height: 38px !important;
    padding-block: 0 !important;
    border-width: 1px !important;
    border-radius: 7px !important;
    font-size: 14px !important;
    font-weight: 650 !important;
  }

  .cm-host-layer .cm-number-stepper {
    grid-template-columns: 36px minmax(0, 1fr) 36px !important;
    gap: 5px !important;
    width: 100% !important;
    max-width: none !important;
  }

  .cm-host-layer .cm-number-stepper .cm-icon-button {
    width: 36px !important;
    min-width: 36px !important;
    min-height: 36px !important;
    height: 36px !important;
    padding: 0 !important;
    font-size: 14px !important;
  }

  .cm-host-layer .cm-input-label,
  .cm-host-layer .cm-unit-hint {
    font-size: 10.5px !important;
  }

  .cm-host-layer .cm-footer {
    grid-template-columns: 0 minmax(0, 1fr) !important;
    gap: 0 !important;
    min-height: var(--cm-mobile-footer) !important;
    height: var(--cm-mobile-footer) !important;
    max-height: calc(var(--cm-mobile-footer) + env(safe-area-inset-bottom, 0px)) !important;
    padding: 3px 6px calc(3px + env(safe-area-inset-bottom, 0px)) !important;
    box-shadow: 0 -2px 8px rgba(21, 38, 29, .07) !important;
  }

  .cm-host-layer .cm-status {
    display: none !important;
  }

  .cm-host-layer .cm-footer-commands {
    display: flex !important;
    align-items: center !important;
    justify-content: stretch !important;
    gap: 4px !important;
    width: 100% !important;
  }

  .cm-host-layer .cm-footer .cm-command {
    min-height: 40px !important;
    height: 40px !important;
    padding: 0 8px !important;
    border-radius: 7px !important;
    font-size: 11.5px !important;
  }

  .cm-host-layer .cm-footer .cm-utility-command,
  .cm-host-layer .cm-footer [data-cm-action='import'],
  .cm-host-layer .cm-footer [data-cm-action='export'],
  .cm-host-layer .cm-footer [data-cm-action='reset-all'] {
    flex: 0 0 34px !important;
    width: 34px !important;
    min-width: 34px !important;
    min-height: 34px !important;
    height: 34px !important;
    padding: 0 !important;
    overflow: hidden !important;
    font-size: 0 !important;
  }

  .cm-host-layer .cm-footer .cm-utility-command i,
  .cm-host-layer .cm-footer [data-cm-action='import'] i,
  .cm-host-layer .cm-footer [data-cm-action='export'] i,
  .cm-host-layer .cm-footer [data-cm-action='reset-all'] i {
    margin: 0 !important;
    font-size: 13px !important;
  }

  .cm-host-layer .cm-cancel-command {
    flex: 0 0 auto !important;
    min-width: 70px !important;
  }

  .cm-host-layer .cm-command.is-primary {
    flex: 1 1 auto !important;
    min-width: 78px !important;
    font-size: 12.5px !important;
  }

  .cm-host-layer.cm-keyboard-open .cm-editor {
    grid-template-rows: 38px minmax(0, 1fr) 0 !important;
  }

  .cm-host-layer.cm-keyboard-open .cm-header {
    min-height: 38px !important;
    height: 38px !important;
    max-height: 38px !important;
    padding-block: 2px !important;
  }

  .cm-host-layer.cm-keyboard-open .cm-subject-icon,
  .cm-host-layer.cm-keyboard-open .cm-changed-count {
    display: none !important;
  }

  .cm-host-layer.cm-keyboard-open .cm-header {
    grid-template-columns: 34px minmax(0, 1fr) !important;
  }
}

@media (max-width: 420px) {
  .cm-host-layer .cm-toolbar {
    grid-template-columns: minmax(62px, 1fr) 32px 78px 68px !important;
    gap: 3px !important;
    padding-inline: 4px !important;
  }

  .cm-host-layer .cm-filter-check,
  .cm-host-layer .cm-history .cm-icon-button {
    width: 32px !important;
    min-width: 32px !important;
  }

  .cm-host-layer .cm-history {
    grid-template-columns: repeat(2, 32px) !important;
    gap: 4px !important;
    width: 68px !important;
  }

  .cm-host-layer .cm-toolbar .cm-select {
    font-size: 10.5px !important;
  }

  .cm-host-layer .cm-category {
    padding-inline: 8px !important;
    font-size: 11px !important;
  }

  .cm-host-layer .cm-footer .cm-command {
    padding-inline: 6px !important;
  }

  .cm-host-layer .cm-cancel-command {
    min-width: 64px !important;
  }
}

@media (orientation: landscape) and (max-height: 520px) {
  .cm-host-layer {
    --cm-mobile-header: 38px;
    --cm-mobile-toolbar: 36px;
    --cm-mobile-category: 32px;
    --cm-mobile-section: 30px;
    --cm-mobile-footer: 42px;
  }

  .cm-host-layer .cm-header {
    grid-template-columns: 32px 30px minmax(0, 1fr) auto !important;
    gap: 4px !important;
    padding: 2px 5px !important;
  }

  .cm-host-layer .cm-close,
  .cm-host-layer .cm-header .cm-icon-button {
    width: 32px !important;
    min-width: 32px !important;
    min-height: 32px !important;
  }

  .cm-host-layer .cm-subject-icon {
    width: 30px !important;
    height: 30px !important;
  }

  .cm-host-layer .cm-toolbar {
    min-height: var(--cm-mobile-toolbar) !important;
    height: var(--cm-mobile-toolbar) !important;
    padding-block: 1px !important;
  }

  .cm-host-layer .cm-search,
  .cm-host-layer .cm-toolbar .cm-select {
    min-height: 32px !important;
    height: 32px !important;
  }

  .cm-host-layer .cm-filter-check,
  .cm-host-layer .cm-history .cm-icon-button {
    min-height: 32px !important;
    height: 32px !important;
  }

  .cm-host-layer .cm-category {
    min-height: 28px !important;
    height: 28px !important;
    padding-inline: 8px !important;
  }

  .cm-host-layer .cm-content-head [data-cm-action='reset-category'] {
    min-height: 30px !important;
    height: 30px !important;
  }

  .cm-host-layer .cm-field-list {
    padding: 5px 6px 8px !important;
  }

  .cm-host-layer .cm-field {
    row-gap: 5px !important;
    margin-bottom: 5px !important;
    padding: 7px 8px !important;
  }

  .cm-host-layer .cm-footer {
    padding-block: 1px calc(1px + env(safe-area-inset-bottom, 0px)) !important;
  }

  .cm-host-layer .cm-footer .cm-command {
    min-height: 36px !important;
    height: 36px !important;
  }
}
`;

function installCharacterModificationMobileInformationArchitecturePatch() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

installCharacterModificationMobileInformationArchitecturePatch();

export {
  CSS as CHARACTER_MODIFICATION_MOBILE_INFORMATION_ARCHITECTURE_CSS,
  installCharacterModificationMobileInformationArchitecturePatch
};
