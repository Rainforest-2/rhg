import { getAvailableStages } from '../battle/StageRegistry.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';
import { buildScopedDifficultyFilterCandidates } from '../bcu/BcuStageDifficultyRuntime.js';
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
  main: { tone: 'mint' },
  legend: { tone: 'gold' },
  event: { tone: 'red' },
  collab: { tone: 'blue' },
  special: { tone: 'violet' }
};

const STAGE_WINDOW_MIN_ITEMS = 72;
const STAGE_WINDOW_ROW_HEIGHT = 92;
const STAGE_WINDOW_MOBILE_ROW_HEIGHT = 74;
const STAGE_WINDOW_OVERSCAN_ROWS = 8;

function normalizeFilterValue(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().trim();
}

function stageFilterState(editor) {
  const raw = editor.__bcuStageDifficultyFilter || {};
  return {
    q: normalizeFilterValue(raw.q),
    min: raw.min === '' || raw.min == null ? null : Number(raw.min),
    max: raw.max === '' || raw.max == null ? null : Number(raw.max)
  };
}

function isStageFiltering(filter) {
  return !!filter.q || Number.isFinite(filter.min) || Number.isFinite(filter.max);
}

function stageFilterSignature(filter) {
  return `${filter.q}|${Number.isFinite(filter.min) ? filter.min : ''}|${Number.isFinite(filter.max) ? filter.max : ''}`;
}

function stageSearchText(item) {
  return normalizeFilterValue([
    item?.key,
    item?.id,
    item?.label,
    item?.mapLabel,
    item?.collectionLabel,
    item?.stageNoRaw,
    item?.rawId,
    item?.stage?.stageId,
    item?.stage?.stageKey
  ].filter(Boolean).join(' '));
}

function mapSearchText(map) {
  return normalizeFilterValue([
    map?.key,
    map?.label,
    map?.collectionLabel,
    ...(map?.collectionLabels || []),
    map?.mapNoRaw,
    ...(map?.stages || []).map(stageSearchText)
  ].filter(Boolean).join(' '));
}

function filteredStageItems(editor, kind, items) {
  const filter = stageFilterState(editor);
  if (!isStageFiltering(filter)) return items || [];
  let bcuDb = null;
  try { bcuDb = getBcuAssetDatabase(); } catch {}
  return buildScopedDifficultyFilterCandidates(items || [], {
    kind,
    table: editor.__bcuStageDifficultyTable || null,
    db: bcuDb,
    query: kind === 'map' ? '' : filter.q,
    min: filter.min,
    max: filter.max
  })
    .map((candidate) => candidate.item)
    .filter((item) => kind !== 'map' || !filter.q || mapSearchText(item).includes(filter.q));
}

function countStageColumns(list) {
  if (!list || typeof getComputedStyle !== 'function') return 1;
  const columns = getComputedStyle(list).gridTemplateColumns;
  if (columns && columns !== 'none' && !columns.includes('repeat(')) {
    const count = columns.split(/\s+/).filter((value) => value && !value.startsWith('[')).length;
    if (count > 0) return count;
  }
  const width = list.clientWidth || 1;
  if (width <= 760) return 1;
  if (width <= 1180) return 2;
  return 3;
}

function virtualSpacer(position, height) {
  return `<div class='formation-stage-virtual-spacer' data-stage-virtual-spacer='${position}' aria-hidden='true' style='grid-column:1/-1;height:${Math.max(0, Math.round(height))}px'></div>`;
}

function savedStageScroll(editor, viewKey) {
  const value = editor.__stageSelectorScrollByKey?.[viewKey];
  return Number.isFinite(value) ? value : 0;
}

function renderStageItemWindow(editor, kind, viewKey, items, renderItem) {
  const list = editor.root?.querySelector?.('.formation-stage-list');
  const all = items || [];
  const previousKey = editor.__stageSelectorVirtualKey || '';
  const keyChanged = previousKey !== viewKey;
  if (keyChanged) editor.__stageSelectorVirtualKey = viewKey;
  // On a view switch (category <-> map <-> stage) restore the scroll position this view
  // was last left at instead of snapping to the top. Same-view re-renders (the virtual
  // window sliding while the user scrolls) keep using the live scrollTop.
  const baseScroll = keyChanged ? savedStageScroll(editor, viewKey) : (list?.scrollTop || 0);

  if (!list || all.length < STAGE_WINDOW_MIN_ITEMS) {
    editor.stageSelectorVirtual = {
      active: false,
      kind,
      viewKey,
      total: all.length,
      rendered: all.length,
      start: 0,
      end: all.length,
      restoreScrollTop: keyChanged ? baseScroll : null
    };
    return all.map(renderItem).join('');
  }

  const columns = Math.max(1, countStageColumns(list));
  const rowHeight = (list.clientWidth || 0) <= 760 ? STAGE_WINDOW_MOBILE_ROW_HEIGHT : STAGE_WINDOW_ROW_HEIGHT;
  const totalRows = Math.ceil(all.length / columns);
  const visibleRows = Math.max(1, Math.ceil((list.clientHeight || 520) / rowHeight));
  const firstVisibleRow = Math.max(0, Math.floor(baseScroll / rowHeight));
  const firstRow = Math.max(0, firstVisibleRow - STAGE_WINDOW_OVERSCAN_ROWS);
  const lastRow = Math.min(totalRows, firstVisibleRow + visibleRows + STAGE_WINDOW_OVERSCAN_ROWS);
  const start = firstRow * columns;
  const end = Math.min(all.length, lastRow * columns);
  const top = firstRow * rowHeight;
  const bottom = Math.max(0, (totalRows - lastRow) * rowHeight);

  editor.stageSelectorVirtual = {
    active: true,
    kind,
    viewKey,
    total: all.length,
    rendered: end - start,
    columns,
    rowHeight,
    start,
    end,
    firstVisibleRow,
    lastVisibleRow: Math.min(totalRows, firstVisibleRow + visibleRows),
    restoreScrollTop: keyChanged ? baseScroll : null
  };

  return `${virtualSpacer('top', top)}${all.slice(start, end).map(renderItem).join('')}${virtualSpacer('bottom', bottom)}`;
}

function selectedStageLabel(editor, catalog) {
  const selected = catalog.getStage(editor.selectedStageId);
  if (selected) return `${selected.mapLabel} - ${selected.label}`;
  const selectedStage = (editor.stageOptions || []).find((stage) => getStageId(stage) === editor.selectedStageId || stage.stageId === editor.selectedStageId);
  if (selectedStage) {
    // The default/raw selectedStageId (e.g. "stageRNA001_00") is not a catalog key,
    // so resolve it through the rich BCU name resolver before falling back to raw ids.
    try {
      const meta = editor.stageMeta?.get?.(selectedStage.stageKey || selectedStage.stageId) || {};
      const display = editor.resolveStageDisplay?.(selectedStage, meta)?.displayName;
      if (display) return display;
    } catch {}
    return selectedStage.label || selectedStage.stageId || editor.selectedStageId || '未選択';
  }
  return editor.selectedStageId || '未選択';
}

function renderBackControl(state, category, map) {
  if (state.level === 'map' && category) {
    return `<div class='formation-stage-backbar'><button type='button' data-stage-root='1'>＜ カテゴリ</button><span>${safeHtml(category.label)}</span></div>`;
  }
  if (state.level === 'stage' && map) {
    const categoryId = category?.id || map.categoryId || '';
    return `<div class='formation-stage-backbar'><button type='button' data-stage-category='${safeHtml(categoryId)}'>＜ マップ</button><span>${safeHtml(map.label)}</span></div>`;
  }
  return '';
}

function renderCategoryCards(catalog) {
  return catalog.categories.map((category) => {
    const ui = CATEGORY_UI[category.id] || { tone: 'mint' };
    return `<button type='button' class='formation-stage-card formation-stage-card-category category-${safeHtml(category.id)} tone-${safeHtml(ui.tone)}' data-stage-category='${safeHtml(category.id)}'>
    <strong>${safeHtml(category.label)}</strong>
    <span class='formation-stage-card-meta'><b>${category.mapCount}マップ</b></span>
  </button>`;
  }).join('');
}

function renderMapCard(map) {
  return `<button type='button' class='formation-stage-card formation-stage-card-map' data-stage-map='${safeHtml(map.key)}'>
    <strong>${safeHtml(map.label)}</strong>
  </button>`;
}

function renderMapCards(editor, category) {
  const filter = stageFilterState(editor);
  const maps = filteredStageItems(editor, 'map', category?.maps || []);
  const viewKey = `map:${category?.id || ''}:${stageFilterSignature(filter)}`;
  return renderStageItemWindow(editor, 'map', viewKey, maps, renderMapCard);
}

function renderStageCard(editor, stage) {
    const active = stage.key === editor.selectedStageId || stage.stage?.stageId === editor.selectedStageId || stage.stage?.stageKey === editor.selectedStageId;
    return `<button type='button' class='formation-stage-card formation-stage-card-stage ${active ? 'is-active' : ''}' data-stage-id='${safeHtml(stage.key)}'>
      <strong>${safeHtml(stage.label)}</strong>
    </button>`;
}

function renderStageCards(editor, map) {
  const filter = stageFilterState(editor);
  const stages = filteredStageItems(editor, 'stage', map?.stages || []);
  const viewKey = `stage:${map?.key || ''}:${stageFilterSignature(filter)}`;
  return renderStageItemWindow(editor, 'stage', viewKey, stages, (stage) => renderStageCard(editor, stage));
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

  if (state.level === 'stage' && map) return `${renderBackControl(state, category, map)}${renderStageCards(editor, map)}`;
  if (state.level === 'map' && category) return `${renderBackControl(state, category, null)}${renderMapCards(editor, category)}`;
  editor.stageSelectorVirtual = { active: false, kind: 'category', total: catalog.categories.length, rendered: catalog.categories.length };
  return renderCategoryCards(catalog);
}

function stageSelectorBodyKey(editor) {
  const state = ensureSelectorState(editor);
  const filter = stageFilterState(editor);
  return [
    state.level || 'category',
    state.categoryId || '',
    state.mapKey || '',
    stageFilterSignature(filter),
    editor.selectedStageId || '',
    (editor.stageOptions || []).length
  ].join('|');
}

function updateStageHeader(editor) {
  const state = ensureSelectorState(editor);
  const title = editor.root.querySelector('.formation-stage-dialog header strong');
  const lead = editor.root.querySelector('.formation-stage-dialog header span');
  if (title) title.textContent = state.level === 'stage' ? 'ステージを選ぶ' : state.level === 'map' ? 'マップを選ぶ' : 'カテゴリを選ぶ';
  if (lead) {
    lead.textContent = '';
    lead.hidden = true;
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

  const originalOnScroll = FormationEditor.prototype.onScroll;
  FormationEditor.prototype.onScroll = function patchedOnScroll(event) {
    const stageList = event?.target?.closest?.('.formation-stage-list');
    if (stageList && this.root?.contains(stageList)) {
      if (this.stageSelectorState?.level === 'custom-stage-battle') return;
      // Remember where the current map/stage view is scrolled so returning to it restores
      // the position. Gate on level so scrolling the (stale-keyed) category list cannot
      // overwrite a saved map/stage position.
      const level = this.stageSelectorState?.level;
      if ((level === 'map' || level === 'stage') && this.__stageSelectorVirtualKey) {
        (this.__stageSelectorScrollByKey || (this.__stageSelectorScrollByKey = {}))[this.__stageSelectorVirtualKey] = stageList.scrollTop;
      }
      if (this.__stageSelectorScrollFrame) return;
      this.__stageSelectorScrollFrame = requestAnimationFrame(() => {
        this.__stageSelectorScrollFrame = null;
        this.renderStageSelector();
      });
      return;
    }
    return originalOnScroll.call(this, event);
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
    const bodyKey = stageSelectorBodyKey(this);
    const bodyHtml = this.stageOptions?.length
      ? renderStageSelectorBody(this)
      : `<p class='formation-stage-empty'>ステージデータを読み込み中...</p>`;
    if (list.__stageSelectorBodyKey !== bodyKey || list.__stageSelectorBodyHtml !== bodyHtml) {
      list.innerHTML = bodyHtml;
      list.__stageSelectorBodyKey = bodyKey;
      list.__stageSelectorBodyHtml = bodyHtml;
      // Replacing innerHTML drops scrollTop; when this render switched views, put the list
      // back where that view was last scrolled (set by renderStageItemWindow). The rAF
      // re-apply covers layout that settles after the new markup is attached.
      const restore = this.stageSelectorVirtual?.restoreScrollTop;
      if (Number.isFinite(restore)) {
        list.scrollTop = restore;
        requestAnimationFrame(() => { if (list.isConnected) list.scrollTop = restore; });
      }
    }
  };
}
