import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_ASSETS_DIR = path.join(ROOT, 'public', 'assets');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_ASSETS_DIR = path.join(ROOT, 'dist', 'assets');

// Root-level runtime configs fetched by the app via a web-root-relative path
// (BcuBootLoader.loadPlayableErrorConfig -> readText('error-*.json') ->
// `./error-*.json` -> /rhg/error-*.json). They are NOT under public/assets, so the
// build must copy them into dist/ or production 404s and the formation roster keeps
// every error/missing enemy and ally visible. Node tests read the same files from
// cwd, so the source location and path string stay unchanged.
const ROOT_RUNTIME_FILES = ['error-enemy.json', 'error-ally.json'];

// GitHub Pages serves this project under https://<user>.github.io/rhg/, so every
// emitted URL (entry chunk, hashed CSS, public assets, in-HTML/CSS references)
// must carry the /rhg/ base. The same base is used for `vite dev` and
// `vite preview` so dev, preview and the Pages build resolve identical paths;
// runtime asset URLs read it back via import.meta.env.BASE_URL (js/assetBase.js).
const BASE = '/rhg/';
const BASE_PREFIX = BASE.replace(/\/$/, ''); // '/rhg'

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
        // Requests arrive base-prefixed (e.g. /rhg/assets/...) under `vite dev`;
        // strip the base so the asset lookup below stays base-agnostic.
        let pathname = decodeURIComponent(url.pathname);
        if (pathname === BASE_PREFIX || pathname.startsWith(BASE_PREFIX + '/')) {
          pathname = pathname.slice(BASE_PREFIX.length) || '/';
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
      await copySelectedPublicAssets(PUBLIC_ASSETS_DIR, DIST_ASSETS_DIR);
      await mkdir(DIST_DIR, { recursive: true });
      for (const name of ROOT_RUNTIME_FILES) {
        try {
          await copyFile(path.join(ROOT, name), path.join(DIST_DIR, name));
        } catch (error) {
          this.warn?.(`failed to copy root runtime file ${name}: ${error?.message || error}`);
        }
      }
    }
  };
}

async function copySelectedPublicAssets(sourceDir, targetDir, rel = '') {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (isBlockedAssetPath(childRel)) continue;
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copySelectedPublicAssets(sourcePath, targetPath, childRel);
    } else if (entry.isFile()) {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
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
