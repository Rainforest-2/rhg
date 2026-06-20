// Boot-time loader for per-unit talent (PCoin) definitions from the canonical
// 150300 pack's SkillAcquisition.csv.
//
// The CSV ships inside core-db.zip as `skill-acquisition.json` ({ csv }), read
// through the semantic asset provider — never from a raw public/assets/bcu fetch
// (the runtime raw-asset guard blocks those). Until this runs the talent-info
// registry is empty and talent multipliers are no-ops (they also require
// player-selected talent levels). A read/parse failure leaves the registry
// empty, degrading gracefully like the combo loader.

import { getBcuAssetDatabase } from '../../bcu/BcuAssetDatabase.js';
import {
  parseSkillAcquisition,
  parseTalentAbilityNames,
  setTalentAbilityNames,
  setTalentInfoRegistry,
  getTalentInfoForUnit
} from './BcuTalentInfoData.js';

// core-db.zip internal entry produced by scripts/build-bcu-core-db-bundle.mjs.
export const TALENT_BUNDLE_ENTRY = 'skill-acquisition.json';
export const TALENT_LANG_INTERNAL_PATH = 'jp-util.properties';

function resolveProvider(options = {}) {
  if (options.semanticProvider) return options.semanticProvider;
  try {
    return getBcuAssetDatabase()?.semanticProvider
      || globalThis.__BCU_DB__?.semanticProvider
      || null;
  } catch {
    return null;
  }
}

async function readTalentAbilityNameText(options = {}) {
  if (typeof options.readUtilText === 'function') return await options.readUtilText();
  const provider = resolveProvider(options);
  if (provider?.readLanguageFile) return await provider.readLanguageFile('jp', TALENT_LANG_INTERNAL_PATH);
  return '';
}

export async function loadBcuTalentAbilityNames(options = {}) {
  const text = await readTalentAbilityNameText(options);
  return setTalentAbilityNames(parseTalentAbilityNames(text));
}

export async function loadBcuTalentRegistry(options = {}) {
  let csv = options.csv;
  let provider = options.semanticProvider || null;
  if (csv == null) {
    provider = resolveProvider(options);
    if (!provider || typeof provider.readCoreJson !== 'function') {
      throw new Error('loadBcuTalentRegistry: semantic provider core-db unavailable');
    }
    const record = await provider.readCoreJson(options.entry || TALENT_BUNDLE_ENTRY);
    csv = record?.csv ?? '';
  }
  const registry = setTalentInfoRegistry(parseSkillAcquisition(csv));
  try {
    await loadBcuTalentAbilityNames(provider ? { ...options, semanticProvider: provider } : options);
  } catch (error) {
    console.warn('[battle boot] talent ability-name load failed; using fallback labels', error);
  }
  return registry;
}

export async function installBcuTalentRegistry(options = {}) {
  try {
    await loadBcuTalentRegistry(options);
    return true;
  } catch (error) {
    console.warn('[battle boot] talent registry load failed; talents disabled', error);
    globalThis.__BATTLE_BOOT_PATCH_ERRORS__ = [
      ...(globalThis.__BATTLE_BOOT_PATCH_ERRORS__ || []),
      { path: 'BcuTalentRegistryLoader', message: error?.message || String(error), stack: error?.stack || null }
    ];
    return false;
  }
}

export { getTalentInfoForUnit };
