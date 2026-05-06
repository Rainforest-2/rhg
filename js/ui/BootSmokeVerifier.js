import { readFile } from 'node:fs/promises';

const PREVIEW_APP_PATH = new URL('../preview/PreviewApp.js', import.meta.url);
const MAIN_ENTRY_PATH = new URL('../main.js', import.meta.url);

export async function verifyPreviewAppModuleBoots() {
  const errors = [];
  try {
    const mod = await import(PREVIEW_APP_PATH);
    if (typeof mod.PreviewApp !== 'function') {
      errors.push('PreviewApp export is missing or not a function/class.');
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      errors.push(`SyntaxError while importing PreviewApp.js: ${error.message}`);
    } else {
      errors.push(`Import failed for PreviewApp.js: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export async function verifyMainEntryImportsPreviewApp() {
  const errors = [];
  let source = '';
  try {
    source = await readFile(MAIN_ENTRY_PATH, 'utf8');
  } catch (error) {
    return { ok: false, errors: [`Unable to read js/main.js: ${error instanceof Error ? error.message : String(error)}`] };
  }

  const importRegex = /import\s*\{[^}]*\bPreviewApp\b[^}]*\}\s*from\s*['"]([^'"]+)['"]/m;
  const match = source.match(importRegex);
  if (!match) {
    errors.push('js/main.js does not import PreviewApp.');
  } else {
    const specifier = match[1];
    if (/mode|legacy/i.test(specifier)) {
      errors.push(`js/main.js references old mode-style entry: ${specifier}`);
    }
    try {
      await import(new URL(specifier, MAIN_ENTRY_PATH));
    } catch (error) {
      errors.push(`main.js PreviewApp import target failed to resolve/import: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export async function verifyNoDuplicateTopLevelHelpers() {
  const errors = [];
  let source = '';
  try {
    source = await readFile(PREVIEW_APP_PATH, 'utf8');
  } catch (error) {
    return { ok: false, errors: [`Unable to read PreviewApp.js: ${error instanceof Error ? error.message : String(error)}`] };
  }

  const matches = source.match(/^function\s+nextFrame\s*\(/gm) ?? [];
  if (matches.length !== 1) {
    errors.push(`Expected exactly one top-level nextFrame helper, found ${matches.length}.`);
  }

  return { ok: errors.length === 0, errors };
}
