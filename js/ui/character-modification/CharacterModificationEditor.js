import {
  CHARACTER_MODIFICATION_CATEGORIES,
  CHARACTER_MODIFICATION_FIELD_REGISTRY
} from '../../character-modification/CharacterModificationFieldRegistry.js';
import { normalizeCharacterModification } from '../../character-modification/CharacterModificationNormalizer.js';
import { validateCharacterModification } from '../../character-modification/CharacterModificationValidator.js';
import { getCharacterModificationHash } from '../../character-modification/CharacterModificationHash.js';
import { createCharacterModificationDraft } from './CharacterModificationDraft.js';
import { createCharacterModificationHost } from './CharacterModificationOverlayHost.js';
import { renderCharacterModificationEditor } from './CharacterModificationRenderer.js';
import { installCharacterModificationResponsiveStyles } from './CharacterModificationResponsive.css.js';

const DEFAULT_DEPENDENCIES = {
  registry: CHARACTER_MODIFICATION_FIELD_REGISTRY,
  categories: CHARACTER_MODIFICATION_CATEGORIES,
  normalize: normalizeCharacterModification,
  validate: validateCharacterModification,
  hash: getCharacterModificationHash
};

let configuredDependencies = { ...DEFAULT_DEPENDENCIES };

function errorMessage(error, fallback = '処理に失敗しました') {
  return String(error?.message || error || fallback);
}

function resultFailed(result) {
  return result === false || result?.ok === false || result?.success === false;
}

function resultMessage(result, fallback) {
  return String(result?.message || result?.error?.message || result?.error || fallback);
}

function importedModification(transaction, result) {
  const candidates = [
    result?.modification,
    result?.normalizedModification,
    result?.normalized,
    transaction?.modification,
    transaction?.preview?.modification
  ];
  return candidates.find((candidate) => candidate && typeof candidate === 'object') || null;
}

async function defaultDiscardConfirmation() {
  if (typeof globalThis.confirm !== 'function') return true;
  return globalThis.confirm('未保存の改造内容を破棄しますか？');
}

export function configureCharacterModificationUi(dependencies = {}) {
  configuredDependencies = {
    ...configuredDependencies,
    ...Object.fromEntries(Object.entries(dependencies).filter(([, value]) => value != null))
  };
  return { ...configuredDependencies };
}

export function getCharacterModificationUiConfiguration() {
  return { ...configuredDependencies };
}

export class CharacterModificationEditor {
  constructor(options = {}) {
    this.options = options;
    this.dependencies = {
      ...configuredDependencies,
      ...(options.dependencies || {}),
      ...(options.registry ? { registry: options.registry } : {}),
      ...(options.categories ? { categories: options.categories } : {}),
      ...(options.normalize ? { normalize: options.normalize } : {}),
      ...(options.validate ? { validate: options.validate } : {}),
      ...(options.hash ? { hash: options.hash } : {})
    };
    if (!this.dependencies.registry) throw new TypeError('CharacterModificationEditor requires a field registry');
    this.subject = options.subject || {};
    this.subjectKind = options.subjectKind || this.subject.kind || 'unit';
    this.owner = options.owner || options.context?.owner || 'formation';
    this.mode = options.mode === 'embedded' ? 'embedded' : 'standalone';
    this.onCommit = options.onCommit;
    this.onCancel = options.onCancel;
    this.onAfterClose = options.onAfterClose || options.onClose;
    this.onRequestImport = options.onRequestImport;
    this.onRequestExport = options.onRequestExport;
    this.confirmDiscard = options.confirmDiscard || defaultDiscardConfirmation;
    this.importTransaction = null;
    this.host = options.host || null;
    this.ownsHost = !options.host;
    this.draft = null;
    this.renderer = null;
    this.unsubscribeDraft = null;
    this.opened = false;
    this.closing = false;
    this.busy = false;
    this.destroyed = false;
  }

  async resolveNormalValues() {
    if (typeof this.options.onResolveNormalValues === 'function') {
      const resolved = await this.options.onResolveNormalValues({
        subject: this.subject,
        subjectKind: this.subjectKind,
        owner: this.owner,
        modification: this.options.modification || null
      });
      if (resolved) return resolved;
    }
    return await Promise.resolve(this.options.normalValues || {});
  }

  createHost() {
    if (this.host) {
      this.host.setRequestCloseHandler?.((reason, event) => this.requestClose(reason, event));
      return this.host;
    }
    this.host = createCharacterModificationHost({
      mode: this.mode,
      mount: this.options.mount,
      overlay: this.options.overlay || null,
      trigger: this.options.trigger || null,
      onRequestClose: (reason, event) => this.requestClose(reason, event),
      manageDocumentScroll: this.options.manageDocumentScroll,
      inertBackground: this.options.inertBackground,
      label: this.options.dialogLabel || 'キャラクター改造'
    });
    return this.host;
  }

  async open() {
    if (this.destroyed) throw new Error('CharacterModificationEditor has been destroyed');
    if (this.opened) return this;
    installCharacterModificationResponsiveStyles();
    const normalValues = await this.resolveNormalValues();
    this.draft = createCharacterModificationDraft({
      modification: this.options.modification || {},
      normalValues,
      registry: this.dependencies.registry,
      subjectKind: this.subjectKind,
      normalize: this.dependencies.normalize,
      validate: this.dependencies.validate,
      hash: this.dependencies.hash,
      historyLimit: this.options.historyLimit,
      context: {
        ...(this.options.context || {}),
        resolvers: {
          ...(this.options.context?.resolvers || {}),
          ...(this.options.resolvers || {})
        },
        resolveSummonTarget: this.options.resolveSummonTarget
          || this.options.context?.resolveSummonTarget,
        requireResolvedReferences: true,
        owner: this.owner,
        subject: this.subject
      }
    });
    const host = this.createHost();
    this.renderer = renderCharacterModificationEditor({
      root: host.editorRoot,
      draft: this.draft,
      categories: this.dependencies.categories,
      subject: this.subject,
      framesToSeconds: this.options.framesToSeconds,
      labels: this.options.labels,
      actions: {
        setField: (fieldId, value) => this.runDraftAction(() => this.draft.setField(fieldId, value)),
        setFieldPart: (fieldId, partId, value) => this.runDraftAction(() => this.draft.setFieldPart(fieldId, partId, value)),
        resetField: (fieldId) => this.runDraftAction(() => this.draft.resetField(fieldId)),
        resetCategory: (categoryId) => this.runDraftAction(() => this.draft.resetCategory(categoryId)),
        resetAll: () => this.runDraftAction(() => this.draft.resetAll()),
        undo: () => this.runDraftAction(() => this.draft.undo()),
        redo: () => this.runDraftAction(() => this.draft.redo()),
        save: () => this.save(),
        cancel: (reason, event) => this.requestClose(reason, event),
        ...(typeof this.onRequestImport === 'function' ? { import: () => this.requestImport() } : {}),
        ...(typeof this.onRequestExport === 'function' ? { export: () => this.exportModification() } : {}),
        cancelImportPreview: () => this.cancelImportPreview(),
        applyImportPreview: () => this.applyImportPreview()
      }
    });
    this.unsubscribeDraft = this.draft.subscribe((change) => {
      this.renderer?.handleDraftChange(change);
    });
    host.open({ initialFocus: this.options.initialFocus || '[data-cm-search]' });
    this.opened = true;
    host.announce(`キャラクター改造を開きました。現在${this.draft.getChangedCount()}件が改造済みです`);
    return this;
  }

  runDraftAction(action) {
    if (this.busy || !this.draft) return false;
    try {
      const changed = action();
      if (changed) {
        this.renderer?.setStatus('');
        this.host?.announce(`改造済み ${this.draft.getChangedCount()}件`);
      }
      return changed;
    } catch (error) {
      const message = errorMessage(error, '入力を反映できませんでした');
      this.renderer?.setStatus(message, { error: true });
      this.host?.announce(message, { assertive: true });
      return false;
    }
  }

  setBusy(busy) {
    this.busy = !!busy;
    this.host?.setBusy(this.busy);
    this.renderer?.setBusy(this.busy);
  }

  async save() {
    if (this.busy || !this.draft) return false;
    const snapshot = this.draft.getSnapshot();
    if (snapshot.validation?.ok === false) {
      const message = `${snapshot.validation.errors.length}件の入力エラーを修正してください`;
      this.renderer?.setStatus(message, { error: true });
      this.host?.announce(message, { assertive: true });
      return false;
    }
    this.setBusy(true);
    try {
      const modification = snapshot.normalizedModification;
      const hash = await Promise.resolve(this.draft.getHash());
      const payload = {
        modification,
        hash,
        changedCount: snapshot.changedCount,
        warnings: snapshot.validation?.warnings || [],
        subject: this.subject,
        subjectKind: this.subjectKind,
        owner: this.owner
      };
      const result = typeof this.onCommit === 'function' ? await this.onCommit(payload) : { ok: true };
      if (resultFailed(result)) {
        const message = resultMessage(result, '改造を保存できませんでした');
        this.renderer?.setStatus(message, { error: true });
        this.host?.announce(message, { assertive: true });
        return false;
      }
      this.draft.markCommitted();
      const message = resultMessage(result, '改造を保存しました');
      this.host?.announce(message);
      await this.close({ reason: 'save', notifyCancel: false });
      return true;
    } catch (error) {
      const message = errorMessage(error, '改造を保存できませんでした');
      this.renderer?.setStatus(message, { error: true });
      this.host?.announce(message, { assertive: true });
      return false;
    } finally {
      if (this.opened) this.setBusy(false);
    }
  }

  async exportModification() {
    if (this.busy || !this.draft || typeof this.onRequestExport !== 'function') return false;
    const snapshot = this.draft.getSnapshot();
    if (snapshot.validation?.ok === false) {
      const message = '入力エラーを修正してからエクスポートしてください';
      this.renderer?.setStatus(message, { error: true });
      this.host?.announce(message, { assertive: true });
      return false;
    }
    this.setBusy(true);
    try {
      const result = await this.onRequestExport({
        subject: this.subject,
        subjectKind: this.subjectKind,
        owner: this.owner,
        modification: snapshot.normalizedModification,
        hash: await Promise.resolve(this.draft.getHash()),
        changedCount: snapshot.changedCount,
        warnings: snapshot.validation?.warnings || []
      });
      if (resultFailed(result)) {
        const message = resultMessage(result, 'エクスポートできませんでした');
        this.renderer?.setStatus(message, { error: true });
        this.host?.announce(message, { assertive: true });
        return false;
      }
      const message = resultMessage(result, '改造データをエクスポートしました');
      this.renderer?.setStatus(message);
      this.host?.announce(message);
      return true;
    } catch (error) {
      const message = errorMessage(error, 'エクスポートできませんでした');
      this.renderer?.setStatus(message, { error: true });
      this.host?.announce(message, { assertive: true });
      return false;
    } finally {
      this.setBusy(false);
    }
  }

  async requestImport() {
    if (this.busy || typeof this.onRequestImport !== 'function') return false;
    this.setBusy(true);
    try {
      const transaction = await this.onRequestImport({
        subject: this.subject,
        subjectKind: this.subjectKind,
        owner: this.owner,
        current: this.draft.getSnapshot()
      });
      if (!transaction) return false;
      this.setImportTransaction(transaction);
      return true;
    } catch (error) {
      const message = errorMessage(error, 'インポート内容を読み込めませんでした');
      this.renderer?.setStatus(message, { error: true });
      this.host?.announce(message, { assertive: true });
      return false;
    } finally {
      this.setBusy(false);
    }
  }

  setImportTransaction(transaction) {
    if (!transaction || typeof transaction !== 'object') {
      throw new TypeError('Import transaction must be an object');
    }
    this.importTransaction = transaction.preview ? transaction : { preview: transaction };
    this.renderer?.showImportPreview(this.importTransaction);
    this.host?.announce('インポート内容の確認を表示しました');
    return this.importTransaction;
  }

  async cancelImportPreview() {
    const transaction = this.importTransaction;
    this.importTransaction = null;
    try { await transaction?.cancel?.(); } catch {}
    this.renderer?.showImportPreview(null);
    this.host?.announce('インポートをキャンセルしました');
  }

  async applyImportPreview() {
    const transaction = this.importTransaction;
    if (!transaction || this.busy) return false;
    const previewErrors = transaction.preview?.errors;
    if (Array.isArray(previewErrors) && previewErrors.length) {
      this.host?.announce('エラーがあるためインポートできません', { assertive: true });
      return false;
    }
    this.setBusy(true);
    try {
      const result = typeof transaction.commit === 'function'
        ? await transaction.commit({
          subject: this.subject,
          subjectKind: this.subjectKind,
          owner: this.owner,
          current: this.draft.getSnapshot()
        })
        : transaction;
      if (resultFailed(result)) {
        const message = resultMessage(result, 'インポートを適用できませんでした');
        this.host?.announce(message, { assertive: true });
        return false;
      }
      const modification = importedModification(transaction, result);
      if (modification) this.draft.replaceModification(modification, { source: 'import' });
      const committed = result?.committed === true || transaction.committed === true;
      if (committed) this.draft.markCommitted();
      this.importTransaction = null;
      this.renderer?.showImportPreview(null);
      const message = resultMessage(
        result,
        committed ? 'インポート内容を保存しました' : 'インポート内容をdraftへ適用しました'
      );
      this.renderer?.setStatus(message);
      this.host?.announce(message);
      return true;
    } catch (error) {
      const message = errorMessage(error, 'インポートを適用できませんでした');
      this.renderer?.setStatus(message, { error: true });
      this.host?.announce(message, { assertive: true });
      return false;
    } finally {
      this.setBusy(false);
    }
  }

  async requestClose(reason = 'cancel', event = null) {
    if (this.busy || !this.opened || this.closing) return false;
    if (this.draft?.isDirty()) {
      const allow = await this.confirmDiscard({
        reason,
        event,
        subject: this.subject,
        snapshot: this.draft.getSnapshot()
      });
      if (!allow) {
        this.host?.announce('編集を続けます');
        return false;
      }
    }
    return this.close({ reason, notifyCancel: true });
  }

  async close({ reason = 'close', notifyCancel = true } = {}) {
    if (this.closing || !this.opened) return false;
    this.closing = true;
    try {
      if (this.importTransaction) {
        try { await this.importTransaction.cancel?.(); } catch {}
        this.importTransaction = null;
      }
      this.unsubscribeDraft?.();
      this.unsubscribeDraft = null;
      this.renderer?.destroy();
      this.renderer = null;
      this.host?.close();
      this.opened = false;
      try {
        if (notifyCancel && typeof this.onCancel === 'function') {
          await this.onCancel({ reason, subject: this.subject, owner: this.owner });
        }
        if (typeof this.onAfterClose === 'function') {
          await this.onAfterClose({
            reason,
            saved: reason === 'save',
            subject: this.subject,
            subjectKind: this.subjectKind,
            owner: this.owner
          });
        }
        return true;
      } finally {
        if (this.ownsHost) {
          this.host?.destroy();
          this.host = null;
        }
      }
    } finally {
      this.closing = false;
    }
  }

  async destroy() {
    if (this.destroyed) return;
    if (this.opened) await this.close({ reason: 'destroy', notifyCancel: false });
    else if (this.ownsHost) this.host?.destroy();
    this.host = null;
    this.draft = null;
    this.destroyed = true;
  }

  getSession() {
    return {
      editor: this,
      host: this.host,
      draft: this.draft,
      save: () => this.save(),
      cancel: (reason = 'api') => this.requestClose(reason),
      export: () => this.exportModification(),
      setImportTransaction: (transaction) => this.setImportTransaction(transaction),
      destroy: () => this.destroy()
    };
  }
}

export async function openCharacterModificationEditor(options = {}) {
  const editor = new CharacterModificationEditor(options);
  await editor.open();
  return editor;
}
