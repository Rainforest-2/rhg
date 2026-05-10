import { CHARACTER_FACTIONS, getAvailableCharacters, getCharactersByFaction, getCharacterBaseId, getCharacterById } from '../battle/CharacterCatalog.js';
import { FormationStore } from '../battle/FormationStore.js';

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
    this.root = document.createElement('div');
    this.root.className = 'formation-ui';
    this.mount.appendChild(this.root);
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('input', (e) => this.onInput(e));
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
        catch (err) { console.error('[FormationEditor] apply failed', err); this.setHint(`Apply failed: ${err instanceof Error ? err.message : String(err)}`); }
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
    return `<img class='${extraClass}' src='${icon.primary || ''}' onerror="this.onerror=null;this.classList.add('image-missing');this.src='${icon.fallback || ''}'">`;
  }

  renderDynamic() {
    const chars = this.getFilteredCharacters();
    const dogCount = getCharactersByFaction('dog').length;
    const catCount = getCharactersByFaction('cat').length;
    const flat = (this.formation?.pages || []).flat();
    const usedBaseIds = new Set(flat.filter(Boolean).map((id) => getCharacterBaseId(id)).filter(Boolean));

    this.root.querySelector('.formation-catalog-summary').textContent = `Catalog: ${chars.length} / dog ${dogCount} / cat ${catCount}`;

    this.root.querySelector('.formation-slots').innerHTML = flat.map((id, i) => {
      const c = id ? getCharacterById(id) : null;
      return `<button type='button' class='formation-slot ${this.activeSlot === i ? 'is-active' : ''}' data-slot='${i}'>${c ? `${this.renderIconMarkup(c)}<span>${c.label}</span><small class='character-id'>${c.characterId}</small>` : '<span>EMPTY</span>'}</button>`;
    }).join('');

    this.root.querySelector('.formation-catalog-grid').innerHTML = chars.map((c) => {
      return `<button type='button' class='formation-character-card ${usedBaseIds.has(getCharacterBaseId(c.characterId)) ? 'is-used' : ''}' data-character='${c.characterId}' data-faction='${c.faction}' data-base-character-id='${c.baseCharacterId || ''}'>${this.renderIconMarkup(c)}<span>${c.factionLabel || c.faction}</span><strong>${c.label}</strong><small class='character-id'>${c.characterId}</small><small class='base-id'>base:${c.baseCharacterId || '-'}</small><small>${c.sourceSlotId || '-'}</small><small>${c.statsSummary || ''}</small></button>`;
    }).join('');
  }

  refresh() {
    this.root.innerHTML = `<div class='formation-panel'><section class='formation-main'><header class='formation-header'><h3>編成</h3><p>キャラを選び、右の Apply Battle で開始</p></header><section class='formation-slots-wrap'><div class='formation-slots'></div></section><section class='formation-catalog-section'><div class='formation-catalog-tabs'>${Object.values(CHARACTER_FACTIONS).map((f) => `<button type='button' data-filter='${f}'>${f}</button>`).join('')}</div><div class='formation-catalog-toolbar'><input class='formation-search-input' data-search-input='1' placeholder='ID / 名前で検索' value='${this.searchText}' /><div class='formation-catalog-summary'></div></div><div class='formation-catalog-scroll'><div class='formation-catalog-grid'></div></div></section></section><aside class='formation-action-rail' aria-label='Formation actions'><button type='button' data-action='apply' class='apply-battle-button'>Apply Battle</button><button type='button' data-action='clear' class='secondary-action'>Clear Slot</button><button type='button' data-action='reset' class='secondary-action'>Reset Default</button><p class='formation-action-hint'>Apply Battleで戦闘開始</p></aside></div>`;
    this.renderDynamic();
  }
}
