import { getAvailableStages } from '../battle/StageRegistry.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';
import { FormationEditor } from './FormationEditor.js';
import { buildBcuStageCatalog } from './BcuStageCatalogBuilder.js';

function safeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function getStageId(stage) {
  return stage?.stageKey || stage?.stageId || '';
}

function ensureCatalog(editor) {
  if (!editor.stageCatalog) {
    let bcuDb = null;
    try { bcuDb = getBcuAssetDatabase(); } catch {}
    editor.stageCatalog = buildBcuStageCatalog(editor.stageOptions || [], { bcuDb });
  }
  return editor.stageCatalog;
}

function ensureSelectorState(editor) {
  if (!editor.stageSelectorState) editor.stageSelectorState = { level: 'category', categoryId: null, mapKey: null };
  return editor.stageSelectorState;
}

const CATEGORY_UI = {
  main: { icon: '日の丸', short: '日本編・未来編・宇宙編', tone: 'mint' },
  legend: { icon: '王冠', short: '長く遊べる常設マップ', tone: 'gold' },
  event: { icon: '祭', short: '期間イベントと強襲', tone: 'red' },
  collab: { icon: '握手', short: 'コラボ専用ステージ', tone: 'blue' },
  special: { icon: '道場', short: '道場・迷宮・検定など', tone: 'violet' }
};

function selectedStageLabel(editor, catalog) {
  const selected = catalog.getStage(editor.selectedStageId);
  if (selected) return `${selected.mapLabel} - ${selected.label}`;
  const selectedStage = (editor.stageOptions || []).find((stage) => getStageId(stage) === editor.selectedStageId || stage.stageId === editor.selectedStageId);
  return selectedStage?.label || selectedStage?.stageId || editor.selectedStageId || '未選択';
}

function renderBreadcrumb(state, category, map) {
  return `<div class='formation-stage-breadcrumb'>
    <button type='button' class='formation-stage-crumb ${state.level === 'category' ? 'is-active' : ''}' data-stage-root='1'>カテゴリ</button>
    ${category ? `<button type='button' class='formation-stage-crumb ${state.level === 'map' ? 'is-active' : ''}' data-stage-category='${safeHtml(category.id)}'>${safeHtml(category.label)}</button>` : ''}
    ${map ? `<button type='button' class='formation-stage-crumb is-active' data-stage-map='${safeHtml(map.key)}'>${safeHtml(map.label)}</button>` : ''}
  </div>`;
}

function renderCategoryCards(catalog) {
  return catalog.categories.map((category) => {
    const ui = CATEGORY_UI[category.id] || { icon: '選択', short: category.description || '', tone: 'mint' };
    return `<button type='button' class='formation-stage-card formation-stage-card-category category-${safeHtml(category.id)} tone-${safeHtml(ui.tone)}' data-stage-category='${safeHtml(category.id)}'>
    <span class='formation-stage-card-icon' aria-hidden='true'>${safeHtml(ui.icon)}</span>
    <span class='formation-stage-card-kicker'>カテゴリ</span>
    <strong>${safeHtml(category.label)}</strong>
    <span class='formation-stage-card-desc'>${safeHtml(ui.short || category.description || '')}</span>
    <span class='formation-stage-card-meta'><b>${category.mapCount}マップ</b><i>${category.stageCount}ステージ</i></span>
  </button>`;
  }).join('');
}

function renderMapCards(category) {
  return (category?.maps || []).map((map) => `<button type='button' class='formation-stage-card formation-stage-card-map' data-stage-map='${safeHtml(map.key)}'>
    <span class='formation-stage-card-kicker'>${safeHtml(map.collectionLabel)}</span>
    <strong>${safeHtml(map.label)}</strong>
    <span class='formation-stage-card-desc'>${safeHtml((map.collectionLabels || [map.collectionLabel]).slice(0, 2).join(' / '))}</span>
    <span class='formation-stage-card-meta'><b>${map.stageCount}ステージ</b><i>${Number.isFinite(map.mapNo) ? `No.${map.mapNoRaw}` : 'マップ'}</i></span>
  </button>`).join('');
}

function renderStageCards(editor, map) {
  return (map?.stages || []).map((stage) => {
    const active = stage.key === editor.selectedStageId || stage.stage?.stageId === editor.selectedStageId || stage.stage?.stageKey === editor.selectedStageId;
    return `<button type='button' class='formation-stage-card formation-stage-card-stage ${active ? 'is-active' : ''}' data-stage-id='${safeHtml(stage.key)}'>
      <span class='formation-stage-card-kicker'>${safeHtml(stage.collectionLabel)}</span>
      <strong>${safeHtml(stage.label)}</strong>
      <span class='formation-stage-card-desc'>${safeHtml(stage.mapLabel)}</span>
      <span class='formation-stage-card-meta'><b>${active ? '選択中' : `No.${safeHtml(stage.stageNoRaw)}`}</b><i>${safeHtml(stage.mapNoRaw ? `Map ${stage.mapNoRaw}` : 'Stage')}</i></span>
    </button>`;
  }).join('');
}

function renderStageSelectorBody(editor) {
  const catalog = ensureCatalog(editor);
  const state = ensureSelectorState(editor);
  let category = state.categoryId ? catalog.getCategory(state.categoryId) : null;
  let map = state.mapKey ? catalog.getMap(state.mapKey) : null;
  if (state.level === 'map' && !category) {
    editor.stageSelectorState = { level: 'category', categoryId: null, mapKey: null };
    return renderStageSelectorBody(editor);
  }
  if (state.level === 'stage' && !map) {
    editor.stageSelectorState = { level: category ? 'map' : 'category', categoryId: category?.id || null, mapKey: null };
    return renderStageSelectorBody(editor);
  }
  if (map && !category) category = catalog.getCategory(map.categoryId);

  if (state.level === 'stage' && map) return `${renderBreadcrumb(state, category, map)}${renderStageCards(editor, map)}`;
  if (state.level === 'map' && category) return `${renderBreadcrumb(state, category, null)}${renderMapCards(category)}`;
  return `${renderBreadcrumb(state, null, null)}${renderCategoryCards(catalog)}`;
}

function updateStageHeader(editor) {
  const state = ensureSelectorState(editor);
  const catalog = ensureCatalog(editor);
  const category = state.categoryId ? catalog.getCategory(state.categoryId) : null;
  const map = state.mapKey ? catalog.getMap(state.mapKey) : null;
  const title = editor.root.querySelector('.formation-stage-dialog header strong');
  const lead = editor.root.querySelector('.formation-stage-dialog header span');
  if (title) title.textContent = state.level === 'stage' ? 'ステージを選ぶ' : state.level === 'map' ? 'マップを選ぶ' : 'カテゴリを選ぶ';
  if (lead) {
    lead.textContent = state.level === 'stage'
      ? `${map?.label || ''} のステージだけ表示`
      : state.level === 'map'
        ? `${category?.label || ''} のマップだけ表示`
        : '通常・レジェンド・イベント別に軽量表示';
  }
}

if (!FormationEditor.prototype.__nyankoPerformancePatched) {
  FormationEditor.prototype.__nyankoPerformancePatched = true;

  const originalRenderDynamic = FormationEditor.prototype.renderDynamic;
  FormationEditor.prototype.renderDynamic = function patchedRenderDynamic(...args) {
    const scroller = this.root?.querySelector?.('.formation-catalog-scroll') || null;
    const keepScroll = this.__preserveCatalogScroll === true;
    const previousScrollTop = keepScroll ? (scroller?.scrollTop || 0) : 0;
    const result = originalRenderDynamic.apply(this, args);
    if (keepScroll) {
      const nextScroller = this.root?.querySelector?.('.formation-catalog-scroll') || scroller;
      if (nextScroller) {
        nextScroller.scrollTop = previousScrollTop;
        requestAnimationFrame(() => {
          if (nextScroller.isConnected) nextScroller.scrollTop = previousScrollTop;
        });
      }
      this.__preserveCatalogScroll = false;
    }
    return result;
  };

  const originalOnClick = FormationEditor.prototype.onClick;
  FormationEditor.prototype.onClick = function patchedOnClick(event) {
    const rootButton = event?.target?.closest?.('[data-stage-root]');
    const categoryButton = event?.target?.closest?.('[data-stage-category]');
    const mapButton = event?.target?.closest?.('[data-stage-map]');
    const stageOpen = event?.target?.closest?.('[data-action="stage-open"]');

    if (stageOpen && this.root?.contains(stageOpen)) {
      this.stageSelectorState = { level: 'category', categoryId: null, mapKey: null };
    }
    if (rootButton && this.root?.contains(rootButton)) {
      event.preventDefault();
      event.stopPropagation();
      this.stageSelectorState = { level: 'category', categoryId: null, mapKey: null };
      this.renderStageSelector();
      return;
    }
    if (categoryButton && this.root?.contains(categoryButton)) {
      event.preventDefault();
      event.stopPropagation();
      this.stageSelectorState = { level: 'map', categoryId: categoryButton.dataset.stageCategory, mapKey: null };
      this.renderStageSelector();
      return;
    }
    if (mapButton && this.root?.contains(mapButton)) {
      event.preventDefault();
      event.stopPropagation();
      const catalog = ensureCatalog(this);
      const map = catalog.getMap(mapButton.dataset.stageMap);
      this.stageSelectorState = { level: 'stage', categoryId: map?.categoryId || this.stageSelectorState?.categoryId || null, mapKey: mapButton.dataset.stageMap };
      this.renderStageSelector();
      return;
    }
    if (event?.target?.closest?.('[data-character]')) this.__preserveCatalogScroll = true;
    return originalOnClick.call(this, event);
  };

  FormationEditor.prototype.loadStageOptions = async function patchedLoadStageOptions() {
    if (this.stageLoading) return;
    this.stageLoading = true;
    try {
      this.stageOptions = getAvailableStages().filter((stage) => stage?.bundleRef?.bundlePath || stage?.semanticEntry?.bundleRef?.bundlePath || stage?.enabled !== false);
      let bcuDb = null;
      try { bcuDb = getBcuAssetDatabase(); } catch {}
      this.stageCatalog = buildBcuStageCatalog(this.stageOptions, { bcuDb });
      this.stageSelectorState = { level: 'category', categoryId: null, mapKey: null };
      this.renderStageSelector();
    } finally {
      this.stageLoading = false;
    }
  };

  FormationEditor.prototype.renderStageSelector = function patchedRenderStageSelector() {
    const overlay = this.root.querySelector('.formation-stage-overlay');
    if (overlay) overlay.classList.toggle('is-open', this.stageOverlayOpen);
    const catalog = ensureCatalog(this);
    const current = this.root.querySelector('.formation-current-stage');
    if (current) current.textContent = selectedStageLabel(this, catalog);
    const list = this.root.querySelector('.formation-stage-list');
    if (!list) return;
    updateStageHeader(this);
    list.innerHTML = this.stageOptions?.length
      ? renderStageSelectorBody(this)
      : `<p class='formation-stage-empty'>ステージデータを読み込み中...</p>`;
  };
}
