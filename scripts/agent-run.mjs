#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('../', import.meta.url).pathname;

function usage() {
  return [
    'Usage: node scripts/agent-run.mjs [--tail n] [--keep-going] [--json] [command ...]',
    '',
    'Runs command lines with compact output. With no command args, reads one command per stdin line.',
    'Examples:',
    '  node scripts/agent-run.mjs "node --check scripts/agent-probe.mjs"',
    '  printf "%s\\n" "node --check scripts/agent-checks.mjs" "node scripts/agent-checks.mjs --changed" | node scripts/agent-run.mjs'
  ].join('\n');
}

function parseArgs(argv) {
  const out = { commands: [], tail: 12, keepGoing: false, json: false };
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
    if (arg === '--keep-going') {
      out.keepGoing = true;
      continue;
    }
    if (arg === '--tail') {
      out.tail = Number.parseInt(argv[i + 1] || '', 10) || out.tail;
      i += 1;
      continue;
    }
    out.commands.push(arg);
  }
  if (!out.commands.length && !process.stdin.isTTY) {
    out.commands = readFileSync(0, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
  }
  out.tail = Math.max(1, Math.min(out.tail, 80));
  return out;
}

function tail(text, lines) {
  return String(text || '').trim().split(/\r?\n/).filter(Boolean).slice(-lines).join('\n');
}

function run(command, tailLines) {
  const result = spawnSync(command, {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 12
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  return {
    command,
    status: result.status ?? 1,
    signal: result.signal || null,
    tail: tail(output, tailLines)
  };
}

function printResult(result) {
  console.log(`\n$ ${result.command}`);
  if (result.status === 0) {
    const line = result.tail.split(/\r?\n/).filter(Boolean).slice(-1)[0] || 'OK';
    console.log(`OK: ${line}`);
    return;
  }
  if (result.tail) console.log(result.tail);
  console.log(`FAIL: exit ${result.status}${result.signal ? ` signal ${result.signal}` : ''}`);
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.commands.length) {
  console.error(usage());
  process.exit(1);
}

const results = [];
let failed = false;
for (const command of opts.commands) {
  const result = run(command, opts.tail);
  results.push(result);
  if (!opts.json) printResult(result);
  if (result.status !== 0) {
    failed = true;
    if (!opts.keepGoing) break;
  }
}

if (opts.json) console.log(JSON.stringify({ ok: !failed, results }, null, 2));
else console.log(`\nagent-run: ${failed ? 'FAIL' : 'OK'}`);
if (failed) process.exit(1);
