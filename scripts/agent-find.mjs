#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const DEFAULT_LIMIT = 8;
const DEFAULT_SNIPPETS = 2;
const MAX_SNIPPET_CHARS = 180;

const GROUPS = {
  code: ['js'],
  checks: ['scripts'],
  tests: ['tests'],
  docs: ['README.md', 'AGENTS.md', 'docs'],
  scripts: ['scripts']
};

const ALLOWED_EXT = new Set(['.js', '.mjs', '.md', '.json']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'tmp', 'public']);

const SYNONYMS = new Map([
  ['cannon', ['catcannon', 'nycastle', 'base_wall', 'wall']],
  ['summon', ['scdef', 'scgroup', 'setsummon']],
  ['spirit', ['imuatk', 'conjure']],
  ['zombie', ['revive', 'corpse', 'soulstrike', 'zkill']],
  ['shield', ['barrier', 'demon']],
  ['delay', ['p_delay', 'buttondelay']],
  ['wallet', ['worker', 'elineup', 'price', 'respawn']],
  ['storage', ['formationstore', 'stageregistry', 'localstorage']],
  ['trait', ['targetforms', 'targettype']],
  ['combo', ['nyancombo', 'pcoin', 'orb', 'treasure', 'talent']]
]);

function usage() {
  return [
    'Usage: node scripts/agent-find.mjs --topic words [--kind code|checks|tests|docs|scripts|all] [--limit n] [--snippets n] [--json]',
    '',
    'Ranks local files for a topic and prints compact line snippets.',
    'Examples:',
    '  node scripts/agent-find.mjs --topic "summon entry"',
    '  node scripts/agent-find.mjs cannon --kind code --limit 12',
    '  node scripts/agent-find.mjs --topic storage --json'
  ].join('\n');
}

function parseArgs(argv) {
  const out = { topic: '', kind: 'all', limit: DEFAULT_LIMIT, snippets: DEFAULT_SNIPPETS, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--json') {
      out.json = true;
      continue;
    }
    if (arg === '--kind') {
      out.kind = argv[i + 1] || 'all';
      i += 1;
      continue;
    }
    if (arg === '--limit') {
      out.limit = Number.parseInt(argv[i + 1] || '', 10) || DEFAULT_LIMIT;
      i += 1;
      continue;
    }
    if (arg === '--snippets') {
      out.snippets = Number.parseInt(argv[i + 1] || '', 10);
      i += 1;
      continue;
    }
    if (arg === '--topic') {
      out.topic = [out.topic, argv[i + 1] || ''].filter(Boolean).join(' ');
      i += 1;
      continue;
    }
    out.topic = [out.topic, arg].filter(Boolean).join(' ');
  }
  out.limit = Math.max(1, Math.min(out.limit, 40));
  out.snippets = Math.max(0, Math.min(out.snippets, 8));
  out.terms = expandTerms(out.topic);
  return out;
}

function baseTerms(input) {
  return String(input || '')
    .toLowerCase()
    .split(/[^a-z0-9_/-]+/i)
    .flatMap((term) => term.split(/[-_/]+/))
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
}

function expandTerms(input) {
  const terms = new Set(baseTerms(input));
  for (const term of [...terms]) {
    for (const extra of SYNONYMS.get(term) || []) terms.add(extra);
  }
  return [...terms];
}

function walk(entry, files = []) {
  const full = join(ROOT, entry);
  const stat = statSync(full);
  if (stat.isDirectory()) {
    if (SKIP_DIRS.has(basename(entry))) return files;
    for (const child of readdirSync(full)) walk(join(entry, child), files);
    return files;
  }
  if (stat.isFile() && ALLOWED_EXT.has(extname(entry))) files.push(entry);
  return files;
}

function kindForPath(path) {
  if (path.startsWith('js/')) return 'code';
  if (path.startsWith('tests/')) return 'tests';
  if (path.startsWith('scripts/check-')) return 'checks';
  if (path.startsWith('scripts/')) return 'scripts';
  if (path.endsWith('.md') || path === 'README.md' || path === 'AGENTS.md') return 'docs';
  return 'other';
}

function candidateFiles(kind) {
  const roots = kind === 'all'
    ? [...new Set(Object.values(GROUPS).flat())]
    : GROUPS[kind] || GROUPS.all || [];
  const files = new Set();
  for (const root of roots) {
    try {
      const full = join(ROOT, root);
      const stat = statSync(full);
      if (stat.isFile()) files.add(root);
      else for (const file of walk(root)) files.add(file);
    } catch {
      // Missing optional roots should not block the index.
    }
  }
  return [...files].sort();
}

function countOccurrences(text, term) {
  let count = 0;
  let offset = 0;
  while (term && offset < text.length) {
    const found = text.indexOf(term, offset);
    if (found === -1) break;
    count += 1;
    offset = found + term.length;
  }
  return count;
}

function trimSnippet(text) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= MAX_SNIPPET_CHARS) return cleaned;
  return `${cleaned.slice(0, MAX_SNIPPET_CHARS - 1).trimEnd()}...`;
}

function scoreFile(path, terms, snippetLimit) {
  const raw = readFileSync(join(ROOT, path), 'utf8');
  const lowerPath = path.toLowerCase();
  const lowerBase = basename(path).toLowerCase();
  const lines = raw.split(/\r?\n/);
  let score = 0;
  const snippets = [];

  for (const term of terms) {
    score += countOccurrences(lowerPath, term) * 25;
    score += countOccurrences(lowerBase, term) * 35;
  }

  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    let lineScore = 0;
    for (const term of terms) lineScore += countOccurrences(lower, term);
    if (!lineScore) return;
    score += lineScore;
    if (snippets.length < snippetLimit) {
      snippets.push({ line: index + 1, text: trimSnippet(line) });
    }
  });

  return {
    path,
    kind: kindForPath(path),
    score,
    snippets,
    size: raw.length
  };
}

function rank(opts) {
  if (!opts.terms.length) return [];
  return candidateFiles(opts.kind)
    .map((path) => scoreFile(path, opts.terms, opts.snippets))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.size - b.size || a.path.localeCompare(b.path))
    .slice(0, opts.limit);
}

function print(results, opts) {
  console.log(`# Agent File Finder`);
  console.log(`Topic: ${opts.topic}`);
  console.log(`Terms: ${opts.terms.join(', ')}`);
  if (!results.length) {
    console.log('\nNo local file matches. Try fewer terms or --kind all.');
    return;
  }
  for (const item of results) {
    console.log(`\n## ${item.path}`);
    console.log(`- kind: ${item.kind}; score: ${item.score}`);
    for (const snippet of item.snippets) {
      console.log(`- ${item.path}:${snippet.line}: ${snippet.text}`);
    }
  }
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.terms.length) {
  console.log(usage());
  process.exit(1);
}

const results = rank(opts);
if (opts.json) console.log(JSON.stringify({ topic: opts.topic, terms: opts.terms, results }, null, 2));
else print(results, opts);
