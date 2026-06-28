#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);

const DOCS = {
  agents: 'AGENTS.md',
  readme: 'README.md',
  migration: 'docs/bcu-migration-status.md',
  status: 'docs/ability-logic/current-ability-parity-status.md',
  blockers: 'docs/ability-logic/bcu-unresolved-evidence-blockers.md',
  visual: 'docs/ability-logic/bcu-visual-review-checklist.md',
  evidence: 'docs/ability-logic/bcu-ability-source-evidence.md',
  workplan: 'docs/ability-logic/bcu-parity-codex-workplan.md',
  procedure: 'docs/ability-logic/bcu-fact-first-update-procedure.md',
  agentReadme: 'docs/agent/README.md'
};

const OPEN_STATUS_RE = /human-visual-review-needed|partial|unconfirmed|negative-evidence|out-of-scope|blocked|not-reviewed|mismatch|logic-only/i;
const MAX_CELL_CHARS = 260;

function usage() {
  return [
    'Usage: node scripts/agent-context.mjs [--topic words] [--all] [--json]',
    '',
    'Prints a compact, generated orientation view from current BCU parity docs.',
    'Examples:',
    '  node scripts/agent-context.mjs',
    '  node scripts/agent-context.mjs --topic "cannon visual"',
    '  node scripts/agent-context.mjs --all --json'
  ].join('\n');
}

function parseArgs(argv) {
  const out = { all: false, json: false, topic: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--all') {
      out.all = true;
      continue;
    }
    if (arg === '--json') {
      out.json = true;
      continue;
    }
    if (arg === '--topic') {
      out.topic = argv[i + 1] || '';
      i += 1;
      continue;
    }
    out.topic = [out.topic, arg].filter(Boolean).join(' ');
  }
  out.terms = normalizeTerms(out.topic);
  return out;
}

function normalizeTerms(input) {
  return String(input || '')
    .toLowerCase()
    .split(/[^a-z0-9_/-]+/i)
    .map((term) => term.trim())
    .filter(Boolean);
}

function readProjectFile(path) {
  return readFileSync(new URL(path, ROOT), 'utf8');
}

function parseCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function isTableLine(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isSeparator(line) {
  return /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line);
}

function parseTables(path) {
  const lines = readProjectFile(path).split(/\r?\n/);
  const rows = [];
  let section = '';
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const heading = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (heading) section = heading[2].replace(/`/g, '');
    if (!isTableLine(line) || !isSeparator(lines[i + 1] || '')) continue;

    const headers = parseCells(line);
    let cursor = i + 2;
    while (cursor < lines.length && isTableLine(lines[cursor])) {
      if (!isSeparator(lines[cursor])) {
        const cells = parseCells(lines[cursor]);
        const byHeader = Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
        rows.push({
          source: path,
          line: cursor + 1,
          section,
          headers,
          cells,
          byHeader,
          text: cells.join(' | ')
        });
      }
      cursor += 1;
    }
    i = cursor - 1;
  }
  return rows;
}

function extractReadFirst() {
  const lines = readProjectFile(DOCS.agents).split(/\r?\n/);
  const docs = [];
  let active = false;
  for (const line of lines) {
    if (line.startsWith('## Read first')) {
      active = true;
      continue;
    }
    if (active && line.startsWith('## ')) break;
    const match = /^\d+\.\s+`?([^`]+?)`?\s*$/.exec(line.trim());
    if (match) docs.push(match[1]);
  }
  return docs;
}

function extractWorkflow() {
  const text = readProjectFile(DOCS.agents);
  const match = /```text\n(BCU fact -> current JS owner audit -> minimal change -> deterministic check -> focused docs update)\n```/.exec(text);
  return match?.[1] || 'BCU fact -> current JS owner audit -> minimal change -> deterministic check -> focused docs update';
}

function rowMatches(row, terms) {
  if (!terms.length) return true;
  const haystack = `${row.source} ${row.section} ${row.text}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function openRow(row, opts) {
  if (opts.all) return true;
  return OPEN_STATUS_RE.test(row.text);
}

function cleanCell(text) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= MAX_CELL_CHARS) return cleaned;
  return `${cleaned.slice(0, MAX_CELL_CHARS - 1).trimEnd()}...`;
}

function compactRow(row, preferredHeaders) {
  const parts = [];
  for (const header of preferredHeaders) {
    const value = row.byHeader[header];
    if (value) parts.push(cleanCell(value));
  }
  if (!parts.length) parts.push(cleanCell(row.text));
  return {
    source: `${row.source}:${row.line}`,
    section: row.section,
    text: parts.join(' - ')
  };
}

function limitRows(rows, limit) {
  if (rows.length <= limit) return rows;
  return [
    ...rows.slice(0, limit),
    { source: '', section: '', text: `... ${rows.length - limit} more; rerun with --topic or --all as needed.` }
  ];
}

function getCheckScripts(terms) {
  const names = readdirSync(new URL('scripts/', ROOT))
    .filter((name) => /^check-.*\.mjs$/.test(name))
    .sort();
  if (!terms.length) {
    const agents = readProjectFile(DOCS.agents);
    return [...agents.matchAll(/node (scripts\/check-[^\s`]+\.mjs)/g)].map((match) => match[1]);
  }
  return names
    .map((name) => `scripts/${name}`)
    .filter((name) => terms.some((term) => name.toLowerCase().includes(term)));
}

function buildContext(opts) {
  const statusRows = parseTables(DOCS.status)
    .filter((row) => row.section === 'Current runtime coverage' || row.section === 'Remaining non-complete areas')
    .filter((row) => openRow(row, opts))
    .filter((row) => rowMatches(row, opts.terms))
    .map((row) => compactRow(row, ['Area', 'Status', 'Current evidence boundary', 'Current boundary', 'Safe next step']));

  const blockerRows = parseTables(DOCS.blockers)
    .filter((row) => row.section === 'Active blockers' || row.section === 'Manual-only acceptance blockers')
    .filter((row) => rowMatches(row, opts.terms))
    .map((row) => compactRow(row, ['Severity', 'Area', 'Current blocker', 'Required next step']));

  const visualRows = parseTables(DOCS.visual)
    .filter((row) => openRow(row, opts))
    .filter((row) => rowMatches(row, opts.terms))
    .map((row) => compactRow(row, ['Area', 'Current parity status', 'Result', 'Minimum review fixture']));

  const evidenceRows = parseTables(DOCS.evidence)
    .filter((row) => rowMatches(row, opts.terms))
    .slice(0, opts.terms.length ? 12 : 0)
    .map((row) => compactRow(row, ['Area', 'BCU source owner / holder', 'Current rhg boundary']));

  return {
    generatedFrom: Object.values(DOCS),
    workflow: extractWorkflow(),
    readFirst: extractReadFirst(),
    statusRows: limitRows(statusRows, opts.terms.length ? 20 : 14),
    blockerRows: limitRows(blockerRows, opts.terms.length ? 20 : 12),
    visualRows: limitRows(visualRows, opts.terms.length ? 20 : 12),
    evidenceRows,
    checks: getCheckScripts(opts.terms).slice(0, opts.terms.length ? 30 : 18),
    topic: opts.topic || null
  };
}

function printSection(title, rows) {
  console.log(`\n## ${title}`);
  if (!rows.length) {
    console.log('- none matched');
    return;
  }
  for (const row of rows) {
    const source = row.source ? ` (${row.source})` : '';
    console.log(`- ${row.text}${source}`);
  }
}

function printMarkdown(context) {
  console.log('# Agent Context Snapshot');
  if (context.topic) console.log(`Topic: ${context.topic}`);
  console.log(`Workflow: ${context.workflow}`);
  console.log('\n## Current docs');
  for (const doc of context.readFirst) console.log(`- ${doc}`);
  printSection('Open status rows', context.statusRows);
  printSection('Active blockers', context.blockerRows);
  printSection('Visual review queue', context.visualRows);
  if (context.evidenceRows.length) printSection('Topic evidence rows', context.evidenceRows);
  console.log('\n## Candidate checks');
  for (const check of context.checks) console.log(`- node ${check}`);
  console.log('\nNote: this generated view is an orientation shortcut only; behavior changes still require the source docs and focused checks.');
}

const opts = parseArgs(process.argv.slice(2));
const context = buildContext(opts);
if (opts.json) {
  console.log(JSON.stringify(context, null, 2));
} else {
  printMarkdown(context);
}
