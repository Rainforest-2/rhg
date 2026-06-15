#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const BUNDLE_ROOT = 'public/assets/bundles';
const REPORT_DATE = '2026-06-14';
const UTF8_FLAG = 0x0800;
const STORE = 0;
const DEFLATE = 8;
const STORE_ONLY_RUNTIME_ZIPS = new Set([
  'public/assets/bundles/icon/enemy.zip',
  'public/assets/bundles/icon/unit-c.zip',
  'public/assets/bundles/icon/unit-f.zip',
  'public/assets/bundles/icon/unit-s.zip',
  'public/assets/bundles/icon/unit-u.zip'
]);

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
}

function readU16(buf, offset) {
  return buf.readUInt16LE(offset);
}

function readU32(buf, offset) {
  return buf.readUInt32LE(offset);
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function parseArgs(argv) {
  const args = {
    apply: false,
    report: null,
    json: null,
    zip: [],
    limit: null,
    tempVerify: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--no-temp-verify') args.tempVerify = false;
    else if (arg === '--report') args.report = argv[++i];
    else if (arg === '--json') args.json = argv[++i];
    else if (arg === '--zip') args.zip.push(argv[++i]);
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function walkZipFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const p = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) out.push(...await walkZipFiles(p));
    else if (entry.isFile() && entry.name.endsWith('.zip')) out.push(p);
  }
  return out.sort();
}

function ensureBundleZipPath(zipPath) {
  const normalized = String(zipPath || '').replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized.startsWith(`${BUNDLE_ROOT}/`) || !normalized.endsWith('.zip')) {
    throw new Error(`Refusing non-bundle ZIP path: ${zipPath}`);
  }
  return normalized;
}

function validateEntryName(name, zipPath) {
  if (!name || name.includes('\0')) throw new Error(`Invalid ZIP entry name in ${zipPath}`);
  const normalized = name.replace(/\\/g, '/');
  if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error(`Unsafe ZIP entry path in ${zipPath}: ${name}`);
  }
}

function parseZipBytes(bytes, zipPath = '<buffer>') {
  const entries = [];
  let offset = 0;

  while (offset + 30 <= bytes.length && readU32(bytes, offset) === 0x04034b50) {
    const flags = readU16(bytes, offset + 6);
    const method = readU16(bytes, offset + 8);
    const crc = readU32(bytes, offset + 14);
    const compressedSize = readU32(bytes, offset + 18);
    const uncompressedSize = readU32(bytes, offset + 22);
    const nameLen = readU16(bytes, offset + 26);
    const extraLen = readU16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const dataEnd = dataStart + compressedSize;
    if (flags & 0x0008) throw new Error(`Unsupported ZIP data descriptor flag in ${zipPath}`);
    if (dataEnd > bytes.length) throw new Error(`Truncated ZIP entry in ${zipPath}`);

    const name = bytes.subarray(nameStart, nameStart + nameLen).toString('utf8');
    validateEntryName(name, zipPath);
    const compressed = bytes.subarray(dataStart, dataEnd);
    let data;
    if (method === STORE) {
      if (compressedSize !== uncompressedSize) throw new Error(`Invalid STORE sizes for ${name} in ${zipPath}`);
      data = Buffer.from(compressed);
    } else if (method === DEFLATE) {
      data = zlib.inflateRawSync(compressed);
      if (data.length !== uncompressedSize) {
        throw new Error(`Invalid DEFLATE size for ${name} in ${zipPath}: expected ${uncompressedSize}, got ${data.length}`);
      }
    } else {
      throw new Error(`Unsupported ZIP compression method ${method} for ${name} in ${zipPath}`);
    }
    const actualCrc = crc32(data);
    if (actualCrc !== crc) throw new Error(`CRC mismatch for ${name} in ${zipPath}`);
    entries.push({ name, method, compressedSize, uncompressedSize, crc, data, isDirectory: name.endsWith('/') });
    offset = dataEnd;
  }

  if (entries.length === 0) throw new Error(`No local ZIP entries found in ${zipPath}`);
  return entries;
}

function methodSummaryFromEntries(entries) {
  const counts = new Map();
  for (const entry of entries) counts.set(entry.method, (counts.get(entry.method) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([method, count]) => `${method === STORE ? 'STORE' : method === DEFLATE ? 'DEFLATE' : `method-${method}`}=${count}`)
    .join(',');
}

function manifestFromEntries(entries) {
  return entries
    .filter((entry) => !entry.isDirectory)
    .map((entry, index) => ({
      path: entry.name,
      size: entry.data.length,
      sha256: sha256(entry.data),
      entryIndex: index
    }))
    .sort((a, b) => a.path.localeCompare(b.path) || a.entryIndex - b.entryIndex);
}

function compareManifests(original, candidate) {
  if (original.length !== candidate.length) {
    return { ok: false, reason: `file-count ${original.length} != ${candidate.length}` };
  }
  for (let i = 0; i < original.length; i += 1) {
    const a = original[i];
    const b = candidate[i];
    if (a.path !== b.path) return { ok: false, reason: `path mismatch at ${i}: ${a.path} != ${b.path}` };
    if (a.size !== b.size) return { ok: false, reason: `size mismatch for ${a.path}: ${a.size} != ${b.size}` };
    if (a.sha256 !== b.sha256) return { ok: false, reason: `sha256 mismatch for ${a.path}` };
  }
  return { ok: true, reason: 'path-size-sha256-match' };
}

function compressedPlans(entries) {
  const deflate6 = entries.map((entry) => entry.isDirectory ? null : zlib.deflateRawSync(entry.data, { level: 6 }));
  const deflate9 = entries.map((entry) => entry.isDirectory ? null : zlib.deflateRawSync(entry.data, { level: 9 }));
  return [
    {
      name: 'STORE',
      choose: () => ({ method: STORE, compressed: null })
    },
    {
      name: 'DEFLATE-level-6',
      choose: (_entry, index) => ({ method: DEFLATE, compressed: deflate6[index] })
    },
    {
      name: 'DEFLATE-level-9',
      choose: (_entry, index) => ({ method: DEFLATE, compressed: deflate9[index] })
    },
    {
      name: 'mixed-STORE-DEFLATE-level-9',
      choose: (entry, index) => {
        const compressed = deflate9[index];
        if (!compressed || compressed.length >= entry.data.length) return { method: STORE, compressed: null };
        return { method: DEFLATE, compressed };
      }
    }
  ];
}

function buildZip(entries, plan) {
  let offset = 0;
  const locals = [];
  const centrals = [];
  const methodCounts = { store: 0, deflate: 0 };

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const name = Buffer.from(entry.name, 'utf8');
    let { method, compressed } = plan.choose(entry, i);
    if (entry.isDirectory) {
      method = STORE;
      compressed = null;
    }
    const data = method === STORE ? entry.data : compressed;
    if (!data) throw new Error(`Missing compressed data for ${entry.name}`);
    if (method === STORE) methodCounts.store += 1;
    else if (method === DEFLATE) methodCounts.deflate += 1;
    else throw new Error(`Unsupported output method ${method}`);

    const localHeader = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(UTF8_FLAG),
      u16(method),
      u16(0),
      u16(0),
      u32(entry.crc),
      u32(data.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      name
    ]);
    locals.push(localHeader, data);
    centrals.push(Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(UTF8_FLAG),
      u16(method),
      u16(0),
      u16(0),
      u32(entry.crc),
      u32(data.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(entry.isDirectory ? 0x10 : 0),
      u32(offset),
      name
    ]));
    offset += localHeader.length + data.length;
  }

  const centralStart = offset;
  const central = Buffer.concat(centrals);
  const eocd = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(central.length),
    u32(centralStart),
    u16(0)
  ]);
  return {
    bytes: Buffer.concat([...locals, central, eocd]),
    methodCounts
  };
}

function duplicatePaths(entries) {
  const counts = new Map();
  for (const entry of entries) counts.set(entry.name, (counts.get(entry.name) || 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
}

function safeExtractPath(root, entryName) {
  const normalized = entryName.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.includes('..')) throw new Error(`Unsafe ZIP entry path: ${entryName}`);
  const target = path.join(root, ...parts);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Unsafe ZIP entry path: ${entryName}`);
  return target;
}

async function extractEntries(entries, dir) {
  await fs.mkdir(dir, { recursive: true });
  for (const entry of entries) {
    const target = safeExtractPath(dir, entry.name);
    if (entry.isDirectory) {
      await fs.mkdir(target, { recursive: true });
    } else {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, entry.data);
    }
  }
}

async function manifestFromDirectory(dir) {
  async function walk(current, prefix = '') {
    const dirEntries = await fs.readdir(current, { withFileTypes: true });
    const out = [];
    for (const entry of dirEntries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) out.push(...await walk(full, rel));
      else if (entry.isFile()) {
        const data = await fs.readFile(full);
        out.push({ path: rel, size: data.length, sha256: sha256(data), entryIndex: out.length });
      }
    }
    return out;
  }
  const manifest = await walk(dir);
  return manifest.sort((a, b) => a.path.localeCompare(b.path));
}

async function verifyWithTempDirs(originalEntries, candidateEntries, tempRoot, ordinal) {
  const root = path.join(tempRoot, String(ordinal).padStart(5, '0'));
  const originalDir = path.join(root, 'original');
  const candidateDir = path.join(root, 'candidate');
  await extractEntries(originalEntries, originalDir);
  await extractEntries(candidateEntries, candidateDir);
  const originalManifest = await manifestFromDirectory(originalDir);
  const candidateManifest = await manifestFromDirectory(candidateDir);
  const result = compareManifests(originalManifest, candidateManifest);
  await fs.rm(root, { recursive: true, force: true });
  return result;
}

function chooseBestCandidate(originalBytes, candidates) {
  const verified = candidates.filter((candidate) => candidate.verification.ok);
  verified.sort((a, b) => a.bytes.length - b.bytes.length || safetyRank(a.method) - safetyRank(b.method));
  const best = verified[0] || null;
  return best && best.bytes.length < originalBytes.length ? best : null;
}

function safetyRank(method) {
  if (method === 'STORE') return 0;
  if (method === 'mixed-STORE-DEFLATE-level-9') return 1;
  if (method === 'DEFLATE-level-9') return 2;
  if (method === 'DEFLATE-level-6') return 3;
  return 10;
}

async function evaluateZip(zipPath, options, tempRoot, ordinal) {
  const originalBytes = await fs.readFile(zipPath);
  const originalEntries = parseZipBytes(originalBytes, zipPath);
  const originalManifest = manifestFromEntries(originalEntries);
  const duplicates = duplicatePaths(originalEntries);
  if (duplicates.length) {
    return {
      zipPath,
      status: 'unchanged',
      reason: `duplicate ZIP entries retained as original: ${duplicates.slice(0, 3).join(', ')}`,
      originalBytes: originalBytes.length,
      newBytes: originalBytes.length,
      savedBytes: 0,
      reductionPercent: 0,
      originalMethod: methodSummaryFromEntries(originalEntries),
      selectedMethod: 'original',
      fileCount: originalManifest.length,
      verification: 'skipped-duplicate-entry-names',
      candidates: []
    };
  }
  if (STORE_ONLY_RUNTIME_ZIPS.has(zipPath)) {
    return {
      zipPath,
      status: 'unchanged',
      reason: 'aggregate icon ZIP kept STORE-only to avoid browser eager-inflate runtime cost',
      originalBytes: originalBytes.length,
      newBytes: originalBytes.length,
      savedBytes: 0,
      reductionPercent: 0,
      originalMethod: methodSummaryFromEntries(originalEntries),
      selectedMethod: 'original',
      fileCount: originalManifest.length,
      verification: 'path-size-sha256-match',
      candidates: []
    };
  }

  const candidates = [];
  for (const plan of compressedPlans(originalEntries)) {
    const built = buildZip(originalEntries, plan);
    const candidateEntries = parseZipBytes(built.bytes, `${zipPath}:${plan.name}`);
    const candidateManifest = manifestFromEntries(candidateEntries);
    const verification = compareManifests(originalManifest, candidateManifest);
    candidates.push({
      method: plan.name,
      bytes: built.bytes,
      size: built.bytes.length,
      methodCounts: built.methodCounts,
      verification
    });
  }

  const selected = chooseBestCandidate(originalBytes, candidates);
  const originalMethod = methodSummaryFromEntries(originalEntries);
  if (!selected) {
    return {
      zipPath,
      status: 'unchanged',
      reason: 'no verified candidate smaller than original',
      originalBytes: originalBytes.length,
      newBytes: originalBytes.length,
      savedBytes: 0,
      reductionPercent: 0,
      originalMethod,
      selectedMethod: 'original',
      fileCount: originalManifest.length,
      verification: candidates.every((candidate) => candidate.verification.ok) ? 'path-size-sha256-match' : 'candidate-verification-failed',
      candidates: candidates.map((candidate) => summarizeCandidate(candidate))
    };
  }

  const selectedEntries = parseZipBytes(selected.bytes, `${zipPath}:${selected.method}:selected`);
  const tempVerification = options.tempVerify
    ? await verifyWithTempDirs(originalEntries, selectedEntries, tempRoot, ordinal)
    : { ok: true, reason: 'temp-verify-disabled' };
  if (!tempVerification.ok) {
    return {
      zipPath,
      status: 'unchanged',
      reason: `selected candidate discarded: ${tempVerification.reason}`,
      originalBytes: originalBytes.length,
      newBytes: originalBytes.length,
      savedBytes: 0,
      reductionPercent: 0,
      originalMethod,
      selectedMethod: 'original',
      fileCount: originalManifest.length,
      verification: tempVerification.reason,
      candidates: candidates.map((candidate) => summarizeCandidate(candidate))
    };
  }

  if (options.apply) await fs.writeFile(zipPath, selected.bytes);
  const savedBytes = originalBytes.length - selected.bytes.length;
  return {
    zipPath,
    status: options.apply ? 'changed' : 'would-change',
    reason: options.apply ? 'verified smaller ZIP adopted' : 'verified smaller ZIP available',
    originalBytes: originalBytes.length,
    newBytes: selected.bytes.length,
    savedBytes,
    reductionPercent: Number(((savedBytes / originalBytes.length) * 100).toFixed(4)),
    originalMethod,
    selectedMethod: selected.method,
    selectedMethodCounts: selected.methodCounts,
    fileCount: originalManifest.length,
    verification: tempVerification.ok ? 'path-size-sha256-match' : tempVerification.reason,
    candidates: candidates.map((candidate) => summarizeCandidate(candidate))
  };
}

function summarizeCandidate(candidate) {
  return {
    method: candidate.method,
    size: candidate.size,
    methodCounts: candidate.methodCounts,
    verification: candidate.verification.ok ? 'path-size-sha256-match' : candidate.verification.reason
  };
}

function categoryFor(zipPath) {
  return path.dirname(zipPath.replace(`${BUNDLE_ROOT}/`, ''));
}

function summarize(results) {
  const totalOriginal = results.reduce((sum, r) => sum + r.originalBytes, 0);
  const totalNew = results.reduce((sum, r) => sum + r.newBytes, 0);
  const totalSaved = totalOriginal - totalNew;
  const byStatus = {};
  const byCategory = {};
  for (const result of results) {
    byStatus[result.status] = (byStatus[result.status] || 0) + 1;
    const cat = categoryFor(result.zipPath);
    byCategory[cat] ||= { count: 0, changed: 0, originalBytes: 0, newBytes: 0, savedBytes: 0 };
    byCategory[cat].count += 1;
    if (result.status === 'changed' || result.status === 'would-change') byCategory[cat].changed += 1;
    byCategory[cat].originalBytes += result.originalBytes;
    byCategory[cat].newBytes += result.newBytes;
    byCategory[cat].savedBytes += result.savedBytes;
  }
  return {
    totalZipCount: results.length,
    totalOriginalBytes: totalOriginal,
    totalNewBytes: totalNew,
    totalSavedBytes: totalSaved,
    totalReductionPercent: totalOriginal ? Number(((totalSaved / totalOriginal) * 100).toFixed(4)) : 0,
    byStatus,
    byCategory
  };
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|');
}

function formatMethodCounts(counts) {
  if (!counts) return '';
  const parts = [];
  if (counts.store) parts.push(`STORE=${counts.store}`);
  if (counts.deflate) parts.push(`DEFLATE=${counts.deflate}`);
  return parts.join(',');
}

function makeMarkdownReport(results, summary, options) {
  const categoryRows = Object.entries(summary.byCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, item]) => `| ${escapeCell(category)} | ${item.count} | ${item.changed} | ${item.originalBytes} | ${item.newBytes} | ${item.savedBytes} | ${item.originalBytes ? ((item.savedBytes / item.originalBytes) * 100).toFixed(4) : '0.0000'}% |`)
    .join('\n');

  const zipRows = results
    .map((r) => `| ${escapeCell(r.zipPath)} | ${r.originalBytes} | ${r.newBytes} | ${r.savedBytes} | ${r.reductionPercent.toFixed(4)}% | ${escapeCell(r.originalMethod)} | ${escapeCell(r.selectedMethod)} | ${escapeCell(formatMethodCounts(r.selectedMethodCounts))} | ${r.fileCount} | ${escapeCell(r.verification)} | ${escapeCell(r.status)} | ${escapeCell(r.reason)} |`)
    .join('\n');

  const candidateText = [
    '- original ZIP bytes retained as the baseline',
    '- STORE: method 0, no compression',
    '- DEFLATE-level-6: method 8 via Node zlib raw DEFLATE level 6',
    '- DEFLATE-level-9: method 8 via Node zlib raw DEFLATE level 9',
    '- mixed-STORE-DEFLATE-level-9: per-entry method 8 only when smaller than STORE, otherwise method 0'
  ].join('\n');

  return `# Bundle ZIP Recompression Audit (${REPORT_DATE})

## Scope

- Targeted only \`${BUNDLE_ROOT}/**/*.zip\`.
- Treated each existing ZIP as the source of truth.
- Did not run BCU asset generation scripts and did not transform PNG, JPG, audio, JSON, CSV, imgcut, mamodel, or maanim payloads.
- Rebuilt only ZIP containers from decompressed existing entries.
- Verified extracted relative path, file count, uncompressed size, and SHA-256 before adopting a candidate.
- Runtime behavior remains unchanged. \`js/bcu/SemanticAssetProvider.js\` already reads ZIP method 0 (STORE) and method 8 (DEFLATE), so no loader change was needed.
- \`scripts/bcu-semantic-utils.mjs\` also reads method 0 and method 8 for Node checks.

## Compression Candidates

${candidateText}

Adopted candidate rule: use the smallest candidate whose manifest matched the original and whose ZIP bytes were smaller than the original. Ties prefer lower runtime risk. Exotic ZIP methods were not considered.

## Summary

| ZIP count | Original bytes | New bytes | Saved bytes | Reduction |
| ---: | ---: | ---: | ---: | ---: |
| ${summary.totalZipCount} | ${summary.totalOriginalBytes} | ${summary.totalNewBytes} | ${summary.totalSavedBytes} | ${summary.totalReductionPercent.toFixed(4)}% |

Status counts: ${Object.entries(summary.byStatus).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join(', ')}

## Category Summary

| Category | ZIP count | Changed | Original bytes | New bytes | Saved bytes | Reduction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${categoryRows}

## Per-ZIP Results

| ZIP path | Original bytes | New bytes | Saved bytes | Reduction | Original method | Adopted method | Adopted entry methods | File count | Verification | Status | Reason |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- | ---: | --- | --- | --- |
${zipRows}

## Notes

- The generated bundle manifest was not regenerated because this task did not regenerate assets or indexes, and runtime loading uses the manifest for bundle presence rather than size/hash validation.
- Temporary extraction directories used during verification are created under the OS temp directory and removed by the script.
- Script invocation mode: ${options.apply ? 'apply' : 'dry-run'}; temp verification: ${options.tempVerify ? 'enabled' : 'disabled'}.
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let zipPaths = options.zip.length ? options.zip.map(ensureBundleZipPath) : await walkZipFiles(BUNDLE_ROOT);
  if (options.limit != null) zipPaths = zipPaths.slice(0, options.limit);

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'bcu-bundle-rezip-'));
  const results = [];
  try {
    for (let i = 0; i < zipPaths.length; i += 1) {
      const zipPath = zipPaths[i];
      try {
        const result = await evaluateZip(zipPath, options, tempRoot, i);
        results.push(result);
        console.log(`${result.zipPath}\toriginal=${result.originalBytes}\tnew=${result.newBytes}\tsaved=${result.savedBytes}\treduction=${result.reductionPercent.toFixed(4)}%\tmethod=${result.selectedMethod}\tfiles=${result.fileCount}\tverification=${result.verification}\tstatus=${result.status}`);
      } catch (error) {
        results.push({
          zipPath,
          status: 'error',
          reason: error.message,
          originalBytes: 0,
          newBytes: 0,
          savedBytes: 0,
          reductionPercent: 0,
          originalMethod: 'unknown',
          selectedMethod: 'none',
          fileCount: 0,
          verification: 'error',
          candidates: []
        });
        console.error(`${zipPath}\terror=${error.message}`);
      }
    }
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }

  const summary = summarize(results);
  const report = { schemaVersion: 1, generatedAt: REPORT_DATE, scope: `${BUNDLE_ROOT}/**/*.zip`, options, summary, results };
  if (options.json) {
    await fs.mkdir(path.dirname(options.json), { recursive: true });
    await fs.writeFile(options.json, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (options.report) {
    await fs.mkdir(path.dirname(options.report), { recursive: true });
    await fs.writeFile(options.report, makeMarkdownReport(results, summary, options));
  }

  console.log(`summary\tzips=${summary.totalZipCount}\toriginal=${summary.totalOriginalBytes}\tnew=${summary.totalNewBytes}\tsaved=${summary.totalSavedBytes}\treduction=${summary.totalReductionPercent.toFixed(4)}%\tstatuses=${JSON.stringify(summary.byStatus)}`);
  if (results.some((result) => result.status === 'error')) process.exitCode = 1;
}

await main();
