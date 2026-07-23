import { countCharacterModificationFields } from '../character-modification/CharacterModificationValidator.js';
import { resolveCustomStageSpawnModification } from '../custom-stage/CustomStageCharacterModificationAdapter.js';

const PATCH_FLAG = Symbol.for('rhg.custom-stage-character-modification-ui.v1');
const STYLE_ID = 'custom-stage-character-modification-ui-style';

function installStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
html body.nyanko-ui-polish .formation-custom-character-modification-entry{
  gap:8px!important;
}
html body.nyanko-ui-polish .formation-custom-character-modification-entry>[data-custom-spawn-modification-open].cm-custom-stage-status-launcher{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) auto auto!important;
  align-items:center!important;
  gap:9px!important;
  width:100%!important;
  min-width:0!important;
  min-height:48px!important;
  height:auto!important;
  padding:7px 11px!important;
  border:2px solid #202423!important;
  border-radius:10px!important;
  background:linear-gradient(180deg,#fff,#f1f5f2)!important;
  color:#202423!important;
  -webkit-text-fill-color:#202423!important;
  box-shadow:0 2px 0 #202423!important;
  text-align:left!important;
  line-height:1.15!important;
}
html body.nyanko-ui-polish .formation-custom-character-modification-entry>[data-custom-spawn-modification-open].cm-custom-stage-status-launcher:active{
  transform:translateY(1px)!important;
  box-shadow:0 1px 0 #202423!important;
}
html body.nyanko-ui-polish .cm-custom-stage-status-launcher-label{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:.84rem;
  font-weight:1000;
}
html body.nyanko-ui-polish .cm-custom-stage-status-launcher-count{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:44px;
  min-height:28px;
  padding:3px 8px;
  border:2px solid #202423;
  border-radius:999px;
  background:#e9b44c;
  color:#202423;
  -webkit-text-fill-color:#202423;
  font-size:.7rem;
  font-weight:1000;
  font-variant-numeric:tabular-nums;
}
html body.nyanko-ui-polish .cm-custom-stage-status-launcher-arrow{
  font-size:1.15rem;
  font-weight:1000;
  line-height:1;
}
html body.nyanko-ui-polish .formation-custom-spawn-modal-card.cm-embedded-container{
  width:min(1120px,calc(100vw - 32px))!important;
  max-width:calc(100vw - 32px)!important;
  min-width:0!important;
}
html body.nyanko-ui-polish .formation-custom-spawn-modal-card.cm-embedded-container>.cm-host-layer-embedded,
html body.nyanko-ui-polish .formation-custom-spawn-modal-card.cm-embedded-container .cm-dialog-embedded{
  width:100%!important;
  max-width:none!important;
}
@media(max-width:700px){
  html body.nyanko-ui-polish .formation-custom-spawn-modal-card.cm-embedded-container{
    width:calc(100vw - 16px)!important;
    max-width:calc(100vw - 16px)!important;
  }
  html body.nyanko-ui-polish .formation-custom-character-modification-entry>[data-custom-spawn-modification-open].cm-custom-stage-status-launcher{
    min-height:44px!important;
    padding:6px 9px!important;
  }
}
`;
  document.head.appendChild(style);
}

function resolveLauncherCount(button) {
  const fallback = Number(button?.dataset?.cmCustomStageStatusCount);
  const root = button?.closest?.('.formation-ui');
  const editor = root?.__formationEditor;
  const state = editor?.getCustomStageBuilderState?.();
  const index = Number(button?.dataset?.customSpawnModificationOpen);
  const spawn = Number.isInteger(index) ? state?.stage?.spawns?.[index] : null;
  if (!state?.stage || !spawn) return Number.isFinite(fallback) ? fallback : 0;
  const resolved = resolveCustomStageSpawnModification(state.stage, spawn);
  return countCharacterModificationFields(resolved?.characterModification);
}

function decorateLauncher(button) {
  if (!button?.isConnected) return;
  const section = button.closest('.formation-custom-character-modification-entry');
  const heading = section?.querySelector(':scope > h4');
  const hint = section?.querySelector(':scope > .hint');
  if (heading && heading.textContent !== 'ステータス改竄') heading.textContent = 'ステータス改竄';
  if (hint && hint.textContent !== 'この敵だけ、倍率計算後の値を変更します') {
    hint.textContent = 'この敵だけ、倍率計算後の値を変更します';
  }

  const count = resolveLauncherCount(button);
  const countText = String(count);
  button.classList.add('cm-custom-stage-status-launcher');
  button.dataset.cmCustomStageStatusCount = countText;
  button.setAttribute('aria-label', `ステータス改竄を開く（${count}件変更）`);
  button.title = `ステータス改竄を開く（${count}件変更）`;

  const currentCount = button.querySelector('.cm-custom-stage-status-launcher-count')?.textContent;
  if (currentCount === `${count}件` && button.querySelector('.cm-custom-stage-status-launcher-label')) return;

  const label = document.createElement('span');
  label.className = 'cm-custom-stage-status-launcher-label';
  label.textContent = 'ステータス改竄';
  const badge = document.createElement('span');
  badge.className = 'cm-custom-stage-status-launcher-count';
  badge.textContent = `${count}件`;
  const arrow = document.createElement('span');
  arrow.className = 'cm-custom-stage-status-launcher-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '›';
  button.replaceChildren(label, badge, arrow);
}

function decorateLaunchers(root = document) {
  for (const button of root.querySelectorAll?.('[data-custom-spawn-modification-open]') || []) {
    decorateLauncher(button);
  }
}

function installObserver() {
  if (globalThis.__RHG_CUSTOM_STAGE_CM_UI_OBSERVER__) return;
  let queued = false;
  const run = () => {
    queued = false;
    decorateLaunchers();
  };
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(run);
    else globalThis.setTimeout?.(run, 0);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  globalThis.__RHG_CUSTOM_STAGE_CM_UI_OBSERVER__ = observer;
  run();
}

function installFormationCustomStageCharacterModificationUiPatch() {
  if (typeof document === 'undefined' || globalThis[PATCH_FLAG]) return;
  globalThis[PATCH_FLAG] = true;
  installStyles();
  installObserver();
}

installFormationCustomStageCharacterModificationUiPatch();

export { installFormationCustomStageCharacterModificationUiPatch };
