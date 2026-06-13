// Boot-time loader that populates the BCU combo registry from the
// NyancomboData.csv / NyancomboParam.tsv assets (canonical version 150300).
//
// Until this runs the combo registry is empty and BcuComboStatModifier is a
// no-op, so combo stat modifiers are strictly additive to existing behavior.
// A fetch/parse failure leaves the registry empty (combos disabled), matching
// the battle boot convention of degrading gracefully rather than aborting.

import { parseNyancomboData, parseNyancomboParam } from '../BcuComboData.js';
import { setComboRegistry, getComboRegistry } from './BcuComboStatModifier.js';

export const COMBO_DATA_BASE = './public/assets/bcu/150300/org/data';

async function fetchText(path, fetchImpl) {
  const response = await fetchImpl(path);
  if (!response || response.ok === false) {
    throw new Error(`combo asset fetch failed (${response?.status ?? 'no-response'}): ${path}`);
  }
  return response.text();
}

/**
 * Fetch + parse the combo assets and install them into the combo registry.
 *
 * @param {{ fetchImpl?: typeof fetch, base?: string }} [options]
 * @returns {Promise<{combos:Array, values:number[][]}>} the installed registry.
 */
export async function loadBcuComboRegistry(options = {}) {
  const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl) throw new Error('loadBcuComboRegistry: no fetch implementation available');
  const base = options.base || COMBO_DATA_BASE;
  const [dataCsv, paramTsv] = await Promise.all([
    fetchText(`${base}/NyancomboData.csv`, fetchImpl),
    fetchText(`${base}/NyancomboParam.tsv`, fetchImpl)
  ]);
  const combos = parseNyancomboData(dataCsv);
  const values = parseNyancomboParam(paramTsv);
  return setComboRegistry({ combos, values });
}

/** Boot installer: load the combo registry, logging (not throwing) on failure. */
export async function installBcuComboRegistry(options = {}) {
  try {
    await loadBcuComboRegistry(options);
    return true;
  } catch (error) {
    console.warn('[battle boot] combo registry load failed; combos disabled', error);
    globalThis.__BATTLE_BOOT_PATCH_ERRORS__ = [
      ...(globalThis.__BATTLE_BOOT_PATCH_ERRORS__ || []),
      { path: 'BcuComboRegistryLoader', message: error?.message || String(error), stack: error?.stack || null }
    ];
    return false;
  }
}

export { getComboRegistry };
