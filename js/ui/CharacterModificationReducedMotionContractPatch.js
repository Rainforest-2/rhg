const STYLE_ID = 'character-modification-zero-motion-contract-style';

function installCharacterModificationReducedMotionContractPatch() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
@media (prefers-reduced-motion: reduce) {
  .cm-host-layer .cm-editor *,
  .cm-host-layer .cm-editor *::before,
  .cm-host-layer .cm-editor *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
  }
}
`;
  document.head.appendChild(style);
}

installCharacterModificationReducedMotionContractPatch();

export { installCharacterModificationReducedMotionContractPatch };
