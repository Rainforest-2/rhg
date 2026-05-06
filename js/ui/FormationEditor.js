import { CHARACTER_FACTIONS, getAvailableCharacters, getCharactersByFaction, getCharacterBaseId } from '../battle/CharacterCatalog.js';
import { FormationStore } from '../battle/FormationStore.js';

export class FormationEditor {
  constructor({ mount, onFormationChanged, onApplyBattle }) {
    this.mount = mount || document.body; this.onFormationChanged = onFormationChanged || (() => {}); this.onApplyBattle = onApplyBattle || (() => {});
    this.filter = CHARACTER_FACTIONS.all; this.formation = FormationStore.load(); this.activeSlot = 0;
    this.root = document.createElement('div'); this.root.className = 'formation-ui'; this.mount.appendChild(this.root);
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.refresh();
  }
  setVisible(v) { this.root.style.display = v ? 'block' : 'none'; }
  onClick(e) {
    const slot = e.target.closest('[data-slot]'); const filter = e.target.closest('[data-filter]'); const character = e.target.closest('[data-character]'); const action = e.target.closest('[data-action]');
    if (slot) { this.activeSlot = Number(slot.dataset.slot); this.refreshSlotsAndCatalog(); return; }
    if (filter) { this.filter = filter.dataset.filter; this.refreshSlotsAndCatalog(); return; }
    if (character) { const before = this.activeSlot; FormationStore.setSlot(before, character.dataset.character); this.formation = FormationStore.load(); this.activeSlot = this.nextEmptySlot() ?? before; this.onFormationChanged(this.formation); this.refreshSlotsAndCatalog(); return; }
    if (action?.dataset.action === 'apply') this.onApplyBattle(this.formation);
  }
  nextEmptySlot() { const flat=(this.formation?.pages||[]).flat(); const i=flat.findIndex((v)=>!v); return i>=0?i:null; }
  refreshSlotsAndCatalog() { this.formation = FormationStore.load(); this.renderDynamic(); }
  renderDynamic() {
    const chars = this.filter === CHARACTER_FACTIONS.all ? getAvailableCharacters() : getCharactersByFaction(this.filter);
    const flat = (this.formation?.pages || []).flat();
    const usedBaseIds = new Set(flat.filter(Boolean).map((id) => getCharacterBaseId({ characterId: id })).filter(Boolean));
    this.root.querySelector('.formation-slots').innerHTML = flat.map((id, i) => `<button class='formation-slot ${this.activeSlot===i?'is-active':''}' data-slot='${i}'>${id || 'EMPTY'}</button>`).join('');
    this.root.querySelector('.formation-catalog-grid').innerHTML = chars.map((c)=>`<button class='formation-character-card ${usedBaseIds.has(getCharacterBaseId(c))?'is-used':''}' data-character='${c.characterId}'><span>${c.label}</span><small data-character-stat='${c.characterId}'>stats</small></button>`).join('');
  }
  refresh() {
    this.root.innerHTML = `<div class='formation-panel'><div class='formation-header'><h3>編成</h3></div><div class='formation-filters'>${Object.values(CHARACTER_FACTIONS).map((f)=>`<button data-filter='${f}'>${f}</button>`).join('')}</div><div class='formation-slots'></div><div class='formation-catalog-scroll'><div class='formation-catalog-grid'></div></div><div class='formation-actions'><button data-action='apply'>Apply</button></div></div>`;
    this.renderDynamic();
  }
}
