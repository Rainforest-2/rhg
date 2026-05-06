
const NODE_BUILTIN_PATTERN = new RegExp(['node'+':fs','node'+':path','fs'+'/promises',"from\\s+['\"]fs['\"]","from\\s+['\"]path['\"]"].join('|'));

async function readText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return await res.text();
}

export async function verifyNoNodeBuiltinsInBrowserModules() {
  const { readdir, readFile } = await import('node'+':fs'+'/promises');
  const { join } = await import('node'+':path');
  const errors = [];
  async function walk(dir) {
    for (const ent of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) await walk(full);
      if (!ent.isFile() || !ent.name.endsWith('.js')) continue;
      const t = await readFile(full, 'utf8');
      if (NODE_BUILTIN_PATTERN.test(t)) errors.push(full);
    }
  }
  await walk('js');
  return { ok: errors.length === 0, errors };
}

export async function verifyPreviewAppModuleBoots() {
  const errors = [];
  try { const mod = await import('../preview/PreviewApp.js'); if (!mod?.PreviewApp) errors.push('PreviewApp export missing'); } catch (e) { errors.push(String(e?.message || e)); }
  return { ok: errors.length === 0, errors };
}

export async function verifyBattleSceneImportIsBrowserSafe() {
  const errors = [];
  try { await import('../battle/BattleScene.js'); } catch (e) { errors.push(String(e?.message || e)); }
  const src = await (await import('node'+':fs'+'/promises')).readFile(new URL('../battle/BattleScene.js', import.meta.url), 'utf8');
  if (NODE_BUILTIN_PATTERN.test(src)) errors.push('BattleScene.js contains node builtin import');
  return { ok: errors.length === 0, errors };
}

export async function verifyStageDefinitionLoaderIsBrowserSafe() {
  const errors = [];
  try {
    const mod = await import('../battle/StageDefinitionLoader.js');
    const loader = new mod.StageDefinitionLoader(() => {});
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 404, text: async () => '' });
    const r = await loader.load({ stageCsvPath: './missing.csv' });
    if (r?.ok !== false || r?.runtime !== null) errors.push('load() must fallback without throw on fetch failure');
    globalThis.fetch = originalFetch;
  } catch (e) { errors.push(String(e?.message || e)); }
  return { ok: errors.length === 0, errors };
}
