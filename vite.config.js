import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { defineConfig } from 'vite';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_ASSETS_DIR = path.join(ROOT, 'public', 'assets');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_ASSETS_DIR = path.join(ROOT, 'dist', 'assets');

// Root-level runtime configs fetched by the app via a document-relative path
// (BcuBootLoader.loadPlayableErrorConfig -> readText('error-*.json') ->
// `./error-*.json`). They are NOT under public/assets, so the build must copy
// them into dist/ or production 404s and the formation roster keeps every
// error/missing enemy and ally visible. Node tests read the same files from cwd,
// so the source location and path string stay unchanged.
const ROOT_RUNTIME_FILES = ['error-enemy.json', 'error-ally.json', 'manifest.webmanifest', 'sw.js'];

// Keep emitted URLs relative so the same dist works both at Cloudflare Pages'
// domain root and under GitHub Pages' /rhg/ project path.
const BASE = './';
const BASE_PATH_PREFIX = BASE.startsWith('/') ? BASE.replace(/\/$/, '') : '';
const DIST_ASSET_SIZE_LIMIT = 25_000_000;
// Small shards keep the first formation-screen enemy icons (enemy/000...) on a
// download comparable to the ~4.4MB unit icon zips; a single 24MB shard left
// dog icons blank for seconds after boot while cat icons were already visible.
const DIST_ICON_SHARD_TARGET_BYTES = 4_000_000;
const ENEMY_ICON_BUNDLE_PATH = 'public/assets/bundles/icon/enemy.zip';
const ENEMY_ICON_ASSET_PATH = 'bundles/icon/enemy.zip';
const DIST_GENERATED_SKIP_ASSETS = new Set([
  'generated/bcu-asset-audit.json'
]);
const DIST_GENERATED_SLIM_REPLACEMENTS = new Map([
  ['generated/bcu-background-index.json', 'generated/bcu-background-index.slim.json']
]);

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.m4a', 'audio/mp4'],
  ['.otf', 'font/otf'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ttf', 'font/ttf'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.zip', 'application/zip']
]);

function isBlockedAssetPath(assetPath) {
  const normalized = assetPath.replace(/\\/g, '/').replace(/^\/+/, '');
  return normalized === 'bcu'
    || normalized.startsWith('bcu/')
    || normalized === 'bcu-manifest.json';
}

function isSkippedDistAssetPath(assetPath) {
  const normalized = assetPath.replace(/\\/g, '/').replace(/^\/+/, '');
  return DIST_GENERATED_SKIP_ASSETS.has(normalized);
}

function readU16(buf, off) { return buf.readUInt16LE(off); }
function readU32(buf, off) { return buf.readUInt32LE(off); }

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(v) { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; }
function u32(v) { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b; }

async function readZipEntries(zipPath) {
  const bytes = await readFile(zipPath);
  const files = [];
  let offset = 0;
  while (offset + 30 <= bytes.length && readU32(bytes, offset) === 0x04034b50) {
    const method = readU16(bytes, offset + 8);
    const compressedSize = readU32(bytes, offset + 18);
    const uncompressedSize = readU32(bytes, offset + 22);
    const nameLen = readU16(bytes, offset + 26);
    const extraLen = readU16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) throw new Error(`Truncated ZIP entry at ${zipPath}`);
    const name = bytes.subarray(nameStart, nameStart + nameLen).toString('utf8');
    const compressed = bytes.subarray(dataStart, dataEnd);
    let data;
    if (method === 0) {
      if (compressedSize !== uncompressedSize) throw new Error(`Invalid STORE ZIP sizes at ${zipPath}`);
      data = compressed;
    } else if (method === 8) {
      data = inflateRawSync(compressed);
      if (uncompressedSize !== 0 && data.length !== uncompressedSize) {
        throw new Error(`Invalid DEFLATE ZIP size for ${name} at ${zipPath}: expected ${uncompressedSize}, got ${data.length}`);
      }
    } else {
      throw new Error(`Unsupported ZIP compression method ${method} at ${zipPath}`);
    }
    files.push({ name, data });
    offset = dataEnd;
  }
  return files;
}

function storedZipSize(entries) {
  let size = 22;
  for (const entry of entries) {
    const nameLength = Buffer.byteLength(entry.name.replace(/\\/g, '/'));
    size += 30 + nameLength + entry.data.length;
    size += 46 + nameLength;
  }
  return size;
}

function createStoreZipBuffer(entries) {
  let offset = 0;
  const locals = [];
  const centrals = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/\\/g, '/'));
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const crc = crc32(data);
    const local = Buffer.concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
    locals.push(local);
    centrals.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += local.length;
  }
  const central = Buffer.concat(centrals);
  const eocd = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(central.length), u32(offset), u16(0)]);
  return Buffer.concat([...locals, central, eocd]);
}

async function ensureEnemyIconShards(state) {
  if (state.enemyIconShardMap) return state.enemyIconShardMap;
  const sourceZip = path.join(PUBLIC_ASSETS_DIR, ENEMY_ICON_ASSET_PATH);
  const targetDir = path.join(DIST_ASSETS_DIR, 'bundles', 'icon');
  await mkdir(targetDir, { recursive: true });
  const allEntries = (await readZipEntries(sourceZip)).sort((a, b) => a.name.localeCompare(b.name));
  // enemy.zip ships duplicate unpadded names (enemy/7.png == enemy/007.png) for
  // ids < 100. The runtime only requests the padded form (icon index entries and
  // SemanticAssetProvider's inferred canonical entry both use pad3), so shipping
  // the duplicates would only bloat the first shard.
  const byName = new Map(allEntries.map((entry) => [entry.name, entry]));
  const entries = allEntries.filter((entry) => {
    const short = entry.name.match(/^enemy\/(\d{1,2})\.png$/);
    if (!short) return true;
    const padded = byName.get(`enemy/${short[1].padStart(3, '0')}.png`);
    return !(padded && Buffer.compare(padded.data, entry.data) === 0);
  });
  const shards = [];
  let current = [];
  for (const entry of entries) {
    const candidate = [...current, entry];
    if (current.length > 0 && storedZipSize(candidate) > DIST_ICON_SHARD_TARGET_BYTES) {
      shards.push(current);
      current = [entry];
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) shards.push(current);

  const shardMap = new Map();
  for (let i = 0; i < shards.length; i += 1) {
    const fileName = `enemy-${i}.zip`;
    const bundlePath = `public/assets/bundles/icon/${fileName}`;
    const zip = createStoreZipBuffer(shards[i]);
    if (zip.length > DIST_ASSET_SIZE_LIMIT) {
      throw new Error(`${bundlePath} is ${zip.length} bytes, above ${DIST_ASSET_SIZE_LIMIT}`);
    }
    await writeFile(path.join(targetDir, fileName), zip);
    for (const entry of shards[i]) shardMap.set(entry.name, bundlePath);
  }
  state.enemyIconShardMap = shardMap;
  state.enemyIconShardPaths = shards.map((_, i) => `public/assets/bundles/icon/enemy-${i}.zip`);
  return shardMap;
}

async function writeDistIconIndex(sourcePath, targetPath, state) {
  const shardMap = await ensureEnemyIconShards(state);
  const index = JSON.parse(await readFile(sourcePath, 'utf8'));
  const entries = (index.entries || []).map((entry) => {
    if (entry?.bundleRef?.bundlePath !== ENEMY_ICON_BUNDLE_PATH) return entry;
    const shardPath = shardMap.get(entry.internalPath);
    if (!shardPath) return entry;
    return { ...entry, bundleRef: { ...entry.bundleRef, bundlePath: shardPath } };
  });
  // Enemies whose icon exists only as a generated composed PNG (no audited raw
  // enemy_icon source, e.g. enemy:388) have no icon-index entry. In dev the
  // runtime falls back to the aggregate enemy.zip, but dist ships only shards,
  // so without an explicit entry those icons 404 and render transparent.
  const indexedKeys = new Set(entries.map((entry) => entry?.key).filter(Boolean));
  for (const [internalPath, shardPath] of shardMap) {
    const match = internalPath.match(/^enemy\/(\d{3})\.png$/);
    if (!match) continue;
    const id = Number(match[1]);
    const key = `enemy:${id}`;
    if (indexedKeys.has(key)) continue;
    indexedKeys.add(key);
    entries.push({
      key,
      kind: 'enemy',
      id,
      id3: match[1],
      bundleRef: { bundleKey: 'icon:enemy', bundlePath: shardPath },
      internalPath,
      sourceStatus: 'generated-composed-icon-entry'
    });
  }
  index.entries = entries;
  index.byKey = Object.fromEntries(entries.map((entry) => [entry.key, entry]));
  index.aggregateBundles = [
    ...(state.enemyIconShardPaths || []).map((bundlePath, i) => ({ bundleKey: `icon:enemy:${i}`, bundlePath })),
    ...(index.aggregateBundles || []).filter((bundle) => bundle?.bundlePath !== ENEMY_ICON_BUNDLE_PATH)
  ];
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(index, null, 2)}\n`);
}

async function writeDistBundleManifest(sourcePath, targetPath, state) {
  await ensureEnemyIconShards(state);
  const manifest = JSON.parse(await readFile(sourcePath, 'utf8'));
  if (manifest?.bundles?.['icon:enemy']) {
    delete manifest.bundles['icon:enemy'];
    for (const bundlePath of state.enemyIconShardPaths || []) {
      const key = `icon:enemy:${bundlePath.match(/enemy-(\d+)\.zip$/)?.[1] || '0'}`;
      manifest.bundles[key] = {
        kind: 'icon',
        key,
        bundlePath,
        status: 'full',
        sourceBundleKey: 'icon:enemy'
      };
    }
  }
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function contentTypeFor(filePath) {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

function parseRange(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader || ''));
  if (!match) return null;
  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;
  if (!match[1] && match[2]) {
    const suffix = Number(match[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

function selectedPublicAssetsPlugin() {
  return {
    name: 'rhg-selected-public-assets',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        // Strip an absolute Vite base when one is configured; relative builds
        // have no fixed request prefix.
        let pathname = decodeURIComponent(url.pathname);
        if (BASE_PATH_PREFIX && (pathname === BASE_PATH_PREFIX || pathname.startsWith(BASE_PATH_PREFIX + '/'))) {
          pathname = pathname.slice(BASE_PATH_PREFIX.length) || '/';
        }
        const fromAssets = pathname.startsWith('/assets/') ? pathname.slice('/assets/'.length) : null;
        const fromLegacyPublic = pathname.startsWith('/public/assets/') ? pathname.slice('/public/assets/'.length) : null;
        const assetPath = fromAssets || fromLegacyPublic;
        if (!assetPath) return next();
        if (isBlockedAssetPath(assetPath)) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        const filePath = path.resolve(PUBLIC_ASSETS_DIR, assetPath);
        if (!filePath.startsWith(PUBLIC_ASSETS_DIR + path.sep)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        try {
          const info = await stat(filePath);
          if (!info.isFile()) return next();
          const headers = {
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache',
            'Content-Type': contentTypeFor(filePath)
          };
          if (req.method === 'HEAD') {
            res.writeHead(200, { ...headers, 'Content-Length': info.size });
            res.end();
            return;
          }
          const range = parseRange(req.headers.range, info.size);
          if (range) {
            res.writeHead(206, {
              ...headers,
              'Content-Length': range.end - range.start + 1,
              'Content-Range': `bytes ${range.start}-${range.end}/${info.size}`
            });
            createReadStream(filePath, range).pipe(res);
            return;
          }
          res.writeHead(200, { ...headers, 'Content-Length': info.size });
          createReadStream(filePath).pipe(res);
        } catch {
          next();
        }
      });
    },
    async closeBundle() {
      await mkdir(DIST_ASSETS_DIR, { recursive: true });
      await copySelectedPublicAssets(PUBLIC_ASSETS_DIR, DIST_ASSETS_DIR, '', {});
      await mkdir(DIST_DIR, { recursive: true });
      for (const name of ROOT_RUNTIME_FILES) {
        try {
          await copyFile(path.join(ROOT, name), path.join(DIST_DIR, name));
        } catch (error) {
          this.warn?.(`failed to copy root runtime file ${name}: ${error?.message || error}`);
        }
      }
      try {
        const indexPath = path.join(DIST_DIR, 'index.html');
        const html = await readFile(indexPath, 'utf8');
        const next = html.replace(
          /(<link\s+rel="manifest"\s+href=")(?:\.\/)?assets\/manifest-[^"]+\.webmanifest(")/,
          '$1./manifest.webmanifest$2'
        );
        if (next !== html) await writeFile(indexPath, next);
      } catch (error) {
        this.warn?.(`failed to normalize manifest link in dist/index.html: ${error?.message || error}`);
      }
    }
  };
}

async function copySelectedPublicAssets(sourceDir, targetDir, rel = '', state = {}) {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (isBlockedAssetPath(childRel)) continue;
    if (isSkippedDistAssetPath(childRel)) continue;
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copySelectedPublicAssets(sourcePath, targetPath, childRel, state);
    } else if (entry.isFile()) {
      await mkdir(path.dirname(targetPath), { recursive: true });
      if (childRel === ENEMY_ICON_ASSET_PATH) {
        await ensureEnemyIconShards(state);
      } else if (childRel === 'generated/bcu-icon-index.json') {
        await writeDistIconIndex(sourcePath, targetPath, state);
      } else if (childRel === 'generated/bcu-bundle-manifest.json') {
        await writeDistBundleManifest(sourcePath, targetPath, state);
      } else if (DIST_GENERATED_SLIM_REPLACEMENTS.has(childRel)) {
        await copyFile(path.join(PUBLIC_ASSETS_DIR, DIST_GENERATED_SLIM_REPLACEMENTS.get(childRel)), targetPath);
      } else {
        await copyFile(sourcePath, targetPath);
      }
    }
  }
}

export default defineConfig({
  base: BASE,
  publicDir: false,
  plugins: [selectedPublicAssetsPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(ROOT, 'index.html')
    }
  }
});
