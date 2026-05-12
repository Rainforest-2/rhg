import { CHARACTER_FACTIONS, getAvailableCharacters, getCharactersByFaction, getCharacterById } from '../battle/CharacterCatalog.js';
import { FormationStore } from '../battle/FormationStore.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';

export class FormationEditor {
  constructor({ mount, onFormationChanged, onApplyBattle }) {
    this.mount = mount || document.body;
    this.onFormationChanged = onFormationChanged || (() => {});
    this.onApplyBattle = onApplyBattle || (() => {});
    this.filter = CHARACTER_FACTIONS.all;
    this.searchText = '';
    this.formation = FormationStore.load();
    this.activeSlot = 0;
    this.applying = false;
    this.iconWork = new Map();
    this.iconQueue = [];
    this.iconActive = 0;
    this.iconConcurrency = 6;
    this.iconObserver = null;
    this.catalogItems = [];
    this.catalogVirtual = { rowHeight: 176, columns: 4, overscanRows: 3, start: 0, end: 0 };
    this.renderFrame = null;
    this.root = document.createElement('div');
    this.root.className = 'formation-ui';
    this.mount.appendChild(this.root);
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('input', (e) => this.onInput(e));
    this.root.addEventListener('scroll', (e) => this.onScroll(e), true);
    this.refresh();
  }

  setVisible(v) { this.root.classList.toggle('is-visible', !!v); }

  setHint(text) {
    const hint = this.root.querySelector('.formation-action-hint');
    if (hint) hint.textContent = text;
  }

  onInput(e) {
    const input = e.target.closest('[data-search-input]');
    if (!input) return;
    this.searchText = String(input.value || '');
    this.renderDynamic();
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
    const action = e.target.closest('[data-action]');
    if (action) {
      const type = action.dataset.action;
      if (type === 'apply' && !this.applying) {
        e.preventDefault();
        e.stopPropagation();
        const btn = this.root.querySelector('.apply-battle-button');
        this.applying = true;
        if (btn) { btn.disabled = true; btn.textContent = 'Applying...'; }
        try { await this.onApplyBattle(this.formation); }
        catch (err) {
          console.error('[FormationEditor] apply failed detail', {
            name: err?.name,
            message: err?.message,
            stack: err?.stack,
            cause: err?.cause,
            error: err
          });
          this.setHint(`Apply failed: ${err?.message || String(err)}`);
        }
        finally { this.applying = false; if (btn) { btn.disabled = false; btn.textContent = 'Apply Battle'; } }
        return;
      }
      if (type === 'clear') {
        FormationStore.setSlot(this.activeSlot, null);
        this.formation = FormationStore.load();
        this.onFormationChanged(this.formation);
        this.setHint('Selected slot cleared');
        return this.renderDynamic();
      }
      if (type === 'reset') {
        FormationStore.reset();
        this.formation = FormationStore.load();
        this.onFormationChanged(this.formation);
        this.setHint('Formation reset to default');
        return this.renderDynamic();
      }
    }

    const slot = e.target.closest('[data-slot]');
    const filter = e.target.closest('[data-filter]');
    const character = e.target.closest('[data-character]');
    if (slot) { this.activeSlot = Number(slot.dataset.slot); return this.renderDynamic(); }
    if (filter) { this.filter = filter.dataset.filter; return this.renderDynamic(); }
    if (character) {
      const characterId = character.dataset.character;
      const selected = getCharacterById(characterId);
      if (!selected) { this.setHint(`Error: character not found ${characterId}`); return; }
      FormationStore.setSlot(this.activeSlot, characterId);
      this.formation = FormationStore.load();
      this.onFormationChanged(this.formation);
      this.setHint(`Selected: ${characterId}`);
      return this.renderDynamic();
    }
  }

  getFilteredCharacters() {
    const baseChars = this.filter === CHARACTER_FACTIONS.all ? getAvailableCharacters() : getCharactersByFaction(this.filter);
    const q = this.searchText.trim().toLowerCase();
    if (!q) return baseChars;
    return baseChars.filter((c) => [c.characterId, c.baseCharacterId, c.label, c.sourceSlotId, c.statsSummary].some((v) => String(v || '').toLowerCase().includes(q)));
  }

  renderIconMarkup(c, extraClass = '') {
    const icon = c?.uiIcon || {};
    const semanticKey = icon.semanticKey || c?.assetDef?.semanticKey || '';
    return `<img class='${extraClass} image-missing' data-semantic-icon='${semanticKey}' alt=''>`;
  }

  scheduleIconLoad(img, provider) {
    const key = img.dataset.semanticIcon;
    if (!key || img.dataset.iconPending === '1' || img.dataset.iconResolved === '1') return Promise.resolve();
    img.dataset.iconPending = '1';
    const existing = this.iconWork.get(key) || provider.getActorUiIconUrl(key);
    this.iconWork.set(key, existing);
    return existing.then((url) => {
      img.src = url;
      img.classList.remove('image-missing');
      img.dataset.iconResolved = '1';
      delete img.dataset.iconPending;
    }).catch((err) => {
      console.error('[FormationEditor] icon load failed detail', {
        key,
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
        cause: err?.cause,
        error: err
      });
      img.classList.add('image-missing');
      delete img.dataset.iconPending;
      delete img.dataset.iconResolved;
      this.iconWork.delete(key);
    });
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
    if (!this.iconObserver && typeof IntersectionObserver !== 'undefined') {
      this.iconObserver = new IntersectionObserver((items) => {
        for (const item of items) {
          if (!item.isIntersecting) continue;
          this.iconObserver.unobserve(item.target);
          this.iconQueue.push(item.target);
        }
        this.pumpIconQueue(provider);
      }, { root: this.root.querySelector('.formation-catalog-scroll') || null, rootMargin: '160px' });
    }
    for (const img of this.root.querySelectorAll('.formation-catalog-grid img[data-semantic-icon]')) {
      if (!img.dataset.semanticIcon || img.dataset.iconResolved === '1') continue;
      if (this.iconObserver) this.iconObserver.observe(img);
      else this.iconQueue.push(img);
    }
    this.pumpIconQueue(provider);
  }

  resolveSelectedSlotIconsImmediately(provider) {
    for (const img of this.root.querySelectorAll('.formation-slots img[data-semantic-icon]')) {
      if (!img.dataset.semanticIcon || img.dataset.iconResolved === '1') continue;
      this.iconQueue.push(img);
    }
    this.pumpIconQueue(provider);
  }

  estimateCatalogColumns(scroller) {
    const width = Math.max(1, scroller?.clientWidth || 1);
    return Math.max(1, Math.floor(width / 168));
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
    const firstRow = Math.max(0, Math.floor((scroller.scrollTop || 0) / rowHeight) - this.catalogVirtual.overscanRows);
    const lastRow = Math.min(totalRows, firstRow + visibleRows + this.catalogVirtual.overscanRows * 2);
    const start = firstRow * columns;
    const end = Math.min(chars.length, lastRow * columns);
    this.catalogVirtual = { ...this.catalogVirtual, columns, start, end };
    const top = firstRow * rowHeight;
    const bottom = Math.max(0, (totalRows - lastRow) * rowHeight);
    const usedBaseIds = this.currentUsedBaseIds || new Set();
    grid.innerHTML = `<div class='formation-catalog-spacer' style='height:${top}px'></div>${chars.slice(start, end).map((c) => {
      const baseId = c.baseCharacterId || c.characterId;
      return `<button type='button' class='formation-character-card ${usedBaseIds.has(baseId) ? 'is-used' : ''}' data-character='${c.characterId}' data-faction='${c.faction}' data-base-character-id='${baseId || ''}'>${this.renderIconMarkup(c)}<span>${c.factionLabel || c.faction}</span><strong>${c.label}</strong><small class='character-id'>${c.characterId}</small><small class='base-id'>base:${baseId || '-'}</small><small>${c.sourceSlotId || '-'}</small><small>${c.statsSummary || ''}</small></button>`;
    }).join('')}<div class='formation-catalog-spacer' style='height:${bottom}px'></div>`;
  }

  renderDynamic() {
    performance.mark?.('formation-render-start');
    const chars = this.getFilteredCharacters();
    const dogCount = getCharactersByFaction('dog').length;
    const catCount = getCharactersByFaction('cat').length;
    const flat = (this.formation?.pages || []).flat();
    const usedBaseIds = new Set(flat.filter(Boolean).map((id) => {
      const c = getCharacterById(id);
      return c?.baseCharacterId || c?.characterId || id;
    }).filter(Boolean));
    this.currentUsedBaseIds = usedBaseIds;
    this.catalogItems = chars;

    this.root.querySelector('.formation-catalog-summary').textContent = `Catalog: ${chars.length} / dog ${dogCount} / cat ${catCount}`;

    this.root.querySelector('.formation-slots').innerHTML = flat.map((id, i) => {
      const c = id ? getCharacterById(id) : null;
      return `<button type='button' class='formation-slot ${this.activeSlot === i ? 'is-active' : ''}' data-slot='${i}'>${c ? `${this.renderIconMarkup(c)}<span>${c.label}</span><small class='character-id'>${c.characterId}</small>` : '<span>EMPTY</span>'}</button>`;
    }).join('');
    const scroller = this.root.querySelector('.formation-catalog-scroll');
    if (scroller) scroller.scrollTop = 0;
    this.renderCatalogWindow();
    this.resolveSemanticIcons();
    performance.mark?.('formation-render-end');
    performance.measure?.('formation-render', 'formation-render-start', 'formation-render-end');
    console.debug?.('[FormationEditor] render diagnostics', {
      catalogItemCount: chars.length,
      renderedDomCardCount: Math.max(0, (this.catalogVirtual.end || 0) - (this.catalogVirtual.start || 0)),
      iconQueueSize: this.iconQueue.length,
      visibleIconCount: this.root.querySelectorAll('.formation-catalog-grid img[data-semantic-icon]').length
    });
  }

  refresh() {
    this.root.innerHTML = `<div class='formation-panel'><section class='formation-main'><header class='formation-header'><h3>編成</h3><p>キャラを選び、右の Apply Battle で開始</p></header><section class='formation-slots-wrap'><div class='formation-slots'></div></section><section class='formation-catalog-section'><div class='formation-catalog-tabs'>${Object.values(CHARACTER_FACTIONS).map((f) => `<button type='button' data-filter='${f}'>${f}</button>`).join('')}</div><div class='formation-catalog-toolbar'><input class='formation-search-input' data-search-input='1' placeholder='ID / 名前で検索' value='${this.searchText}' /><div class='formation-catalog-summary'></div></div><div class='formation-catalog-scroll'><div class='formation-catalog-grid'></div></div></section></section><aside class='formation-action-rail' aria-label='Formation actions'><button type='button' data-action='apply' class='apply-battle-button'>Apply Battle</button><button type='button' data-action='clear' class='secondary-action'>Clear Slot</button><button type='button' data-action='reset' class='secondary-action'>Reset Default</button><p class='formation-action-hint'>Apply Battleで戦闘開始</p></aside></div>`;
    this.renderDynamic();
  }
}
