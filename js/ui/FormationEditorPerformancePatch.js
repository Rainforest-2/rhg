import { FormationEditor } from './FormationEditor.js';
import { getAvailableStages } from '../battle/StageRegistry.js';

function stageIdOf(stage) {
  return stage?.stageKey || stage?.stageId || '';
}

function parseStageAddress(stage) {
  const rawId = stage?.stageId || stage?.semanticEntry?.stageId || stage?.basename || '';
  const match = String(rawId).match(/^stage([A-Za-z]+)(\d{3})_(\d{2})$/i);
  const groupDir = stage?.semanticEntry?.groupDir || String(stage?.mapPath || '').split('/').filter(Boolean).pop() || 'Stage';
  const packId = stage?.packId || stage?.semanticEntry?.packId || 'BCU';
  if (match) {
    const code = match[1].toUpperCase();
    return {
      packId,
      collectionCode: code,
      collectionKey: `${packId}:${code}`,
      mapNo: match[2],
      mapKey: `${packId}:${code}:${match[2]}`,
      stageNo: match[3],
      rawId
    };
  }
  return {
    packId,
    collectionCode: groupDir,
    collectionKey: `${packId}:${groupDir}`,
    mapNo: String(stage?.mapPath || groupDir),
    mapKey: `${packId}:${groupDir}:${stage?.mapPath || groupDir}`,
    stageNo: rawId || stageIdOf(stage),
    rawId
  };
}

function collectionLabel(code) {
  const c = String(code || '').toUpperCase();
  if (c === 'RN') return 'レジェンド系';
  if (c === 'RNA') return 'イベント系';
  if (c === 'EX') return 'EXステージ系';
  if (c === 'DM' || c === 'D') return '月間・曜日系';
  return String(code || 'ステージ群');
}

function safeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function buildStageHierarchy(editor) {
  const byCollection = new Map();
  for (const stage of editor.stageOptions || []) {
    const id = stageIdOf(stage);
    if (!id) continue;
    const address = parseStageAddress(stage);
    let collection = byCollection.get(address.collectionKey);
    if (!collection) {
      collection = {
        key: address.collectionKey,
        code: address.collectionCode,
        label: collectionLabel(address.collectionCode),
        maps: new Map(),
        count: 0
      };
      byCollection.set(address.collectionKey, collection);
    }
    let map = collection.maps.get(address.mapKey);
    if (!map) {
      map = {
        key: address.mapKey,
        no: address.mapNo,
        label: `エリア ${Number(address.mapNo) || address.mapNo}`,
        stages: []
      };
      collection.maps.set(address.mapKey, map);
    }
    map.stages.push({ stage, address });
    collection.count += 1;
  }

  const collections = Array.from(byCollection.values())
    .map((collection) => ({ ...collection, maps: Array.from(collection.maps.values()).sort((a, b) => String(a.no).localeCompare(String(b.no), 'ja', { numeric: true })) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ja', { numeric: true }));

  for (const collection of collections) {
    for (const map of collection.maps) {
      map.stages.sort((a, b) => String(a.address.stageNo).localeCompare(String(b.address.stageNo), 'ja', { numeric: true }));
      const firstName = editor.resolveStageDisplay?.(map.stages[0]?.stage, {})?.displayName || '';
      const mapName = firstName.includes(' - ') ? firstName.split(' - ')[0].trim() : '';
      if (mapName) map.label = mapName;
    }
  }

  return collections;
}

function selectedStageName(editor) {
  const selectedStage = (editor.stageOptions || []).find((s) => stageIdOf(s) === editor.selectedStageId || s.stageId === editor.selectedStageId);
  if (!selectedStage) return '未選択';
  return editor.resolveStageDisplay?.(selectedStage, {})?.displayName || selectedStage.label || selectedStage.stageId || selectedStage.stageKey || 'ステージ';
}

function renderStageBreadcrumb(editor, collection, map) {
  const rootActive = !collection;
  return `<div class='formation-stage-breadcrumb'>
    <button type='button' class='formation-stage-crumb ${rootActive ? 'is-active' : ''}' data-stage-root='1'>カテゴリ</button>
    ${collection ? `<button type='button' class='formation-stage-crumb ${map ? '' : 'is-active'}' data-stage-collection='${safeHtml(collection.key)}'>${safeHtml(collection.label)}</button>` : ''}
    ${map ? `<button type='button' class='formation-stage-crumb is-active' data-stage-map='${safeHtml(map.key)}'>${safeHtml(map.label)}</button>` : ''}
  </div>`;
}

function renderCollectionCards(collections) {
  return collections.map((collection) => `<button type='button' class='formation-stage-card formation-stage-card-collection' data-stage-collection='${safeHtml(collection.key)}'>
    <strong>${safeHtml(collection.label)}</strong>
    <small>${collection.maps.length}マップ</small>
    <span>${collection.count}ステージ</span>
  </button>`).join('');
}

function renderMapCards(collection) {
  return collection.maps.map((map) => `<button type='button' class='formation-stage-card formation-stage-card-map' data-stage-map='${safeHtml(map.key)}'>
    <strong>${safeHtml(map.label)}</strong>
    <small>${map.stages.length}ステージ</small>
    <span>タップしてステージ一覧へ</span>
  </button>`).join('');
}

function renderStageCards(editor, map) {
  return map.stages.map(({ stage, address }) => {
    const id = stageIdOf(stage);
    const active = id === editor.selectedStageId || stage.stageId === editor.selectedStageId;
    const resolved = editor.resolveStageDisplay?.(stage, {})?.displayName || stage.label || stage.stageId || id || 'ステージ';
    const title = resolved.includes(' - ') ? resolved.split(' - ').slice(1).join(' - ').trim() || resolved : resolved;
    return `<button type='button' class='formation-stage-card formation-stage-card-stage ${active ? 'is-active' : ''}' data-stage-id='${safeHtml(id)}'>
      <strong>${safeHtml(title)}</strong>
      <small>${active ? '選択中' : `No.${safeHtml(address.stageNo)}`}</small>
      <span>${active ? '現在のステージ' : 'このステージで出撃'}</span>
    </button>`;
  }).join('');
}

function ensureStagePath(editor, collections) {
  const path = editor.stageSelectorPath || {};
  const collection = collections.find((c) => c.key === path.collectionKey) || null;
  const map = collection?.maps?.find((m) => m.key === path.mapKey) || null;
  if (path.collectionKey && !collection) editor.stageSelectorPath = {};
  else if (path.mapKey && !map) editor.stageSelectorPath = { collectionKey: collection?.key || null, mapKey: null };
  return {
    collection: collections.find((c) => c.key === editor.stageSelectorPath?.collectionKey) || null,
    map: collections.flatMap((c) => c.maps.map((m) => ({ collection: c, map: m }))).find((x) => x.map.key === editor.stageSelectorPath?.mapKey) || null
  };
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
    const collectionButton = event?.target?.closest?.('[data-stage-collection]');
    const mapButton = event?.target?.closest?.('[data-stage-map]');
    const rootButton = event?.target?.closest?.('[data-stage-root]');
    if (rootButton && this.root?.contains(rootButton)) {
      event.preventDefault();
      event.stopPropagation();
      this.stageSelectorPath = {};
      this.renderStageSelector();
      return;
    }
    if (collectionButton && this.root?.contains(collectionButton)) {
      event.preventDefault();
      event.stopPropagation();
      this.stageSelectorPath = { collectionKey: collectionButton.dataset.stageCollection, mapKey: null };
      this.renderStageSelector();
      return;
    }
    if (mapButton && this.root?.contains(mapButton)) {
      event.preventDefault();
      event.stopPropagation();
      const collections = buildStageHierarchy(this);
      const owner = collections.find((collection) => collection.maps.some((map) => map.key === mapButton.dataset.stageMap));
      this.stageSelectorPath = { collectionKey: owner?.key || this.stageSelectorPath?.collectionKey || null, mapKey: mapButton.dataset.stageMap };
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
      this.stageOptions = getAvailableStages().filter((s) => s?.bundleRef?.bundlePath || s?.semanticEntry?.bundleRef?.bundlePath || s?.enabled !== false);
      this.stageHierarchyCache = null;
      this.renderStageSelector();
    } finally {
      this.stageLoading = false;
    }
  };

  FormationEditor.prototype.renderStageSelector = function patchedRenderStageSelector() {
    const overlay = this.root.querySelector('.formation-stage-overlay');
    if (overlay) overlay.classList.toggle('is-open', this.stageOverlayOpen);
    const current = this.root.querySelector('.formation-current-stage');
    if (current) current.textContent = selectedStageName(this);
    const list = this.root.querySelector('.formation-stage-list');
    if (!list) return;

    const collections = buildStageHierarchy(this);
    const { collection, map: mapEntry } = ensureStagePath(this, collections);
    const activeMap = mapEntry?.map || null;
    const activeCollection = mapEntry?.collection || collection;
    const dialog = this.root.querySelector('.formation-stage-dialog');
    const headerTitle = dialog?.querySelector('header strong');
    const headerLead = dialog?.querySelector('header span');
    if (headerTitle) headerTitle.textContent = activeMap ? 'ステージを選ぶ' : activeCollection ? 'マップを選ぶ' : 'カテゴリを選ぶ';
    if (headerLead) headerLead.textContent = activeMap ? 'ステージだけを表示中' : activeCollection ? 'マップ単位で軽量表示' : 'BCU準拠の3階層選択';

    const body = activeMap
      ? renderStageCards(this, activeMap)
      : activeCollection
        ? renderMapCards(activeCollection)
        : renderCollectionCards(collections);

    list.innerHTML = `${renderStageBreadcrumb(this, activeCollection, activeMap)}${body || `<p class='formation-stage-empty'>ステージが見つかりません</p>`}`;
  };
}
