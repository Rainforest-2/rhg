import {
  getCharacterModificationFieldStatus
} from './CharacterModificationDraft.js';

let rendererSerial = 0;

function element(tag, className = '', text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
}

function iconButton({ action, label, icon, className = '', disabled = false, title = label }) {
  const button = element('button', `cm-icon-button ${className}`.trim());
  button.type = 'button';
  button.dataset.cmAction = action;
  button.setAttribute('aria-label', label);
  button.title = title;
  button.disabled = disabled;
  const iconElement = element('i', `bi ${icon}`);
  iconElement.setAttribute('aria-hidden', 'true');
  button.appendChild(iconElement);
  return button;
}

function commandButton({ action, label, className = '', disabled = false, icon = null }) {
  const button = element('button', `cm-command ${className}`.trim());
  button.type = 'button';
  button.dataset.cmAction = action;
  button.disabled = disabled;
  if (icon) {
    const iconElement = element('i', `bi ${icon}`);
    iconElement.setAttribute('aria-hidden', 'true');
    button.appendChild(iconElement);
  }
  button.appendChild(document.createTextNode(label));
  return button;
}

function descriptorFields(descriptor) {
  const fields = descriptor?.fields;
  if (Array.isArray(fields)) return fields;
  if (!fields || typeof fields !== 'object') return [];
  return Object.entries(fields).map(([id, config]) => ({ id, ...config }));
}

function descriptorOptions(descriptor) {
  const values = descriptor?.values ?? descriptor?.options ?? [];
  return Array.isArray(values) ? values.map((entry) => (
    entry && typeof entry === 'object'
      ? { value: entry.value ?? entry.id, label: entry.label ?? entry.value ?? entry.id }
      : { value: entry, label: entry }
  )) : [];
}

function displayPartLabel(part) {
  if (part?.label) return part.label;
  return String(part?.id || '').replace(/([a-z])([A-Z])/g, '$1 $2');
}

function problemField(problem) {
  return String(problem?.field ?? problem?.path ?? problem?.fieldId ?? problem?.registryId ?? '');
}

function problemMessage(problem) {
  return String(
    problem?.message
    ?? problem?.code
    ?? problem?.label
    ?? problem?.name
    ?? problem?.characterId
    ?? problem?.id
    ?? problem
    ?? ''
  );
}

function fieldProblems(validation, fieldId, type) {
  const list = Array.isArray(validation?.[type]) ? validation[type] : [];
  return list.filter((problem) => {
    const path = problemField(problem);
    return path === fieldId || path.startsWith(`${fieldId}.`) || fieldId.startsWith(`${path}.`);
  });
}

function formatPrimitive(value) {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'ON' : 'OFF';
  if (typeof value === 'number') return new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 4 }).format(value);
  return String(value);
}

function summarizeValue(value) {
  if (value === undefined) return '—';
  if (Array.isArray(value)) return value.length ? value.map(formatPrimitive).join(', ') : 'なし';
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return 'なし';
    return entries.slice(0, 4).map(([key, entry]) => `${key}: ${formatPrimitive(entry)}`).join(' / ')
      + (entries.length > 4 ? ` / 他${entries.length - 4}件` : '');
  }
  return formatPrimitive(value);
}

function normalizeSearch(value) {
  return String(value || '').trim().toLocaleLowerCase('ja');
}

function searchableFieldText(field) {
  return `${field.label || ''} ${field.id || ''} ${field.category || ''} ${field.unsupportedReason || ''}`.toLocaleLowerCase('ja');
}

function isAbilityField(field) {
  return ['abilities', 'procs', 'defense', 'lifecycle'].includes(field?.category)
    || ['abilityFlag', 'proc'].includes(field?.apply?.kind);
}

function hasNormalAbility(value) {
  if (value === true) return true;
  if (!value || value === false) return false;
  if (typeof value !== 'object') return !!value;
  if (Object.prototype.hasOwnProperty.call(value, 'enabled')) return value.enabled === true;
  return Object.keys(value).length > 0;
}

function controlKey(fieldId, partId = '') {
  return `${fieldId}\u0000${partId}`;
}

function captureFocus(root) {
  const active = document.activeElement;
  if (!active || !root?.contains(active)) return null;
  const key = active.dataset?.cmControlKey;
  if (!key) return null;
  return {
    key,
    start: typeof active.selectionStart === 'number' ? active.selectionStart : null,
    end: typeof active.selectionEnd === 'number' ? active.selectionEnd : null
  };
}

function restoreFocus(root, record) {
  if (!record) return;
  const control = [...root.querySelectorAll('[data-cm-control-key]')]
    .find((candidate) => candidate.dataset.cmControlKey === record.key);
  if (!control) return;
  try {
    control.focus({ preventScroll: true });
    if (record.start != null && typeof control.setSelectionRange === 'function') {
      control.setSelectionRange(record.start, record.end ?? record.start);
    }
  } catch {}
}

function frameDisplay(value, converter) {
  const frames = formatPrimitive(value);
  if (typeof converter !== 'function' || !Number.isFinite(Number(value))) return `${frames} frame`;
  const seconds = converter(Number(value));
  return Number.isFinite(Number(seconds)) ? `${frames} frame / ${formatPrimitive(seconds)}秒` : `${frames} frame`;
}

function dependencyText(field) {
  if (!Array.isArray(field?.dependencies) || !field.dependencies.length) return '';
  return field.dependencies.map((dependency) => {
    const includes = dependency.includes == null ? '' : ` に ${dependency.includes} が必要`;
    return `${dependency.field || '関連項目'}${includes}`;
  }).join('、');
}

export class CharacterModificationRenderer {
  constructor({
    root,
    draft,
    categories = [],
    subject = {},
    actions = {},
    framesToSeconds = null,
    labels = {}
  } = {}) {
    if (!root || root.nodeType !== 1) throw new TypeError('CharacterModificationRenderer requires a root element');
    if (!draft) throw new TypeError('CharacterModificationRenderer requires a draft');
    this.root = root;
    this.draft = draft;
    this.categories = Array.isArray(categories) ? categories : [];
    this.subject = subject || {};
    this.actions = actions || {};
    this.framesToSeconds = framesToSeconds;
    this.labels = {
      title: 'キャラクター改造',
      save: '保存',
      cancel: 'キャンセル',
      import: 'インポート',
      export: 'エクスポート',
      ...labels
    };
    this.id = `cm-editor-${++rendererSerial}`;
    this.activeCategory = this.firstCategoryId();
    this.query = '';
    this.changedOnly = false;
    this.abilityView = 'all';
    this.importTransaction = null;
    this.statusMessage = '';
    this.statusError = false;
    this.busy = false;
    this.stepRepeatTimer = null;
    this.stepRepeatInterval = null;
    this.boundClick = (event) => this.onClick(event);
    this.boundInput = (event) => this.onInput(event);
    this.boundChange = (event) => this.onChange(event);
    this.boundKeydown = (event) => this.onKeydown(event);
    this.boundPointerDown = (event) => this.onPointerDown(event);
    this.boundPointerEnd = () => this.stopStepRepeat();
  }

  firstCategoryId() {
    const fieldCategories = new Set(this.draft.fields.map((field) => field.category));
    return this.categories.find((category) => fieldCategories.has(category.id))?.id
      || this.draft.fields[0]?.category
      || 'stats';
  }

  categoryItems() {
    const known = new Map(this.categories.map((category) => [category.id, category]));
    const ids = [...new Set(this.draft.fields.map((field) => field.category))];
    return ids.map((id) => known.get(id) || { id, label: id });
  }

  mount() {
    this.root.replaceChildren();
    this.root.classList.add('cm-renderer-mounted');
    this.buildShell();
    this.root.addEventListener('click', this.boundClick);
    this.root.addEventListener('input', this.boundInput);
    this.root.addEventListener('change', this.boundChange);
    this.root.addEventListener('keydown', this.boundKeydown);
    this.root.addEventListener('pointerdown', this.boundPointerDown);
    document.addEventListener('pointerup', this.boundPointerEnd, true);
    document.addEventListener('pointercancel', this.boundPointerEnd, true);
    this.render();
    return this;
  }

  buildShell() {
    this.editor = element('div', 'cm-editor');

    this.header = element('header', 'cm-header');
    this.backButton = iconButton({ action: 'cancel', label: '閉じる', icon: 'bi-x-lg', className: 'cm-close' });
    this.backButton.dataset.cmBack = '1';
    this.identity = element('div', 'cm-identity');
    this.title = element('div', 'cm-title');
    this.title.append(element('strong', '', this.labels.title), element('span', '', this.subject.contextLabel || '最終設定値'));
    this.changedBadge = element('output', 'cm-changed-count');
    this.changedBadge.setAttribute('aria-live', 'polite');
    this.header.append(this.backButton, this.buildSubjectIcon(), this.identity, this.changedBadge);
    this.identity.append(this.subjectTitle(), this.title);

    this.toolbar = element('div', 'cm-toolbar');
    const searchLabel = element('label', 'cm-search-label');
    const searchLabelText = element('span', 'cm-sr-only', '改造項目を検索');
    this.searchInput = element('input', 'cm-search');
    this.searchInput.id = `${this.id}-search`;
    this.searchInput.type = 'search';
    this.searchInput.placeholder = '項目を検索';
    this.searchInput.autocomplete = 'off';
    this.searchInput.dataset.cmSearch = '1';
    this.searchInput.dataset.cmControlKey = 'search';
    searchLabel.htmlFor = this.searchInput.id;
    searchLabel.append(searchLabelText, this.searchInput);
    const changedLabel = element('label', 'cm-filter-check');
    this.changedOnlyInput = element('input');
    this.changedOnlyInput.type = 'checkbox';
    this.changedOnlyInput.dataset.cmChangedOnly = '1';
    this.changedOnlyInput.dataset.cmControlKey = 'changed-only';
    changedLabel.append(this.changedOnlyInput, element('span', '', '変更済みのみ'));
    const abilityFilterLabel = element('label', 'cm-ability-filter');
    abilityFilterLabel.appendChild(element('span', 'cm-sr-only', '能力の表示範囲'));
    this.abilityFilter = element('select', 'cm-select');
    this.abilityFilter.dataset.cmAbilityView = '1';
    this.abilityFilter.dataset.cmControlKey = 'ability-view';
    for (const [value, label] of [
      ['all', '全能力'],
      ['current', '現在持つ能力'],
      ['addable', '追加可能な能力']
    ]) {
      const option = element('option', '', label);
      option.value = value;
      this.abilityFilter.appendChild(option);
    }
    abilityFilterLabel.appendChild(this.abilityFilter);
    this.undoButton = iconButton({ action: 'undo', label: '元に戻す', icon: 'bi-arrow-counterclockwise' });
    this.redoButton = iconButton({ action: 'redo', label: 'やり直す', icon: 'bi-arrow-clockwise' });
    const history = element('div', 'cm-history');
    history.append(this.undoButton, this.redoButton);
    this.toolbar.append(searchLabel, changedLabel, abilityFilterLabel, history);

    this.workspace = element('div', 'cm-workspace');
    this.categoryNav = element('nav', 'cm-categories');
    this.categoryNav.setAttribute('aria-label', '改造カテゴリ');
    this.content = element('main', 'cm-content');
    this.contentHead = element('header', 'cm-content-head');
    this.categoryHeading = element('h2', '', '');
    this.categoryResetButton = commandButton({
      action: 'reset-category',
      label: 'カテゴリをリセット',
      icon: 'bi-arrow-counterclockwise'
    });
    this.contentHead.append(this.categoryHeading, this.categoryResetButton);
    this.validationSummary = element('div', 'cm-validation-summary');
    this.validationSummary.hidden = true;
    this.fieldList = element('div', 'cm-field-list');
    this.content.append(this.contentHead, this.validationSummary, this.fieldList);
    this.workspace.append(this.categoryNav, this.content);

    this.footer = element('footer', 'cm-footer');
    this.importButton = typeof this.actions.import === 'function'
      ? commandButton({ action: 'import', label: this.labels.import, icon: 'bi-box-arrow-in-down' })
      : null;
    this.exportButton = typeof this.actions.export === 'function'
      ? commandButton({ action: 'export', label: this.labels.export, icon: 'bi-box-arrow-up' })
      : null;
    this.resetAllButton = commandButton({ action: 'reset-all', label: '全改造をリセット', icon: 'bi-trash3' });
    this.cancelButton = commandButton({ action: 'cancel', label: this.labels.cancel });
    this.saveButton = commandButton({ action: 'save', label: this.labels.save, className: 'is-primary', icon: 'bi-check-lg' });
    this.status = element('div', 'cm-status');
    this.status.setAttribute('role', 'status');
    const footerCommands = element('div', 'cm-footer-commands');
    if (this.importButton) footerCommands.append(this.importButton);
    if (this.exportButton) footerCommands.append(this.exportButton);
    footerCommands.append(this.resetAllButton, this.cancelButton, this.saveButton);
    this.footer.append(this.status, footerCommands);

    this.preview = element('section', 'cm-import-preview');
    this.preview.hidden = true;

    this.editor.append(this.header, this.toolbar, this.workspace, this.footer, this.preview);
    this.root.appendChild(this.editor);
  }

  buildSubjectIcon() {
    const wrapper = element('div', 'cm-subject-icon');
    if (this.subject.iconElement?.nodeType === 1) {
      const clone = this.subject.iconElement.cloneNode(true);
      clone.removeAttribute?.('id');
      wrapper.appendChild(clone);
    } else if (this.subject.iconUrl) {
      const image = element('img');
      image.src = String(this.subject.iconUrl);
      image.alt = this.subject.iconAlt || '';
      image.decoding = 'async';
      wrapper.appendChild(image);
    } else {
      const fallback = element('span', '', String(this.subject.name || '?').slice(0, 1));
      fallback.setAttribute('aria-hidden', 'true');
      wrapper.appendChild(fallback);
    }
    return wrapper;
  }

  subjectTitle() {
    const wrapper = element('div', 'cm-subject-title');
    wrapper.appendChild(element('span', 'cm-subject-name', this.subject.name || this.subject.characterId || 'キャラクター'));
    const detail = [this.subject.formLabel, this.subject.levelLabel, this.subject.characterId].filter(Boolean).join(' / ');
    if (detail) wrapper.appendChild(element('small', '', detail));
    return wrapper;
  }

  formatValue(value, field, descriptor = field?.value) {
    const formatter = descriptor?.format ?? field?.formatValue ?? field?.toDisplay;
    if (typeof formatter === 'function') {
      try { return String(formatter(value, { field, subject: this.subject, draft: this.draft })); } catch {}
    }
    if ((field?.editor === 'frames' || descriptor?.unit === 'frame' || descriptor?.unit === 'frames') && value != null) {
      return frameDisplay(value, this.framesToSeconds);
    }
    return summarizeValue(value);
  }

  render() {
    this.renderCategories();
    this.renderFieldList();
    this.renderState();
  }

  renderState() {
    const snapshot = this.draft.getSnapshot();
    this.changedBadge.value = `${snapshot.changedCount}件`;
    this.changedBadge.textContent = `改造 ${snapshot.changedCount}件`;
    this.undoButton.disabled = this.busy || !snapshot.canUndo;
    this.redoButton.disabled = this.busy || !snapshot.canRedo;
    this.resetAllButton.disabled = this.busy || snapshot.changedCount === 0;
    this.categoryResetButton.disabled = this.busy || !this.categoryHasChanges(this.activeCategory);
    this.saveButton.disabled = this.busy || snapshot.validation?.ok === false;
    this.cancelButton.disabled = this.busy;
    if (this.importButton) this.importButton.disabled = this.busy;
    if (this.exportButton) this.exportButton.disabled = this.busy;
    this.status.textContent = this.statusMessage;
    this.status.classList.toggle('is-error', this.statusError);
    this.renderValidation(snapshot.validation);
  }

  renderCategories() {
    const fragment = document.createDocumentFragment();
    for (const category of this.categoryItems()) {
      const button = element('button', 'cm-category');
      button.type = 'button';
      button.dataset.cmCategory = category.id;
      button.classList.toggle('is-active', !this.query && category.id === this.activeCategory);
      button.setAttribute('aria-current', !this.query && category.id === this.activeCategory ? 'page' : 'false');
      button.appendChild(element('span', '', category.label));
      const changed = this.draft.fields.filter((field) => field.category === category.id && this.draft.isFieldChanged(field.id)).length;
      if (changed) {
        const count = element('span', 'cm-category-count', changed);
        count.setAttribute('aria-label', `${changed}件変更済み`);
        button.appendChild(count);
      }
      fragment.appendChild(button);
    }
    this.categoryNav.replaceChildren(fragment);
  }

  categoryHasChanges(categoryId) {
    return this.draft.fields.some((field) => field.category === categoryId && this.draft.isFieldChanged(field.id));
  }

  visibleFields() {
    const query = normalizeSearch(this.query);
    return this.draft.fields.filter((field) => {
      if (this.changedOnly && !this.draft.isFieldChanged(field.id)) return false;
      if (this.abilityView !== 'all' && isAbilityField(field)) {
        const present = hasNormalAbility(this.draft.getOriginalValue(field.id));
        if (this.abilityView === 'current' && !present) return false;
        if (this.abilityView === 'addable'
            && (present || getCharacterModificationFieldStatus(field) !== 'editable')) return false;
      }
      if (query) return searchableFieldText(field).includes(query);
      return field.category === this.activeCategory;
    });
  }

  renderFieldList() {
    const focus = captureFocus(this.fieldList);
    const fields = this.visibleFields();
    const activeCategory = this.categoryItems().find((category) => category.id === this.activeCategory);
    this.categoryHeading.textContent = this.query
      ? `検索結果 ${fields.length}件`
      : (activeCategory?.label || this.activeCategory);
    this.categoryResetButton.hidden = !!this.query;
    const fragment = document.createDocumentFragment();
    if (!fields.length) {
      fragment.appendChild(element('p', 'cm-empty', this.changedOnly ? '変更済みの項目はありません' : '一致する項目はありません'));
    } else {
      for (const field of fields) fragment.appendChild(this.buildField(field));
    }
    this.fieldList.replaceChildren(fragment);
    restoreFocus(this.fieldList, focus);
  }

  buildField(field) {
    const status = getCharacterModificationFieldStatus(field);
    const changed = this.draft.isFieldChanged(field.id);
    const original = this.draft.getOriginalValue(field.id);
    const effective = this.draft.getEffectiveValue(field.id);
    const validation = this.draft.lastValidation || this.draft.validate();
    const errors = fieldProblems(validation, field.id, 'errors');
    const warnings = fieldProblems(validation, field.id, 'warnings');
    const row = element('section', 'cm-field');
    row.dataset.cmField = field.id;
    row.classList.toggle('is-changed', changed);
    row.classList.toggle('has-error', errors.length > 0);
    row.classList.toggle('is-read-only', status !== 'editable');

    const head = element('div', 'cm-field-head');
    const title = element('div', 'cm-field-title');
    const label = element('h3', '', field.label || field.id);
    const id = element('code', '', field.id);
    title.append(label, id);
    const badges = element('div', 'cm-field-badges');
    if (changed) badges.appendChild(element('span', 'cm-badge is-changed', '改造済み'));
    else badges.appendChild(element('span', 'cm-badge', '通常'));
    if (status === 'readOnly' && !field.unsupported) {
      badges.appendChild(element('span', 'cm-badge is-read-only', '読み取り専用'));
    }
    if (status === 'unsupported' || field.unsupported) {
      badges.appendChild(element('span', 'cm-badge is-read-only', '未対応'));
    }
    const reset = iconButton({
      action: 'reset-field',
      label: `${field.label || field.id}を通常値に戻す`,
      icon: 'bi-arrow-counterclockwise',
      disabled: !changed || status !== 'editable',
      className: 'cm-field-reset'
    });
    reset.dataset.cmFieldId = field.id;
    head.append(title, badges, reset);

    const comparison = element('div', 'cm-comparison');
    const originalBlock = element('div', 'cm-value-block');
    originalBlock.append(element('span', '', '通常最終値'), element('output', '', this.formatValue(original, field)));
    const arrow = element('i', 'bi bi-arrow-right cm-value-arrow');
    arrow.setAttribute('aria-hidden', 'true');
    const modifiedBlock = element('div', 'cm-value-block');
    modifiedBlock.append(
      element('span', '', changed ? '改造後値' : '現在値'),
      element('output', '', this.formatValue(effective, field))
    );
    comparison.append(originalBlock, arrow, modifiedBlock);

    const control = element('div', 'cm-field-control');
    if (status === 'editable') {
      control.appendChild(this.buildDescriptorControl(field, field.value, this.draft.getFieldValue(field.id), effective));
    } else {
      control.appendChild(element('p', 'cm-read-only-note', field.unsupportedReason || 'この項目は現在のruntimeでは安全に編集できません'));
    }
    const dependency = dependencyText(field);
    if (dependency) control.appendChild(element('p', 'cm-dependency-note', dependency));

    const problems = element('div', 'cm-field-problems');
    for (const error of errors) problems.appendChild(element('p', 'cm-error', problemMessage(error)));
    for (const warning of warnings) problems.appendChild(element('p', 'cm-warning', problemMessage(warning)));
    if (!errors.length && !warnings.length) problems.hidden = true;
    row.append(head, comparison, control, problems);
    return row;
  }

  buildDescriptorControl(field, descriptor, override, effective) {
    if (!descriptor || descriptor.type === 'unknown') {
      return element('p', 'cm-read-only-note', 'この値型に対応する安全な入力UIはありません');
    }
    if (descriptor.type === 'object') return this.buildObjectControl(field, descriptor, override, effective);
    if (descriptor.type === 'array') return this.buildArrayControl(field, descriptor, override, effective);
    return this.buildScalarControl({ field, descriptor, value: override, effective, label: field.label || field.id });
  }

  buildObjectControl(field, descriptor, override, effective) {
    const fieldset = element('fieldset', 'cm-structured');
    fieldset.appendChild(element('legend', 'cm-sr-only', field.label || field.id));
    const current = override && typeof override === 'object' ? override : {};
    const effectiveObject = effective && typeof effective === 'object' ? effective : {};
    const enabled = current.enabled ?? effectiveObject.enabled;
    const selectedType = current.type ?? effectiveObject.type;
    for (const part of descriptorFields(descriptor)) {
      if (Array.isArray(part.requiredFor) && !part.requiredFor.includes(selectedType)) {
        continue;
      }
      const partValue = Object.prototype.hasOwnProperty.call(current, part.id) ? current[part.id] : undefined;
      const partEffective = partValue === undefined ? effectiveObject[part.id] : partValue;
      const control = this.buildScalarControl({
        field,
        descriptor: part,
        value: partValue,
        effective: partEffective,
        partId: part.id,
        label: displayPartLabel(part)
      });
      if (part.id !== 'enabled' && enabled === false) {
        control.classList.add('is-disabled-by-dependency');
        for (const input of control.querySelectorAll('input,select,button')) input.disabled = true;
      }
      fieldset.appendChild(control);
    }
    return fieldset;
  }

  buildArrayControl(field, descriptor, override, effective) {
    const fieldset = element('fieldset', 'cm-multi-select');
    fieldset.appendChild(element('legend', 'cm-sr-only', field.label || field.id));
    const selected = new Set(Array.isArray(override) ? override : Array.isArray(effective) ? effective : []);
    for (const option of descriptorOptions(descriptor.item || descriptor)) {
      const id = this.controlId(field.id, String(option.value));
      const label = element('label', 'cm-option-check');
      label.htmlFor = id;
      const input = element('input');
      input.id = id;
      input.type = 'checkbox';
      input.checked = selected.has(option.value);
      input.dataset.cmArrayField = field.id;
      input.dataset.cmArrayValue = String(option.value);
      input.dataset.cmControlKey = controlKey(field.id, String(option.value));
      label.append(input, element('span', '', option.label));
      fieldset.appendChild(label);
    }
    return fieldset;
  }

  buildScalarControl({ field, descriptor, value, effective, partId = '', label }) {
    const wrapper = element('div', 'cm-scalar');
    const id = this.controlId(field.id, partId);
    const key = controlKey(field.id, partId);
    if (descriptor.type === 'boolean') {
      const input = element('input');
      input.id = id;
      input.type = 'checkbox';
      input.checked = value === undefined ? !!effective : !!value;
      this.decorateFieldInput(input, field.id, partId, key);
      const checkboxLabel = element('label', 'cm-boolean');
      checkboxLabel.htmlFor = id;
      checkboxLabel.append(input, element('span', '', label));
      wrapper.appendChild(checkboxLabel);
      return wrapper;
    }

    const labelElement = element('label', 'cm-input-label', label);
    labelElement.htmlFor = id;
    wrapper.appendChild(labelElement);
    if (descriptor.type === 'enum') {
      const select = element('select', 'cm-select');
      select.id = id;
      this.decorateFieldInput(select, field.id, partId, key);
      const inherited = element('option', '', '通常値を使用');
      inherited.value = '';
      select.appendChild(inherited);
      for (const option of descriptorOptions(descriptor)) {
        const optionElement = element('option', '', option.label);
        optionElement.value = String(option.value);
        optionElement.selected = value !== undefined && String(value) === String(option.value);
        select.appendChild(optionElement);
      }
      wrapper.appendChild(select);
      return wrapper;
    }

    if (descriptor.type !== 'number') {
      wrapper.appendChild(element('p', 'cm-read-only-note', 'この値型は表示のみです'));
      return wrapper;
    }

    const step = Number(descriptor.step) || (descriptor.integer ? 1 : 0.1);
    const stepper = element('div', 'cm-number-stepper');
    const decrease = iconButton({ action: 'step', label: `${label}を減らす`, icon: 'bi-dash-lg' });
    decrease.dataset.cmFieldId = field.id;
    decrease.dataset.cmPartId = partId;
    decrease.dataset.cmStep = String(-step);
    decrease.dataset.cmControlKey = controlKey(field.id, `${partId}:decrease`);
    const input = element('input', 'cm-number-input');
    input.id = id;
    input.type = 'number';
    input.inputMode = descriptor.integer ? 'numeric' : 'decimal';
    input.step = String(step);
    if (Number.isFinite(descriptor.min)) input.min = String(descriptor.min);
    if (Number.isFinite(descriptor.max)) input.max = String(descriptor.max);
    input.value = value === undefined ? (effective ?? '') : value;
    this.decorateFieldInput(input, field.id, partId, key);
    const increase = iconButton({ action: 'step', label: `${label}を増やす`, icon: 'bi-plus-lg' });
    increase.dataset.cmFieldId = field.id;
    increase.dataset.cmPartId = partId;
    increase.dataset.cmStep = String(step);
    increase.dataset.cmControlKey = controlKey(field.id, `${partId}:increase`);
    stepper.append(decrease, input, increase);
    wrapper.appendChild(stepper);
    const unit = descriptor.unit || (field.editor === 'frames' ? 'frame' : '');
    if (unit) {
      const hintValue = input.value === '' ? null : Number(input.value);
      const hint = unit === 'frame' || unit === 'frames'
        ? frameDisplay(hintValue, this.framesToSeconds)
        : `${formatPrimitive(hintValue)} ${unit}`;
      wrapper.appendChild(element('small', 'cm-unit-hint', hint));
    }
    return wrapper;
  }

  decorateFieldInput(input, fieldId, partId, key) {
    input.dataset.cmFieldInput = fieldId;
    if (partId) input.dataset.cmPart = partId;
    input.dataset.cmControlKey = key;
  }

  controlId(fieldId, partId = '') {
    return `${this.id}-${fieldId}-${partId}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  }

  renderValidation(validation) {
    const errors = Array.isArray(validation?.errors) ? validation.errors : [];
    const warnings = Array.isArray(validation?.warnings) ? validation.warnings : [];
    if (!errors.length && !warnings.length) {
      this.validationSummary.hidden = true;
      this.validationSummary.replaceChildren();
      return;
    }
    const heading = element('strong', '', errors.length ? `${errors.length}件の入力エラー` : `${warnings.length}件の警告`);
    const list = element('ul');
    for (const problem of [...errors, ...warnings].slice(0, 12)) {
      const item = element('li', errors.includes(problem) ? 'cm-error' : 'cm-warning', problemMessage(problem));
      list.appendChild(item);
    }
    this.validationSummary.replaceChildren(heading, list);
    this.validationSummary.hidden = false;
  }

  handleDraftChange(change = {}) {
    this.renderCategories();
    const categoryChanged = change.fieldId === 'attacks.hitCount' || change.type === 'replace'
      || change.type === 'undo' || change.type === 'redo' || change.type?.startsWith?.('reset');
    if (categoryChanged || this.changedOnly || this.query) {
      this.renderFieldList();
    } else if (change.fieldId) {
      this.replaceField(change.fieldId);
    } else {
      this.renderFieldList();
    }
    this.renderState();
  }

  replaceField(fieldId) {
    const current = [...this.fieldList.querySelectorAll('[data-cm-field]')]
      .find((row) => row.dataset.cmField === fieldId);
    const field = this.draft.getField(fieldId);
    if (!current || !field) return this.renderFieldList();
    const focus = captureFocus(current);
    current.replaceWith(this.buildField(field));
    restoreFocus(this.fieldList, focus);
  }

  setBusy(busy) {
    this.busy = !!busy;
    this.editor.classList.toggle('is-busy', this.busy);
    this.renderState();
  }

  setStatus(message, { error = false } = {}) {
    this.statusMessage = String(message || '');
    this.statusError = !!error;
    this.renderState();
  }

  showImportPreview(transaction) {
    this.importTransaction = transaction || null;
    this.preview.replaceChildren();
    if (!transaction) {
      this.preview.hidden = true;
      this.header.hidden = false;
      this.toolbar.hidden = false;
      this.workspace.hidden = false;
      this.footer.hidden = false;
      return;
    }
    const preview = transaction.preview || transaction;
    const head = element('header', 'cm-preview-head');
    head.append(
      iconButton({ action: 'preview-cancel', label: '改造エディタへ戻る', icon: 'bi-arrow-left' }),
      element('h2', '', 'インポート内容の確認')
    );
    const body = element('div', 'cm-preview-body');
    const summary = element('dl', 'cm-preview-summary');
    const rows = [
      ['改造データ', preview.modificationCount ?? preview.addedModificationCount ?? preview.addedCount],
      ['対象キャラクター', preview.entryCount],
      ['敵spawn row', preview.spawnCount],
      ['上書き対象', preview.overwriteCount ?? preview.overwrittenCharacters?.length],
      ['変更フィールド', preview.changedFieldCount ?? preview.changedCount]
    ].filter(([, value]) => value != null);
    for (const [label, value] of rows) {
      summary.append(element('dt', '', label), element('dd', '', value));
    }
    if (rows.length) body.appendChild(summary);
    this.appendPreviewList(body, '上書きされるキャラクター', preview.overwrittenCharacters);
    this.appendPreviewList(body, 'マイグレーション', preview.migrations ?? preview.migration);
    this.appendPreviewList(body, '警告', preview.warnings);
    this.appendPreviewList(body, 'エラー', preview.errors, 'cm-error');
    if (!body.children.length) body.appendChild(element('p', 'cm-empty', '適用可能な改造データです'));
    const foot = element('footer', 'cm-preview-foot');
    const hasErrors = Array.isArray(preview.errors) && preview.errors.length > 0;
    foot.append(
      commandButton({ action: 'preview-cancel', label: '戻る' }),
      commandButton({ action: 'preview-apply', label: 'この内容を適用', className: 'is-primary', disabled: hasErrors })
    );
    this.preview.append(head, body, foot);
    this.preview.hidden = false;
    this.header.hidden = true;
    this.toolbar.hidden = true;
    this.workspace.hidden = true;
    this.footer.hidden = true;
    globalThis.requestAnimationFrame?.(() => this.preview.querySelector('button')?.focus({ preventScroll: true }));
  }

  appendPreviewList(parent, label, values, className = '') {
    const listValues = Array.isArray(values) ? values : values ? [values] : [];
    if (!listValues.length) return;
    const section = element('section', 'cm-preview-section');
    section.appendChild(element('h3', '', label));
    const list = element('ul');
    for (const value of listValues.slice(0, 100)) {
      list.appendChild(element('li', className, problemMessage(value)));
    }
    section.appendChild(list);
    parent.appendChild(section);
  }

  onClick(event) {
    const category = event.target.closest?.('[data-cm-category]');
    if (category && this.root.contains(category)) {
      event.preventDefault();
      event.stopPropagation();
      this.activeCategory = category.dataset.cmCategory;
      this.query = '';
      this.searchInput.value = '';
      this.renderCategories();
      this.renderFieldList();
      this.renderState();
      this.categoryNav.querySelector(`[data-cm-category="${CSS.escape(this.activeCategory)}"]`)?.focus({ preventScroll: true });
      this.content.scrollTop = 0;
      return;
    }
    const actionElement = event.target.closest?.('[data-cm-action]');
    if (!actionElement || !this.root.contains(actionElement)) return;
    const action = actionElement.dataset.cmAction;
    event.preventDefault();
    event.stopPropagation();
    if (action === 'undo') this.actions.undo?.();
    else if (action === 'redo') this.actions.redo?.();
    else if (action === 'reset-field') this.actions.resetField?.(actionElement.dataset.cmFieldId);
    else if (action === 'reset-category') this.actions.resetCategory?.(this.activeCategory);
    else if (action === 'reset-all') this.actions.resetAll?.();
    else if (action === 'save') this.actions.save?.();
    else if (action === 'cancel') this.actions.cancel?.('button', event);
    else if (action === 'import') this.actions.import?.();
    else if (action === 'export') this.actions.export?.();
    else if (action === 'preview-cancel') this.actions.cancelImportPreview?.();
    else if (action === 'preview-apply') this.actions.applyImportPreview?.();
    else if (action === 'step') this.applyStep(actionElement);
  }

  onInput(event) {
    if (event.target === this.searchInput) {
      event.stopPropagation();
      this.query = event.target.value;
      this.renderCategories();
      this.renderFieldList();
    }
  }

  onChange(event) {
    const target = event.target;
    if (target === this.changedOnlyInput) {
      event.stopPropagation();
      this.changedOnly = target.checked;
      this.renderFieldList();
      return;
    }
    if (target === this.abilityFilter) {
      event.stopPropagation();
      this.abilityView = ['current', 'addable'].includes(target.value)
        ? target.value
        : 'all';
      this.renderFieldList();
      return;
    }
    const arrayField = target.dataset?.cmArrayField;
    if (arrayField) {
      event.stopPropagation();
      const field = this.draft.getField(arrayField);
      const options = descriptorOptions(field?.value?.item || field?.value);
      const selected = [...this.root.querySelectorAll('[data-cm-array-field]')]
        .filter((input) => input.dataset.cmArrayField === arrayField && input.checked)
        .map((input) => (
          options.find((option) => String(option.value) === input.dataset.cmArrayValue)?.value
          ?? input.dataset.cmArrayValue
        ));
      this.actions.setField?.(arrayField, selected);
      return;
    }
    const fieldId = target.dataset?.cmFieldInput;
    if (!fieldId) return;
    event.stopPropagation();
    const field = this.draft.getField(fieldId);
    if (!field) return;
    const partId = target.dataset.cmPart || '';
    const descriptor = partId
      ? descriptorFields(field.value).find((part) => part.id === partId)
      : field.value;
    let value;
    if (target.type === 'checkbox') value = target.checked;
    else if (descriptor?.type === 'number') {
      if (target.value.trim() === '') value = undefined;
      else {
        value = Number(target.value);
        if (descriptor.integer && Number.isFinite(value)) value = Math.trunc(value);
      }
    } else if (descriptor?.type === 'enum') {
      value = target.value === ''
        ? undefined
        : descriptorOptions(descriptor).find((option) => String(option.value) === target.value)?.value
          ?? target.value;
    } else value = target.value === '' ? undefined : target.value;
    if (partId) this.actions.setFieldPart?.(fieldId, partId, value);
    else this.actions.setField?.(fieldId, value);
  }

  onKeydown(event) {
    if (event.key !== 'Enter' || !event.target.matches?.('input[type="number"]')) return;
    event.preventDefault();
    event.stopPropagation();
    event.target.blur();
  }

  onPointerDown(event) {
    const step = event.target.closest?.('[data-cm-action="step"]');
    if (!step || !this.root.contains(step) || step.disabled) return;
    this.stopStepRepeat();
    this.stepRepeatTimer = globalThis.setTimeout?.(() => {
      this.applyStep(step);
      this.stepRepeatInterval = globalThis.setInterval?.(() => this.applyStep(step), 90);
    }, 420);
  }

  stopStepRepeat() {
    if (this.stepRepeatTimer != null) globalThis.clearTimeout?.(this.stepRepeatTimer);
    if (this.stepRepeatInterval != null) globalThis.clearInterval?.(this.stepRepeatInterval);
    this.stepRepeatTimer = null;
    this.stepRepeatInterval = null;
  }

  applyStep(button) {
    const fieldId = button.dataset.cmFieldId;
    const partId = button.dataset.cmPartId || '';
    const field = this.draft.getField(fieldId);
    if (!field) return;
    const descriptor = partId
      ? descriptorFields(field.value).find((part) => part.id === partId)
      : field.value;
    const amount = Number(button.dataset.cmStep);
    const input = [...this.root.querySelectorAll('[data-cm-field-input]')].find((candidate) => (
      candidate.dataset.cmFieldInput === fieldId && (candidate.dataset.cmPart || '') === partId
    ));
    const current = Number(input?.value ?? this.draft.getEffectiveValue(fieldId) ?? 0);
    let next = (Number.isFinite(current) ? current : 0) + (Number.isFinite(amount) ? amount : 0);
    if (Number.isFinite(descriptor?.min)) next = Math.max(descriptor.min, next);
    if (Number.isFinite(descriptor?.max)) next = Math.min(descriptor.max, next);
    if (descriptor?.integer) next = Math.trunc(next);
    if (partId) this.actions.setFieldPart?.(fieldId, partId, next);
    else this.actions.setField?.(fieldId, next);
  }

  destroy() {
    this.stopStepRepeat();
    this.root.removeEventListener('click', this.boundClick);
    this.root.removeEventListener('input', this.boundInput);
    this.root.removeEventListener('change', this.boundChange);
    this.root.removeEventListener('keydown', this.boundKeydown);
    this.root.removeEventListener('pointerdown', this.boundPointerDown);
    document.removeEventListener('pointerup', this.boundPointerEnd, true);
    document.removeEventListener('pointercancel', this.boundPointerEnd, true);
    this.root.replaceChildren();
    this.root.classList.remove('cm-renderer-mounted');
  }
}

export function renderCharacterModificationEditor(options = {}) {
  return new CharacterModificationRenderer(options).mount();
}
