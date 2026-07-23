import { CharacterModificationEditor } from './character-modification/CharacterModificationEditor.js';
import { CharacterModificationRenderer } from './character-modification/CharacterModificationRenderer.js';

const FLAG = Symbol.for('rhg.character-modification-usability.v1');
const STYLE_ID = 'character-modification-usability-style';
const CATEGORY_LABELS = Object.freeze({
  stats: '基本',
  production: '生産',
  attackCycle: '攻撃間隔',
  attacks: '攻撃',
  traits: '対象属性',
  abilities: '特殊能力',
  procs: '攻撃効果',
  defense: '防御・耐性',
  lifecycle: '復活・潜伏',
  unsupported: '変更不可'
});
const TEXT_REPLACEMENTS = Object.freeze([
  ['キャラクター改造', 'ステータス改竄'],
  ['改造エディタを開く', 'ステータス改竄を開く'],
  ['改造項目を検索', '変更する項目を検索'],
  ['項目を検索', '項目名で検索'],
  ['変更済みのみ', '変更した項目だけ'],
  ['全能力', 'すべて'],
  ['現在持つ能力', '現在の能力'],
  ['追加可能な能力', '追加できる能力'],
  ['カテゴリをリセット', 'この分類を元に戻す'],
  ['全改造をリセット', 'すべて元に戻す'],
  ['インポート内容の確認', '読み込み内容の確認'],
  ['インポート', '読み込み'],
  ['エクスポート', '書き出し'],
  ['マイグレーション', '形式の更新'],
  ['敵spawn row', '敵の出現設定'],
  ['spawn row', '出現設定'],
  ['通常最終値', '元の値'],
  ['改造後値', '変更後'],
  ['現在値', '変更後'],
  ['改造済み', '変更済み'],
  ['読み取り専用', '変更不可'],
  ['通常値を使用', '元の値を使う'],
  ['通常値に戻す', '元の値に戻す'],
  ['この項目は現在のruntimeでは安全に編集できません', 'この項目は現在、安全に変更できません'],
  ['この値型に対応する安全な入力UIはありません', 'この項目は現在、安全に変更できません'],
  ['draft', '編集中の内容'],
  ['frame', 'フレーム'],
  ['BCU', 'ゲーム内距離']
]);

function localizeString(value) {
  let text = String(value ?? '');
  for (const [from, to] of TEXT_REPLACEMENTS) text = text.split(from).join(to);
  return text
    .replace(/\bON\b/g, '有効')
    .replace(/\bOFF\b/g, '無効')
    .replace(/\benabled:/gi, '有効:')
    .replace(/\bchance:/gi, '発動率:')
    .replace(/\bmultiplier:/gi, '倍率:')
    .replace(/\bdurationFrames:/gi, '持続時間:')
    .replace(/\bdelayFrames:/gi, '待ち時間:')
    .replace(/\btargetKind:/gi, '召喚先の種類:')
    .replace(/\btargetId:/gi, '召喚先:')
    .replace(/\btrue\b/gi, '有効')
    .replace(/\bfalse\b/gi, '無効');
}

function localizeTree(root) {
  if (!root?.ownerDocument?.createTreeWalker) return;
  const showText = root.ownerDocument.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
  const walker = root.ownerDocument.createTreeWalker(root, showText);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  for (const node of textNodes) {
    if (node.parentElement?.matches('script,style,input,textarea')) continue;
    node.nodeValue = localizeString(node.nodeValue);
  }
  for (const node of root.querySelectorAll('[aria-label],[title],[placeholder]')) {
    for (const name of ['aria-label', 'title', 'placeholder']) {
      const value = node.getAttribute(name);
      if (value) node.setAttribute(name, localizeString(value));
    }
  }
}

function makeButton(action, label, icon = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cm-command';
  button.dataset.cmAction = action;
  button.setAttribute('aria-label', label);
  if (icon) {
    const mark = document.createElement('i');
    mark.className = `bi ${icon}`;
    mark.setAttribute('aria-hidden', 'true');
    button.appendChild(mark);
  }
  button.appendChild(document.createTextNode(label));
  return button;
}

function closeMenu(renderer) {
  if (!renderer?.moreMenu || !renderer?.moreButton) return;
  renderer.moreMenu.hidden = true;
  renderer.moreButton.setAttribute('aria-expanded', 'false');
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.cm-editor{position:relative}.cm-field-title code{display:none!important}
.cm-footer{position:relative;grid-template-columns:minmax(0,1fr) auto;min-height:56px;padding:6px 10px calc(6px + env(safe-area-inset-bottom,0px))}
.cm-footer-commands{display:grid!important;grid-template-columns:auto auto minmax(96px,140px)!important;align-items:center;gap:7px;flex-wrap:nowrap!important}
.cm-footer .cm-command{min-height:44px;padding:7px 12px;font-size:.76rem;white-space:nowrap}.cm-footer .is-primary{min-width:104px}
.cm-more-menu{position:absolute;right:10px;bottom:calc(100% + 6px);z-index:8;display:grid;min-width:220px;padding:6px;border:2px solid #202423;border-radius:8px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.26)}
.cm-more-menu[hidden]{display:none!important}.cm-more-menu .cm-command{justify-content:flex-start;width:100%;border:0;background:#fff}.cm-more-menu [data-cm-action='reset-all']{margin-top:5px;border-top:1px solid #d8ddda;color:#9b241c}
.cm-comparison.is-compact-unchanged{grid-template-columns:minmax(0,1fr);max-width:420px}.cm-comparison.is-compact-unchanged .cm-value-arrow,.cm-comparison.is-compact-unchanged .cm-value-block:last-child{display:none}
.cm-comparison:not(.is-compact-unchanged){grid-template-columns:minmax(0,1fr) minmax(0,1fr);max-width:680px}.cm-comparison .cm-value-arrow{display:none}.cm-value-block{min-height:46px;padding:6px 9px}
.cm-number-stepper{grid-template-columns:44px minmax(96px,260px) 44px}.cm-number-stepper .cm-icon-button{width:44px;min-width:44px;min-height:44px}.cm-number-input,.cm-select{min-height:44px}
.cm-keyboard-open .cm-header{grid-template-columns:38px minmax(0,1fr) auto;min-height:48px;padding:4px 7px}
.cm-keyboard-open .cm-subject-icon,.cm-keyboard-open .cm-subject-title,.cm-keyboard-open .cm-toolbar,.cm-keyboard-open .cm-categories,.cm-keyboard-open .cm-more-button{display:none!important}
.cm-keyboard-open .cm-identity{display:block}.cm-keyboard-open .cm-title{display:block!important}.cm-keyboard-open .cm-title span{display:none!important}
.cm-keyboard-open .cm-workspace{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr)!important}.cm-keyboard-open .cm-field-list{scroll-padding:16px 0 88px}
.cm-keyboard-open .cm-footer{min-height:52px;padding:4px 7px calc(4px + env(safe-area-inset-bottom,0px))}.cm-keyboard-open .cm-footer-commands{grid-template-columns:auto minmax(92px,130px)!important}.cm-keyboard-open .cm-more-menu{display:none!important}
@media(max-width:760px){.cm-footer-commands{grid-template-columns:auto auto minmax(92px,1fr)!important}.cm-footer .cm-command{font-size:.7rem}}
@media(max-width:420px){.cm-footer-commands{grid-template-columns:44px auto minmax(88px,1fr)!important}.cm-more-button{width:44px;min-width:44px;padding:0!important;font-size:0!important}.cm-more-button::before{content:'⋯';font-size:1.4rem}.cm-more-menu{right:6px;left:6px;min-width:0}}
@media(orientation:landscape) and (max-height:520px){.cm-footer{min-height:46px;padding:3px 6px calc(3px + env(safe-area-inset-bottom,0px))}.cm-footer .cm-command{min-height:40px!important;padding:4px 8px!important;font-size:.64rem!important}}
`;
  document.head.appendChild(style);
}

function localizeLaunchers(root = document) {
  for (const section of root.querySelectorAll('.formation-character-modification-entry')) {
    const heading = section.querySelector('.formation-tuning-control-head strong');
    const count = section.querySelector('.formation-tuning-control-head span');
    if (heading) heading.textContent = 'ステータス改竄';
    if (count) count.textContent = count.textContent.replace(/項目変更/g, '件変更');
  }
  for (const button of root.querySelectorAll('[data-character-modification-open],[data-custom-spawn-modification-open]')) {
    button.setAttribute('aria-label', 'ステータス改竄を開く');
    if (!button.children.length) button.textContent = 'ステータス改竄を開く';
  }
}

function installLauncherObserver() {
  if (globalThis.__RHG_CM_USABILITY_OBSERVER__) return;
  let queued = false;
  const run = () => { queued = false; localizeLaunchers(); };
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run, 0);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  globalThis.__RHG_CM_USABILITY_OBSERVER__ = observer;
  run();
}

function installEditorPatch() {
  const proto = CharacterModificationEditor?.prototype;
  if (!proto || proto[FLAG]) return;
  proto[FLAG] = true;
  const original = proto.createHost;
  proto.createHost = function createLocalizedHost() {
    if (!this.options.dialogLabel) this.options.dialogLabel = 'ステータス改竄';
    if (!this.options.confirmDiscard) {
      this.confirmDiscard = async () => typeof confirm !== 'function' || confirm('未保存の変更を破棄しますか？');
    }
    const host = original.call(this);
    if (!host.__localizedAnnounce) {
      const announce = host.announce.bind(host);
      host.announce = (message, options) => announce(localizeString(message), options);
      host.__localizedAnnounce = true;
    }
    return host;
  };
}

function installRendererPatch() {
  const proto = CharacterModificationRenderer?.prototype;
  if (!proto || proto[FLAG]) return;
  proto[FLAG] = true;

  const categoryItems = proto.categoryItems;
  proto.categoryItems = function localizedCategories() {
    return categoryItems.call(this).map((item) => ({ ...item, label: CATEGORY_LABELS[item.id] || localizeString(item.label) }));
  };

  const subjectTitle = proto.subjectTitle;
  proto.subjectTitle = function localizedSubjectTitle() {
    const node = subjectTitle.call(this);
    const detail = [this.subject.formLabel, this.subject.levelLabel].filter(Boolean).map(localizeString).join(' / ');
    const small = node.querySelector('small');
    if (small && detail) small.textContent = detail;
    else small?.remove();
    return node;
  };

  const buildShell = proto.buildShell;
  proto.buildShell = function buildCompactShell() {
    this.labels = { ...this.labels, title: 'ステータス改竄', cancel: '保存せず戻る', import: '読み込む', export: '書き出す' };
    buildShell.call(this);
    this.searchInput.placeholder = '項目名で検索';
    this.categoryNav.setAttribute('aria-label', '項目の分類');
    this.categoryResetButton.textContent = 'この分類を元に戻す';
    for (const option of this.abilityFilter.options) option.textContent = localizeString(option.textContent);

    const commands = this.footer.querySelector('.cm-footer-commands');
    this.moreButton = makeButton('toggle-more', 'その他', 'bi-three-dots');
    this.moreButton.classList.add('cm-more-button');
    this.moreButton.setAttribute('aria-haspopup', 'menu');
    this.moreButton.setAttribute('aria-expanded', 'false');
    this.moreMenu = document.createElement('div');
    this.moreMenu.className = 'cm-more-menu';
    this.moreMenu.setAttribute('role', 'menu');
    this.moreMenu.hidden = true;
    for (const button of [this.importButton, this.exportButton, this.resetAllButton]) {
      if (!button) continue;
      button.setAttribute('role', 'menuitem');
      this.moreMenu.appendChild(button);
    }
    this.cancelButton.textContent = '保存せず戻る';
    this.saveButton.textContent = '保存';
    commands.replaceChildren(this.moreButton, this.cancelButton, this.saveButton);
    this.footer.appendChild(this.moreMenu);
    localizeTree(this.editor);
  };

  const buildField = proto.buildField;
  proto.buildField = function buildSimplifiedField(field) {
    const row = buildField.call(this, field);
    row.querySelector('.cm-field-title code')?.remove();
    const changed = this.draft.isFieldChanged(field.id);
    const comparison = row.querySelector('.cm-comparison');
    comparison?.classList.toggle('is-compact-unchanged', !changed);
    const blocks = comparison?.querySelectorAll('.cm-value-block') || [];
    if (blocks[0]?.firstElementChild) blocks[0].firstElementChild.textContent = '元の値';
    if (blocks[1]?.firstElementChild) blocks[1].firstElementChild.textContent = '変更後';
    for (const badge of row.querySelectorAll('.cm-badge')) {
      if (badge.textContent === '通常') badge.textContent = '未変更';
      if (badge.textContent === '改造済み') badge.textContent = '変更済み';
    }
    localizeTree(row);
    return row;
  };

  const renderState = proto.renderState;
  proto.renderState = function localizedState() {
    renderState.call(this);
    const count = this.draft.getSnapshot().changedCount;
    this.changedBadge.value = `${count}件`;
    this.changedBadge.textContent = `改竄 ${count}件`;
    if (this.moreButton) this.moreButton.disabled = this.busy;
    localizeTree(this.editor);
  };

  const showImportPreview = proto.showImportPreview;
  proto.showImportPreview = function localizedPreview(transaction) {
    showImportPreview.call(this, transaction);
    localizeTree(this.preview);
  };

  const onClick = proto.onClick;
  proto.onClick = function compactCommandClick(event) {
    const action = event.target.closest?.('[data-cm-action]')?.dataset.cmAction;
    if (action === 'toggle-more') {
      event.preventDefault();
      event.stopPropagation();
      const opening = this.moreMenu.hidden;
      this.moreMenu.hidden = !opening;
      this.moreButton.setAttribute('aria-expanded', opening ? 'true' : 'false');
      if (opening) this.moreMenu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
      return;
    }
    if (action === 'reset-all') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(this);
      if (typeof confirm !== 'function' || confirm('変更した内容をすべて元に戻しますか？')) this.actions.resetAll?.();
      return;
    }
    if (action && action !== 'step') closeMenu(this);
    return onClick.call(this, event);
  };

  const mount = proto.mount;
  proto.mount = function mountWithKeyboardSupport() {
    const result = mount.call(this);
    const viewport = globalThis.visualViewport;
    const baseline = Math.max(globalThis.innerHeight || 0, viewport?.height || 0);
    this.cmViewportHandler = () => {
      const visible = viewport?.height || globalThis.innerHeight || 0;
      const hidden = Math.max(0, (globalThis.innerHeight || baseline) - visible - (viewport?.offsetTop || 0));
      const open = hidden >= Math.max(120, baseline * 0.18);
      this.editor.classList.toggle('cm-keyboard-open', open);
      this.root.closest('.cm-host-layer')?.classList.toggle('cm-keyboard-open', open);
      if (open) closeMenu(this);
      const active = document.activeElement;
      if (open && active && this.root.contains(active) && active.matches('input,select,textarea')) {
        requestAnimationFrame(() => active.scrollIntoView({ block: 'center', inline: 'nearest' }));
      }
    };
    this.cmFocusHandler = (event) => {
      const target = event.target;
      if (!target?.matches?.('input,select,textarea')) return;
      closeMenu(this);
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'center', inline: 'nearest' });
        if (target.matches('input[type="number"]')) target.select?.();
      });
    };
    viewport?.addEventListener('resize', this.cmViewportHandler);
    viewport?.addEventListener('scroll', this.cmViewportHandler);
    this.root.addEventListener('focusin', this.cmFocusHandler);
    this.cmViewportHandler();
    return result;
  };

  const destroy = proto.destroy;
  proto.destroy = function destroyKeyboardSupport() {
    const viewport = globalThis.visualViewport;
    viewport?.removeEventListener('resize', this.cmViewportHandler);
    viewport?.removeEventListener('scroll', this.cmViewportHandler);
    this.root?.removeEventListener('focusin', this.cmFocusHandler);
    this.root?.closest('.cm-host-layer')?.classList.remove('cm-keyboard-open');
    closeMenu(this);
    return destroy.call(this);
  };
}

export function installCharacterModificationUsabilityPatch() {
  if (typeof document === 'undefined') return;
  installStyles();
  installEditorPatch();
  installRendererPatch();
  installLauncherObserver();
}

installCharacterModificationUsabilityPatch();
