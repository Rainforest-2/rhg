import { CHARACTER_FACTIONS, getAvailableCharacters, getCharactersByFaction, getCharacterById } from '../battle/CharacterCatalog.js';
import { FormationStore, LINEUP_COLS, LINEUP_ROWS, LINEUP_TOTAL } from '../battle/FormationStore.js';
import { getAvailableStages, getDefaultStage } from '../battle/StageRegistry.js';
import { StageDefinitionLoader } from '../battle/StageDefinitionLoader.js';
import { stageKey as makeStageKey, stageMapKey } from '../bcu/BcuIdentifier.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';
import { BattleSpeedControl } from './BattleSpeedControl.js';

// Community Discord invite shown in the settings UI.
const SETTINGS_DISCORD_URL = 'https://discord.gg/6XJgaXEFQz';

function clampPage(page) {
  const p = Math.floor(Number(page) || 0);
  return Math.max(0, Math.min(LINEUP_ROWS - 1, p));
}

function formatCost(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '---';
  return `${Math.floor(n).toLocaleString('ja-JP')}円`;
}

function formatCooldown(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '---';
  const sec = n / 1000;
  return sec >= 10 ? `${Math.round(sec)}s` : `${sec.toFixed(1)}s`;
}

function characterCost(c) {
  return c?.cost ?? c?.defaultCost ?? c?.productionCost ?? null;
}

function characterCooldown(c) {
  return c?.cooldownMs ?? c?.defaultCooldownMs ?? c?.productionCooldownMs ?? null;
}

function pageLabel(page) {
  return `PAGE ${page + 1}`;
}

export class FormationEditor {
  constructor({ mount, onFormationChanged, onApplyBattle, onStageChanged, selectedStageId, onSettingChanged } = {}) {
    this.mount = mount || document.body;
    this.onFormationChanged = onFormationChanged || (() => {});
    this.onApplyBattle = onApplyBattle || (() => {});
    this.onStageChanged = onStageChanged || (() => {});
    this.onSettingChanged = onSettingChanged || (() => {});
    this.selectedStageId = selectedStageId || getDefaultStage()?.stageKey || getDefaultStage()?.stageId || null;
    this.stageLoader = new StageDefinitionLoader((level, message) => console[level === 'error' ? 'error' : 'warn']?.(message));
    this.stageOptions = [];
    this.stageMeta = new Map();
    this.stageLoading = false;
    this.stageOverlayOpen = false;
    this.settingsOverlayOpen = false;
    this.filter = CHARACTER_FACTIONS.all;
    this.searchText = '';
    this.searchDraft = '';
    this.formation = FormationStore.load();
    this.activePage = 0;
    this.activeSlot = 0;
    this.applying = false;
    this.iconWork = new Map();
    this.iconQueue = [];
    this.iconActive = 0;
    this.iconConcurrency = 6;
    this.iconObserver = null;
    this.iconObserverRoot = null;
    this.iconDebug = { resolvedIconCount: 0, failedIconCount: 0, observedIconCount: 0, eagerIconCount: 0, queuedIconCount: 0 };
    this.reportedIconFailures = new Set();
    this.catalogItems = [];
    this.catalogVirtual = { rowHeight: 194, columns: 4, overscanRows: 8, start: 0, end: 0, firstVisibleRow: 0, lastVisibleRow: 0 };
    this.renderFrame = null;
    this.root = document.createElement('div');
    this.root.className = 'formation-ui';
    this.root.__formationEditor = this;
    this.mount.appendChild(this.root);
    this.root.addEventListener('pointerup', (e) => this.onPointerUpCapture(e), true);
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('input', (e) => this.onInput(e));
    this.root.addEventListener('scroll', (e) => this.onScroll(e), true);
    this.refresh();
    this.loadStageOptions();
  }

  setVisible(v) { this.root.classList.toggle('is-visible', !!v); }

  setHint(text) {
    const hint = this.root.querySelector('.formation-action-hint');
    if (hint) hint.textContent = text;
  }

  switchPage(page, reason = 'ui') {
    const nextPage = clampPage(page);
    const previousPage = this.activePage;
    this.activePage = nextPage;
    this.activeSlot = nextPage * LINEUP_COLS;
    this.setHint(`${pageLabel(nextPage)} selected`);
    globalThis.__FORMATION_PAGE_DEBUG__ = {
      reason,
      previousPage,
      activePage: this.activePage,
      activeSlot: this.activeSlot,
      rows: LINEUP_ROWS,
      cols: LINEUP_COLS,
      timestamp: Date.now()
    };
    this.renderDynamic();
  }

  onPointerUpCapture(e) {
    const page = e.target.closest?.('[data-page]');
    if (!page || !this.root.contains(page)) return;
    e.preventDefault();
    e.stopPropagation();
    this.switchPage(page.dataset.page, 'pointerup-capture');
  }

  onInput(e) {
    const input = e.target.closest('[data-search-input]');
    if (!input) return;
    this.searchDraft = String(input.value || '');
  }

  onScroll(e) {
    if (!e.target.closest?.('.formation-catalog-scroll')) return;
    if (this.renderFrame) return;
    this.renderFrame = requestAnimationFrame(() => {
      this.renderFrame = null;
      this.renderCatalogWindow();
      this.resolveSemanticIcons();
    });
  }

  async onClick(e) {
    if (e.target.closest('[data-search-input]')) return;
    const page = e.target.closest('[data-page]');
    if (page) {
      e.preventDefault();
      e.stopPropagation();
      return this.switchPage(page.dataset.page, 'click');
    }

    const setting = e.target.closest('[data-setting]');
    if (setting && this.root.contains(setting)) {
      e.preventDefault();
      e.stopPropagation();
      if (setting.dataset.setting === 'bcu-speed-control') {
        const next = setting.getAttribute('aria-checked') !== 'true';
        BattleSpeedControl.setFeatureEnabled(next);
        this.onSettingChanged('bcu-speed-control', next);
        this.setHint(next ? 'スピードアップ機能: ON' : 'スピードアップ機能: OFF');
        this.renderSettingsOverlay();
      }
      return;
    }

    const settingsBackdrop = e.target.closest('.formation-settings-overlay');
    if (settingsBackdrop && e.target === settingsBackdrop) {
      e.preventDefault();
      e.stopPropagation();
      this.settingsOverlayOpen = false;
      this.renderSettingsOverlay();
      return;
    }

    const action = e.target.closest('[data-action]');
    const stage = e.target.closest('[data-stage-id]');
    if (stage) {
      e.preventDefault();
      e.stopPropagation();
      this.selectStage(stage.dataset.stageId);
      return;
    }
    if (action) {
      const type = action.dataset.action;
      if (type === 'stage-open') {
        e.preventDefault();
        e.stopPropagation();
        this.stageOverlayOpen = true;
        this.renderStageSelector();
        return;
      }
      if (type === 'stage-close') {
        e.preventDefault();
        e.stopPropagation();
        this.stageOverlayOpen = false;
        this.renderStageSelector();
        return;
      }
      if (type === 'settings-open') {
        e.preventDefault();
        e.stopPropagation();
        this.settingsOverlayOpen = true;
        this.renderSettingsOverlay();
        return;
      }
      if (type === 'settings-close') {
        e.preventDefault();
        e.stopPropagation();
        this.settingsOverlayOpen = false;
        this.renderSettingsOverlay();
        return;
      }
      if (type === 'catalog-search') {
        e.preventDefault();
        e.stopPropagation();
        const input = this.root.querySelector('[data-search-input]');
        this.searchDraft = String(input?.value ?? this.searchDraft ?? '');
        this.searchText = this.searchDraft;
        this.setHint(this.searchText ? `検索: ${this.searchText}` : '検索条件をクリア');
        return this.renderDynamic({ resetCatalogScroll: true });
      }
      if (type === 'apply' && !this.applying) {
        e.preventDefault();
        e.stopPropagation();
        const btn = this.root.querySelector('.apply-battle-button');
        this.applying = true;
        if (btn) { btn.disabled = true; btn.textContent = 'Applying...'; }
        try { await this.onApplyBattle(this.formation); }
        catch (err) {
          console.error('[FormationEditor] apply failed detail', { name: err?.name, message: err?.message, stack: err?.stack, cause: err?.cause, error: err });
          this.setHint(`Apply failed: ${err?.message || String(err)}`);
        }
        finally { this.applying = false; if (btn) { btn.disabled = false; btn.textContent = 'Apply Battle'; } }
        return;
      }
      if (type === 'clear') {
        FormationStore.setSlot(this.activeSlot, null);
        this.formation = FormationStore.load();
        this.onFormationChanged(this.formation);
        this.setHint(`${pageLabel(this.activePage)} slot cleared`);
        return this.renderDynamic();
      }
      if (type === 'reset') {
        FormationStore.reset();
        this.formation = FormationStore.load();
        this.activePage = 0;
        this.activeSlot = 0;
        this.onFormationChanged(this.formation);
        this.setHint('Formation reset to default');
        return this.renderDynamic();
      }
    }

    const slot = e.target.closest('[data-slot]');
    const filter = e.target.closest('[data-filter]');
    const character = e.target.closest('[data-character]');
    if (slot) {
      this.activeSlot = Number(slot.dataset.slot);
      this.activePage = clampPage(Math.floor(this.activeSlot / LINEUP_COLS));
      return this.renderDynamic();
    }
    if (filter) { this.filter = filter.dataset.filter; return this.renderDynamic({ resetCatalogScroll: true }); }
    if (character) {
      const characterId = character.dataset.character;
      const selected = getCharacterById(characterId);
      if (!selected) { this.setHint(`Error: character not found ${characterId}`); return; }
      FormationStore.setSlot(this.activeSlot, characterId);
      this.formation = FormationStore.load();
      this.onFormationChanged(this.formation);
      this.setHint(`${pageLabel(this.activePage)} selected: ${selected.label || characterId}`);
      return this.renderDynamic();
    }
  }

  selectStage(stageId) {
    this.selectedStageId = stageId || null;
    this.onStageChanged(this.selectedStageId);
    this.stageOverlayOpen = false;
    globalThis.__BCU_STAGE_SELECT_DEBUG__ = {
      selectedStageId: this.selectedStageId,
      meta: this.stageMeta.get(this.selectedStageId) || null,
      source: 'FormationEditor stage selector -> PreviewApp.selectedStageId',
      timestamp: Date.now()
    };
    this.renderStageSelector();
  }

  async loadStageOptions() {
    if (this.stageLoading) return;
    this.stageLoading = true;
    try {
      const stages = getAvailableStages()
        .filter((s) => s?.bundleRef?.bundlePath || s?.semanticEntry?.bundleRef?.bundlePath || s?.enabled !== false)
        .slice(0, 80);
      this.stageOptions = stages;
      this.renderStageSelector();
      const limit = stages.slice(0, 30);
      for (const stage of limit) {
        try {
          const def = await this.stageLoader.load(stage);
          const rows = def?.runtime?.enemyRows || [];
          this.stageMeta.set(stage.stageKey || stage.stageId, {
            ok: !!def?.ok,
            displayName: null,
            unresolvedNameReason: 'name bundle resolver not connected for formation stage selector',
            bgId: def?.bgId ?? def?.meta?.bgId ?? null,
            enemyBaseHp: def?.enemyBaseHp ?? def?.meta?.enemyBaseHp ?? null,
            enemyRowCount: rows.length,
            unresolvedEnemyCount: rows.filter((r) => r?.unresolved || r?.enemyId == null).length,
            stageLen: def?.stageLen ?? def?.meta?.stageLen ?? null,
            bundleAvailability: stage?.bundleRef?.bundlePath ? 'available' : 'missing',
            bundlePath: stage?.bundleRef?.bundlePath || null
          });
        } catch (error) {
          this.stageMeta.set(stage.stageKey || stage.stageId, {
            ok: false,
            displayName: null,
            unresolvedNameReason: 'stage definition load failed',
            errorMessage: error?.message || String(error),
            bundleAvailability: stage?.bundleRef?.bundlePath ? 'available-load-failed' : 'missing',
            bundlePath: stage?.bundleRef?.bundlePath || null
          });
        }
      }
      this.renderStageSelector();
    } finally {
      this.stageLoading = false;
    }
  }

  parseStageTripletFromEntry(stage) {
    const basename = stage?.stageId || stage?.basename || stage?.semanticEntry?.basename || '';
    let m = basename.match(/^stageRN(\d{3})_(\d{2})$/i);
    if (m) return { mapColcId: 0, mapId: Number(m[1]), stageId: Number(m[2]), source: 'BCU filename stageRN -> legend triplet' };
    m = basename.match(/^stageRNA(\d{3})_(\d{2})$/i);
    if (m) return { mapColcId: 1, mapId: Number(m[1]), stageId: Number(m[2]), source: 'BCU filename stageRNA -> event triplet' };
    m = basename.match(/^stageEX(\d{3})_(\d{2})$/i);
    if (m) return { mapColcId: 4, mapId: Number(m[1]), stageId: Number(m[2]), source: 'BCU filename stageEX -> EX triplet' };
    return null;
  }

  resolveStageDisplay(stage, meta = {}) {
    const db = getBcuAssetDatabase();
    const direct = db?.stages?.get?.(stage?.stageKey || stage?.key);
    if (direct?.name?.source === 'lang' && direct.name.value) {
      return { displayName: direct.name.value, source: direct.name.file || 'BcuStageRepository.name', unresolvedNameReason: null };
    }
    const triplet = this.parseStageTripletFromEntry(stage);
    if (triplet && db?.names) {
      const map = db.names.resolve('stageMap', stageMapKey(triplet.mapColcId, triplet.mapId), db.locale);
      const st = db.names.resolve('stage', makeStageKey(triplet.mapColcId, triplet.mapId, triplet.stageId), db.locale);
      const mapOk = map?.source === 'lang' && map.value;
      const stageOk = st?.source === 'lang' && st.value;
      if (mapOk && stageOk) return {
        displayName: `${map.value} - ${st.value}`,
        source: `${map.file}; ${st.file}`,
        unresolvedNameReason: null,
        nameTriplet: triplet
      };
      if (stageOk) return {
        displayName: st.value,
        source: st.file,
        unresolvedNameReason: mapOk ? null : `map name missing for ${stageMapKey(triplet.mapColcId, triplet.mapId)}`,
        nameTriplet: triplet
      };
      return {
        displayName: null,
        source: triplet.source,
        unresolvedNameReason: `lang missing for ${makeStageKey(triplet.mapColcId, triplet.mapId, triplet.stageId)}`,
        nameTriplet: triplet
      };
    }
    const fallback = meta.displayName || stage?.name?.value || stage?.label || null;
    return {
      displayName: fallback,
      source: stage?.name?.source || 'stage-index',
      unresolvedNameReason: fallback ? null : 'stage filename cannot be mapped to BCU StageName triplet'
    };
  }

  renderStageSelector() {
    const overlay = this.root.querySelector('.formation-stage-overlay');
    if (overlay) overlay.classList.toggle('is-open', this.stageOverlayOpen);
    const current = this.root.querySelector('.formation-current-stage');
    const selectedStage = (this.stageOptions || []).find((s) => (s.stageKey || s.stageId) === this.selectedStageId || s.stageId === this.selectedStageId);
    const selectedMeta = selectedStage ? this.stageMeta.get(selectedStage.stageKey || selectedStage.stageId) || {} : {};
    const selectedName = selectedStage ? this.resolveStageDisplay(selectedStage, selectedMeta).displayName || selectedStage.stageId : '未選択';
    if (current) current.textContent = selectedName;
    const list = this.root.querySelector('.formation-stage-list');
    if (!list) return;
    // Decouple the heavy list rebuild from the close transition: a hidden list does
    // not need fresh content, and rebuilding hundreds of stage cards synchronously
    // while the overlay is closing blocks the close animation (the "slow close /
    // animation barely visible" symptom). The existing markup stays in the DOM so
    // the fade-out shows real content, and the next open rebuilds it.
    if (!this.stageOverlayOpen) return;
    const stages = this.stageOptions || [];
    list.innerHTML = stages.map((s) => {
      const id = s.stageKey || s.stageId;
      const meta = this.stageMeta.get(id) || {};
      const active = id === this.selectedStageId || s.stageId === this.selectedStageId;
      const resolved = this.resolveStageDisplay(s, meta);
      const name = resolved.displayName || s.stageId || s.stageKey || 'name unresolved';
      const reason = resolved.unresolvedNameReason || '';
      return `<button type='button' class='formation-stage-card ${active ? 'is-active' : ''}' data-stage-id='${id}'><strong>${name}</strong><small>${s.stageKey || id}</small><span>BG ${meta.bgId ?? '---'} / HP ${meta.enemyBaseHp ?? '---'} / rows ${meta.enemyRowCount ?? '---'}</span><span>unresolved enemies ${meta.unresolvedEnemyCount ?? '---'} / bundle ${meta.bundleAvailability || (s.bundleRef?.bundlePath ? 'available' : 'missing')}</span>${reason ? `<em>${reason}</em>` : ''}</button>`;
    }).join('') || `<p class='formation-stage-empty'>No stage bundle entries available</p>`;
  }

  getFilteredCharacters() {
    const baseChars = this.filter === CHARACTER_FACTIONS.all ? getAvailableCharacters() : getCharactersByFaction(this.filter);
    const q = this.searchText.trim().toLowerCase();
    if (!q) return baseChars;
    return baseChars.filter((c) => [c.characterId, c.baseCharacterId, c.label, c.sourceSlotId, c.statsSummary, c.defaultCost, c.defaultCooldownMs].some((v) => String(v || '').toLowerCase().includes(q)));
  }

  renderIconMarkup(c, extraClass = '') {
    const icon = c?.uiIcon || {};
    const semanticKey = icon.semanticKey || c?.assetDef?.semanticKey || '';
    return `<img class='${extraClass} image-missing' data-semantic-icon='${semanticKey}' alt=''>`;
  }

  renderCardMeta(c) {
    return `<div class='formation-card-meta'><span class='formation-card-cost'>${formatCost(characterCost(c))}</span><span class='formation-card-cooldown'>${formatCooldown(characterCooldown(c))}</span></div>`;
  }

  getFormationIconDebug() {
    if (!globalThis.__FORMATION_ICON_DEBUG__) globalThis.__FORMATION_ICON_DEBUG__ = { lastRender: {}, recentIconFailures: [] };
    return globalThis.__FORMATION_ICON_DEBUG__;
  }

  recordIconFailure(semanticKey, err, detail = {}) {
    const debug = this.getFormationIconDebug();
    const failureKey = `${semanticKey}:${detail.internalPath || err?.detail?.internalPath || ''}:${err?.detail?.reason || err?.message || String(err)}`;
    if (this.reportedIconFailures.has(failureKey)) return;
    this.reportedIconFailures.add(failureKey);
    const failure = { semanticKey, bundlePath: detail.bundlePath || err?.detail?.bundlePath || null, internalPath: detail.internalPath || err?.detail?.internalPath || null, errorName: err?.name || 'Error', errorMessage: err?.message || String(err) };
    debug.recentIconFailures.unshift(failure);
    debug.recentIconFailures.splice(20);
    this.iconDebug.failedIconCount += 1;
  }

  async waitForImageReady(img) {
    if (!img?.isConnected) return false;
    if (img.complete && img.naturalWidth > 0) {
      try { await img.decode?.(); } catch {}
      return img.isConnected && img.naturalWidth > 0;
    }
    await new Promise((resolve, reject) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', () => reject(new Error('icon image element failed to load')), { once: true });
    });
    try { await img.decode?.(); } catch {}
    return img.isConnected && img.naturalWidth > 0;
  }

  scheduleIconLoad(img, provider) {
    const key = img.dataset.semanticIcon;
    if (!key || img.dataset.iconPending === '1' || img.dataset.iconResolved === '1') return Promise.resolve();
    img.dataset.iconPending = '1';
    const existing = this.iconWork.get(key) || provider.getActorUiIconUrl(key);
    this.iconWork.set(key, existing);
    return existing.then(async (url) => {
      if (!img.isConnected) return;
      img.src = url;
      const ready = await this.waitForImageReady(img);
      if (!ready) return;
      img.classList.remove('image-missing');
      img.dataset.iconResolved = '1';
      delete img.dataset.iconPending;
      this.iconDebug.resolvedIconCount += 1;
    }).catch((err) => {
      const failureKey = `${key}:${err?.detail?.internalPath || ''}:${err?.detail?.reason || err?.message || String(err)}`;
      if (!this.reportedIconFailures.has(failureKey)) {
        const log = err?.detail?.reason === 'missing-inferred-zip-entry' || err?.detail?.reason === 'missing-zip-entry' ? console.warn : console.error;
        log?.('[FormationEditor] icon load failed detail', { key, bundlePath: err?.detail?.bundlePath || null, internalPath: err?.detail?.internalPath || null, name: err?.name, message: err?.message, reason: err?.detail?.reason || null });
      }
      img.classList.add('image-missing');
      delete img.dataset.iconPending;
      delete img.dataset.iconResolved;
      this.iconWork.delete(key);
      this.recordIconFailure(key, err);
    });
  }

  enqueueIcon(img, provider, eager = false) {
    if (!img?.isConnected || !img.dataset.semanticIcon || img.dataset.iconResolved === '1' || img.dataset.iconPending === '1') return false;
    if (this.iconQueue.includes(img)) return false;
    this.iconQueue.push(img);
    this.iconDebug.queuedIconCount += 1;
    if (eager) this.iconDebug.eagerIconCount += 1;
    if (provider) this.pumpIconQueue(provider);
    return true;
  }

  pumpIconQueue(provider) {
    while (this.iconActive < this.iconConcurrency && this.iconQueue.length) {
      const img = this.iconQueue.shift();
      if (!img?.isConnected) continue;
      this.iconActive += 1;
      this.scheduleIconLoad(img, provider).finally(() => {
        this.iconActive -= 1;
        this.pumpIconQueue(provider);
      });
    }
  }

  resolveSemanticIcons() {
    let provider = null;
    try { provider = getBcuAssetDatabase()?.semanticProvider; } catch {}
    if (!provider) return;
    this.resolveSelectedSlotIconsImmediately(provider);
    this.resolveVisibleCatalogIconsImmediately(provider);
    const root = this.root.querySelector('.formation-catalog-scroll') || null;
    if (this.iconObserver && this.iconObserverRoot !== root) {
      this.iconObserver.disconnect();
      this.iconObserver = null;
    }
    if (!this.iconObserver && typeof IntersectionObserver !== 'undefined') {
      this.iconObserverRoot = root;
      this.iconObserver = new IntersectionObserver((items) => {
        for (const item of items) {
          if (!item.isIntersecting) continue;
          this.iconObserver.unobserve(item.target);
          this.enqueueIcon(item.target, provider, false);
        }
        this.pumpIconQueue(provider);
      }, { root, rootMargin: '600px 0px 900px 0px' });
    }
    for (const img of this.root.querySelectorAll('.formation-catalog-grid img[data-semantic-icon]')) {
      if (!img.dataset.semanticIcon || img.dataset.iconResolved === '1') continue;
      if (this.iconObserver) { this.iconObserver.observe(img); this.iconDebug.observedIconCount += 1; }
      else this.enqueueIcon(img, provider, false);
    }
    this.pumpIconQueue(provider);
    this.updateFormationIconDebug();
  }

  resolveSelectedSlotIconsImmediately(provider) {
    for (const img of this.root.querySelectorAll('.formation-slots img[data-semantic-icon]')) {
      if (!img.dataset.semanticIcon || img.dataset.iconResolved === '1') continue;
      this.enqueueIcon(img, provider, true);
    }
    this.pumpIconQueue(provider);
  }

  resolveVisibleCatalogIconsImmediately(provider) {
    const scroller = this.root.querySelector('.formation-catalog-scroll');
    const rowHeight = this.catalogVirtual.rowHeight || 194;
    const columns = this.catalogVirtual.columns || 1;
    const viewportRows = Math.max(1, Math.ceil((scroller?.clientHeight || 480) / rowHeight));
    const firstVisibleRow = Math.max(0, Math.floor((scroller?.scrollTop || 0) / rowHeight));
    const lastVisibleRow = firstVisibleRow + viewportRows - 1;
    const eagerRows = Math.max(this.catalogVirtual.overscanRows || 8, viewportRows * 2);
    const eagerStart = Math.max(0, (firstVisibleRow - eagerRows) * columns);
    const eagerEnd = Math.min(this.catalogItems.length, (lastVisibleRow + eagerRows + 1) * columns);
    for (const img of this.root.querySelectorAll('.formation-catalog-grid img[data-semantic-icon]')) {
      const card = img.closest('[data-catalog-index]');
      const index = Number(card?.dataset.catalogIndex);
      if (!Number.isFinite(index) || index < eagerStart || index >= eagerEnd) continue;
      this.enqueueIcon(img, provider, true);
    }
    this.pumpIconQueue(provider);
  }

  estimateCatalogColumns(scroller) {
    const width = Math.max(1, scroller?.clientWidth || 1);
    return Math.max(1, Math.floor(width / 166));
  }

  renderCatalogWindow() {
    const scroller = this.root.querySelector('.formation-catalog-scroll');
    const grid = this.root.querySelector('.formation-catalog-grid');
    if (!scroller || !grid) return;
    const chars = this.catalogItems || [];
    const columns = this.estimateCatalogColumns(scroller);
    const rowHeight = this.catalogVirtual.rowHeight;
    const totalRows = Math.ceil(chars.length / columns);
    const visibleRows = Math.ceil((scroller.clientHeight || 480) / rowHeight);
    const dynamicOverscanRows = Math.max(8, Math.ceil(((scroller.clientHeight || 480) * 2) / rowHeight));
    const firstVisibleRow = Math.max(0, Math.floor((scroller.scrollTop || 0) / rowHeight));
    const lastVisibleRow = Math.min(totalRows, firstVisibleRow + visibleRows);
    const firstRow = Math.max(0, firstVisibleRow - dynamicOverscanRows);
    const lastRow = Math.min(totalRows, lastVisibleRow + dynamicOverscanRows);
    const start = firstRow * columns;
    const end = Math.min(chars.length, lastRow * columns);
    this.catalogVirtual = { ...this.catalogVirtual, columns, overscanRows: dynamicOverscanRows, start, end, firstVisibleRow, lastVisibleRow };
    const top = firstRow * rowHeight;
    const bottom = Math.max(0, (totalRows - lastRow) * rowHeight);
    const usedBaseIds = this.currentUsedBaseIds || new Set();
    grid.innerHTML = `<div class='formation-catalog-spacer' aria-hidden='true' style='grid-column:1/-1;height:${top}px'></div>${chars.slice(start, end).map((c, offset) => {
      const baseId = c.baseCharacterId || c.characterId;
      const catalogIndex = start + offset;
      return `<button type='button' class='formation-character-card ${usedBaseIds.has(baseId) ? 'is-used' : ''}' data-character='${c.characterId}' data-catalog-index='${catalogIndex}' data-faction='${c.faction}' data-base-character-id='${baseId || ''}'>${this.renderIconMarkup(c)}<span>${c.faction === 'dog' ? 'DOG' : 'CAT'}</span><strong>${c.label}</strong><small class='character-id'>${c.characterId}</small>${this.renderCardMeta(c)}</button>`;
    }).join('')}<div class='formation-catalog-spacer' aria-hidden='true' style='grid-column:1/-1;height:${bottom}px'></div>`;
  }

  updateFormationIconDebug() {
    const scroller = this.root.querySelector('.formation-catalog-scroll');
    const catalogImgs = this.root.querySelectorAll('.formation-catalog-grid img[data-semantic-icon]');
    const debug = this.getFormationIconDebug();
    debug.lastRender = {
      catalogItemCount: this.catalogItems.length,
      renderedDomCardCount: Math.max(0, (this.catalogVirtual.end || 0) - (this.catalogVirtual.start || 0)),
      columns: this.catalogVirtual.columns,
      rowHeight: this.catalogVirtual.rowHeight,
      overscanRows: this.catalogVirtual.overscanRows,
      start: this.catalogVirtual.start,
      end: this.catalogVirtual.end,
      scrollerClientHeight: scroller?.clientHeight || 0,
      scrollTop: scroller?.scrollTop || 0,
      firstVisibleRow: this.catalogVirtual.firstVisibleRow,
      lastVisibleRow: this.catalogVirtual.lastVisibleRow,
      eagerIconCount: this.iconDebug.eagerIconCount,
      observedIconCount: this.iconDebug.observedIconCount,
      queuedIconCount: this.iconDebug.queuedIconCount,
      activeIconCount: this.iconActive,
      resolvedIconCount: this.iconDebug.resolvedIconCount,
      failedIconCount: this.iconDebug.failedIconCount,
      activePage: this.activePage,
      activeSlot: this.activeSlot
    };
    debug.lastRender.renderedIconCount = catalogImgs.length;
  }

  renderDynamic({ resetCatalogScroll = false } = {}) {
    performance.mark?.('formation-render-start');
    const chars = this.getFilteredCharacters();
    const dogCount = getCharactersByFaction('dog').length;
    const catCount = getCharactersByFaction('cat').length;
    const pages = this.formation?.pages || [];
    const flat = pages.flat();
    const usedBaseIds = new Set(flat.filter(Boolean).map((id) => {
      const c = getCharacterById(id);
      return c?.baseCharacterId || c?.characterId || id;
    }).filter(Boolean));
    this.currentUsedBaseIds = usedBaseIds;
    this.catalogItems = chars;

    const summary = this.root.querySelector('.formation-catalog-summary');
    if (summary) summary.textContent = `Catalog ${chars.length} / DOG ${dogCount} / CAT ${catCount}`;

    const pageTabs = this.root.querySelector('.formation-page-tabs');
    if (pageTabs) {
      pageTabs.innerHTML = Array.from({ length: LINEUP_ROWS }, (_, page) => {
        const filled = (pages?.[page] || []).filter(Boolean).length;
        return `<button type='button' class='formation-page-tab ${this.activePage === page ? 'is-active' : ''}' data-page='${page}' aria-pressed='${this.activePage === page ? 'true' : 'false'}'><strong>${pageLabel(page)}</strong><span>${filled}/${LINEUP_COLS}</span></button>`;
      }).join('');
    }

    const activeLabel = this.root.querySelector('.formation-active-page-label');
    if (activeLabel) activeLabel.textContent = `${pageLabel(this.activePage)} / ${LINEUP_TOTAL} SLOT DECK`;

    const visibleSlots = pages?.[this.activePage] || Array(LINEUP_COLS).fill(null);
    const slotsEl = this.root.querySelector('.formation-slots');
    if (slotsEl) {
      slotsEl.innerHTML = visibleSlots.map((id, col) => {
        const i = this.activePage * LINEUP_COLS + col;
        const c = id ? getCharacterById(id) : null;
        return `<button type='button' class='formation-slot ${this.activeSlot === i ? 'is-active' : ''}' data-slot='${i}' data-page-slot='${col + 1}'>${c ? `${this.renderIconMarkup(c)}<span>${c.label}</span><small class='character-id'>${formatCost(characterCost(c))} / ${formatCooldown(characterCooldown(c))}</small>` : `<span>EMPTY</span><small>${pageLabel(this.activePage)}-${col + 1}</small>`}</button>`;
      }).join('');
    }

    const scroller = this.root.querySelector('.formation-catalog-scroll');
    if (scroller && resetCatalogScroll) scroller.scrollTop = 0;
    this.renderCatalogWindow();
    this.resolveSemanticIcons();
    this.updateFormationIconDebug();
    performance.mark?.('formation-render-end');
    performance.measure?.('formation-render', 'formation-render-start', 'formation-render-end');
    if (globalThis.__FORMATION_RENDER_DEBUG__ === true) {
      console.debug?.('[FormationEditor] render diagnostics', {
        catalogItemCount: chars.length,
        renderedDomCardCount: Math.max(0, (this.catalogVirtual.end || 0) - (this.catalogVirtual.start || 0)),
        iconQueueSize: this.iconQueue.length,
        visibleIconCount: this.root.querySelectorAll('.formation-catalog-grid img[data-semantic-icon]').length,
        activePage: this.activePage,
        activeSlot: this.activeSlot
      });
    }
  }

  refresh() {
    this.root.innerHTML = `<div class='formation-panel'><section class='formation-main'><header class='formation-header'><div><h3>編成</h3><p>5枠ずつページを切り替えて、合計10枠のデッキを作成</p></div><div class='formation-active-page-label'></div></header><section class='formation-slots-wrap'><div class='formation-page-tabs'></div><div class='formation-slots'></div></section><section class='formation-catalog-section'><div class='formation-catalog-tabs'>${Object.values(CHARACTER_FACTIONS).map((f) => `<button type='button' data-filter='${f}'>${f}</button>`).join('')}</div><div class='formation-catalog-toolbar'><input class='formation-search-input' data-search-input='1' placeholder='ID / 名前で検索' value='${this.searchDraft ?? this.searchText}' /><button type='button' class='formation-search-button' data-action='catalog-search'>検索</button><div class='formation-catalog-summary'></div></div><div class='formation-catalog-scroll'><div class='formation-catalog-grid'></div></div></section></section><aside class='formation-action-rail' aria-label='Formation actions'><button type='button' data-action='apply' class='apply-battle-button'>Apply Battle</button><button type='button' data-action='stage-open' class='secondary-action stage-select-button'>Stage Select</button><div class='formation-current-stage'></div><button type='button' data-action='clear' class='secondary-action'>Clear Slot</button><button type='button' data-action='reset' class='secondary-action'>Reset Default</button><button type='button' data-action='settings-open' class='secondary-action settings-open-button'><i class='bi bi-gear-wide-connected' aria-hidden='true'></i> 設定</button><p class='formation-action-hint'>PAGE 1/2を切り替えて10枠編成できます</p></aside><section class='formation-stage-overlay' aria-label='Stage selection'><div class='formation-stage-dialog'><header><div><strong>ステージ選択</strong><span>BCU MultiLangCont 準拠名</span></div><button type='button' data-action='stage-close'>Close</button></header><div class='formation-stage-list'></div></div></section><section class='formation-settings-overlay' aria-label='Game settings'><div class='formation-settings-dialog' role='dialog' aria-modal='true'><header><div><strong><i class='bi bi-gear-wide-connected' aria-hidden='true'></i> 設定</strong><span>ゲーム設定</span></div><button type='button' data-action='settings-close'>閉じる</button></header><div class='formation-settings-list'></div><footer class='formation-settings-footer'></footer></div></section></div>`;
    this.renderDynamic({ resetCatalogScroll: true });
    this.renderStageSelector();
    this.renderSettingsOverlay();
  }

  renderSettingsOverlay() {
    const overlay = this.root.querySelector('.formation-settings-overlay');
    if (!overlay) return;
    overlay.classList.toggle('is-open', !!this.settingsOverlayOpen);
    const list = overlay.querySelector('.formation-settings-list');
    if (!list) return;
    const speedOn = BattleSpeedControl.isFeatureEnabled();
    list.innerHTML = `<div class='formation-settings-row'>
      <div class='label'><strong>スピードアップ機能</strong></div>
      <button type='button' role='switch' class='formation-setting-toggle' data-setting='bcu-speed-control' aria-checked='${speedOn ? 'true' : 'false'}' aria-label='スピードアップ機能を切り替え'></button>
    </div>`;
    const footer = overlay.querySelector('.formation-settings-footer');
    if (footer) {
      footer.innerHTML = `<span class='formation-settings-credit'>created by るる</span>
        <a class='formation-settings-discord' href='${SETTINGS_DISCORD_URL}' target='_blank' rel='noopener noreferrer'><i class='bi bi-discord' aria-hidden='true'></i><span>Discord</span></a>`;
    }
  }
}
