import { FormationEditor } from './FormationEditor.js';

const PATCH_FLAG = Symbol.for('wanko-ui.formation-catalog-virtual-dom-diff.v1');

function safeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function estimateCatalogColumns(editor, scroller) {
  if (typeof editor.estimateCatalogColumns === 'function') return editor.estimateCatalogColumns(scroller);
  const width = Math.max(1, scroller?.clientWidth || 1);
  return Math.max(1, Math.floor(width / 166));
}

function cardKey(character) {
  return String(character?.characterId || 'unknown-character');
}

function ensureSpacer(grid, position) {
  const attr = position === 'top' ? 'top' : 'bottom';
  let node = grid.querySelector(`.formation-catalog-spacer[data-virtual-spacer="${attr}"]`);
  if (!node) {
    node = document.createElement('div');
    node.className = 'formation-catalog-spacer';
    node.dataset.virtualSpacer = attr;
    node.setAttribute('aria-hidden', 'true');
    node.style.gridColumn = '1 / -1';
  }
  return node;
}

function buildCard(editor, character, catalogIndex, usedBaseIds) {
  const baseId = character.baseCharacterId || character.characterId;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `formation-character-card ${usedBaseIds.has(baseId) ? 'is-used' : ''}`;
  button.dataset.character = character.characterId;
  button.dataset.catalogIndex = String(catalogIndex);
  button.dataset.faction = character.faction;
  button.dataset.baseCharacterId = baseId || '';
  button.dataset.virtualCardKey = cardKey(character);
  button.innerHTML = `${editor.renderIconMarkup(character)}<span>${safeHtml(character.faction === 'dog' ? 'DOG' : 'CAT')}</span><strong>${safeHtml(character.label)}</strong><small class='character-id'>${safeHtml(character.characterId)}</small>${editor.renderCardMeta(character)}`;
  return button;
}

function updateCard(editor, button, character, catalogIndex, usedBaseIds) {
  const baseId = character.baseCharacterId || character.characterId;
  button.dataset.catalogIndex = String(catalogIndex);
  button.dataset.faction = character.faction;
  button.dataset.baseCharacterId = baseId || '';
  button.classList.toggle('is-used', usedBaseIds.has(baseId));

  const faction = button.querySelector(':scope > span');
  if (faction) faction.textContent = character.faction === 'dog' ? 'DOG' : 'CAT';
  const label = button.querySelector(':scope > strong');
  if (label) label.textContent = character.label || '';
  const id = button.querySelector(':scope > .character-id');
  if (id) id.textContent = character.characterId || '';
  const meta = button.querySelector(':scope > .formation-card-meta');
  if (meta) {
    const next = document.createElement('div');
    next.innerHTML = editor.renderCardMeta(character);
    const nextMeta = next.firstElementChild;
    if (nextMeta) meta.replaceWith(nextMeta);
  }

  // Preserve an already-loaded <img> element. Only repair semantic key if a reused node somehow mismatches.
  const img = button.querySelector('img[data-semantic-icon]');
  const semanticKey = character?.uiIcon?.semanticKey || character?.assetDef?.semanticKey || '';
  if (img && img.dataset.semanticIcon !== semanticKey) {
    img.removeAttribute('src');
    img.classList.add('image-missing');
    img.dataset.semanticIcon = semanticKey;
    delete img.dataset.iconResolved;
    delete img.dataset.iconPending;
  }
}

function renderCatalogWindowDiff(editor) {
  const scroller = editor.root.querySelector('.formation-catalog-scroll');
  const grid = editor.root.querySelector('.formation-catalog-grid');
  if (!scroller || !grid) return;

  const chars = editor.catalogItems || [];
  const columns = estimateCatalogColumns(editor, scroller);
  const rowHeight = editor.catalogVirtual.rowHeight;
  const totalRows = Math.ceil(chars.length / columns);
  const visibleRows = Math.ceil((scroller.clientHeight || 480) / rowHeight);
  const dynamicOverscanRows = Math.max(8, Math.ceil(((scroller.clientHeight || 480) * 2) / rowHeight));
  const firstVisibleRow = Math.max(0, Math.floor((scroller.scrollTop || 0) / rowHeight));
  const lastVisibleRow = Math.min(totalRows, firstVisibleRow + visibleRows);
  const firstRow = Math.max(0, firstVisibleRow - dynamicOverscanRows);
  const lastRow = Math.min(totalRows, lastVisibleRow + dynamicOverscanRows);
  const start = firstRow * columns;
  const end = Math.min(chars.length, lastRow * columns);
  const top = firstRow * rowHeight;
  const bottom = Math.max(0, (totalRows - lastRow) * rowHeight);
  const usedBaseIds = editor.currentUsedBaseIds || new Set();

  editor.catalogVirtual = { ...editor.catalogVirtual, columns, overscanRows: dynamicOverscanRows, start, end, firstVisibleRow, lastVisibleRow };

  const topSpacer = ensureSpacer(grid, 'top');
  topSpacer.style.height = `${top}px`;
  const bottomSpacer = ensureSpacer(grid, 'bottom');
  bottomSpacer.style.height = `${bottom}px`;

  const existingCards = new Map();
  for (const node of grid.querySelectorAll('.formation-character-card[data-virtual-card-key]')) {
    existingCards.set(node.dataset.virtualCardKey, node);
  }

  const requiredKeys = new Set();
  const fragment = document.createDocumentFragment();
  fragment.appendChild(topSpacer);

  let reused = 0;
  let created = 0;
  for (let index = start; index < end; index += 1) {
    const character = chars[index];
    if (!character) continue;
    const key = cardKey(character);
    requiredKeys.add(key);
    let card = existingCards.get(key);
    if (card) {
      reused += 1;
      updateCard(editor, card, character, index, usedBaseIds);
    } else {
      card = buildCard(editor, character, index, usedBaseIds);
      created += 1;
    }
    fragment.appendChild(card);
  }
  fragment.appendChild(bottomSpacer);

  let removed = 0;
  for (const [key, node] of existingCards) {
    if (!requiredKeys.has(key)) {
      node.remove();
      removed += 1;
    }
  }

  grid.replaceChildren(fragment);

  globalThis.__FORMATION_VDOM_DIFF_DEBUG__ = {
    source: 'FormationCatalogVirtualDomPatch.renderCatalogWindowDiff',
    catalogItemCount: chars.length,
    start,
    end,
    renderedDomCardCount: Math.max(0, end - start),
    reused,
    created,
    removed,
    columns,
    firstVisibleRow,
    lastVisibleRow,
    overscanRows: dynamicOverscanRows,
    reason: 'preserve overlapping virtual catalog card DOM and image elements; only create/remove changed range'
  };
}

export function installFormationCatalogVirtualDomPatch() {
  const proto = FormationEditor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  proto.renderCatalogWindow = function patchedRenderCatalogWindowDiff() {
    return renderCatalogWindowDiff(this);
  };
}

installFormationCatalogVirtualDomPatch();
