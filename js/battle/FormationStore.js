import { getCharacterById } from './CharacterCatalog.js';

export const FORMATION_STORAGE_KEY = 'wanko-battle.formation.v1';
export const DEFAULT_FORMATION = Object.freeze({
  version: 1,
  slots: Object.freeze(['dog-wanko', 'dog-nyoro', 'dog-rei', 'cat-basic', 'cat-tank'])
});

function cloneFormation(formation) { return { version: 1, slots: [...(formation?.slots || [])] }; }
export function getDefaultFormation() { return cloneFormation(DEFAULT_FORMATION); }

export function sanitizeFormation(rawFormation) {
  const base = getDefaultFormation();
  const srcSlots = Array.isArray(rawFormation?.slots) ? rawFormation.slots : base.slots;
  const out = [];
  const seen = new Set();
  for (let i = 0; i < 5; i += 1) {
    const raw = i < srcSlots.length ? srcSlots[i] : null;
    const id = typeof raw === 'string' ? raw : null;
    if (!id || !getCharacterById(id) || seen.has(id)) { out.push(null); continue; }
    seen.add(id); out.push(id);
  }
  return { version: 1, slots: out };
}

function canUseStorage() { return typeof window !== 'undefined' && !!window.localStorage; }

export const FormationStore = {
  load() {
    if (!canUseStorage()) return getDefaultFormation();
    try {
      const raw = window.localStorage.getItem(FORMATION_STORAGE_KEY);
      if (!raw) return getDefaultFormation();
      return sanitizeFormation(JSON.parse(raw));
    } catch { return getDefaultFormation(); }
  },
  save(formation) {
    const sanitized = sanitizeFormation(formation);
    if (canUseStorage()) {
      try { window.localStorage.setItem(FORMATION_STORAGE_KEY, JSON.stringify(sanitized)); } catch {}
    }
    return sanitized;
  },
  reset() { return this.save(getDefaultFormation()); },
  getDefault() { return getDefaultFormation(); },
  sanitize(formation) { return sanitizeFormation(formation); },
  setSlot(index, characterId) {
    const safeIndex = Math.floor(index);
    const current = this.load();
    if (safeIndex < 0 || safeIndex > 4) return current;
    const slots = [...current.slots];
    if (!characterId || !getCharacterById(characterId)) { slots[safeIndex] = null; return this.save({ version: 1, slots }); }
    const existingIndex = slots.findIndex((id, i) => id === characterId && i !== safeIndex);
    if (existingIndex >= 0) {
      const prev = slots[safeIndex];
      slots[safeIndex] = characterId;
      slots[existingIndex] = prev || null;
    } else {
      slots[safeIndex] = characterId;
    }
    return this.save({ version: 1, slots });
  },
  clearSlot(index) {
    const safeIndex = Math.floor(index);
    const current = this.load();
    if (safeIndex < 0 || safeIndex > 4) return current;
    const slots = [...current.slots];
    slots[safeIndex] = null;
    return this.save({ version: 1, slots });
  }
};
