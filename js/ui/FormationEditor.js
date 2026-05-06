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
    this.pendingStatLoads = new Map();
    this.root = document.createElement('div');
    this.root.className = 'formation-ui';
    this.mount.appendChild(this.root);
    this.refresh();
    this.scheduleVisibleStatsLoad();
  }
  findInitialActiveSlot() { const flat = (this.formation?.pages || []).flat(); const i = flat.findIndex((x) => !x); return i >= 0 ? i : 0; }
  setVisible(v) { this.root.style.display = v ? 'block' : 'none'; }

  scheduleVisibleStatsLoad() {
    const runner = () => {
      const chars = this.filter === CHARACTER_FACTIONS.all ? getAvailableCharacters() : getCharactersByFaction(this.filter);
      this.loadStatsForCharacters(chars, { batchSize: 4 });
    };
    if (typeof globalThis.requestIdleCallback === 'function') globalThis.requestIdleCallback(runner, { timeout: 250 });
    else setTimeout(runner, 0);
  }

  async loadStatsForCharacters(chars, { batchSize = 4 } = {}) {
    for (let i = 0; i < chars.length; i += batchSize) {
      const batch = chars.slice(i, i + batchSize);
      await Promise.all(batch.map((c) => this.ensureStatsForCharacter(c)));
      this.refresh();
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  async ensureStatsForCharacter(c) {
    if (this.characterStats.has(c.characterId)) return this.characterStats.get(c.characterId);
    if (this.pendingStatLoads.has(c.characterId)) return this.pendingStatLoads.get(c.characterId);
    const p = (async () => {
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
      } catch {
        this.characterStats.set(c.characterId, null);
      } finally {
        this.pendingStatLoads.delete(c.characterId);
      }
    })();
    this.pendingStatLoads.set(c.characterId, p);
    return p;
  }

  renderCharacterStats(c) {
    const s = this.characterStats.get(c.characterId);
    if (s === undefined) return `<small>stats loading...</small>`;
    if (!s) return `<small>stats unavailable</small>`;
    return `<small>HP ${s.hp} / ATK ${s.atk} / 射程 ${s.range} / コスト ${s.cost}</small>`;
  }

  refresh() {
    this.formation = FormationStore.load();
    const chars = this.filter === CHARACTER_FACTIONS.all ? getAvailableCharacters() : getCharactersByFaction(this.filter);
    const flatSlots = (this.formation.pages || []).flat();
    const usedBaseIds = new Set(flatSlots.map((id) => getCharacterBaseId(id)).filter(Boolean));
    this.root.innerHTML = `<div class='formation-panel'><div class='formation-header'><h3>編成</h3></div>
      <div class='formation-slots'>${flatSlots.map((id, i) => { const c = id ? getCharacterById(id) : null; const rowLabel = i < 5 ? 'Front' : 'Back'; return `<button class='formation-slot ${this.activeSlot===i?'is-active':''}' data-slot='${i}'><small>${rowLabel} ${i%5+1}</small>${c ? `<img src='${c.uiIcon.primary}' onerror="this.onerror=null;this.src='${c.uiIcon.fallback}'"><span>${c.label}</span>` : '<span>空</span>'}</button>`; }).join('')}</div>
      <div class='formation-catalog-tabs'>${[{id:'all',label:'すべて'},{id:'dog',label:'ワンコ軍'},{id:'cat',label:'ネコ軍'}].map(t=>`<button data-filter='${t.id}' class='${this.filter===t.id?'is-active':''}'>${t.label}</button>`).join('')}</div>
      <div class='formation-catalog-scroll'><div class='formation-catalog-grid'>${chars.map((c)=>`<button class='formation-character-card ${usedBaseIds.has(getCharacterBaseId(c))?'is-used':''}' data-character='${c.characterId}'><img src='${c.uiIcon.primary}' onerror="this.onerror=null;this.src='${c.uiIcon.fallback}'"><small>${c.factionLabel}</small><span>${c.label}</span>${this.renderCharacterStats(c)}</button>`).join('')}</div></div>
      <div class='formation-actions'><button data-action='clear'>Clear Slot</button><button data-action='reset'>Reset Default</button><button data-action='apply'>Apply / Battle Reset</button></div></div>`;
    this.bindEvents();
  }
  bindEvents() {
    this.root.querySelectorAll('[data-slot]').forEach((el) => el.onclick = () => { this.activeSlot = Number(el.dataset.slot); this.refresh(); this.scheduleVisibleStatsLoad(); });
    this.root.querySelectorAll('[data-filter]').forEach((el) => el.onclick = () => { this.filter = el.dataset.filter; this.refresh(); this.scheduleVisibleStatsLoad(); });
    this.root.querySelectorAll('[data-character]').forEach((el) => el.onclick = () => { const formation = FormationStore.setSlot(this.activeSlot, el.dataset.character); this.onFormationChanged(formation); this.refresh(); this.scheduleVisibleStatsLoad(); });
    this.root.querySelector('[data-action="clear"]').onclick = () => { const f = FormationStore.clearSlot(this.activeSlot); this.onFormationChanged(f); this.refresh(); this.scheduleVisibleStatsLoad(); };
    this.root.querySelector('[data-action="reset"]').onclick = () => { const f = FormationStore.reset(); this.activeSlot = this.findInitialActiveSlot(); this.onFormationChanged(f); this.refresh(); this.scheduleVisibleStatsLoad(); };
    this.root.querySelector('[data-action="apply"]').onclick = () => this.onApplyBattle();
  }
  dispose() { this.root?.remove(); }
}
