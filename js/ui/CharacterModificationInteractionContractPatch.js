const STYLE_ID = 'character-modification-interaction-contract-style';

function installCharacterModificationInteractionContractPatch() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.cm-host-layer .cm-editor button,
.cm-host-layer .cm-editor [role='button'] {
  min-height: 44px !important;
}

.cm-host-layer .cm-content-head [data-cm-action='reset-category'] {
  min-height: 44px !important;
  padding-block: 6px !important;
}

/* The custom-stage host has a highly-specific game-button reset. The semantic
 * primary action must remain stronger than that neutral reset in every host. */
html body.nyanko-ui-polish
  .formation-custom-builder
  .cm-host-layer
  .cm-editor
  button.cm-command.is-primary,
html body.nyanko-ui-polish
  .formation-custom-spawn-modal-card
  .cm-host-layer
  .cm-editor
  button.cm-command.is-primary,
.cm-host-layer .cm-editor button.cm-command.is-primary {
  border-color: #075b4c !important;
  background: var(--cm-primary, #087864) !important;
  background-image: none !important;
  color: #fff !important;
  -webkit-text-fill-color: #fff !important;
}

html body.nyanko-ui-polish
  .formation-custom-spawn-modal-card
  .cm-host-layer
  .cm-editor
  button.cm-command.is-primary:hover:not(:disabled),
.cm-host-layer .cm-editor button.cm-command.is-primary:hover:not(:disabled) {
  background: var(--cm-primary-hover, #056451) !important;
}

@media (max-width: 700px) {
  /* Older responsive rules placed filters on an implicit second row. The
   * compact mobile toolbar owns placement and must stay a single row. */
  .cm-host-layer .cm-search-label,
  .cm-host-layer .cm-filter-check,
  .cm-host-layer .cm-ability-filter,
  .cm-host-layer .cm-history {
    grid-column: auto !important;
    grid-row: auto !important;
  }
}

@media (orientation: landscape) and (max-height: 520px) {
  .cm-host-layer .cm-editor button,
  .cm-host-layer .cm-editor [role='button'],
  .cm-host-layer .cm-content-head [data-cm-action='reset-category'] {
    min-height: 44px !important;
  }
}
`;
  document.head.appendChild(style);
}

installCharacterModificationInteractionContractPatch();

export { installCharacterModificationInteractionContractPatch };
