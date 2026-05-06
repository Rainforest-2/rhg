import { fetchBcuText } from './BcuText.js';
import { parseImgcut } from './BcuImgcutParser.js';
import { parseModel } from './BcuModelParser.js';
import { parseAnim } from './BcuAnimParser.js';

const cache = new Map();
const animationCache=new Map();
const imageCache=new Map();

function asArray(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]); }
function join(base, file) { return `${base}${file}`; }

function isNotFoundError(e) { return String(e.message || '').includes('HTTP 404'); }

function loadImage(url) {
  if(imageCache.has(url)) return imageCache.get(url);
  const p=new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(`Image load failed: ${url}`));
    img.src = url;
  });
  imageCache.set(url,p);
  return p;
}

async function tryLoadText(baseDir, candidates, parser, field) {
  const tried = [];
  for (const file of asArray(candidates)) {
    const url = join(baseDir, file);
    tried.push(file);
    try {
      const parsed = parser(await fetchBcuText(url));
      return { ok: true, file, parsed, tried };
    } catch (e) {
      if (!isNotFoundError(e)) return { ok: false, file, error: `${field} parse error ${file}: ${e.message}`, tried };
    }
  }
  return { ok: false, missing: true, tried };
}

async function tryLoadImage(baseDir, candidates) {
  const tried = [];
  for (const file of asArray(candidates)) {
    tried.push(file);
    try { return { ok: true, file, image: await loadImage(join(baseDir, file)), tried }; } catch (_e) {}
  }
  return { ok: false, missing: true, tried };
}

export class BcuAssetLoader {
  async loadAssetSet(def) {
    if (cache.has(def.id)) return cache.get(def.id);
    const r = { loaded: [], missing: [], errors: [], status: { image: 'missing', imgcut: 'missing', model: 'missing' }, imageFile: null, imgcutFile: null, modelFile: null, renderMode: def.renderMode || 'model', modelRequired: def.model != null && (def.renderMode || 'model') !== 'static-imgcut', animationRequired: (def.renderMode || 'model') === 'model' && (def.animations?.length || 0) > 0 };

    const img = await tryLoadImage(def.baseDir, def.image);
    if (img.ok) { r.image = img.image; r.imageFile = img.file; r.loaded.push(img.file); r.status.image = 'loaded'; }
    else { r.missing.push(...img.tried); r.status.image = 'missing'; }

    const ic = await tryLoadText(def.baseDir, def.imgcut, parseImgcut, 'imgcut');
    if (ic.ok) { r.imgcut = ic.parsed; r.imgcutFile = ic.file; r.loaded.push(ic.file); r.status.imgcut = 'loaded'; }
    else if (ic.error) { r.errors.push(ic.error); r.status.imgcut = 'error'; } else { r.missing.push(...ic.tried); r.status.imgcut = 'missing'; }

    if (def.model == null) {
      r.status.model = 'skipped';
    } else {
      const md = await tryLoadText(def.baseDir, def.model, parseModel, 'model');
      if (md.ok) { r.model = md.parsed; r.modelFile = md.file; r.loaded.push(md.file); r.status.model = 'loaded'; }
      else if (md.error) { r.errors.push(md.error); r.status.model = 'error'; }
      else {
        r.status.model = 'missing';
        if (r.modelRequired) r.missing.push(...md.tried);
      }
    }

    cache.set(def.id, r);
    return r;
  }

  async loadAnimation(def, animDef) {
    if (!animDef) return { loaded: [], missing: [], errors: [], file: null, anim: null, status: 'skipped' };
    const files = asArray(animDef.file);
    for (const file of files) {
      const key=`${def.id}:${file}`;
      if(animationCache.has(key)) return animationCache.get(key);
      const p=(async()=>{
        try {
          const anim = parseAnim(await fetchBcuText(`${def.baseDir}${file}`));
          return { loaded: [file], missing: [], errors: [], file, anim, status: 'loaded' };
        } catch (e) {
          if (isNotFoundError(e)) return null;
          throw e;
        }
      })();
      animationCache.set(key,p);
      try{ const r=await p; if(r) return r; animationCache.delete(key);}catch(e){animationCache.delete(key); return { loaded: [], missing: [], errors: [`${file}: ${e.message}`], file, anim: null, status: 'error' }; }
    }
    return { loaded: [], missing: files, errors: [], file: files[0], anim: null, status: 'missing' };
  }
}
export function __getBcuAssetCaches(){return {cache,animationCache,imageCache};}
