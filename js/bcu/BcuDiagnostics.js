export function createBcuDiagnostics() {
  return {
    manifest: { missingFiles: [], duplicateFiles: [], caseConflicts: [] },
    lang: { loadedLocales: [], loadedFiles: [], unknownFiles: [], unknownNameFiles: [], invalidLines: [], missingNames: [] },
    units: { missingStats: [], missingAssets: [], missingNames: [] },
    enemies: { missingStats: [], missingAssets: [], missingNames: [] },
    backgrounds: { missingRows: [], missingAssets: [], missingNames: [] },
    castles: { missingAssets: [], missingNames: [], fallbackIds: [] },
    stages: { missingNames: [], unresolvedEnemies: [], unresolvedBackgrounds: [], unresolvedCastles: [] },
    assets: { missingPairs: [] }
  };
}

export function countDiagnostics(diagnostics) {
  const out = {};
  for (const [section, value] of Object.entries(diagnostics || {})) {
    if (!value || typeof value !== 'object') continue;
    out[section] = {};
    for (const [key, list] of Object.entries(value)) {
      out[section][key] = Array.isArray(list) ? list.length : 0;
    }
  }
  return out;
}
