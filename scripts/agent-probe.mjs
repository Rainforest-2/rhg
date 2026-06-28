#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { inspect } from 'node:util';

const ROOT = new URL('../', import.meta.url);

function usage() {
  return [
    'Usage: node scripts/agent-probe.mjs [--expr js] [--import alias=path] [--quiet]',
    '',
    'Runs small disposable probes without creating temporary test files.',
    'Injected globals: assert, importProject(path), readProject(path), jsonProject(path), raw(length, entries), log(value), projectUrl(path).',
    'Examples:',
    "  node scripts/agent-probe.mjs --expr \"const m = await importProject('js/battle/ProcResolver.js'); assert.ok(m.ProcResolver)\"",
    '  printf "%s\\n" "assert.equal(1 + 1, 2)" | node scripts/agent-probe.mjs --quiet',
    '  node scripts/agent-probe.mjs --import cm=js/battle/BcuCombatModel.js --expr "assert.ok(cm.BcuCombatModel)"'
  ].join('\n');
}

function parseArgs(argv) {
  const opts = { expr: '', imports: [], quiet: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--quiet') {
      opts.quiet = true;
      continue;
    }
    if (arg === '--expr' || arg === '-e') {
      opts.expr = [opts.expr, argv[i + 1] || ''].filter(Boolean).join('\n');
      i += 1;
      continue;
    }
    if (arg === '--import') {
      opts.imports.push(argv[i + 1] || '');
      i += 1;
      continue;
    }
    opts.expr = [opts.expr, arg].filter(Boolean).join('\n');
  }
  if (!opts.expr && !process.stdin.isTTY) {
    opts.expr = readFileSync(0, 'utf8');
  }
  return opts;
}

function projectUrl(path) {
  return new URL(path, ROOT).href;
}

async function importProject(path) {
  return import(projectUrl(path));
}

function readProject(path) {
  return readFileSync(new URL(path, ROOT), 'utf8');
}

function jsonProject(path) {
  return JSON.parse(readProject(path));
}

function raw(length, entries = []) {
  const out = Array.from({ length }, () => 0);
  for (const [index, value] of entries) out[index] = value;
  return out;
}

async function loadImports(imports) {
  const entries = [];
  for (const spec of imports) {
    const [alias, path] = spec.split('=');
    if (!alias || !path || !/^[A-Za-z_$][\w$]*$/.test(alias)) {
      throw new Error(`Bad --import value: ${spec}. Expected alias=path.`);
    }
    entries.push([alias, await importProject(path)]);
  }
  return Object.fromEntries(entries);
}

function log(value) {
  if (typeof value === 'string') {
    console.log(value);
    return value;
  }
  console.log(inspect(value, { depth: 4, colors: false, maxArrayLength: 20 }));
  return value;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.expr.trim()) {
    console.error(usage());
    process.exit(1);
  }

  const imported = await loadImports(opts.imports);
  const names = [
    'assert',
    'importProject',
    'readProject',
    'jsonProject',
    'raw',
    'projectUrl',
    'log',
    'ROOT',
    'resolve',
    'pathToFileURL',
    ...Object.keys(imported)
  ];
  const values = [
    assert,
    importProject,
    readProject,
    jsonProject,
    raw,
    projectUrl,
    log,
    ROOT,
    resolve,
    pathToFileURL,
    ...Object.values(imported)
  ];
  const body = `"use strict";\n${opts.expr}\n`;
  const fn = new Function(...names, `return (async () => {\n${body}\n})();`);
  await fn(...values);
  if (!opts.quiet) console.log('agent-probe: OK');
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
