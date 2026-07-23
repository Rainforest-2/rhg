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
