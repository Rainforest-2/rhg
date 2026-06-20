// Boot-time loader that populates the BCU combo registry from the bundled
// NyancomboData.csv / NyancomboParam.tsv assets (canonical version 150300).
//
// The combo tables ship inside core-db.zip as `nyancombo.json` ({ csv, param }),
// read through the semantic asset provider — never from a raw public/assets/bcu
// fetch (the runtime raw-asset guard blocks those). Until this runs the combo
// registry is empty and BcuComboStatModifier is a no-op, so combo stat modifiers
// are strictly additive to existing behavior. A read/parse failure leaves the
// registry empty (combos disabled), matching the battle boot convention of
// degrading gracefully rather than aborting.

import { getBcuAssetDatabase } from '../../bcu/BcuAssetDatabase.js';
import { parseNyancomboData, parseNyancomboParam } from '../BcuComboData.js';
import { setComboRegistry, getComboRegistry } from './BcuComboStatModifier.js';

// core-db.zip internal entry produced by scripts/build-bcu-core-db-bundle.mjs.
export const COMBO_BUNDLE_ENTRY = 'nyancombo.json';

function resolveProvider(options = {}) {
  if (options.provider) return options.provider;
  try {
    return getBcuAssetDatabase()?.semanticProvider
      || globalThis.__BCU_DB__?.semanticProvider
      || null;
  } catch {
    return null;
  }
}

/**
 * Fetch + parse the bundled combo assets and install them into the combo registry.
 *
 * @param {{ provider?: object, entry?: string, dataCsv?: string, paramTsv?: string }} [options]
 *   `dataCsv`/`paramTsv` are an explicit-text injection seam for tests.
 * @returns {Promise<{combos:Array, values:number[][]}>} the installed registry.
 */
export async function loadBcuComboRegistry(options = {}) {
  let dataCsv = options.dataCsv;
  let paramTsv = options.paramTsv;
  if (dataCsv == null || paramTsv == null) {
    const provider = resolveProvider(options);
    if (!provider || typeof provider.readCoreJson !== 'function') {
      throw new Error('loadBcuComboRegistry: semantic provider core-db unavailable');
    }
    const record = await provider.readCoreJson(options.entry || COMBO_BUNDLE_ENTRY);
    dataCsv = record?.csv ?? '';
    paramTsv = record?.param ?? '';
  }
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
