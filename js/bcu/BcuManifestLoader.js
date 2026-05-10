import { toFetchPath } from './BcuPathResolver.js';

export async function readText(path) {
  const fetchPath = toFetchPath(path);
  if (typeof window === 'undefined') {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath, pathToFileURL } = await import('node:url');
    const cwdBase = pathToFileURL(`${process.cwd().replace(/\\/g, '/')}/`);
    return await readFile(fileURLToPath(new URL(fetchPath, cwdBase)), 'utf8');
  }
  const response = await fetch(fetchPath);
  if (!response.ok) throw new Error(`Failed to fetch ${fetchPath}: ${response.status}`);
  return await response.text();
}

export class BcuManifestLoader {
  static async load({ manifestPath = './public/assets/bcu-manifest.json' } = {}) {
    return JSON.parse(await readText(manifestPath));
  }
}
