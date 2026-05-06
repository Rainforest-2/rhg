import { fetchBcuText } from './BcuText.js';
import { parseImgcut } from './BcuImgcutParser.js';
import { parseModel } from './BcuModelParser.js';
import { parseAnim } from './BcuAnimParser.js';

const cache = new Map();
const counters={assetSetRequested:0,assetSetCacheHit:0,imageRequested:0,imageCacheHit:0,animationRequested:0,animationCacheHit:0};
const animationCache=new Map();
const imageCache=new Map();

function asArray(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]); }
function join(base, file) { return `${base}${file}`; }

function isNotFoundError(e) { return String(e.message || '').includes('HTTP 404'); }

function loadImage(url) {
  counters.imageRequested++;
  if(imageCache.has(url)){ counters.imageCacheHit++; return imageCache.get(url); }
  const p=new Promise((res, rej) => {
    const img = new Image();
    img.onload = async () => { try { if (typeof img.decode === "function") await img.decode(); } catch(_e) {} res(img); };
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
    counters.assetSetRequested++;
    if (cache.has(def.id)) { counters.assetSetCacheHit++; return await cache.get(def.id); }
    const p=this.loadAssetSetUncached(def);
    cache.set(def.id,p);
    try{return await p;}catch(e){cache.delete(def.id); throw e;}
  }

  async loadAssetSetUncached(def) {
    const r = { loaded: [], missing: [], errors: [], status: { image: 'missing', imgcut: 'missing', model: 'missing' }, imageFile: null, imgcutFile: null, modelFile: null, renderMode: def.renderMode || 'model', modelRequired: def.model != null && (def.renderMode || 'model') !== 'static-imgcut', animationRequired: (def.renderMode || 'model') === 'model' && (def.animations?.length || 0) > 0 };

    const [img,ic,md] = await Promise.allSettled([
      tryLoadImage(def.baseDir, def.image),
      tryLoadText(def.baseDir, def.imgcut, parseImgcut, "imgcut"),
      def.model == null ? Promise.resolve({skip:true}) : tryLoadText(def.baseDir, def.model, parseModel, "model")
    ]);
    const imgv=img.status==='fulfilled'?img.value:{ok:false,tried:[]};
    const icv=ic.status==='fulfilled'?ic.value:{ok:false,error:String(ic.reason),tried:[]};
    const mdv=md.status==='fulfilled'?md.value:{ok:false,error:String(md.reason),tried:[]};

    const imgRes = imgv;
    if (imgRes.ok) { r.image = imgRes.image; r.imageFile = imgRes.file; r.loaded.push(imgRes.file); r.status.image = 'loaded'; }
    else { r.missing.push(...imgRes.tried); r.status.image = 'missing'; }

    const icRes = icv;
    if (icRes.ok) { r.imgcut = icRes.parsed; r.imgcutFile = icRes.file; r.loaded.push(icRes.file); r.status.imgcut = 'loaded'; }
    else if (icRes.error) { r.errors.push(icRes.error); r.status.imgcut = 'error'; } else { r.missing.push(...icRes.tried); r.status.imgcut = 'missing'; }

    if (def.model == null) {
      r.status.model = 'skipped';
    } else {
      const mdRes = mdv;
      if (mdRes.ok) { r.model = mdRes.parsed; r.modelFile = mdRes.file; r.loaded.push(mdRes.file); r.status.model = 'loaded'; }
      else if (mdRes.error) { r.errors.push(mdRes.error); r.status.model = 'error'; }
      else {
        r.status.model = 'missing';
        if (r.modelRequired) r.missing.push(...mdRes.tried);
      }
    }

    return r;
  }

  async loadAnimation(def, animDef) {
    if (!animDef) return { loaded: [], missing: [], errors: [], file: null, anim: null, status: 'skipped' };
    counters.animationRequested++;
    const files = asArray(animDef.file);
    for (const file of files) {
      const key=`${def.id}:${file}`;
      if(animationCache.has(key)){ counters.animationCacheHit++; return await animationCache.get(key); }
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
export function __getBcuAssetCaches(){return {assetSetCacheSize:cache.size,animationCacheSize:animationCache.size,imageCacheSize:imageCache.size,counters,cache,animationCache,imageCache};}
