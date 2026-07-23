const STYLE_ID = 'character-modification-embedded-viewport-contract-style';

function installCharacterModificationEmbeddedViewportContractPatch() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
html body.nyanko-ui-polish
  .formation-custom-spawn-modal-card.cm-embedded-container
  > .cm-host-layer-embedded {
  width: 100% !important;
  height: min(
    100%,
    var(--cm-available-height, var(--cm-viewport-height, 100dvh))
  ) !important;
  max-height: var(
    --cm-available-height,
    var(--cm-viewport-height, 100dvh)
  ) !important;
  margin-top: var(--cm-viewport-inset-top, 0px) !important;
  transform: none !important;
  overflow: hidden !important;
}

html body.nyanko-ui-polish
  .formation-custom-spawn-modal-card.cm-embedded-container
  > .cm-host-layer-embedded.cm-keyboard-open {
  height: var(
    --cm-available-height,
    var(--cm-viewport-height, 100dvh)
  ) !important;
  max-height: var(
    --cm-available-height,
    var(--cm-viewport-height, 100dvh)
  ) !important;
  margin-top: var(--cm-viewport-inset-top, 0px) !important;
}

html body.nyanko-ui-polish
  .formation-custom-spawn-modal-card.cm-embedded-container
  > .cm-host-layer-embedded
  > .cm-dialog-embedded,
html body.nyanko-ui-polish
  .formation-custom-spawn-modal-card.cm-embedded-container
  > .cm-host-layer-embedded
  > .cm-dialog-embedded
  > .cm-editor-root,
html body.nyanko-ui-polish
  .formation-custom-spawn-modal-card.cm-embedded-container
  > .cm-host-layer-embedded
  .cm-editor {
  height: 100% !important;
  max-height: 100% !important;
  min-height: 0 !important;
}
`;
  document.head.appendChild(style);
}

installCharacterModificationEmbeddedViewportContractPatch();

export { installCharacterModificationEmbeddedViewportContractPatch };
