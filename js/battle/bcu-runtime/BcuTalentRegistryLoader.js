// Boot-time loader for per-unit talent (PCoin) definitions from
// ./org/data/SkillAcquisition.csv (canonical version 150300).
//
// Until this runs the talent-info registry is empty and talent multipliers are
// no-ops (they also require player-selected talent levels). A fetch/parse
// failure leaves the registry empty, degrading gracefully like the combo loader.

import { getBcuAssetDatabase } from '../../bcu/BcuAssetDatabase.js';
import {
  parseSkillAcquisition,
  parseTalentAbilityNames,
  setTalentAbilityNames,
  setTalentInfoRegistry,
  getTalentInfoForUnit
} from './BcuTalentInfoData.js';

export const TALENT_DATA_PATH = './public/assets/bcu/150300/org/data/SkillAcquisition.csv';
export const TALENT_LANG_INTERNAL_PATH = 'jp-util.properties';

async function readTalentAbilityNameText(options = {}) {
  if (typeof options.readUtilText === 'function') return await options.readUtilText();
  const provider = options.semanticProvider || (() => {
    try { return getBcuAssetDatabase()?.semanticProvider || null; } catch { return null; }
  })();
  if (provider?.readLanguageFile) return await provider.readLanguageFile('jp', TALENT_LANG_INTERNAL_PATH);
  return '';
}

export async function loadBcuTalentAbilityNames(options = {}) {
  const text = await readTalentAbilityNameText(options);
  return setTalentAbilityNames(parseTalentAbilityNames(text));
}

export async function loadBcuTalentRegistry(options = {}) {
  const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl) throw new Error('loadBcuTalentRegistry: no fetch implementation available');
  const path = options.path || TALENT_DATA_PATH;
  const response = await fetchImpl(path);
  if (!response || response.ok === false) {
    throw new Error(`talent asset fetch failed (${response?.status ?? 'no-response'}): ${path}`);
  }
  const csv = await response.text();
  const registry = setTalentInfoRegistry(parseSkillAcquisition(csv));
  try {
    await loadBcuTalentAbilityNames(options);
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
