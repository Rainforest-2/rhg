#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, extname, join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const DEFAULT_CHECK_LIMIT = 5;
const ALL_CHECK_LIMIT = 32;

const COMMON_CHECK_RE = /node (scripts\/check-[^\s`]+\.mjs)/g;
const CODE_EXTENSIONS = new Set(['.js', '.mjs']);
const STOP_TERMS = new Set([
  'agent',
  'agents',
  'probe',
  'context',
  'find',
  'checks',
  'check',
  'changed',
  'run',
  'script',
  'scripts',
  'package',
  'readme',
  'gitignore',
  'docs'
]);
const AGENT_UNTRACKED_FILES = [
  'scripts/agent-checks.mjs',
  'scripts/agent-changed.mjs',
  'scripts/agent-context.mjs',
  'scripts/agent-find.mjs',
  'scripts/agent-probe.mjs',
  'scripts/agent-run.mjs'
];
const CHANGED_PATHS = ['.gitignore', 'AGENTS.md', 'README.md', 'package.json', 'js', 'scripts', 'tests', 'docs'];

const TOPIC_HINTS = new Map([
  ['cannon', ['cannon', 'cat-cannon', 'non-basic-cat-cannon']],
  ['summon', ['summon', 'summon-procobject']],
  ['spirit', ['spirit']],
  ['zombie', ['zombie', 'revive', 'soulstrike']],
  ['shield', ['shield', 'barrier', 'demon-shield']],
  ['delay', ['delay', 'button-delay']],
  ['wallet', ['wallet', 'talent-info', 'stage-runtime-wiring']],
  ['storage', ['storage', 'formation-storage']],
  ['trait', ['trait', 'targetforms']],
  ['combo', ['combo', 'modifier', 'talent', 'orb', 'treasure', 'pcoin']],
  ['stage', ['stage']],
  ['asset', ['asset', 'bundle', 'zip', 'semantic']],
  ['sound', ['sound', 'music', 'audio']],
  ['render', ['render', 'renderer', 'visual']]
]);

function usage() {
  return [
    'Usage: node scripts/agent-checks.mjs [--topic words] [--file path ...] [--changed] [--untracked] [--json] [--run] [--all]',
    '',
    'Suggests focused verification commands without running them.',
    'Examples:',
    '  node scripts/agent-checks.mjs --topic cannon',
    '  node scripts/agent-checks.mjs --file js/battle/BattleSceneBcuSummonPatch.js',
    '  node scripts/agent-checks.mjs --topic storage --file js/battle/FormationStore.js',
    '  node scripts/agent-checks.mjs --topic summon --run',
    '  node scripts/agent-checks.mjs --changed --run'
  ].join('\n');
}

function parseArgs(argv) {
  const out = { topic: '', files: [], json: false, run: false, all: false, changed: false, untracked: false };
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
    if (arg === '--run') {
      out.run = true;
      continue;
    }
    if (arg === '--all') {
      out.all = true;
      continue;
    }
    if (arg === '--changed') {
      out.changed = true;
      continue;
    }
    if (arg === '--untracked') {
      out.untracked = true;
      continue;
    }
    if (arg === '--topic') {
      out.topic = [out.topic, argv[i + 1] || ''].filter(Boolean).join(' ');
      i += 1;
      continue;
    }
    if (arg === '--file') {
      out.files.push(argv[i + 1] || '');
      i += 1;
      continue;
    }
    if (existsSync(join(ROOT, arg))) out.files.push(arg);
    else out.topic = [out.topic, arg].filter(Boolean).join(' ');
  }
  if (out.changed) out.files.push(...changedFiles(out.untracked));
  out.files = [...new Set(out.files.filter(Boolean))];
  out.terms = buildTerms(out.topic, out.files);
  return out;
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

function changedFiles(includeUntracked = false) {
  const tracked = gitLines(['diff', '--name-only', '--diff-filter=ACMR', '--', ...CHANGED_PATHS]);
  const staged = gitLines(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '--', ...CHANGED_PATHS]);
  const untracked = includeUntracked
    ? gitLines(['ls-files', '--others', '--exclude-standard'])
    : AGENT_UNTRACKED_FILES.filter((file) => existsSync(join(ROOT, file)));
  return [...new Set([...tracked, ...staged, ...untracked])]
    .filter((file) => existsSync(join(ROOT, file)))
    .filter((file) => !/^__probe.*\.mjs$/.test(file))
    .filter((file) => !/^scratch[-_].*/.test(file))
    .filter((file) => !file.startsWith('tmp/') && !file.startsWith('dist/') && !file.startsWith('node_modules/'));
}

function splitTerms(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9_/-]+/i)
    .flatMap((term) => term.split(/[-_/]+/))
    .map((term) => term.trim())
    .filter((term) => term.length > 1 && !STOP_TERMS.has(term));
}

function buildTerms(topic, files) {
  const terms = new Set(splitTerms(topic));
  for (const file of files) {
    for (const term of splitTerms(basename(file, extname(file)))) terms.add(term);
  }
  for (const term of [...terms]) {
    for (const hint of TOPIC_HINTS.get(term) || []) {
      for (const expanded of splitTerms(hint)) terms.add(expanded);
    }
  }
  return [...terms];
}

function readIfExists(path) {
  const full = join(ROOT, path);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

function checkScripts() {
  return readdirSync(join(ROOT, 'scripts'))
    .filter((name) => /^check-.*\.mjs$/.test(name))
    .map((name) => `scripts/${name}`)
    .sort();
}

function commonChecks() {
  const text = readIfExists('AGENTS.md');
  return [...text.matchAll(COMMON_CHECK_RE)].map((match) => match[1]);
}

function count(text, term) {
  let total = 0;
  let offset = 0;
  while (term && offset < text.length) {
    const found = text.indexOf(term, offset);
    if (found === -1) break;
    total += 1;
    offset = found + term.length;
  }
  return total;
}

function scoreCheck(path, terms, files) {
  const lowerPath = path.toLowerCase();
  const text = readIfExists(path).toLowerCase();
  let score = 0;
  for (const term of terms) {
    score += count(lowerPath, term) * 50;
    score += Math.min(count(text, term), 1);
  }
  for (const file of files) {
    const base = basename(file, extname(file)).toLowerCase();
    score += count(text, base) * 10;
  }
  return score;
}

function nodeCheckCommands(files) {
  return files
    .filter((file) => CODE_EXTENSIONS.has(extname(file)))
    .filter((file) => {
      try {
        return statSync(join(ROOT, file)).isFile();
      } catch {
        return false;
      }
    })
    .map((file) => `node --check ${file}`);
}

function suggestedChecks(opts) {
  if (!opts.terms.length && opts.files.length) return [];
  if (!opts.terms.length && !opts.files.length) return commonChecks();
  const ranked = checkScripts()
    .map((path) => ({ path, score: scoreCheck(path, opts.terms, opts.files) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
  const focused = !opts.all && ranked.some((item) => item.score >= 50)
    ? ranked.filter((item) => item.score >= 50)
    : ranked;
  const rankedPaths = focused.map((item) => item.path);
  const common = commonChecks().filter((path) => opts.terms.some((term) => path.toLowerCase().includes(term)));
  return [...new Set([...rankedPaths, ...common])].slice(0, opts.all ? ALL_CHECK_LIMIT : DEFAULT_CHECK_LIMIT);
}

function buildPlan(opts) {
  const commands = [];
  commands.push(...nodeCheckCommands(opts.files));
  for (const check of suggestedChecks(opts)) commands.push(`node ${check}`);
  if (opts.files.some((file) => file.endsWith('.md')) && !opts.files.some((file) => CODE_EXTENSIONS.has(extname(file)))) {
    commands.push('node scripts/agent-context.mjs');
  }
  return {
    topic: opts.topic || null,
    files: opts.files,
    changed: opts.changed,
    terms: opts.terms,
    commands: [...new Set(commands)].slice(0, opts.all ? ALL_CHECK_LIMIT : DEFAULT_CHECK_LIMIT + opts.files.length),
    note: 'Run only commands relevant to the actual touched subsystem; this planner is a shortcut, not proof of parity.'
  };
}

function printPlan(plan) {
  console.log('# Agent Check Plan');
  if (plan.topic) console.log(`Topic: ${plan.topic}`);
  if (plan.files.length) {
    console.log('\n## Changed/input files');
    for (const file of plan.files) console.log(`- ${file}`);
  }
  console.log('\n## Suggested commands');
  if (!plan.commands.length) {
    console.log('- none matched; use focused checks under scripts/check-*.mjs');
  } else {
    for (const command of plan.commands) console.log(`- ${command}`);
  }
  console.log(`\nNote: ${plan.note}`);
}

function runCommand(command) {
  const [cmd, ...args] = command.split(/\s+/);
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  return {
    command,
    status: result.status ?? 1,
    signal: result.signal || null,
    tail: output.split(/\r?\n/).slice(-20).join('\n')
  };
}

function runPlan(plan) {
  const results = [];
  for (const command of plan.commands) {
    console.log(`\n$ ${command}`);
    const result = runCommand(command);
    results.push(result);
    if (result.status !== 0) {
      if (result.tail) console.log(result.tail);
      console.error(`FAILED: ${command}`);
      return { ok: false, results };
    }
    const okLine = result.tail.split(/\r?\n/).filter(Boolean).slice(-1)[0] || 'OK';
    console.log(`OK: ${okLine}`);
  }
  return { ok: true, results };
}

const opts = parseArgs(process.argv.slice(2));
const plan = buildPlan(opts);
if (opts.run) {
  printPlan(plan);
  const result = runPlan(plan);
  if (!result.ok) process.exit(1);
  console.log('\nagent-checks: OK');
} else if (opts.json) console.log(JSON.stringify(plan, null, 2));
else printPlan(plan);
