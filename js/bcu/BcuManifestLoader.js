import { toFetchPath } from './BcuPathResolver.js';
import { assertRuntimeUrlAllowed } from './RuntimeAssetGuard.js';

async function importNode(specifier) {
  return await Function('specifier', 'return import(specifier)')(specifier);
}

export async function readText(path) {
  const fetchPath = toFetchPath(path);
  if (typeof window !== 'undefined') assertRuntimeUrlAllowed(fetchPath, 'BcuManifestLoader.readText', globalThis.__BCU_DB__?.semanticProvider || null);
  if (typeof window === 'undefined') {
    const { readFile } = await importNode('node:fs/promises');
    const { fileURLToPath, pathToFileURL } = await importNode('node:url');
    const cwdBase = pathToFileURL(`${process.cwd().replace(/\\/g, '/')}/`);
    return await readFile(fileURLToPath(new URL(fetchPath, cwdBase)), 'utf8');
  }
  const response = await fetch(fetchPath);
  if (!response.ok) throw new Error(`Failed to fetch ${fetchPath}: ${response.status}`);
  return await response.text();
}

export class BcuManifestLoader {
  static async load({ manifestPath = './public/assets/bcu-manifest.json', mode = 'raw-only-diagnostics' } = {}) {
    if (mode !== 'raw-only-diagnostics' && /public\/assets\/bcu-manifest\.json/.test(String(manifestPath))) {
      throw new Error('Raw BCU manifest is not allowed outside raw-only-diagnostics mode');
    }
    return JSON.parse(await readText(manifestPath));
  }
}
