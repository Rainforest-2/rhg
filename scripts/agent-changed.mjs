#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { extname, join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const CHANGED_PATHS = ['.gitignore', 'AGENTS.md', 'README.md', 'package.json', 'js', 'scripts', 'tests', 'docs'];
const AGENT_UNTRACKED_FILES = [
  'scripts/agent-checks.mjs',
  'scripts/agent-changed.mjs',
  'scripts/agent-context.mjs',
  'scripts/agent-find.mjs',
  'scripts/agent-probe.mjs',
  'scripts/agent-run.mjs'
];

function usage() {
  return [
    'Usage: node scripts/agent-changed.mjs [--untracked] [--json]',
    '',
    'Prints a compact changed-file summary without full git status.'
  ].join('\n');
}

function parseArgs(argv) {
  const opts = { untracked: false, json: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--untracked') opts.untracked = true;
    else if (arg === '--json') opts.json = true;
  }
  return opts;
}

function gitLines(args) {
  const result = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 1024 * 1024
  });
  if (result.status !== 0) return [];
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function changedFiles(includeUntracked) {
  const tracked = gitLines(['diff', '--name-only', '--diff-filter=ACMR', '--', ...CHANGED_PATHS]);
  const staged = gitLines(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '--', ...CHANGED_PATHS]);
  const untracked = includeUntracked
    ? gitLines(['ls-files', '--others', '--exclude-standard'])
    : AGENT_UNTRACKED_FILES.filter((file) => existsSync(join(ROOT, file)));
  return [...new Set([...tracked, ...staged, ...untracked])]
    .filter((file) => existsSync(join(ROOT, file)))
    .filter((file) => !/^__probe.*\.mjs$/.test(file))
    .filter((file) => !/^scratch[-_].*/.test(file))
    .filter((file) => !file.startsWith('tmp/') && !file.startsWith('dist/') && !file.startsWith('node_modules/'))
    .sort();
}

function group(file) {
  if (file.startsWith('js/')) return 'code';
  if (file.startsWith('tests/')) return 'tests';
  if (file.endsWith('.md') || file === 'AGENTS.md' || file === 'README.md') return 'docs';
  if (file.startsWith('scripts/') || file === 'package.json' || file === '.gitignore') return 'tooling';
  if (/\.(zip|png|jpg|jpeg|webp|gif|mp3|ogg)$/i.test(file)) return 'generated/assets';
  if (['.js', '.mjs'].includes(extname(file))) return 'code';
  return 'other';
}

function build(opts) {
  const files = changedFiles(opts.untracked);
  const groups = {};
  for (const file of files) {
    const key = group(file);
    if (!groups[key]) groups[key] = [];
    groups[key].push(file);
  }
  return { files, groups };
}

function print(summary) {
  console.log('# Agent Changed Files');
  if (!summary.files.length) {
    console.log('- none');
    return;
  }
  for (const [name, files] of Object.entries(summary.groups)) {
    console.log(`\n## ${name}`);
    for (const file of files) console.log(`- ${file}`);
  }
}

const opts = parseArgs(process.argv.slice(2));
const summary = build(opts);
if (opts.json) console.log(JSON.stringify(summary, null, 2));
else print(summary);
