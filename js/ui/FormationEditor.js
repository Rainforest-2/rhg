import { CHARACTER_FACTIONS, getAvailableCharacters, getCharactersByFaction, getCharacterById, getCharacterBaseId } from '../battle/CharacterCatalog.js';
import { FormationStore } from '../battle/FormationStore.js';
import { BattleStatsLoader } from '../battle/BattleStatsLoader.js';

export class FormationEditor {
  constructor({ mount, onFormationChanged, onApplyBattle }) {
    this.mount = mount || document.body;
    this.onFormationChanged = onFormationChanged || (() => {});
    this.onApplyBattle = onApplyBattle || (() => {});
    this.filter = CHARACTER_FACTIONS.all;
    this.formation = FormationStore.load();
    this.activeSlot = this.findInitialActiveSlot();
    this.statsLoader = new BattleStatsLoader();
    this.characterStats = new Map();
    this.root = document.createElement('div');
    this.root.className = 'formation-ui';
    this.mount.appendChild(this.root);
    this.refresh();
    this.loadCharacterStats();
  }
  findInitialActiveSlot() { const i = (this.formation?.slots || []).findIndex((x) => !x); return i >= 0 ? i : 0; }
  setVisible(v) { this.root.style.display = v ? 'block' : 'none'; }

  async loadCharacterStats() {
    const chars = getAvailableCharacters();
    await Promise.all(chars.map(async (c) => {
      try {
        if (c.uiIcon?.kind === 'unit') {
          const id = Number(c.uiIcon?.bcuId || 0);
          const s = await this.statsLoader.loadUnitStats(id, 'f', 0);
          this.characterStats.set(c.characterId, { hp: s.hp, atk: s.damage, range: s.range, cost: s.price });
        } else {
          const id = Number(c.uiIcon?.bcuId || 0);
          const s = await this.statsLoader.loadEnemyStats(id);
          this.characterStats.set(c.characterId, { hp: s.hp, atk: s.damage, range: s.range, cost: c.defaultCost ?? 0 });
        }
      } catch { this.characterStats.set(c.characterId, null); }
    }));
    this.refresh();
  }

  renderCharacterStats(c) {
    const s = this.characterStats.get(c.characterId);
    if (s === undefined) return `<small>HP ... / ATK ... / 射程 ... / コスト ...</small>`;
    if (!s) return `<small>stats unavailable</small>`;
    return `<small>HP ${s.hp} / ATK ${s.atk} / 射程 ${s.range} / コスト ${s.cost}</small>`;
  }

  refresh() {
    this.formation = FormationStore.load();
    const chars = this.filter === CHARACTER_FACTIONS.all ? getAvailableCharacters() : getCharactersByFaction(this.filter);
    const usedBaseIds = new Set((this.formation.slots || []).map((id) => getCharacterBaseId(id)).filter(Boolean));
    this.root.innerHTML = `<div class='formation-panel'><div class='formation-header'><h3>編成</h3></div>
      <div class='formation-slots'>${this.formation.slots.map((id, i) => { const c = id ? getCharacterById(id) : null; return `<button class='formation-slot ${this.activeSlot===i?'is-active':''}' data-slot='${i}'>${c ? `<img src='${c.uiIcon.primary}' onerror="this.onerror=null;this.src='${c.uiIcon.fallback}'"><span>${c.label}</span>` : '<span>空</span>'}</button>`; }).join('')}</div>
      <div class='formation-catalog-tabs'>${[{id:'all',label:'すべて'},{id:'dog',label:'ワンコ軍'},{id:'cat',label:'ネコ軍'}].map(t=>`<button data-filter='${t.id}' class='${this.filter===t.id?'is-active':''}'>${t.label}</button>`).join('')}</div>
      <div class='formation-catalog-scroll'><div class='formation-catalog-grid'>${chars.map((c)=>`<button class='formation-character-card ${usedBaseIds.has(getCharacterBaseId(c))?'is-used':''}' data-character='${c.characterId}'><img src='${c.uiIcon.primary}' onerror="this.onerror=null;this.src='${c.uiIcon.fallback}'"><small>${c.factionLabel}</small><span>${c.label}</span>${this.renderCharacterStats(c)}</button>`).join('')}</div></div>
      <div class='formation-actions'><button data-action='clear'>Clear Slot</button><button data-action='reset'>Reset Default</button><button data-action='apply'>Apply / Battle Reset</button></div></div>`;
    this.bindEvents();
  }
  bindEvents() {
    this.root.querySelectorAll('[data-slot]').forEach((el) => el.onclick = () => { this.activeSlot = Number(el.dataset.slot); this.refresh(); });
    this.root.querySelectorAll('[data-filter]').forEach((el) => el.onclick = () => { this.filter = el.dataset.filter; this.refresh(); });
    this.root.querySelectorAll('[data-character]').forEach((el) => el.onclick = () => { const formation = FormationStore.setSlot(this.activeSlot, el.dataset.character); this.onFormationChanged(formation); this.refresh(); });
    this.root.querySelector('[data-action="clear"]').onclick = () => { const f = FormationStore.clearSlot(this.activeSlot); this.onFormationChanged(f); this.refresh(); };
    this.root.querySelector('[data-action="reset"]').onclick = () => { const f = FormationStore.reset(); this.activeSlot = this.findInitialActiveSlot(); this.onFormationChanged(f); this.refresh(); };
    this.root.querySelector('[data-action="apply"]').onclick = () => this.onApplyBattle();
  }
  dispose() { this.root?.remove(); }
}
