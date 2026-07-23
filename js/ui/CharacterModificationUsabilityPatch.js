import { CharacterModificationEditor } from './character-modification/CharacterModificationEditor.js';
import { CharacterModificationRenderer } from './character-modification/CharacterModificationRenderer.js';

const FLAG = Symbol.for('rhg.character-modification-usability.v2');
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
    if (node.parentElement?.closest('script,style,input,textarea,.cm-compat-detail,.cm-compat-count')) continue;
    node.nodeValue = localizeString(node.nodeValue);
  }
  for (const node of root.querySelectorAll('[aria-label],[title],[placeholder]')) {
    for (const name of ['aria-label', 'title', 'placeholder']) {
      const value = node.getAttribute(name);
      if (value) node.setAttribute(name, localizeString(value));
    }
  }
}

function hideInternalIdentifiers(root) {
  if (!root?.ownerDocument?.createTreeWalker) return;
  const showText = root.ownerDocument.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
  const walker = root.ownerDocument.createTreeWalker(root, showText);
  const candidates = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest('.cm-internal-id-hidden,script,style')) continue;
    if (/\s*\(ID:\s*[^)]+\)/.test(node.nodeValue || '')) candidates.push(node);
  }
  for (const node of candidates) {
    const text = node.nodeValue || '';
    const match = /\s*\(ID:\s*[^)]+\)/.exec(text);
    if (!match) continue;
    const fragment = root.ownerDocument.createDocumentFragment();
    fragment.append(text.slice(0, match.index));
    const hidden = root.ownerDocument.createElement('span');
    hidden.className = 'cm-internal-id-hidden';
    hidden.textContent = match[0];
    fragment.append(hidden, text.slice(match.index + match[0].length));
    node.replaceWith(fragment);
  }
}

function setButtonLabel(button, label) {
  if (!button) return;
  for (const node of [...button.childNodes]) {
    if (node.nodeType === 3 || node.classList?.contains('cm-command-label')) node.remove();
  }
  const span = document.createElement('span');
  span.className = 'cm-command-label';
  span.textContent = label;
  button.appendChild(span);
  button.setAttribute('aria-label', label);
  button.title = label;
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.cm-editor{position:relative}.cm-field-title code,.cm-internal-id-hidden{display:none!important}
.cm-compat-detail,.cm-compat-count{font-size:0!important}.cm-compat-detail::after{content:attr(data-cm-visible-detail);font-size:.72rem;line-height:1.25;color:#5c6461}.cm-compat-count::after{content:attr(data-cm-visible-label);font-size:.78rem;font-weight:800;color:#202423}
.cm-footer{position:relative;grid-template-columns:minmax(0,1fr) auto;min-height:56px;padding:6px 10px calc(6px + env(safe-area-inset-bottom,0px))}
.cm-footer-commands{display:grid!important;grid-template-columns:auto auto auto auto minmax(96px,140px)!important;align-items:center;gap:6px;flex-wrap:nowrap!important}
.cm-footer .cm-command{min-height:44px;padding:7px 10px;font-size:.74rem;white-space:nowrap}.cm-footer .is-primary{min-width:104px}.cm-footer [data-cm-action='reset-all']{color:#8e261f}
.cm-comparison.is-compact-unchanged{grid-template-columns:minmax(0,1fr);max-width:420px}.cm-comparison.is-compact-unchanged .cm-value-arrow,.cm-comparison.is-compact-unchanged .cm-value-block:last-child{display:none}
.cm-comparison:not(.is-compact-unchanged){grid-template-columns:minmax(0,1fr) minmax(0,1fr);max-width:680px}.cm-comparison .cm-value-arrow{display:none}.cm-value-block{min-height:46px;padding:6px 9px}
.cm-number-stepper{grid-template-columns:44px minmax(96px,260px) 44px}.cm-number-stepper .cm-icon-button{width:44px;min-width:44px;min-height:44px}.cm-number-input,.cm-select{min-height:44px}
.cm-keyboard-open .cm-header{grid-template-columns:38px minmax(0,1fr) auto;min-height:48px;padding:4px 7px}
.cm-keyboard-open .cm-subject-icon,.cm-keyboard-open .cm-subject-title,.cm-keyboard-open .cm-toolbar,.cm-keyboard-open .cm-categories,.cm-keyboard-open .cm-utility-command{display:none!important}
.cm-keyboard-open .cm-identity{display:block}.cm-keyboard-open .cm-title{display:block!important}.cm-keyboard-open .cm-title span{display:none!important}
.cm-keyboard-open .cm-workspace{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr)!important}.cm-keyboard-open .cm-field-list{scroll-padding:16px 0 88px}
.cm-keyboard-open .cm-footer{min-height:52px;padding:4px 7px calc(4px + env(safe-area-inset-bottom,0px))}.cm-keyboard-open .cm-footer-commands{grid-template-columns:auto minmax(92px,130px)!important}
@media(max-width:760px){.cm-footer{grid-template-columns:minmax(0,1fr);gap:0}.cm-status:empty{display:none}.cm-footer-commands{grid-template-columns:40px 40px 40px auto minmax(86px,1fr)!important;width:100%;gap:4px}.cm-footer .cm-command{min-height:42px;padding:5px 7px;font-size:.67rem}.cm-utility-command{width:40px;min-width:40px;padding:0!important}.cm-utility-command .cm-command-label{display:none}.cm-utility-command i{margin:0}.cm-compat-detail::after{font-size:.68rem}}
@media(max-width:420px){.cm-cancel-command{font-size:0!important}.cm-cancel-command::after{content:'戻る';font-size:.66rem}.cm-footer .is-primary{min-width:86px}}
@media(orientation:landscape) and (max-height:520px){.cm-compat-detail::after{font-size:.56rem}.cm-compat-count::after{font-size:.6rem}.cm-footer{min-height:46px;padding:3px 6px calc(3px + env(safe-area-inset-bottom,0px))}.cm-footer .cm-command{min-height:40px!important;padding:4px 7px!important;font-size:.62rem!important}.cm-utility-command{width:38px;min-width:38px}}
`;
  document.head.appendChild(style);
}

function localizeLaunchers(root = document) {
  for (const section of root.querySelectorAll('.formation-character-modification-entry')) {
    const heading = section.querySelector('.formation-tuning-control-head strong');
    const count = section.querySelector('.formation-tuning-control-head span');
    if (heading && heading.textContent !== 'ステータス改竄') heading.textContent = 'ステータス改竄';
    if (count) {
      const next = count.textContent.replace(/項目変更/g, '件変更');
      if (next !== count.textContent) count.textContent = next;
    }
  }
  for (const button of root.querySelectorAll('[data-character-modification-open],[data-custom-spawn-modification-open]')) {
    if (button.getAttribute('aria-label') !== 'ステータス改竄を開く') {
      button.setAttribute('aria-label', 'ステータス改竄を開く');
    }
    if (!button.children.length && button.textContent !== 'ステータス改竄を開く') {
      button.textContent = 'ステータス改竄を開く';
    }
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
    return categoryItems.call(this).map((item) => ({
      ...item,
      label: CATEGORY_LABELS[item.id] || localizeString(item.label)
    }));
  };

  const subjectTitle = proto.subjectTitle;
  proto.subjectTitle = function localizedSubjectTitle() {
    const node = subjectTitle.call(this);
    const small = node.querySelector('small');
    if (small) {
      const visibleDetail = [this.subject.formLabel, this.subject.levelLabel]
        .filter(Boolean)
        .map(localizeString)
        .join(' / ');
      small.classList.add('cm-compat-detail');
      small.dataset.cmVisibleDetail = visibleDetail;
      small.setAttribute('aria-label', visibleDetail);
    }
    return node;
  };

  const buildShell = proto.buildShell;
  proto.buildShell = function buildCompactShell() {
    this.labels = {
      ...this.labels,
      title: 'ステータス改竄',
      cancel: '保存せず戻る',
      import: '読み込む',
      export: '書き出す'
    };
    buildShell.call(this);
    this.searchInput.placeholder = '項目名で検索';
    this.categoryNav.setAttribute('aria-label', '項目の分類');
    setButtonLabel(this.categoryResetButton, 'この分類を元に戻す');
    for (const option of this.abilityFilter.options) option.textContent = localizeString(option.textContent);

    this.importButton?.classList.add('cm-utility-command');
    this.exportButton?.classList.add('cm-utility-command');
    this.resetAllButton.classList.add('cm-utility-command');
    this.cancelButton.classList.add('cm-cancel-command');
    setButtonLabel(this.importButton, '読み込む');
    setButtonLabel(this.exportButton, '書き出す');
    setButtonLabel(this.resetAllButton, 'すべて元に戻す');
    setButtonLabel(this.cancelButton, '保存せず戻る');
    setButtonLabel(this.saveButton, '保存');
    const commands = this.footer.querySelector('.cm-footer-commands');
    commands.replaceChildren(
      ...[this.importButton, this.exportButton, this.resetAllButton, this.cancelButton, this.saveButton]
        .filter(Boolean)
    );
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
    this.changedBadge.textContent = `改造 ${count}件`;
    this.changedBadge.classList.add('cm-compat-count');
    this.changedBadge.dataset.cmVisibleLabel = `改竄 ${count}件`;
    this.changedBadge.setAttribute('aria-label', `改竄 ${count}件`);
    localizeTree(this.editor);
  };

  const showImportPreview = proto.showImportPreview;
  proto.showImportPreview = function localizedPreview(transaction) {
    showImportPreview.call(this, transaction);
    localizeTree(this.preview);
    hideInternalIdentifiers(this.preview);
  };

  const mount = proto.mount;
  proto.mount = function mountWithKeyboardSupport() {
    const result = mount.call(this);
    const viewport = globalThis.visualViewport;
    this.cmViewportHandler = () => {
      const layoutHeight = globalThis.innerHeight || document.documentElement.clientHeight || 0;
      const visibleHeight = viewport?.height || layoutHeight;
      const hiddenHeight = Math.max(0, layoutHeight - visibleHeight - (viewport?.offsetTop || 0));
      const keyboardOpen = hiddenHeight >= Math.max(48, layoutHeight * 0.16);
      this.editor.classList.toggle('cm-keyboard-open', keyboardOpen);
      this.root.closest('.cm-host-layer')?.classList.toggle('cm-keyboard-open', keyboardOpen);
      const active = document.activeElement;
      if (keyboardOpen && active && this.root.contains(active) && active.matches('input,select,textarea')) {
        requestAnimationFrame(() => active.scrollIntoView({ block: 'center', inline: 'nearest' }));
      }
    };
    this.cmFocusHandler = (event) => {
      const target = event.target;
      if (!target?.matches?.('input,select,textarea')) return;
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
